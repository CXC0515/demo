/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getModelConfig, isModelConfigured } from '../config/modelConfig';
import { addMaterials, getMaterials, StoredMaterial } from '../repositories/materialRepository';
import { OpenAICompatibleProvider } from '../services/multimodal/OpenAICompatibleProvider';

const router = Router();
const upload = multer({
  dest: 'var/uploads',
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/'))
});

const knowledgeCatalogSchema = z.array(z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string()
})).max(2000);

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
    fileName: file.originalname,
    mimeType: file.mimetype,
    status: 'uploaded',
    diskPath: file.path,
    publicUrl: `/uploads/${file.filename}`
  }));
  addMaterials(request.params.taskId, assets);
  response.status(201).json({ assets: assets.map(({ diskPath: _diskPath, ...asset }) => asset) });
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
  if (!materials.some(item => item.kind === 'assignment')) {
    response.status(409).json({ code: 'ASSIGNMENT_MATERIAL_REQUIRED' });
    return;
  }
  try {
    const files = await Promise.all(materials.map(async material => ({
      fileName: material.fileName,
      mimeType: material.mimeType,
      kind: material.kind as 'assignment' | 'reference-answer',
      dataBase64: (await readFile(material.diskPath)).toString('base64')
    })));
    const provider = new OpenAICompatibleProvider(config);
    const rawAnalysis = await provider.analyzeAssignment({ files, knowledgeCatalog: parsedCatalog.data });
    const catalogById = new Map(parsedCatalog.data.map(node => [node.id, node]));
    const analysis = {
      questions: rawAnalysis.questions.map(question => ({
        ...question,
        knowledgeCandidates: question.knowledgeCandidates.flatMap(candidate => {
          const node = catalogById.get(candidate.nodeId);
          return node ? [{ ...candidate, nodeName: node.name }] : [];
        })
      }))
    };
    response.json({ status: 'needs-review', analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ANALYSIS_FAILED';
    response.status(message === 'MODEL_INPUT_REQUIRES_RENDERED_IMAGE' ? 422 : 502).json({ code: message });
  }
});

export default router;
