/**
 * Backfill historical OCR block metadata and canonical page images.
 * Dry-run is the default. Applying to the configured product root requires a
 * separately verified product snapshot path.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { runtimeConfig } from '../config/runtimeConfig';
import { runResourceMigrations } from '../database/resourceMigrations';
import { normalizePaddleBlockType } from '../services/materials/PaddleVisionMaterialParser';
import { verifyProductSnapshot } from '../services/operations/productSnapshot';
import { richBlockToPlainText } from '../services/resources/resourceAnalyzer';

const argumentsMap = new Map(process.argv.slice(2).map(argument => {
  const [key, ...parts] = argument.split('=');
  return [key, parts.join('=')];
}));
const root = path.resolve(argumentsMap.get('--root') || '');
const apply = argumentsMap.has('--apply');
const backup = argumentsMap.get('--backup');
if (!argumentsMap.get('--root')) throw new Error('Usage: npm run backfill:resource-ocr -- --root=<product-copy> [--apply] [--backup=<verified-snapshot>]');
if (apply && root === path.resolve(runtimeConfig.dataRoot)) {
  if (!backup) throw new Error('VERIFIED_BACKUP_REQUIRED_FOR_AUTHORITATIVE_ROOT');
  await verifyProductSnapshot(path.resolve(backup));
}

const hashFile = async (file: string) => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
};

interface PaddleBlock {
  block_id: number;
  block_order?: number | null;
  block_label: string;
  block_content: string;
}
interface ArtifactPage {
  pageNumber: number;
  inputImageUrl?: string;
  markdown?: { images?: Record<string, string> };
  prunedResult?: { width?: number; height?: number; parsing_res_list?: PaddleBlock[] };
}

const report = { workspaces: 0, resources: 0, blockCandidates: 0, blocksUpdated: 0, pageImages: 0, skippedImages: 0, blockMismatchPages: 0, imageMismatchPages: 0, apply };
const workspacesRoot = path.join(root, 'workspaces');
for (const workspaceEntry of await readdir(workspacesRoot, { withFileTypes: true })) {
  if (!workspaceEntry.isDirectory()) continue;
  const workspaceRoot = path.join(workspacesRoot, workspaceEntry.name);
  const databasePath = path.join(workspaceRoot, 'data', 'resources.sqlite');
  try { await access(databasePath); } catch { continue; }
  report.workspaces += 1;
  const database = new Database(databasePath, apply ? undefined : { readonly: true });
  try {
    if (apply) runResourceMigrations(database);
    const hasRichColumns = (database.prepare('PRAGMA table_info(resource_chunks)').all() as Array<{ name: string }>).some(column => column.name === 'source_type');
    const resources = database.prepare('SELECT id FROM resources').all() as Array<{ id: string }>;
    for (const resource of resources) {
      const artifactPath = path.join(workspaceRoot, 'data', 'parser-artifacts', `${resource.id}.json`);
      let pages: ArtifactPage[] = [];
      try { pages = (JSON.parse(await readFile(artifactPath, 'utf8')) as { pages?: ArtifactPage[] }).pages ?? []; } catch { continue; }
      report.resources += 1;
      for (const page of pages) {
        const blocks = [...(page.prunedResult?.parsing_res_list ?? [])]
          .filter(block => block.block_content.trim())
          .sort((left, right) => (left.block_order ?? left.block_id) - (right.block_order ?? right.block_id));
        report.blockCandidates += blocks.length;
        const chunks = database.prepare("SELECT id FROM resource_chunks WHERE resource_id = ? AND level = 'content' AND page_start = ? ORDER BY sort_order").all(resource.id, page.pageNumber) as Array<{ id: string }>;
        if (chunks.length !== blocks.length) {
          report.blockMismatchPages += 1;
        } else if (hasRichColumns) {
          const update = database.prepare('UPDATE resource_chunks SET source_type = ?, content_type = ?, text = ?, markdown = ?, resource_urls_json = ? WHERE id = ?');
          const updateSection = database.prepare("UPDATE resource_chunks SET source_type = ?, content_type = 'heading', text = ?, markdown = ? WHERE id = ?");
          blocks.forEach((block, index) => {
            const pageImages = Object.entries(page.markdown?.images ?? {});
            const explicitImages = pageImages.filter(([sourceName]) => block.block_content.includes(sourceName));
            const imageOrdinal = normalizePaddleBlockType(block.block_label) === 'image'
              ? blocks.slice(0, index + 1).filter(candidate => normalizePaddleBlockType(candidate.block_label) === 'image').length - 1
              : -1;
            const imageUrls = (explicitImages.length ? explicitImages : imageOrdinal >= 0 && pageImages[imageOrdinal] ? [pageImages[imageOrdinal]] : [])
              .map(([, remoteUrl]) => `/api/resources/${encodeURIComponent(resource.id)}/derived/resources/${encodeURIComponent(path.basename(new URL(remoteUrl).pathname))}`);
            if (apply) {
              update.run(block.block_label, normalizePaddleBlockType(block.block_label), richBlockToPlainText(block.block_content), block.block_content, JSON.stringify(imageUrls), chunks[index].id);
              if (normalizePaddleBlockType(block.block_label) === 'heading') updateSection.run(block.block_label, richBlockToPlainText(block.block_content), block.block_content, chunks[index].id.replace(':content:', ':section:'));
              report.blocksUpdated += 1;
            }
          });
        }
        if (!page.inputImageUrl) { report.skippedImages += 1; continue; }
        const source = path.join(workspaceRoot, 'uploads', 'parsed', resource.id, 'resources', path.basename(new URL(page.inputImageUrl).pathname));
        const target = path.join(workspaceRoot, 'uploads', 'parsed', resource.id, 'page-images', `page-${page.pageNumber}.jpg`);
        try {
          const metadata = await sharp(source).metadata();
          const sourceRatio = (metadata.width ?? 0) / (metadata.height ?? 1);
          const ocrRatio = (page.prunedResult?.width ?? 0) / (page.prunedResult?.height ?? 1);
          if (!Number.isFinite(sourceRatio) || !Number.isFinite(ocrRatio) || Math.abs(sourceRatio - ocrRatio) > 0.01) {
            report.imageMismatchPages += 1;
            continue;
          }
          if (apply) {
            await mkdir(path.dirname(target), { recursive: true });
            await copyFile(source, target);
            if (await hashFile(source) !== await hashFile(target)) throw new Error(`PAGE_IMAGE_COPY_MISMATCH:${target}`);
          }
          report.pageImages += 1;
        } catch { report.skippedImages += 1; }
      }
    }
  } finally { database.close(); }
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
