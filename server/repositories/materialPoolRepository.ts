import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { PoolFolder, PoolItem } from '../../src/domain/materialPool';
import { getResourceDatabase } from '../database/resourceDatabase';

type Row = Record<string, unknown>;

const folderFromRow = (row: Row): PoolFolder => ({
  id: String(row.id),
  parentId: row.parent_id ? String(row.parent_id) : null,
  name: String(row.name),
  presetKey: row.preset_key ? String(row.preset_key) : null,
  sortOrder: Number(row.sort_order),
});

export class MaterialPoolRepository {
  constructor(private readonly database: Database.Database) {}

  listFolders(): PoolFolder[] {
    return (this.database.prepare('SELECT * FROM pool_folders ORDER BY sort_order, name').all() as Row[]).map(folderFromRow);
  }

  getFolder(id: string) {
    const row = this.database.prepare('SELECT * FROM pool_folders WHERE id = ?').get(id) as Row | undefined;
    return row ? folderFromRow(row) : undefined;
  }

  createFolder(name: string, parentId: string | null) {
    let depth = 1;
    let ancestor = parentId;
    while (ancestor) {
      const parent = this.getFolder(ancestor);
      if (!parent) throw new Error('FOLDER_NOT_FOUND');
      depth += 1;
      ancestor = parent.parentId;
    }
    if (depth > 3) throw new Error('FOLDER_DEPTH_EXCEEDED');
    const duplicate = this.database.prepare('SELECT 1 FROM pool_folders WHERE parent_id IS ? AND name = ?').get(parentId, name);
    if (duplicate) throw new Error('FOLDER_NAME_EXISTS');
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare('INSERT INTO pool_folders (id, parent_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, 100, ?, ?)').run(id, parentId, name, now, now);
    return this.getFolder(id)!;
  }

  renameFolder(id: string, name: string) {
    const current = this.getFolder(id);
    if (!current) return undefined;
    const duplicate = this.database.prepare('SELECT 1 FROM pool_folders WHERE parent_id IS ? AND name = ? AND id <> ?').get(current.parentId, name, id);
    if (duplicate) throw new Error('FOLDER_NAME_EXISTS');
    const result = this.database.prepare('UPDATE pool_folders SET name = ?, updated_at = ? WHERE id = ?').run(name, new Date().toISOString(), id);
    return result.changes ? this.getFolder(id) : undefined;
  }

  private tagsForItem(id: string): string[] {
    return (this.database.prepare('SELECT t.name FROM pool_tags t JOIN pool_item_tags it ON it.tag_id = t.id WHERE it.item_id = ? ORDER BY t.name').all(id) as Array<{ name: string }>).map(row => row.name);
  }

  private itemFromRow(row: Row): PoolItem {
    const id = String(row.id);
    return {
      id,
      folderId: row.folder_id ? String(row.folder_id) : null,
      originalName: String(row.original_name),
      detectedMime: String(row.detected_mime),
      sizeBytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      state: row.state as PoolItem['state'],
      source: String(row.source),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      tags: this.tagsForItem(id),
      resourceId: row.resource_id ? String(row.resource_id) : null,
      resourceStatus: row.resource_status ? String(row.resource_status) : null,
      contentUrl: `/api/material-pool/items/${id}/content`,
    };
  }

  getItem(id: string): (PoolItem & { diskPath: string }) | undefined {
    const row = this.database.prepare(`
      SELECT i.*, r.id AS resource_id, r.status AS resource_status
      FROM pool_items i LEFT JOIN resources r ON r.pool_item_id = i.id WHERE i.id = ?
    `).get(id) as Row | undefined;
    return row ? { ...this.itemFromRow(row), diskPath: String(row.disk_path) } : undefined;
  }

