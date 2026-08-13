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
import { AnalysisEvidenceRef, FirstSectionAnalysis, GradingMode, TrialGradingResult, VisionValidationResult } from '../../src/domain/types';
import { getModelConfig, isModelConfigured } from '../config/modelConfig';
import { deleteFirstSectionAnalysis, getFirstSectionAnalysis, saveFirstSectionAnalysis } from '../repositories/analysisRepository';
import { appendMaterials, getMaterials, removeMaterialsForKind, replaceMaterialsForKind, StoredMaterial, updateMaterial } from '../repositories/materialRepository';
import { getTaskRubrics, saveTaskRubric } from '../repositories/gradingRubricRepository';
import { deleteGradingBatch, getGradingBatch, saveGradingBatch } from '../repositories/gradingBatchRepository';
import { getParserArtifact } from '../repositories/parserArtifactRepository';
import { recordGradingError } from '../repositories/gradingErrorRepository';
import { deleteTrialGradingResult, getTrialGradingResult, invalidateAiGradingForAsset, saveTrialGradingResult } from '../repositories/trialGradingRepository';
import { deleteVisionValidationForTask, getVisionValidationResult, NON_CHOICE_RECOGNITION_VERSION, saveVisionValidationResult } from '../repositories/visionValidationRepository';
import { paddleParserArtifactSchema, visionValidationRequestSchema } from '../schemas/paddleParserArtifact';
import { trialGradingRequestSchema } from '../schemas/trialGrading';
import { gradingRubricInputSchema } from '../schemas/gradingRubric';
import { OpenAICompatibleQuestionAnalyzer } from '../services/analysis/OpenAICompatibleQuestionAnalyzer';
import { resolveSourceEvidence } from '../services/evidence/sourceEvidenceResolver';
import { OpenAICompatibleVisionRecognizer } from '../services/grading/OpenAICompatibleVisionRecognizer';
import { OpenAICompatibleVisionRegionLocator } from '../services/grading/OpenAICompatibleVisionRegionLocator';
import { createVisionLocatedRegions } from '../services/grading/questionRegionCropper';
import { hasSuspiciousRepeatedShortAnswer, inferAnswerCardOption } from '../services/grading/trialScore';
import { buildExpectedAnswerFields } from '../services/grading/answerFieldSchema';
import { findSubmissionsNeedingTrialGrading, mergeCurrentTrialSamples } from '../services/grading/trialResultReconciler';
import { gradeTrialSubmissions } from '../services/grading/trialGradingService';
import { buildGradingDiagnosis } from '../services/grading/gradingDiagnosis';
import { applyTeacherReviewDecision } from '../services/grading/teacherReviewDecision';
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

const ocrCorrectionSchema = z.object({
  correctedText: z.string().max(10_000),
  question: trialGradingRequestSchema.shape.questions.element,
  submission: trialGradingRequestSchema.shape.submissions.element
});

const teacherReviewSchema = z.object({
  finalScore: z.number().nonnegative(),
  reason: z.string().trim().min(1).max(2_000),
  resultSource: z.enum(['ai-confirmed', 'teacher-adjusted', 'teacher-manual']),
  correctedText: z.string().max(10_000).optional(),
  reviewDecision: z.enum(['confirmed-score', 'corrected-recognition', 'adjusted-score', 'deferred']).optional(),
  feedbackReasons: z.array(z.enum(['answer-region-incomplete', 'recognition-error', 'crossed-out-error', 'rubric-missing', 'rubric-judgment-error', 'score-too-high', 'score-too-low', 'other'])).max(8).optional()
});

const batchConfirmationSchema = z.object({ studentIds: z.array(z.string().min(1)).min(1).max(50) });

const batchRequestSchema = trialGradingRequestSchema.extend({
  mode: z.enum(['per-submission', 'batch-checkpoint', 'auto-continue'])
});

const analysisQuestionCorrectionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  stem: z.string().trim().min(1).max(10_000),
  answerRequirement: z.string().trim().max(2_000),
  standardAnswer: z.string().trim().max(20_000).optional()
});

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

