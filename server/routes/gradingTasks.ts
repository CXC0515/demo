/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { AnalysisEvidenceRef, CalibrationSample, FirstSectionAnalysis, TrialGradingResult, VisionValidationResult } from '../../src/domain/types';
import { getModelConfig, isModelConfigured } from '../config/modelConfig';
import { deleteFirstSectionAnalysis, getFirstSectionAnalysis, saveFirstSectionAnalysis } from '../repositories/analysisRepository';
import { getMaterials, replaceMaterialsForKind, StoredMaterial, updateMaterial } from '../repositories/materialRepository';
import { getTaskRubrics, saveTaskRubric } from '../repositories/gradingRubricRepository';
import { getParserArtifact } from '../repositories/parserArtifactRepository';
import { deleteTrialGradingResult, getTrialGradingResult, saveTrialGradingResult } from '../repositories/trialGradingRepository';
import { getVisionValidationResult, NON_CHOICE_RECOGNITION_VERSION, saveVisionValidationResult } from '../repositories/visionValidationRepository';
import { paddleParserArtifactSchema, visionValidationRequestSchema } from '../schemas/paddleParserArtifact';
import { trialGradingRequestSchema } from '../schemas/trialGrading';
import { gradingRubricInputSchema } from '../schemas/gradingRubric';
import { OpenAICompatibleQuestionAnalyzer } from '../services/analysis/OpenAICompatibleQuestionAnalyzer';
import { resolveSourceEvidence } from '../services/evidence/sourceEvidenceResolver';
import { OpenAICompatibleTrialGrader } from '../services/grading/OpenAICompatibleTrialGrader';
import { OpenAICompatibleVisionRecognizer } from '../services/grading/OpenAICompatibleVisionRecognizer';
import { OpenAICompatibleVisionRegionLocator } from '../services/grading/OpenAICompatibleVisionRegionLocator';
import { createVisionLocatedRegions } from '../services/grading/questionRegionCropper';
import { getObservedAnswer, hasSuspiciousRepeatedShortAnswer, recognitionTextsConflict, resolveTrialConfidence, resolveTrialScore, trialNeedsTeacherReview } from '../services/grading/trialScore';
import { buildExpectedAnswerFields } from '../services/grading/answerFieldSchema';
import { MaterialParserError } from '../services/materials/MaterialParser';
import { parseMaterial } from '../services/materials/materialParserRegistry';

const router = Router();
const supportedExtensions = new Set(['.docx', '.pdf', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.tif', '.tiff']);
const decodeUploadFileName = (fileName: string) => {
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? fileName : decoded;
};
const upload = multer({
  dest: 'var/uploads',
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (_request, file, callback) => callback(null,
    file.mimetype === 'application/pdf'
    || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || file.mimetype.startsWith('image/')
    || file.mimetype.startsWith('text/')
    || supportedExtensions.has(path.extname(file.originalname).toLowerCase()))
});

const knowledgeCatalogSchema = z.array(z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string()
})).max(2000);

const evidenceCropQuerySchema = z.object({
  page: z.coerce.number().int().positive(),
  x: z.coerce.number().min(0).max(1),
  y: z.coerce.number().min(0).max(1),
  width: z.coerce.number().positive().max(1),
  height: z.coerce.number().positive().max(1)
});

const getTopLevelNumber = (value?: string) => value?.match(/^\s*(\d+)/)?.[1];

interface ReferenceAnswerUnit {
  displayNo: string;
  standardAnswer: string;
  answerSource?: AnalysisEvidenceRef | null;
}

const completeReferenceAnswer = <T extends ReferenceAnswerUnit>(unit: T, materials: StoredMaterial[]): T => {
  const displayNo = getTopLevelNumber(unit.displayNo);
  const source = unit.answerSource;
  if (!displayNo || !source) return unit;
  const material = materials.find(item => item.id === source.assetId && item.kind === 'reference-answer');
  const blocks = material?.normalizedDocument?.blocks;
  if (!material || !blocks?.length) return unit;
  const start = blocks.findIndex(block => getTopLevelNumber(block.listLabel) === displayNo);
  if (start < 0) return unit;
  let end = start + 1;
  while (end < blocks.length && !getTopLevelNumber(blocks[end].listLabel)) end += 1;
  const answerBlocks = blocks.slice(start, end);
  const completeAnswer = answerBlocks.map(block => block.text.trim()).filter(Boolean).join('\n');
  if (!completeAnswer) return unit;
  return {
    ...unit,
    standardAnswer: completeAnswer,
    answerSource: {
      assetKind: 'reference-answer',
      assetId: material.id,
      fileName: material.fileName,
      blockIds: answerBlocks.map(block => block.id),
      quote: completeAnswer
    }
  };
};