  listItems(filter: { folderId?: string | null; query?: string; mime?: string; state?: PoolItem['state']; offset?: number; limit?: number } = {}) {
    const where = ['i.state = ?'];
    const args: Array<string | number> = [filter.state ?? 'saved'];
    if (filter.folderId !== undefined) {
      where.push(filter.folderId === null ? 'i.folder_id IS NULL' : 'i.folder_id = ?');
      if (filter.folderId !== null) args.push(filter.folderId);
    }
    if (filter.mime) { where.push('i.detected_mime = ?'); args.push(filter.mime); }
    if (filter.query) {
      where.push(`(i.original_name LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM pool_item_tags it JOIN pool_tags t ON t.id = it.tag_id
        WHERE it.item_id = i.id AND t.name LIKE ? ESCAPE '\\'))`);
      const escaped = filter.query.replace(/[\\%_]/g, '\\$&');
      args.push(`%${escaped}%`, `%${escaped}%`);
    }
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const rows = this.database.prepare(`
      SELECT i.*, r.id AS resource_id, r.status AS resource_status
      FROM pool_items i LEFT JOIN resources r ON r.pool_item_id = i.id
      WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC, i.id DESC LIMIT ? OFFSET ?
    `).all(...args, limit + 1, offset) as Row[];
    return { items: rows.slice(0, limit).map(row => this.itemFromRow(row)), nextOffset: rows.length > limit ? offset + limit : null };
  }

  createItem(input: { id: string; originalName: string; detectedMime: string; sizeBytes: number; sha256: string; diskPath: string; source: string; folderId?: string | null }) {
    if (input.folderId && !this.getFolder(input.folderId)) throw new Error('FOLDER_NOT_FOUND');
    const now = new Date().toISOString();
    this.database.prepare(`INSERT INTO pool_items
      (id, folder_id, original_name, detected_mime, size_bytes, sha256, disk_path, state, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'saved', ?, ?, ?)`)
      .run(input.id, input.folderId ?? null, input.originalName, input.detectedMime, input.sizeBytes, input.sha256, input.diskPath, input.source, now, now);
    return this.getItem(input.id)!;
  }

  removeItemRecord(id: string) {
    this.database.prepare('DELETE FROM pool_items WHERE id = ? AND NOT EXISTS (SELECT 1 FROM resources WHERE pool_item_id = ?)').run(id, id);
  }

  moveItem(id: string, folderId: string | null) {
    if (folderId && !this.getFolder(folderId)) throw new Error('FOLDER_NOT_FOUND');
    const result = this.database.prepare("UPDATE pool_items SET folder_id = ?, updated_at = ? WHERE id = ? AND state = 'saved'").run(folderId, new Date().toISOString(), id);
    return result.changes ? this.getItem(id) : undefined;
  }

  setTags(id: string, names: string[]) {
    if (!this.getItem(id)) return undefined;
    this.database.transaction(() => {
      this.database.prepare('DELETE FROM pool_item_tags WHERE item_id = ?').run(id);
      for (const name of [...new Set(names)]) {
        this.database.prepare('INSERT OR IGNORE INTO pool_tags (id, name, created_at) VALUES (?, ?, ?)').run(randomUUID(), name, new Date().toISOString());
        const tag = this.database.prepare('SELECT id FROM pool_tags WHERE name = ?').get(name) as { id: string };
        this.database.prepare('INSERT INTO pool_item_tags (item_id, tag_id) VALUES (?, ?)').run(id, tag.id);
      }
      this.database.prepare('UPDATE pool_items SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    })();
    return this.getItem(id);
  }

  setTrashed(id: string, trashed: boolean) {
    const item = this.getItem(id);
    if (!item) return undefined;
    if (trashed && item.resourceId) throw new Error('ITEM_IN_USE');
    const now = new Date().toISOString();
    this.database.prepare('UPDATE pool_items SET state = ?, trashed_at = ?, updated_at = ? WHERE id = ?')
      .run(trashed ? 'trashed' : 'saved', trashed ? now : null, now, id);
    return this.getItem(id);
  }
}

export const materialPoolRepository = new Proxy({} as MaterialPoolRepository, {
  get(_target, property) {
    const repository = new MaterialPoolRepository(getResourceDatabase());
    const value = Reflect.get(repository, property);
    return typeof value === 'function' ? value.bind(repository) : value;
  },
});