router.delete('/:taskId/student-submissions', (request, response) => {
  const removed = removeMaterialsForKind(request.params.taskId, 'student-submission');
  deleteVisionValidationForTask(request.params.taskId);
  deleteTrialGradingResult(request.params.taskId);
  deleteGradingBatch(request.params.taskId);
  response.json({ removed: removed.map(toPublicAsset) });
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
    const expectedEvidenceIds = new Map(analysis.questions
      .filter(question => parsedRequest.data.questionNos.includes(question.displayNo))
      .map(question => [question.displayNo, [`${question.displayNo}-answer`]]));
    const expectedQuestionKinds = new Map(analysis.questions
      .filter(question => parsedRequest.data.questionNos.includes(question.displayNo))
      .map(question => [question.displayNo, /选择题/.test(question.questionType) ? 'choice' as const : 'text' as const]));
    let regions = await createVisionLocatedRegions(
      request.params.taskId,
      material.id,
      pageSources,
      parsedRequest.data.questionNos,
      expectedEvidenceIds,
      [],
      parsedArtifact.data,
      expectedQuestionKinds
    );
    const missingPaddleNumbers = regions
      .filter(region => region.locationStatus === 'needs-teacher' && region.locationReasons.some(reason => reason.includes('视觉与 Paddle 均未定位')))
      .map(region => region.displayNo);
    if (missingPaddleNumbers.length) {
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
        const located = await locator.locate(page.sourceImagePath, missingPaddleNumbers, analysis, layoutHints);
        return located.items.map(item => ({ ...item, pageNumber: page.pageNumber }));
      }));
      const locatedCandidates = locatedPages.flat();
      const sequenceFiltered = missingPaddleNumbers.flatMap(displayNo => {
        const nextQuestionNo = analysis.questions.find(question => Number(question.displayNo) > Number(displayNo))?.displayNo;
        if (!nextQuestionNo) return locatedCandidates.filter(item => item.displayNo === displayNo);
        const candidates = locatedCandidates.filter(item => item.displayNo === displayNo);
        const preceding = candidates.filter(candidate => {
          const artifactPage = parsedArtifact.data.pages.find(page => page.pageNumber === candidate.pageNumber);
          if (!artifactPage) return false;
          const nextAnchor = artifactPage.prunedResult.parsing_res_list
            .filter(block => block.block_content.trim().match(/^(\d+)(?:\s|[.、（(])/u)?.[1] === nextQuestionNo)
            .sort((first, second) => first.block_bbox[1] - second.block_bbox[1])[0];
          if (!nextAnchor) return true;
          const anchorTop = nextAnchor.block_bbox[1] / artifactPage.prunedResult.height;
          return candidate.boundingBox.y < anchorTop + 0.02;
        });
        return preceding.length ? preceding : candidates;
      });
      const recovered = await createVisionLocatedRegions(
        request.params.taskId,
        material.id,
        pageSources,
        missingPaddleNumbers,
        expectedEvidenceIds,
        sequenceFiltered,
        parsedArtifact.data,
        expectedQuestionKinds
      );
      const recoveredByNo = new Map(recovered.map(region => [region.displayNo, region]));
      regions = regions.map(region => recoveredByNo.get(region.displayNo) ?? region);
    }
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
        const paddleSelectedOption = inferAnswerCardOption(region.paddleText);
        const selectedOption = paddleSelectedOption ?? item?.selectedOption ?? null;
        const structuredText = selectedOption
          ? selectedOption
          : answerFields.length
          ? answerFields.map(field => `${field.label}：${field.text || '[未填写]'}`).join('\n')
          : item?.recognizedAnswer ?? '';
        const evidenceUnits = region.evidenceUnits.map(unit => {
          const transcriptionConfidence = unit.kind === 'choice' ? item?.confidence : undefined;
          const transcriptionNeedsReview = unit.kind === 'choice' ? item?.needsReview : false;
          const literalText = unit.kind === 'choice' ? selectedOption ?? '' : '';
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
          paddleText: region.locationStatus === 'located' ? region.paddleText : '',
          lunaText: structuredText,
          answerFields,
          crossedOutText: item?.crossedOutText ?? [],
          selectedOption,
          visualEvidence: item?.visualEvidence ?? '',
          existingMarkings: item?.existingMarkings ?? [],
          confidence: item?.confidence ?? 0,
          needsReview: region.locationStatus !== 'located' || evidenceUnits.some(unit => unit.needsReview) || (item?.needsReview ?? true)
        };
      })].sort((first, second) => Number(first.displayNo) - Number(second.displayNo)),
      createdAt: new Date().toISOString()
    };
    saveVisionValidationResult(result);
    invalidateAiGradingForAsset(request.params.taskId, material.id);
    response.json({ result });
  } catch (error) {
    recordGradingError('vision_validation_failed', request.params.taskId, error, { assetId: parsedRequest.data.assetId, questionNos: parsedRequest.data.questionNos });
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
  if (kind === 'student-submission') appendMaterials(request.params.taskId, assets);
  else replaceMaterialsForKind(request.params.taskId, kind, assets);
  if (kind !== 'student-submission') {
    deleteTrialGradingResult(request.params.taskId);
    deleteFirstSectionAnalysis(request.params.taskId);
  }
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

router.put('/:taskId/analysis/questions/:displayNo', (request, response) => {
  const parsed = analysisQuestionCorrectionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ code: 'INVALID_QUESTION_CORRECTION' });
    return;
  }
  const analysis = getFirstSectionAnalysis(request.params.taskId);
  if (!analysis) {
    response.status(404).json({ code: 'ANALYSIS_NOT_FOUND' });
    return;
  }
  const displayNo = decodeURIComponent(request.params.displayNo);
  if (!analysis.questions.some(question => question.displayNo === displayNo)) {
    response.status(404).json({ code: 'QUESTION_NOT_FOUND' });
    return;
  }
  const updated = saveFirstSectionAnalysis({
    ...analysis,
    questions: analysis.questions.map(question => question.displayNo === displayNo ? { ...question, ...parsed.data } : question)
  });
  deleteTrialGradingResult(request.params.taskId);
  deleteGradingBatch(request.params.taskId);
  deleteVisionValidationForTask(request.params.taskId);
  response.json({ analysis: updated });
});