const toPublicAsset = ({ diskPath: _diskPath, normalizedDocument: _normalizedDocument, ...asset }: StoredMaterial) => asset;

const parseUploadedMaterial = async (material: StoredMaterial) => {
  updateMaterial(material.taskId, material.id, { status: 'processing', parseErrorCode: undefined });
  try {
    const normalizedDocument = await parseMaterial({
      assetId: material.id,
      fileName: material.fileName,
      mimeType: material.mimeType,
      filePath: material.diskPath
    });
    updateMaterial(material.taskId, material.id, {
      status: normalizedDocument.warnings.length ? 'needs-review' : 'ready',
      pageCount: normalizedDocument.pageCount,
      normalizedDocument
    });
  } catch (error) {
    const code = error instanceof MaterialParserError ? error.code : 'MATERIAL_PARSE_FAILED';
    console.error(JSON.stringify({ event: 'material_parse_failed', taskId: material.taskId, materialId: material.id, code }));
    updateMaterial(material.taskId, material.id, { status: 'failed', parseErrorCode: code });
  }
};

router.get('/:taskId/materials', (request, response) => {
  const materials = getMaterials(request.params.taskId);
  response.json({
    assets: materials.map(toPublicAsset),
    documents: materials.flatMap(material => material.normalizedDocument ? [material.normalizedDocument] : [])
  });
});

router.get('/:taskId/rubrics', (request, response) => {
  response.json({ rubrics: getTaskRubrics(request.params.taskId) });
});

router.put('/:taskId/rubrics/:questionId', (request, response) => {
  const parsed = gradingRubricInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_GRADING_RUBRIC' });
    return;
  }
  const rubric = saveTaskRubric({
    taskId: request.params.taskId,
    questionId: request.params.questionId,
    ...parsed.data,
    updatedAt: new Date().toISOString()
  });
  response.json({ rubric });
});

router.get('/:taskId/materials/:assetId/content', (request, response) => {
  const material = getMaterials(request.params.taskId).find(item => item.id === request.params.assetId);
  if (!material) {
    response.status(404).json({ code: 'MATERIAL_NOT_FOUND' });
    return;
  }
  response.type(material.mimeType);
  response.sendFile(path.resolve(material.diskPath));
});

router.get('/:taskId/materials/:assetId/evidence-crop', async (request, response) => {
  const parsed = evidenceCropQuerySchema.safeParse(request.query);
  const material = getMaterials(request.params.taskId).find(item => item.id === request.params.assetId);
  const document = material?.normalizedDocument;
  if (!parsed.success || !material || !document) {
    response.status(parsed.success ? 404 : 400).json({ code: parsed.success ? 'MATERIAL_NOT_FOUND' : 'INVALID_EVIDENCE_REGION' });
    return;
  }
  const sourcePage = document.resources.find(resource => resource.role === 'source-page' && (resource.pageNumber ?? 1) === parsed.data.page);
  if (!sourcePage) {
    response.status(404).json({ code: 'SOURCE_PAGE_NOT_FOUND' });
    return;
  }
  try {
    const sourcePath = path.resolve('var/uploads/parsed', material.id, 'resources', sourcePage.fileName);
    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('SOURCE_PAGE_DIMENSIONS_MISSING');
    const left = Math.max(0, Math.floor(parsed.data.x * metadata.width));
    const top = Math.max(0, Math.floor(parsed.data.y * metadata.height));
    const width = Math.max(1, Math.min(metadata.width - left, Math.ceil(parsed.data.width * metadata.width)));
    const height = Math.max(1, Math.min(metadata.height - top, Math.ceil(parsed.data.height * metadata.height)));
    const buffer = await image.extract({ left, top, width, height }).jpeg({ quality: 94 }).toBuffer();
    response.type('image/jpeg').send(buffer);
  } catch {
    response.status(500).json({ code: 'EVIDENCE_CROP_FAILED' });
  }
});

