/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type Database from "better-sqlite3";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE resources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        kind TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        publisher TEXT NOT NULL DEFAULT '',
        edition TEXT NOT NULL DEFAULT '',
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        status TEXT NOT NULL,
        page_count INTEGER,
        disk_path TEXT NOT NULL,
        public_url TEXT NOT NULL,
        parse_error_code TEXT,
        summary TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        parsed_page_start INTEGER,
        parsed_page_end INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE resource_chunks (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        parent_id TEXT REFERENCES resource_chunks(id) ON DELETE CASCADE,
        level TEXT NOT NULL CHECK (level IN ('document', 'section', 'content')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        text TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        page_start INTEGER NOT NULL,
        page_end INTEGER NOT NULL,
        bounding_box_json TEXT,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX resource_chunks_resource_page_idx ON resource_chunks(resource_id, page_start, sort_order);

      CREATE TABLE knowledge_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        aliases_json TEXT NOT NULL DEFAULT '[]',
        subject TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        merged_into_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX knowledge_nodes_active_name_idx ON knowledge_nodes(subject, type, name) WHERE status = 'active';

      CREATE TABLE knowledge_relations (
        id TEXT PRIMARY KEY,
        source_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        target_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_node_id, target_node_id, type)
      );

      CREATE TABLE knowledge_source_links (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        chunk_id TEXT NOT NULL REFERENCES resource_chunks(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
        quote TEXT NOT NULL DEFAULT '',
        bounding_box_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(node_id, chunk_id)
      );

      CREATE TABLE discovery_suggestions (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        proposed_type TEXT NOT NULL,
        proposed_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        aliases_json TEXT NOT NULL DEFAULT '[]',
        confidence REAL NOT NULL,
        rationale TEXT NOT NULL DEFAULT '',
        source_chunk_ids_json TEXT NOT NULL DEFAULT '[]',
        existing_node_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        target_node_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        created_node_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        reviewed_at TEXT
      );
      CREATE INDEX discovery_suggestions_resource_status_idx ON discovery_suggestions(resource_id, status);

      CREATE TABLE entity_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        action TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        actor TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX entity_revisions_entity_idx ON entity_revisions(entity_type, entity_id, version);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE knowledge_nodes ADD COLUMN primary_mother_id TEXT REFERENCES knowledge_nodes(id) ON DELETE SET NULL;
      ALTER TABLE knowledge_nodes ADD COLUMN trainable INTEGER NOT NULL DEFAULT 0 CHECK (trainable IN (0, 1));
      ALTER TABLE knowledge_nodes ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

      UPDATE knowledge_nodes
      SET trainable = CASE WHEN type IN ('knowledge', 'ability') THEN 1 ELSE 0 END;

      UPDATE knowledge_nodes
      SET primary_mother_id = (
        SELECT target_node_id
        FROM knowledge_relations
        WHERE type = 'parent'
          AND status = 'active'
          AND source_node_id = knowledge_nodes.id
        ORDER BY created_at
        LIMIT 1
      )
      WHERE primary_mother_id IS NULL;

      DELETE FROM knowledge_relations WHERE type = 'parent';
      CREATE INDEX knowledge_nodes_mother_order_idx ON knowledge_nodes(primary_mother_id, sort_order, name);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE knowledge_nodes ADD COLUMN code TEXT;
      ALTER TABLE knowledge_nodes ADD COLUMN stage_ids_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE knowledge_nodes ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';

      CREATE UNIQUE INDEX knowledge_nodes_code_idx ON knowledge_nodes(code) WHERE code IS NOT NULL;

      CREATE TABLE knowledge_subjects (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE knowledge_stages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE knowledge_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE resource_pages (
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL CHECK (page_number > 0),
        included INTEGER NOT NULL DEFAULT 1 CHECK (included IN (0, 1)),
        parse_status TEXT NOT NULL DEFAULT 'unparsed' CHECK (parse_status IN ('unparsed', 'processing', 'ready', 'failed')),
        parse_error_code TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (resource_id, page_number)
      );
      CREATE INDEX resource_pages_status_idx ON resource_pages(resource_id, included, parse_status, page_number);

      CREATE TABLE resource_processing_jobs (
        id TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        page_start INTEGER NOT NULL,
        page_end INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
        stage TEXT NOT NULL CHECK (stage IN ('queued', 'preparing', 'ocr', 'analyzing', 'saving', 'completed', 'failed', 'interrupted')),
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX resource_processing_jobs_resource_idx ON resource_processing_jobs(resource_id, created_at DESC);

      INSERT INTO resource_pages (resource_id, page_number, included, parse_status, updated_at)
      WITH RECURSIVE page_numbers(resource_id, page_number, page_count, parsed_start, parsed_end, updated_at) AS (
        SELECT id, 1, page_count, parsed_page_start, parsed_page_end, updated_at
        FROM resources WHERE page_count IS NOT NULL AND page_count > 0
        UNION ALL
        SELECT resource_id, page_number + 1, page_count, parsed_start, parsed_end, updated_at
        FROM page_numbers WHERE page_number < page_count
      )
      SELECT resource_id, page_number, 1,
        CASE WHEN page_number BETWEEN COALESCE(parsed_start, -1) AND COALESCE(parsed_end, -1) THEN 'ready' ELSE 'unparsed' END,
        updated_at
      FROM page_numbers;

      UPDATE resources SET status = 'needs-review', parse_error_code = 'PROCESSING_INTERRUPTED'
      WHERE status = 'processing';
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE resource_pages ADD COLUMN rag_status TEXT NOT NULL DEFAULT 'unindexed'
        CHECK (rag_status IN ('unindexed', 'indexing', 'indexed', 'failed', 'excluded'));
      ALTER TABLE resource_pages ADD COLUMN rag_chunk_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE resource_pages ADD COLUMN rag_indexed_at TEXT;

      CREATE VIRTUAL TABLE resource_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        resource_id UNINDEXED,
        title,
        text,
        tags,
        tokenize = 'unicode61'
      );
      INSERT INTO resource_chunks_fts (chunk_id, resource_id, title, text, tags)
      SELECT id, resource_id, title, text, tags_json FROM resource_chunks WHERE level = 'content';

      CREATE TRIGGER resource_chunks_fts_insert AFTER INSERT ON resource_chunks
      WHEN new.level = 'content' BEGIN
        INSERT INTO resource_chunks_fts (chunk_id, resource_id, title, text, tags)
        VALUES (new.id, new.resource_id, new.title, new.text, new.tags_json);
      END;
      CREATE TRIGGER resource_chunks_fts_delete AFTER DELETE ON resource_chunks
      WHEN old.level = 'content' BEGIN
        DELETE FROM resource_chunks_fts WHERE chunk_id = old.id;
      END;
      CREATE TRIGGER resource_chunks_fts_update AFTER UPDATE ON resource_chunks
      WHEN old.level = 'content' OR new.level = 'content' BEGIN
        DELETE FROM resource_chunks_fts WHERE chunk_id = old.id;
        INSERT INTO resource_chunks_fts (chunk_id, resource_id, title, text, tags)
        SELECT new.id, new.resource_id, new.title, new.text, new.tags_json WHERE new.level = 'content';
      END;

      UPDATE resource_pages
      SET rag_status = CASE WHEN included = 0 THEN 'excluded' ELSE 'indexed' END,
          rag_chunk_count = (
            SELECT COUNT(*) FROM resource_chunks chunk
            WHERE chunk.resource_id = resource_pages.resource_id
              AND chunk.level = 'content'
              AND resource_pages.page_number BETWEEN chunk.page_start AND chunk.page_end
          ),
          rag_indexed_at = CASE WHEN parse_status = 'ready' THEN updated_at ELSE NULL END
      WHERE parse_status = 'ready';
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE resource_processing_jobs ADD COLUMN phase TEXT;
      ALTER TABLE resource_processing_jobs ADD COLUMN metrics_json TEXT NOT NULL DEFAULT '{}';
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE discovery_suggestions ADD COLUMN primary_mother_id TEXT
        REFERENCES knowledge_nodes(id) ON DELETE SET NULL;
    `,
  },
];

export const runResourceMigrations = (database: Database.Database) => {
  database.exec(
    "CREATE TABLE IF NOT EXISTS resource_schema_version (version INTEGER PRIMARY KEY)",
  );
  const currentVersion = database
    .prepare("SELECT MAX(version) AS version FROM resource_schema_version")
    .get() as { version: number | null };
  const pending = migrations.filter(
    (migration) => migration.version > (currentVersion.version ?? 0),
  );
  if (!pending.length) return;
  database.transaction(() => {
    pending.forEach((migration) => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO resource_schema_version (version) VALUES (?)")
        .run(migration.version);
    });
  })();
};
