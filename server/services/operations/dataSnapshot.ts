/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, cp, lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATABASE_FILES = ['roster.sqlite', 'resources.sqlite'] as const;
const SNAPSHOT_DIRECTORIES = ['data', 'uploads'] as const;

export interface SnapshotFile {
  path: string;
  size: number;
  sha256: string;
}

export interface DatabaseVerification {
  file: string;
  integrity: string;
  counts: Record<string, number>;
}

export interface AppDataVerification {
  root: string;
  databases: DatabaseVerification[];
  referencedFiles: number;
  missingReferencedFiles: string[];
  files: number;
  bytes: number;
}

export interface SnapshotManifest {
  formatVersion: 1;
  createdAt: string;
  sourceRoot: string;
  files: SnapshotFile[];
  verification: AppDataVerification;
}

const tableSets: Record<(typeof DATABASE_FILES)[number], string[]> = {
  'roster.sqlite': [
    'classes',
    'students',
    'class_memberships',
    'classroom_layouts',
    'classroom_seats',
    'committee_roles',
    'committee_assignments',
    'schedule_items',
    'schedule_periods',
    'timer_reminders',
  ],
  'resources.sqlite': [
    'resources',
    'resource_pages',
    'resource_chunks',
    'knowledge_nodes',
    'knowledge_relations',
    'knowledge_source_links',
    'discovery_suggestions',
    'resource_processing_jobs',
  ],
};

const isInside = (root: string, candidate: string) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const assertDistinctRoots = (sourceRoot: string, destinationRoot: string) => {
  if (sourceRoot === destinationRoot) throw new Error('SOURCE_AND_DESTINATION_MUST_DIFFER');
  if (isInside(destinationRoot, sourceRoot)) throw new Error('SOURCE_CANNOT_BE_INSIDE_DESTINATION');
};

const assertSnapshotDestinationIsSafe = (sourceRoot: string, destinationRoot: string) => {
  for (const directory of SNAPSHOT_DIRECTORIES) {
    if (isInside(path.join(sourceRoot, directory), destinationRoot)) {
      throw new Error(`SNAPSHOT_DESTINATION_INSIDE_SOURCE_DATA:${directory}`);
    }
  }
};