router.post('/:taskId/materials/:assetId/reparse', async (request, response) => {
  const material = getMaterials(request.params.taskId).find(item => item.id === request.params.assetId);
  if (!material) {
    response.status(404).json({ code: 'MATERIAL_NOT_FOUND' });
    return;
  }
  await parseUploadedMaterial(material);
  const updated = getMaterials(request.params.taskId).find(item => item.id === request.params.assetId);
  response.json({ asset: updated ? toPublicAsset(updated) : toPublicAsset(material) });
});

router.get('/:taskId/vision-validation/:assetId', (request, response) => {
  const result = getVisionValidationResult(request.params.taskId, request.params.assetId);
  if (!result) {
    response.status(404).json({ code: 'VISION_VALIDATION_NOT_FOUND' });
    return;
  }
  response.json({ result });
});

router.post('/:taskId/vision-validation', async (request, response) => {
  const parsedRequest = visionValidationRequestSchema.safeParse(request.body);
  if (!parsedRequest.success) {
    response.status(400).json({ code: 'INVALID_VISION_VALIDATION_REQUEST' });
    return;
  }
  const config = getModelConfig();
  if (!isModelConfigured(config)) {
    response.status(503).json({ code: 'MODEL_NOT_CONFIGURED' });
    return;
  }
  let material = getMaterials(request.params.taskId).find(item => item.id === parsedRequest.data.assetId && item.kind === 'student-submission');
  const analysis = getFirstSectionAnalysis(request.params.taskId);
  let parsedArtifact = paddleParserArtifactSchema.safeParse(getParserArtifact(parsedRequest.data.assetId));
  if (material && !parsedArtifact.success) {
    await parseUploadedMaterial(material);
    material = getMaterials(request.params.taskId).find(item => item.id === parsedRequest.data.assetId && item.kind === 'student-submission');
    parsedArtifact = paddleParserArtifactSchema.safeParse(getParserArtifact(parsedRequest.data.assetId));
  }
  const sourceResources = material?.normalizedDocument?.resources
    .filter(resource => resource.role === 'source-page')
    .map((resource, index) => ({ ...resource, pageNumber: resource.pageNumber ?? index + 1 }))
    .sort((first, second) => (first.pageNumber ?? 0) - (second.pageNumber ?? 0)) ?? [];
  if (!material || !analysis || !sourceResources.length || !parsedArtifact.success) {
    response.status(409).json({ code: 'VISION_VALIDATION_INPUT_NOT_READY' });
    return;
  }
  try {
    const pageSources = sourceResources.map(resource => ({
      pageNumber: resource.pageNumber!,
      sourceImagePath: path.resolve('var/uploads/parsed', material!.id, 'resources', resource.fileName)
    }));
    const locator = new OpenAICompatibleVisionRegionLocator(config);
    const locatedPages = await Promise.all(pageSources.map(async page => {
      const artifactPage = parsedArtifact.data.pages.find(candidate => candidate.pageNumber === page.pageNumber);
      const layoutHints = artifactPage?.prunedResult.parsing_res_list.map(block => {
        const [left, top, right, bottom] = block.block_bbox;
        return {
          text: block.block_content.trim().slice(0, 160),
          boundingBox: {
            x: left / artifactPage.prunedResult.width,
            y: top / artifactPage.prunedResult.height,
            width: (right - left) / artifactPage.prunedResult.width,
            height: (bottom - top) / artifactPage.prunedResult.height
          }
        };
      }) ?? [];
      const located = await locator.locate(page.sourceImagePath, parsedRequest.data.questionNos, analysis, layoutHints);
      return located.items.map(item => ({ ...item, pageNumber: page.pageNumber }));
    }));
    const expectedEvidenceIds = new Map(analysis.questions
      .filter(question => parsedRequest.data.questionNos.includes(question.displayNo))
      .map(question => {
        const fields = buildExpectedAnswerFields(question);
        return [question.displayNo, fields.length ? fields.map(field => field.fieldId) : [`${question.displayNo}-answer`]];
      }));
    const regions = await createVisionLocatedRegions(
      request.params.taskId,
      material.id,
      pageSources,
      parsedRequest.data.questionNos,
      expectedEvidenceIds,
      locatedPages.flat(),
      parsedArtifact.data
    );
    const recognizer = new OpenAICompatibleVisionRecognizer(config);
    const recognizableRegions = regions.filter(region => region.locationStatus === 'located');
    const recognition = await recognizer.recognize(recognizableRegions);
    const recognitionByNo = new Map(recognition.items.map(item => [item.displayNo, item]));
    const previousResult = getVisionValidationResult(request.params.taskId, material.id);
    const requestedNumbers = new Set(parsedRequest.data.questionNos);
    const result: VisionValidationResult = {
      taskId: request.params.taskId,
      assetId: material.id,
      model: config.visionModel,
      items: [...(previousResult?.items.filter(item => !requestedNumbers.has(item.displayNo)) ?? []), ...regions.map(region => {
        const item = recognitionByNo.get(region.displayNo);
        const question = analysis.questions.find(candidate => candidate.displayNo === region.displayNo);
        const expectedFields = question ? buildExpectedAnswerFields(question) : [];
        const answerFields = item?.answerFields.map(field => ({
          ...field,
          label: expectedFields.find(candidate => candidate.fieldId === field.fieldId)?.label ?? field.fieldId
        })) ?? [];
        const structuredText = item?.selectedOption
          ? item.selectedOption
          : answerFields.length
          ? answerFields.map(field => `${field.label}：${field.text || '[未填写]'}`).join('\n')
          : item?.recognizedAnswer ?? '';
        const evidenceUnits = region.evidenceUnits.map(unit => {
          const transcriptionConfidence = unit.kind === 'choice' ? item?.confidence : undefined;
          const transcriptionNeedsReview = unit.kind === 'choice' ? item?.needsReview : false;
          const literalText = unit.kind === 'choice' ? item?.selectedOption ?? '' : '';
          const paddleCandidate = unit.paddleText;
          const suspiciousPaddleRepetition = hasSuspiciousRepeatedShortAnswer(paddleCandidate);
          return {
          evidenceId: unit.evidenceId,
          kind: unit.kind,
          region: unit.region,
          cropUrl: unit.cropUrl,
          provisionalText: paddleCandidate,
          literalText,
          confidence: unit.kind === 'choice' ? Math.min(unit.confidence, transcriptionConfidence ?? 0) : unit.confidence,
          needsReview: unit.needsReview || suspiciousPaddleRepetition || (transcriptionNeedsReview ?? false),
          reviewReasons: [...new Set([
            ...unit.reviewReasons,
            ...(suspiciousPaddleRepetition ? ['PaddleOCR 短答案存在连续重复，需核验'] : [])
          ])]
          };
        });
        return {
          pipelineVersion: NON_CHOICE_RECOGNITION_VERSION,
          displayNo: region.displayNo,
          region: region.region,
          locatorSource: region.locatorSource,
          locationStatus: region.locationStatus,
          locationReasons: region.locationReasons,
          cropUrl: region.cropUrl,
          evidenceUnits,
          paddleText: region.paddleText,
          lunaText: structuredText,
          answerFields,
          crossedOutText: item?.crossedOutText ?? [],
          selectedOption: item?.selectedOption ?? null,
          visualEvidence: item?.visualEvidence ?? '',
          existingMarkings: item?.existingMarkings ?? [],
          confidence: item?.confidence ?? 0,
          needsReview: region.locationStatus !== 'located' || evidenceUnits.some(unit => unit.needsReview) || (item?.needsReview ?? true)
        };
      })].sort((first, second) => Number(first.displayNo) - Number(second.displayNo)),
      createdAt: new Date().toISOString()
    };
    saveVisionValidationResult(result);
    response.json({ result });
  } catch (error) {
    console.error(JSON.stringify({ event: 'vision_validation_failed', taskId: request.params.taskId, assetId: parsedRequest.data.assetId, error: error instanceof Error ? error.message : String(error) }));
    const message = error instanceof Error ? error.message : 'VISION_VALIDATION_FAILED';
    response.status(502).json({ code: message.startsWith('MODEL_REQUEST_FAILED:') ? message : 'VISION_VALIDATION_OUTPUT_INVALID' });
  }
});