router.get('/:taskId/trial-grading', (request, response) => {
  const result = getTrialGradingResult(request.params.taskId);
  if (!result) {
    response.status(404).json({ code: 'TRIAL_GRADING_NOT_FOUND' });
    return;
  }
  response.json({ result });
});

router.put('/:taskId/trial-grading/:sampleId/ocr-correction', async (request, response) => {
  const parsed = ocrCorrectionSchema.safeParse(request.body);
  const existing = getTrialGradingResult(request.params.taskId);
  const current = existing?.samples.find(sample => sample.id === request.params.sampleId);
  const config = getModelConfig();
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_OCR_CORRECTION' }); return; }
  if (!existing || !current || !current.sourceAssetId) { response.status(404).json({ code: 'TRIAL_SAMPLE_NOT_FOUND' }); return; }
  if (!isModelConfigured(config)) { response.status(503).json({ code: 'MODEL_NOT_CONFIGURED' }); return; }
  if (current.resultSource === 'teacher-manual') { response.status(409).json({ code: 'TEACHER_FINAL_RESULT_LOCKED' }); return; }
  try {
    const correctionRequest = { questions: [parsed.data.question], submissions: [parsed.data.submission] };
    const rawText = current.rawOcrText ?? current.ocrText;
    const overrides = parsed.data.correctedText === rawText
      ? new Map<string, string>()
      : new Map([[`${parsed.data.submission.assetId}:${parsed.data.question.displayNo}`, parsed.data.correctedText]]);
    const [rescored] = await gradeTrialSubmissions(request.params.taskId, correctionRequest, getMaterials(request.params.taskId), config, overrides);
    const updated = { ...rescored, status: current.status, resultSource: current.resultSource, teacherScore: current.teacherScore, teacherReason: current.teacherReason, isFinal: current.isFinal, reviewStatus: current.reviewStatus, reviewDecision: current.reviewDecision, feedbackReasons: current.feedbackReasons };
    const latest = getTrialGradingResult(request.params.taskId);
    if (!latest?.samples.some(sample => sample.id === current.id)) { response.status(409).json({ code: 'TRIAL_RESULT_CHANGED' }); return; }
    const result = saveTrialGradingResult({ ...latest, samples: latest.samples.map(sample => sample.id === current.id ? updated : sample), createdAt: new Date().toISOString() });
    response.json({ sample: updated, result });
  } catch (error) {
    console.error(JSON.stringify({ event: 'ocr_correction_rescore_failed', taskId: request.params.taskId, sampleId: request.params.sampleId, error: error instanceof Error ? error.message : String(error) }));
    response.status(502).json({ code: 'OCR_CORRECTION_RESCORE_FAILED' });
  }
});

