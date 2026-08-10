/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { FirstSectionAnalysis } from '../../src/domain/types';
import { getModelConfig, isModelConfigured } from '../config/modelConfig';
import { deleteFirstSectionAnalysis, getFirstSectionAnalysis, saveFirstSectionAnalysis } from '../repositories/analysisRepository';
import { getMaterials, replaceMaterialsForKind, StoredMaterial, updateMaterial } from '../repositories/materialRepository';
import { OpenAICompatibleQuestionAnalyzer } from '../services/analysis/OpenAICompatibleQuestionAnalyzer';
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

router.post('/:taskId/materials', upload.array('files'), (request, response) => {
  const kind = request.body.kind;
  if (kind !== 'assignment' && kind !== 'reference-answer') {
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
  deleteFirstSectionAnalysis(request.params.taskId);
  assets.forEach(material => { void parseUploadedMaterial(material); });
  response.status(201).json({ assets: assets.map(toPublicAsset) });
});

router.get('/:taskId/analysis', (request, response) => {
  const analysis = getFirstSectionAnalysis(request.params.taskId);
  if (!analysis) {
    response.status(404).json({ code: 'ANALYSIS_NOT_FOUND' });
    return;
  }
  response.json({ analysis });
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
  if (!materials.some(item => item.kind === 'assignment' && item.normalizedDocument)) {
    response.status(409).json({ code: 'ASSIGNMENT_MATERIAL_REQUIRED' });
    return;
  }
  if (!materials.some(item => item.kind === 'reference-answer' && item.normalizedDocument)) {
    response.status(409).json({ code: 'REFERENCE_ANSWER_REQUIRED' });
    return;
  }
  if (materials.some(item => item.status === 'uploaded' || item.status === 'processing' || item.status === 'failed')) {
    response.status(409).json({ code: 'MATERIALS_NOT_READY' });
    return;
  }
  try {
    const analyzer = new OpenAICompatibleQuestionAnalyzer(config);
    const rawAnalysis = await analyzer.analyzeFirstSection(materials, parsedCatalog.data);
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
    const questions = rawAnalysis.questions.map(question => ({
      ...question,
      rubricPoints: normalizeRubricPoints(question.rubricPoints),
      knowledgeCandidates: normalizeKnowledgeCandidates(question.knowledgeCandidates),
      subquestions: question.subquestions.map(subquestion => ({
        ...subquestion,
        rubricPoints: normalizeRubricPoints(subquestion.rubricPoints),
        knowledgeCandidates: normalizeKnowledgeCandidates(subquestion.knowledgeCandidates)
      }))
    })) as FirstSectionAnalysis['questions'];
    const analysis = saveFirstSectionAnalysis({
      taskId: request.params.taskId,
      scope: rawAnalysis.scope,
      status: 'needs-review',
      model: config.visionModel,
      materialAssetIds: materials.map(material => material.id),
      questions,
      createdAt: new Date().toISOString()
    });
    response.json({ analysis });
  } catch (error) {
    console.error(JSON.stringify({ event: 'first_section_analysis_failed', taskId: request.params.taskId, error: error instanceof Error ? error.message : String(error) }));
    const message = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
    response.status(502).json({ code: message.startsWith('MODEL_REQUEST_FAILED:') ? message : 'MODEL_OUTPUT_INVALID' });
  }
});

export default router;
