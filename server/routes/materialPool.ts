import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { assertPathInsideWorkspace } from '../context/workspaceContext';
import { authenticatedUploadPath, resumeAuthenticatedWorkspace } from '../middleware/authenticated';
import { uploadRateLimit } from '../middleware/security';
import { materialPoolRepository } from '../repositories/materialPoolRepository';
import { runtimeConfig } from '../config/runtimeConfig';

const router = Router();
const allowedExtensions: Record<string, string> = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.txt': 'text/plain',
};

const detectMime = (filePath: string, originalName: string) => {
  const extension = path.extname(originalName).toLowerCase();
  const mime = allowedExtensions[extension];
  if (!mime) return null;
  const data = readFileSync(filePath);
  if (!data.length) return null;
  if (extension === '.pdf') return data.subarray(0, 5).toString() === '%PDF-' ? mime : null;
  if (extension === '.jpg' || extension === '.jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff ? mime : null;
  if (extension === '.png') return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? mime : null;
  if (extension === '.webp') return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' ? mime : null;
  if (['.docx', '.pptx', '.xlsx'].includes(extension)) {
    const requiredEntry = extension === '.docx' ? 'word/document.xml' : extension === '.pptx' ? 'ppt/presentation.xml' : 'xl/workbook.xml';
    return data.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) &&
      data.includes(Buffer.from('[Content_Types].xml')) && data.includes(Buffer.from(requiredEntry)) ? mime : null;
  }
  if (extension === '.txt') return !data.includes(0) && new TextDecoder('utf-8', { fatal: true }).decode(data) ? mime : null;
  return null;
};

const hashFile = async (filePath: string) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (request, _file, callback) => {
      try {
        const directory = authenticatedUploadPath(request, 'material-pool', 'tmp');
        mkdirSync(directory, { recursive: true });
        callback(null, directory);
      } catch (error) {
        callback(error instanceof Error ? error : new Error('WORKSPACE_CONTEXT_REQUIRED'), '');
      }
    },
    filename: (_request, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { files: 1, fileSize: runtimeConfig.uploadLimits.resourceFileBytes },
});

const nameSchema = z.object({ name: z.string().trim().min(1).max(80), parentId: z.string().uuid().nullable().optional() });
const itemUpdateSchema = z.object({ folderId: z.string().nullable().optional(), tags: z.array(z.string().trim().min(1).max(40)).max(20).optional() })
  .refine(value => value.folderId !== undefined || value.tags !== undefined);

router.get('/material-pool/folders', (_request, response) => response.json({ folders: materialPoolRepository.listFolders() }));
router.post('/material-pool/folders', (request, response) => {
  const parsed = nameSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ code: 'INVALID_FOLDER' });
  try { return response.status(201).json({ folder: materialPoolRepository.createFolder(parsed.data.name, parsed.data.parentId ?? null) }); }
  catch (error) { return response.status(400).json({ code: error instanceof Error ? error.message : 'INVALID_FOLDER' }); }
});
router.patch('/material-pool/folders/:id', (request, response) => {
  const parsed = nameSchema.pick({ name: true }).safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ code: 'INVALID_FOLDER' });
  const folder = materialPoolRepository.renameFolder(request.params.id, parsed.data.name);
  return folder ? response.json({ folder }) : response.status(404).json({ code: 'FOLDER_NOT_FOUND' });
});

router.get('/material-pool/items', (request, response) => {
  const parsed = z.object({ folderId: z.string().optional(), q: z.string().max(200).optional(), mime: z.string().max(120).optional(), state: z.enum(['saved', 'trashed']).optional(), offset: z.coerce.number().int().min(0).optional() }).safeParse(request.query);
  if (!parsed.success) return response.status(400).json({ code: 'INVALID_FILTER' });
  const folderId = parsed.data.folderId === 'unfiled' ? null : parsed.data.folderId;
  return response.json(materialPoolRepository.listItems({ folderId, query: parsed.data.q, mime: parsed.data.mime, state: parsed.data.state, offset: parsed.data.offset }));
});

router.post('/material-pool/items', uploadRateLimit, upload.single('file'), resumeAuthenticatedWorkspace, async (request, response) => {
  const file = request.file;
  if (!file) return response.status(400).json({ code: 'FILE_REQUIRED' });
  let finalPath: string | null = null;
  try {
    const decoded = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const originalName = decoded.includes('\uFFFD') ? file.originalname : decoded;
    const detectedMime = detectMime(file.path, originalName);
    if (!detectedMime) {
      rmSync(file.path, { force: true });
      return response.status(400).json({ code: 'UNSUPPORTED_FILE' });
    }
    const id = randomUUID();
    const sha256 = await hashFile(file.path);
    const destination = authenticatedUploadPath(request, 'material-pool', 'files');
    mkdirSync(destination, { recursive: true });
    finalPath = path.join(destination, id);
    renameSync(file.path, finalPath);
    const item = materialPoolRepository.createItem({
      id, originalName, detectedMime,
      sizeBytes: statSync(finalPath).size, sha256, diskPath: finalPath, source: 'upload',
    });
    const { diskPath: _diskPath, ...publicItem } = item;
    return response.status(201).json({ item: publicItem });
  } catch {
    rmSync(file.path, { force: true });
    if (finalPath) rmSync(finalPath, { force: true });
    return response.status(500).json({ code: 'FILE_SAVE_FAILED' });
  }
});

router.patch('/material-pool/items/:id', (request, response) => {
  const parsed = itemUpdateSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ code: 'INVALID_ITEM_UPDATE' });
  try {
    let item = materialPoolRepository.getItem(request.params.id);
    if (!item) return response.status(404).json({ code: 'ITEM_NOT_FOUND' });
    if (parsed.data.folderId !== undefined) item = materialPoolRepository.moveItem(item.id, parsed.data.folderId);
    if (parsed.data.tags !== undefined) item = materialPoolRepository.setTags(request.params.id, parsed.data.tags);
    if (!item) return response.status(409).json({ code: 'ITEM_NOT_AVAILABLE' });
    const { diskPath: _diskPath, ...publicItem } = item;
    return response.json({ item: publicItem });
  } catch (error) {
    return response.status(400).json({ code: error instanceof Error ? error.message : 'INVALID_ITEM_UPDATE' });
  }
});

router.post('/material-pool/items/:id/trash', (request, response) => {
  try {
    const item = materialPoolRepository.setTrashed(request.params.id, true);
    return item ? response.json({ item: { ...item, diskPath: undefined } }) : response.status(404).json({ code: 'ITEM_NOT_FOUND' });
  } catch { return response.status(409).json({ code: 'ITEM_IN_USE' }); }
});
router.post('/material-pool/items/:id/restore', (request, response) => {
  const item = materialPoolRepository.setTrashed(request.params.id, false);
  return item ? response.json({ item: { ...item, diskPath: undefined } }) : response.status(404).json({ code: 'ITEM_NOT_FOUND' });
});

router.get('/material-pool/items/:id/content', (request, response) => {
  const item = materialPoolRepository.getItem(request.params.id);
  if (!item || item.state !== 'saved') return response.status(404).json({ code: 'ITEM_NOT_FOUND' });
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
  response.setHeader('Content-Disposition', `${item.detectedMime === 'application/pdf' || item.detectedMime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(item.originalName)}`);
  response.type(item.detectedMime);
  try { return response.sendFile(assertPathInsideWorkspace(item.diskPath)); }
  catch { return response.status(404).json({ code: 'ITEM_FILE_MISSING' }); }
});

export default router;