router.post('/:taskId/materials', upload.array('files'), (request, response) => {
  const kind = request.body.kind;
  if (kind !== 'assignment' && kind !== 'reference-answer' && kind !== 'student-submission') {
    response.status(400).json({ code: 'INVALID_MATERIAL_KIND' });
    return;
  }
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) {
    response.status(400).json({ code: 'NO_FILES' });
    return;
  }
  const assets: StoredMaterial[] = files.map(file => ({
    id: randomUUID(),
    taskId: request.params.taskId,
    kind,
    fileName: decodeUploadFileName(file.originalname),
    mimeType: file.mimetype,
    status: 'uploaded',
    diskPath: file.path,
    publicUrl: `/uploads/${file.filename}`
  }));
  replaceMaterialsForKind(request.params.taskId, kind, assets);
  deleteTrialGradingResult(request.params.taskId);
  if (kind !== 'student-submission') deleteFirstSectionAnalysis(request.params.taskId);
  assets.forEach(material => { void parseUploadedMaterial(material); });
  response.status(201).json({ assets: assets.map(toPublicAsset) });
});

router.get('/:taskId/analysis', (request, response) => {
  const analysis = getFirstSectionAnalysis(request.params.taskId);
  if (!analysis) {
    response.status(404).json({ code: 'ANALYSIS_NOT_FOUND' });
    return;
  }
  const analysisMaterials = getMaterials(request.params.taskId).filter(item => item.kind === 'assignment' || item.kind === 'reference-answer');
  response.json({
    analysis: {
      ...analysis,
      questions: analysis.questions.map(question => ({
        ...question,
        questionSource: resolveSourceEvidence(request.params.taskId, question.questionSource, analysisMaterials),
        answerSource: question.answerSource ? resolveSourceEvidence(request.params.taskId, question.answerSource, analysisMaterials) : null,
        subquestions: question.subquestions.map(subquestion => ({
          ...subquestion,
          questionSource: resolveSourceEvidence(request.params.taskId, subquestion.questionSource, analysisMaterials),
          answerSource: subquestion.answerSource ? resolveSourceEvidence(request.params.taskId, subquestion.answerSource, analysisMaterials) : null
        }))
      }))
    }
  });
});