const ensureAbsent = async (target: string) => {
  try {
    await lstat(target);
    throw new Error(`TARGET_ALREADY_EXISTS:${target}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
  }
};

const hashFile = async (filePath: string) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
};

const listFiles = async (root: string, current = root): Promise<string[]> => {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`SYMLINK_NOT_ALLOWED:${absolute}`);
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute));
  }
  return files.sort();
};

const buildFileManifest = async (root: string) => {
  const relativeFiles = await listFiles(root);
  const files: SnapshotFile[] = [];
  for (const relativePath of relativeFiles) {
    if (relativePath === 'manifest.json' || relativePath === 'restore-report.json') continue;
    const absolute = path.join(root, relativePath);
    const metadata = await stat(absolute);
    files.push({ path: relativePath, size: metadata.size, sha256: await hashFile(absolute) });
  }
  return files;
};

const databaseVerification = (databasePath: string, file: (typeof DATABASE_FILES)[number]) => {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = String(database.pragma('integrity_check', { simple: true }));
    const availableTables = new Set(
      (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name),
    );
    const counts = Object.fromEntries(tableSets[file]
      .filter((table) => availableTables.has(table))
      .map((table) => [table, Number((database.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number }).count)]));
    return { file, integrity, counts };
  } finally {
    database.close();
  }
};

export const verifyAppData = async (rootInput: string): Promise<AppDataVerification> => {
  const root = path.resolve(rootInput);
  await access(root);
  const databases = DATABASE_FILES.map((file) => databaseVerification(path.join(root, 'data', file), file));
  const resourceDatabase = new Database(path.join(root, 'data', 'resources.sqlite'), { readonly: true, fileMustExist: true });
  let diskPaths: string[] = [];
  try {
    const hasResources = resourceDatabase.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'resources'").get() as { count: number };
    if (hasResources.count) {
      diskPaths = (resourceDatabase.prepare('SELECT disk_path FROM resources').all() as Array<{ disk_path: string }>).map((row) => row.disk_path);
    }
  } finally {
    resourceDatabase.close();
  }
  const missingReferencedFiles: string[] = [];
  for (const diskPath of diskPaths) {
    try { await access(diskPath); }
    catch { missingReferencedFiles.push(diskPath); }
  }
  const files = await buildFileManifest(root);
  return {
    root,
    databases,
    referencedFiles: diskPaths.length,
    missingReferencedFiles,
    files: files.length,
    bytes: files.reduce((total, file) => total + file.size, 0),
  };
};

const copySnapshotDirectory = async (sourceRoot: string, destinationRoot: string, directory: string) => {
  const source = path.join(sourceRoot, directory);
  const destination = path.join(destinationRoot, directory);
  await mkdir(destination, { recursive: true });
  await cp(source, destination, {
    recursive: true,
    filter: (candidate) => {
      const name = path.basename(candidate);
      if (directory === 'data' && (/\.sqlite(?:-wal|-shm)?$/.test(name) || /^\.incoming-/.test(name))) return false;
      return true;
    },
  });
};

export const createAppDataSnapshot = async (sourceInput: string, destinationInput: string) => {
  const sourceRoot = path.resolve(sourceInput);
  const destinationRoot = path.resolve(destinationInput);
  assertDistinctRoots(sourceRoot, destinationRoot);
  assertSnapshotDestinationIsSafe(sourceRoot, destinationRoot);
  await access(sourceRoot);
  await ensureAbsent(destinationRoot);
  await mkdir(path.join(destinationRoot, 'data'), { recursive: true });

  for (const directory of SNAPSHOT_DIRECTORIES) await copySnapshotDirectory(sourceRoot, destinationRoot, directory);
  for (const file of DATABASE_FILES) {
    const sourceDatabase = new Database(path.join(sourceRoot, 'data', file), { readonly: true, fileMustExist: true });
    try {
      await sourceDatabase.backup(path.join(destinationRoot, 'data', file));
    } finally {
      sourceDatabase.close();
    }
  }

  const verification = await verifyAppData(destinationRoot);
  if (verification.databases.some((database) => database.integrity !== 'ok')) throw new Error('SNAPSHOT_DATABASE_INTEGRITY_FAILED');
  const files = await buildFileManifest(destinationRoot);
  const manifest: SnapshotManifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    sourceRoot,
    files,
    verification,
  };
  await writeFile(path.join(destinationRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return manifest;
};

export const verifySnapshot = async (snapshotInput: string) => {
  const snapshotRoot = path.resolve(snapshotInput);
  const manifest = JSON.parse(await readFile(path.join(snapshotRoot, 'manifest.json'), 'utf8')) as SnapshotManifest;
  if (manifest.formatVersion !== 1) throw new Error('UNSUPPORTED_SNAPSHOT_FORMAT');
  const actualFiles = await buildFileManifest(snapshotRoot);
  const expected = new Map(manifest.files.map((file) => [file.path, file]));
  if (actualFiles.length !== expected.size) throw new Error('SNAPSHOT_FILE_COUNT_MISMATCH');
  for (const actual of actualFiles) {
    const recorded = expected.get(actual.path);
    if (!recorded || recorded.size !== actual.size || recorded.sha256 !== actual.sha256) {
      throw new Error(`SNAPSHOT_FILE_MISMATCH:${actual.path}`);
    }
  }
  return manifest;
};

const remapValue = (value: unknown, sourceRoot: string, targetRoot: string): unknown => {
  if (typeof value === 'string' && path.isAbsolute(value) && isInside(sourceRoot, value)) {
    return path.join(targetRoot, path.relative(sourceRoot, value));
  }
  if (Array.isArray(value)) return value.map((item) => remapValue(item, sourceRoot, targetRoot));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, remapValue(nested, sourceRoot, targetRoot)]));
  }
  return value;
};

const remapJsonPaths = async (targetRoot: string, sourceRoot: string) => {
  const dataRoot = path.join(targetRoot, 'data');
  const files = await listFiles(dataRoot);
  for (const relativePath of files.filter((file) => file.endsWith('.json'))) {
    const absolute = path.join(dataRoot, relativePath);
    const current = JSON.parse(await readFile(absolute, 'utf8')) as unknown;
    const remapped = remapValue(current, sourceRoot, targetRoot);
    await writeFile(absolute, JSON.stringify(remapped));
  }
};

const remapResourceDatabasePaths = (targetRoot: string, sourceRoot: string) => {
  const databasePath = path.join(targetRoot, 'data', 'resources.sqlite');
  const database = new Database(databasePath);
  try {
    const rows = database.prepare('SELECT id, disk_path FROM resources').all() as Array<{ id: string; disk_path: string }>;
    const update = database.prepare('UPDATE resources SET disk_path = ? WHERE id = ?');
    database.transaction(() => {
      for (const row of rows) {
        if (!path.isAbsolute(row.disk_path) || !isInside(sourceRoot, row.disk_path)) continue;
        update.run(path.join(targetRoot, path.relative(sourceRoot, row.disk_path)), row.id);
      }
    })();
  } finally {
    database.close();
  }
};

export const restoreAppDataSnapshot = async (snapshotInput: string, targetInput: string) => {
  const snapshotRoot = path.resolve(snapshotInput);
  const targetRoot = path.resolve(targetInput);
  const manifest = await verifySnapshot(snapshotRoot);
  assertDistinctRoots(snapshotRoot, targetRoot);
  if (isInside(snapshotRoot, targetRoot)) throw new Error('RESTORE_TARGET_CANNOT_BE_INSIDE_SNAPSHOT');
  await ensureAbsent(targetRoot);
  await mkdir(targetRoot, { recursive: false });
  for (const directory of SNAPSHOT_DIRECTORIES) {
    await cp(path.join(snapshotRoot, directory), path.join(targetRoot, directory), { recursive: true });
  }
  remapResourceDatabasePaths(targetRoot, manifest.sourceRoot);
  await remapJsonPaths(targetRoot, manifest.sourceRoot);
  const verification = await verifyAppData(targetRoot);
  if (verification.databases.some((database) => database.integrity !== 'ok') || verification.missingReferencedFiles.length) {
    throw new Error('RESTORE_VERIFICATION_FAILED');
  }
  const report = {
    formatVersion: 1,
    restoredAt: new Date().toISOString(),
    snapshotRoot,
    targetRoot,
    sourceRoot: manifest.sourceRoot,
    verification,
  };
  await writeFile(path.join(targetRoot, 'restore-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
};
