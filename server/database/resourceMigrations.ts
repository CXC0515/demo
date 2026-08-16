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