router.put('/:taskId/trial-grading/:sampleId/teacher-review', (request, response) => {
  const parsed = teacherReviewSchema.safeParse(request.body);
  const existing = getTrialGradingResult(request.params.taskId);
  const current = existing?.samples.find(sample => sample.id === request.params.sampleId);
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_TEACHER_REVIEW' }); return; }
  if (!existing || !current) { response.status(404).json({ code: 'TRIAL_SAMPLE_NOT_FOUND' }); return; }
  let updated;
  try { updated = applyTeacherReviewDecision(current, parsed.data); }
  catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_TEACHER_REVIEW';
    response.status(code === 'AI_SCORE_CONFIRMATION_MISMATCH' ? 409 : 400).json({ code });
    return;
  }
  const result = saveTrialGradingResult({ ...existing, samples: existing.samples.map(sample => sample.id === current.id ? updated : sample), createdAt: new Date().toISOString() });
  response.json({ sample: updated, result });
});

router.get('/:taskId/batch-grading', (request, response) => {
  const stored = getGradingBatch(request.params.taskId);
  response.json({ batch: stored ? { ...stored, studentIds: stored.studentIds ?? [], confirmedStudentIds: stored.confirmedStudentIds ?? [] } : { taskId: request.params.taskId, status: 'idle', mode: 'batch-checkpoint', totalStudents: 0, processedStudents: 0, failedStudentIds: [], studentIds: [], confirmedStudentIds: [], updatedAt: new Date().toISOString() } });
});

router.post('/:taskId/batch-grading/start', async (request, response) => {
  const parsed = batchRequestSchema.safeParse(request.body);
  const config = getModelConfig();
  if (!parsed.success) { response.status(400).json({ code: 'INVALID_BATCH_GRADING_REQUEST' }); return; }
  if (!isModelConfigured(config)) { response.status(503).json({ code: 'MODEL_NOT_CONFIGURED' }); return; }
  const startedAt = new Date().toISOString();
  const studentIds = parsed.data.submissions.map(item => item.studentId);
  const previousConfirmed = getGradingBatch(request.params.taskId)?.confirmedStudentIds ?? [];
  saveGradingBatch({ taskId: request.params.taskId, status: 'running', mode: parsed.data.mode as GradingMode, totalStudents: parsed.data.submissions.length, processedStudents: 0, failedStudentIds: [], studentIds, confirmedStudentIds: previousConfirmed.filter(id => studentIds.includes(id)), startedAt, updatedAt: startedAt });
  try {
    const existing = getTrialGradingResult(request.params.taskId);
    const missing = findSubmissionsNeedingTrialGrading(existing, parsed.data);
    const refreshed = [];
    const failedStudentIds: string[] = [];
    for (const submission of missing) {
      const currentBatch = getGradingBatch(request.params.taskId);
      if (currentBatch?.status === 'paused') { response.json({ batch: currentBatch, result: existing }); return; }
      try {
        refreshed.push(...await gradeTrialSubmissions(request.params.taskId, { questions: parsed.data.questions, submissions: [submission] }, getMaterials(request.params.taskId), config));
      } catch { failedStudentIds.push(submission.studentId); }
      saveGradingBatch({ ...currentBatch!, processedStudents: parsed.data.submissions.length - missing.length + refreshed.length / parsed.data.questions.length + failedStudentIds.length, failedStudentIds, updatedAt: new Date().toISOString() });
    }
    const result = saveTrialGradingResult({ taskId: request.params.taskId, model: config.visionModel, samples: mergeCurrentTrialSamples(existing, parsed.data, refreshed), createdAt: new Date().toISOString() });
    const completedAt = new Date().toISOString();
    const currentBatch = getGradingBatch(request.params.taskId)!;
    const autoConfirmed = parsed.data.mode === 'auto-continue'
      ? studentIds.filter(studentId => !result.samples.some(sample => sample.studentId === studentId && sample.reviewTriggers?.length))
      : currentBatch.confirmedStudentIds;
    const batch = saveGradingBatch({ ...currentBatch, status: failedStudentIds.length ? 'failed' : 'completed', mode: parsed.data.mode as GradingMode, totalStudents: parsed.data.submissions.length, processedStudents: parsed.data.submissions.length, failedStudentIds, studentIds, confirmedStudentIds: [...new Set(autoConfirmed)], startedAt, completedAt, updatedAt: completedAt });
    response.json({ batch, result });
  } catch (error) {
    const batch = saveGradingBatch({ taskId: request.params.taskId, status: 'failed', mode: parsed.data.mode as GradingMode, totalStudents: parsed.data.submissions.length, processedStudents: 0, failedStudentIds: parsed.data.submissions.map(item => item.studentId), studentIds, confirmedStudentIds: previousConfirmed.filter(id => studentIds.includes(id)), startedAt, updatedAt: new Date().toISOString() });
    response.status(502).json({ code: 'BATCH_GRADING_FAILED', batch });
  }
});