router.get('/:taskId/trial-grading', (request, response) => {
  const result = getTrialGradingResult(request.params.taskId);
  if (!result) {
    response.status(404).json({ code: 'TRIAL_GRADING_NOT_FOUND' });
    return;
  }
  response.json({ result });
});

router.post('/:taskId/trial-grading', async (request, response) => {
  const parsed = trialGradingRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_TRIAL_GRADING_REQUEST' });
    return;
  }
  const config = getModelConfig();
  if (!isModelConfigured(config)) {
    response.status(503).json({ code: 'MODEL_NOT_CONFIGURED' });
    return;
  }
  const materials = getMaterials(request.params.taskId);
  const materialsById = new Map(materials.map(material => [material.id, material]));
  const invalidSubmission = parsed.data.submissions.find(submission => {
    const material = materialsById.get(submission.assetId);
    return !material || material.kind !== 'student-submission' || !material.normalizedDocument;
  });
  if (invalidSubmission) {
    response.status(409).json({ code: 'SUBMISSION_MATERIAL_NOT_READY' });
    return;
  }
  const expectedQuestionNos = parsed.data.questions.map(question => question.displayNo);
  const incompleteVision = parsed.data.submissions.find(submission => {
    const result = getVisionValidationResult(request.params.taskId, submission.assetId);
    return !result || expectedQuestionNos.some(displayNo => !result.items.some(item => item.displayNo === displayNo));
  });
  if (incompleteVision) {
    response.status(409).json({ code: 'VISION_RESULTS_NOT_READY' });
    return;
  }
  try {
    const grader = new OpenAICompatibleTrialGrader(config);
    const modelResult = await grader.grade(request.params.taskId, parsed.data, materials);
    const questionsById = new Map(parsed.data.questions.map(question => [question.questionId, question]));
    const submissionsById = new Map(parsed.data.submissions.map(submission => [submission.assetId, submission]));
    const expectedKeys = new Set(parsed.data.questions.flatMap(question => parsed.data.submissions.map(submission => `${question.questionId}:${submission.assetId}`)));
    const returnedKeys = new Set(modelResult.samples.map(sample => `${sample.questionId}:${sample.assetId}`));
    if (returnedKeys.size !== expectedKeys.size || [...expectedKeys].some(key => !returnedKeys.has(key))) {
      throw new Error('MODEL_OUTPUT_INCOMPLETE');
    }
    const samples: CalibrationSample[] = modelResult.samples.map(sample => {
      const question = questionsById.get(sample.questionId);
      const submission = submissionsById.get(sample.assetId);
      const material = materialsById.get(sample.assetId);
      if (!question || !submission || !material) throw new Error('MODEL_OUTPUT_INVALID_REFERENCE');
      const score = resolveTrialScore(
        question.fullScore,
        question.rubricPoints,
        sample.matchedPoints,
        sample.missedPoints,
        sample.score
      );
      const visionItem = getVisionValidationResult(request.params.taskId, material.id)?.items.find(item => item.displayNo === question.displayNo);
      if (!visionItem) throw new Error('VISION_RESULT_REFERENCE_MISSING');
      const ocrText = getObservedAnswer(visionItem);
      const recognitionConflict = !visionItem.selectedOption && recognitionTextsConflict(visionItem.paddleText, visionItem.lunaText);
      const gradingConfidence = resolveTrialConfidence(sample.confidence, visionItem);
      const needsTeacherReview = trialNeedsTeacherReview(sample.needsTeacherReview, visionItem);
      const scoreRatio = question.fullScore > 0 && score !== null ? score / question.fullScore : 0;
      const sampleType: CalibrationSample['sampleType'] = needsTeacherReview || gradingConfidence < 0.65
        ? 'ocr-risk'
        : scoreRatio >= 0.8
          ? 'high'
          : scoreRatio <= 0.4
            ? 'low'
            : 'middle';
      return {
        id: `${sample.questionId}-${sample.assetId}`,
        questionId: sample.questionId,
        studentId: submission.studentId,
        studentName: submission.studentName,
        studentNo: submission.studentNo,
        sampleType,
        rawImageDescription: `${material.fileName} · 第 ${question.displayNo} 题截图`,
        rawOcrText: ocrText,
        ocrText,
        lunaReviewText: visionItem.lunaText,
        recognitionConflict,
        ocrSource: visionItem.selectedOption ? 'choice-vision' : visionItem.paddleText ? 'paddle' : 'luna',
        ocrConfidence: visionItem.confidence,
        aiScore: score,
        fullScore: question.fullScore,
        gradingConfidence,
        needsTeacherReview,
        matchedPoints: sample.matchedPoints,
        missedPoints: sample.missedPoints,
        gradingReason: sample.reason,
        sourceAssetId: material.id,
        sourceFileName: `${material.fileName} · 第 ${question.displayNo} 题`,
        sourcePreviewUrl: visionItem.cropUrl,
        sourcePreviewType: 'image',
        status: 'pending',
        rubricVersion: question.rubricVersion
      };
    });
    const result: TrialGradingResult = {
      taskId: request.params.taskId,
      model: config.visionModel,
      samples,
      createdAt: new Date().toISOString()
    };
    saveTrialGradingResult(result);
    response.json({ result });
  } catch (error) {
    console.error(JSON.stringify({ event: 'trial_grading_failed', taskId: request.params.taskId, error: error instanceof Error ? error.message : String(error) }));
    const message = error instanceof Error ? error.message : 'TRIAL_GRADING_FAILED';
    response.status(502).json({ code: message.startsWith('MODEL_REQUEST_FAILED:') ? message : 'TRIAL_GRADING_OUTPUT_INVALID' });
  }
});