router.post('/:taskId/batch-grading/confirm', (request, response) => {
  const parsed = batchConfirmationSchema.safeParse(request.body);
  const current = getGradingBatch(request.params.taskId);
  if (!parsed.success || !current) { response.status(400).json({ code: 'INVALID_BATCH_CONFIRMATION' }); return; }
  const confirmedStudentIds = [...new Set([...(current.confirmedStudentIds ?? []), ...parsed.data.studentIds.filter(id => (current.studentIds ?? []).includes(id))])];
  response.json({ batch: saveGradingBatch({ ...current, confirmedStudentIds, updatedAt: new Date().toISOString() }) });
});

router.post('/:taskId/batch-grading/:action', (request, response) => {
  const current = getGradingBatch(request.params.taskId);
  if (!current || (request.params.action !== 'pause' && request.params.action !== 'resume')) { response.status(404).json({ code: 'BATCH_ACTION_NOT_AVAILABLE' }); return; }
  const batch = saveGradingBatch({ ...current, status: request.params.action === 'pause' ? 'paused' : 'running', updatedAt: new Date().toISOString() });
  response.json({ batch });
});

router.post('/:taskId/diagnosis', (request, response) => {
  const questions = z.array(z.object({ id: z.string(), displayNo: z.string(), score: z.number() })).safeParse(request.body.questions);
  const result = getTrialGradingResult(request.params.taskId);
  if (!questions.success || !result) { response.status(409).json({ code: 'DIAGNOSIS_INPUT_NOT_READY' }); return; }
  const normalized = questions.data.map(item => ({ ...item, title: '', knowledgePoint: '', knowledgeLinks: [], desc: '', parseConfidence: 1, sourceEvidenceIds: [] }));
  response.json({ diagnosis: buildGradingDiagnosis(request.params.taskId, normalized, result.samples) });
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
    const existingResult = getTrialGradingResult(request.params.taskId);
    const submissionsToGrade = findSubmissionsNeedingTrialGrading(existingResult, parsed.data);
    if (!submissionsToGrade.length) {
      const result: TrialGradingResult = {
        taskId: request.params.taskId,
        model: existingResult?.model ?? config.visionModel,
        samples: mergeCurrentTrialSamples(existingResult, parsed.data, []),
        createdAt: new Date().toISOString()
      };
      saveTrialGradingResult(result);
      response.json({ result });
      return;
    }
    const settled = await Promise.allSettled(submissionsToGrade.map(async submission => {
      const incrementalRequest = { ...parsed.data, submissions: [submission] };
      return gradeTrialSubmissions(request.params.taskId, incrementalRequest, materials, config);
    }));
    const failed = settled.find((item): item is PromiseRejectedResult => item.status === 'rejected');
    if (failed) {
      const reason = failed.reason instanceof Error ? failed.reason.message : String(failed.reason);
      throw new Error(reason);
    }
    const refreshedSamples = settled.flatMap(item => item.status === 'fulfilled' ? item.value : []);
    const result: TrialGradingResult = {
      taskId: request.params.taskId,
      model: config.visionModel,
      samples: mergeCurrentTrialSamples(existingResult, parsed.data, refreshedSamples),
      createdAt: new Date().toISOString()
    };
    saveTrialGradingResult(result);
    response.json({ result });
  } catch (error) {
    recordGradingError('trial_grading_failed', request.params.taskId, error, { submissionCount: parsed.data.submissions.length, questionCount: parsed.data.questions.length });
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
    const rawAnalysis = await analyzer.analyzeAssignment(analysisMaterials, parsedCatalog.data);
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
    deleteGradingBatch(request.params.taskId);
    deleteVisionValidationForTask(request.params.taskId);
    response.json({ analysis });
  } catch (error) {
    console.error(JSON.stringify({ event: 'first_section_analysis_failed', taskId: request.params.taskId, error: error instanceof Error ? error.message : String(error) }));
    const message = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
    response.status(502).json({ code: message.startsWith('MODEL_REQUEST_FAILED:') ? message : 'MODEL_OUTPUT_INVALID' });
  }
});

export default router;