router.post('/:taskId/analysis', async (request, response) => {
  const config = getModelConfig();
  if (!isModelConfigured(config)) {
    response.status(503).json({ code: 'MODEL_NOT_CONFIGURED' });
    return;
  }
  const parsedCatalog = knowledgeCatalogSchema.safeParse(request.body.knowledgeCatalog ?? []);
  if (!parsedCatalog.success) {
    response.status(400).json({ code: 'INVALID_KNOWLEDGE_CATALOG' });
    return;
  }
  const materials = getMaterials(request.params.taskId);
  const analysisMaterials = materials.filter(item => item.kind === 'assignment' || item.kind === 'reference-answer');
  if (!analysisMaterials.some(item => item.kind === 'assignment' && item.normalizedDocument)) {
    response.status(409).json({ code: 'ASSIGNMENT_MATERIAL_REQUIRED' });
    return;
  }
  if (!analysisMaterials.some(item => item.kind === 'reference-answer' && item.normalizedDocument)) {
    response.status(409).json({ code: 'REFERENCE_ANSWER_REQUIRED' });
    return;
  }
  if (analysisMaterials.some(item => item.status === 'uploaded' || item.status === 'processing' || item.status === 'failed')) {
    response.status(409).json({ code: 'MATERIALS_NOT_READY' });
    return;
  }
  try {
    const analyzer = new OpenAICompatibleQuestionAnalyzer(config);
    const rawAnalysis = await analyzer.analyzeFirstSection(analysisMaterials, parsedCatalog.data);
    const catalogById = new Map(parsedCatalog.data.map(node => [node.id, node]));
    const normalizeKnowledgeCandidates = (candidates: { nodeId: string; nodeName: string; confidence: number }[]) =>
      candidates.flatMap(candidate => {
        const node = catalogById.get(candidate.nodeId);
        return node ? [{ ...candidate, nodeName: node.name }] : [];
      });
    const normalizeRubricPoints = (points: { point?: string; score?: number | null; description?: string }[]) =>
      points
        .filter(point => point.point?.trim() || point.description?.trim())
        .map(point => ({ point: point.point?.trim() || point.description?.trim() || '', score: point.score ?? null, description: point.description ?? '' }));
    const questions = rawAnalysis.questions.map(rawQuestion => {
      const question = completeReferenceAnswer(rawQuestion, analysisMaterials);
      return {
        ...question,
        questionSource: resolveSourceEvidence(request.params.taskId, question.questionSource, analysisMaterials),
        answerSource: question.answerSource ? resolveSourceEvidence(request.params.taskId, question.answerSource, analysisMaterials) : null,
        rubricPoints: normalizeRubricPoints(question.rubricPoints),
        knowledgeCandidates: normalizeKnowledgeCandidates(question.knowledgeCandidates),
        subquestions: question.subquestions.map(subquestion => ({
          ...subquestion,
          questionSource: resolveSourceEvidence(request.params.taskId, subquestion.questionSource, analysisMaterials),
          answerSource: subquestion.answerSource ? resolveSourceEvidence(request.params.taskId, subquestion.answerSource, analysisMaterials) : null,
          rubricPoints: normalizeRubricPoints(subquestion.rubricPoints),
          knowledgeCandidates: normalizeKnowledgeCandidates(subquestion.knowledgeCandidates)
        }))
      };
    }) as FirstSectionAnalysis['questions'];
    const analysis = saveFirstSectionAnalysis({
      taskId: request.params.taskId,
      scope: rawAnalysis.scope,
      status: 'needs-review',
      model: config.visionModel,
      materialAssetIds: analysisMaterials.map(material => material.id),
      questions,
      createdAt: new Date().toISOString()
    });
    deleteTrialGradingResult(request.params.taskId);
    response.json({ analysis });
  } catch (error) {
    console.error(JSON.stringify({ event: 'first_section_analysis_failed', taskId: request.params.taskId, error: error instanceof Error ? error.message : String(error) }));
    const message = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
    response.status(502).json({ code: message.startsWith('MODEL_REQUEST_FAILED:') ? message : 'MODEL_OUTPUT_INVALID' });
  }
});

export default router;
