/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  DiscoverySuggestion,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeRelationType,
  KnowledgeSourceLink,
  LibraryResource,
  ResourceChunk,
} from "../../src/domain/types";
import { getResourceDatabase } from "../database/resourceDatabase";

type JsonObject = Record<string, unknown>;
const parseJson = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toResource = (row: JsonObject): LibraryResource => ({
  id: String(row.id),
  title: String(row.title),
  fileName: String(row.file_name),
  mimeType: String(row.mime_type),
  kind: row.kind as LibraryResource["kind"],
  subject: String(row.subject),
  grade: String(row.grade),
  publisher: String(row.publisher),
  edition: String(row.edition),
  isPrimary: Boolean(row.is_primary),
  status: row.status as LibraryResource["status"],
  pageCount: row.page_count === null ? null : Number(row.page_count),
  publicUrl: String(row.public_url),
  parseErrorCode: row.parse_error_code
    ? String(row.parse_error_code)
    : undefined,
  summary: String(row.summary),
  tags: parseJson(String(row.tags_json), []),
  parsedPageStart:
    row.parsed_page_start === null ? undefined : Number(row.parsed_page_start),
  parsedPageEnd:
    row.parsed_page_end === null ? undefined : Number(row.parsed_page_end),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const toChunk = (row: JsonObject): ResourceChunk => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  parentId: row.parent_id ? String(row.parent_id) : undefined,
  level: row.level as ResourceChunk["level"],
  title: String(row.title),
  summary: String(row.summary),
  text: String(row.text),
  tags: parseJson(String(row.tags_json), []),
  pageStart: Number(row.page_start),
  pageEnd: Number(row.page_end),
  boundingBox: parseJson(
    row.bounding_box_json ? String(row.bounding_box_json) : null,
    undefined,
  ),
  order: Number(row.sort_order),
});

const toNode = (row: JsonObject): KnowledgeEntity => ({
  id: String(row.id),
  name: String(row.name),
  type: row.type as KnowledgeEntity["type"],
  description: String(row.description),
  aliases: parseJson(String(row.aliases_json), []),
  subject: String(row.subject),
  grade: String(row.grade),
  primaryMotherId: row.primary_mother_id
    ? String(row.primary_mother_id)
    : undefined,
  trainable: Boolean(row.trainable),
  sortOrder: Number(row.sort_order ?? 0),
  source: row.source as KnowledgeEntity["source"],
  version: Number(row.version),
  status: row.status as KnowledgeEntity["status"],
  mergedIntoId: row.merged_into_id ? String(row.merged_into_id) : undefined,
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const toRelation = (row: JsonObject): KnowledgeRelation => ({
  id: String(row.id),
  sourceNodeId: String(row.source_node_id),
  targetNodeId: String(row.target_node_id),
  type: row.type as KnowledgeRelation["type"],
  description: String(row.description),
  source: row.source as KnowledgeRelation["source"],
  version: Number(row.version),
  status: row.status as KnowledgeRelation["status"],
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
});

const toSourceLink = (row: JsonObject): KnowledgeSourceLink => ({
  id: String(row.id),
  nodeId: String(row.node_id),
  resourceId: String(row.resource_id),
  chunkId: String(row.chunk_id),
  pageNumber: Number(row.page_number),
  isPrimary: Boolean(row.is_primary),
  quote: String(row.quote),
  boundingBox: parseJson(
    row.bounding_box_json ? String(row.bounding_box_json) : null,
    undefined,
  ),
  createdAt: String(row.created_at),
});

const toSuggestion = (row: JsonObject): DiscoverySuggestion => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  kind: row.kind as DiscoverySuggestion["kind"],
  status: row.status as DiscoverySuggestion["status"],
  proposedType: row.proposed_type as DiscoverySuggestion["proposedType"],
  proposedName: String(row.proposed_name),
  description: String(row.description),
  aliases: parseJson(String(row.aliases_json), []),
  confidence: Number(row.confidence),
  rationale: String(row.rationale),
  sourceChunkIds: parseJson(String(row.source_chunk_ids_json), []),
  existingNodeId: row.existing_node_id
    ? String(row.existing_node_id)
    : undefined,
  targetNodeId: row.target_node_id ? String(row.target_node_id) : undefined,
  createdNodeId: row.created_node_id ? String(row.created_node_id) : undefined,
  createdAt: String(row.created_at),
  reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
});

export interface StoredLibraryResource extends LibraryResource {
  diskPath: string;
}

export class ResourceRepository {
  constructor(private readonly database: Database.Database) {}

  seedBaseKnowledge() {
    const now = new Date().toISOString();
    const nodes: Array<[
      string,
      string,
      KnowledgeEntity["type"],
      string,
      string,
      string,
      string | null,
      number,
      number,
    ]> = [
      [
        "kd_zh_modern_reading",
        "现代文阅读",
        "domain",
        "围绕现代文本理解、分析和鉴赏形成的知识板块",
        "[]",
        "语文",
        null,
        0,
        10,
      ],
      [
        "kt_zh_expression_techniques",
        "表达技巧",
        "topic",
        "作者组织语言、塑造形象和表达情感的常用方式",
        '["表达手法"]',
        "语文",
        "kd_zh_modern_reading",
        0,
        10,
      ],
      [
        "kn_zh_reading_literary",
        "文学类文本阅读",
        "ability",
        "理解、分析和鉴赏文学类文本的综合能力",
        "[]",
        "语文",
        null,
        1,
        10,
      ],
      [
        "kn_zh_rhetoric",
        "修辞手法",
        "knowledge",
        "识别并分析常见修辞手法及其表达效果",
        '["修辞"]',
        "语文",
        "kt_zh_expression_techniques",
        1,
        10,
      ],
      [
        "kn_zh_metaphor",
        "比喻",
        "knowledge",
        "用有相似点的事物描写或说明另一事物",
        '["明喻","暗喻","借喻"]',
        "语文",
        "kn_zh_rhetoric",
        1,
        10,
      ],
      [
        "kn_zh_personification",
        "比拟",
        "knowledge",
        "把物当作人或把人当作物来描写",
        '["拟人","拟物"]',
        "语文",
        "kn_zh_rhetoric",
        1,
        20,
      ],
      [
        "kn_zh_parallelism",
        "排比",
        "knowledge",
        "三个或以上结构相似、语气一致的短语或句子",
        "[]",
        "语文",
        "kn_zh_rhetoric",
        1,
        30,
      ],
      [
        "kn_zh_scene_description",
        "景物描写",
        "knowledge",
        "通过景物特征、顺序和感官等组织描写",
        "[]",
        "语文",
        "kt_zh_expression_techniques",
        1,
        20,
      ],
      [
        "kn_zh_effect_analysis",
        "赏析句子表达效果",
        "question-type",
        "结合手法、内容和情感分析句子的表达效果",
        '["句子赏析"]',
        "语文",
        null,
        0,
        10,
      ],
      [
        "kn_zh_effect_method",
        "手法—内容—情感",
        "method",
        "先判断手法，再联系具体内容，最后说明表达效果或情感",
        '["三步赏析法"]',
        "语文",
        null,
        0,
        10,
      ],
      [
        "kd_math_number_algebra",
        "数与代数",
        "domain",
        "研究数、式、方程和函数关系的数学知识板块",
        "[]",
        "数学",
        null,
        0,
        10,
      ],
      [
        "kt_math_algebra_foundations",
        "代数基础",
        "topic",
        "支撑方程与函数学习的基本运算和变形",
        "[]",
        "数学",
        "kd_math_number_algebra",
        0,
        10,
      ],
      [
        "kt_math_equations",
        "方程与不等式",
        "topic",
        "用代数关系描述并求解未知量",
        "[]",
        "数学",
        "kd_math_number_algebra",
        0,
        20,
      ],
      [
        "kt_math_functions",
        "函数",
        "topic",
        "研究变量之间的对应关系及其图像",
        "[]",
        "数学",
        "kd_math_number_algebra",
        0,
        30,
      ],
      [
        "kn_math_polynomial_operations",
        "整式运算",
        "knowledge",
        "进行整式的加减乘除与恒等变形",
        "[]",
        "数学",
        "kt_math_algebra_foundations",
        1,
        10,
      ],
      [
        "kn_math_factorization",
        "因式分解",
        "knowledge",
        "把多项式化为若干整式乘积",
        "[]",
        "数学",
        "kt_math_algebra_foundations",
        1,
        20,
      ],
      [
        "kn_math_square_root",
        "平方根",
        "knowledge",
        "理解平方根并进行相关运算",
        "[]",
        "数学",
        "kt_math_algebra_foundations",
        1,
        30,
      ],
      [
        "kn_math_linear_equation",
        "一元一次方程",
        "knowledge",
        "理解并求解只含一个未知数的一次方程",
        "[]",
        "数学",
        "kt_math_equations",
        1,
        10,
      ],
      [
        "kn_math_quadratic_equation",
        "一元二次方程",
        "knowledge",
        "理解一元二次方程并选择适当方法求解",
        "[]",
        "数学",
        "kt_math_equations",
        1,
        20,
      ],
      [
        "kn_math_discriminant",
        "根的判别式",
        "knowledge",
        "利用判别式判断一元二次方程实数根的情况",
        '["判别式"]',
        "数学",
        "kn_math_quadratic_equation",
        1,
        10,
      ],
      [
        "kn_math_vieta",
        "根与系数的关系",
        "knowledge",
        "利用一元二次方程根与系数的关系解决问题",
        '["韦达定理"]',
        "数学",
        "kn_math_quadratic_equation",
        1,
        20,
      ],
      [
        "kn_math_quadratic_function",
        "二次函数",
        "knowledge",
        "理解二次函数的图像、性质及应用",
        "[]",
        "数学",
        "kt_math_functions",
        1,
        10,
      ],
      [
        "qt_math_solve_quadratic",
        "解一元二次方程",
        "question-type",
        "选择适当方法求一元二次方程的根",
        "[]",
        "数学",
        null,
        0,
        10,
      ],
      [
        "qt_math_parameter_roots",
        "根的情况与参数取值",
        "question-type",
        "根据根的情况确定参数范围或取值",
        "[]",
        "数学",
        null,
        0,
        20,
      ],
      [
        "km_math_factoring",
        "因式分解法",
        "method",
        "把方程一边化为零，再利用因式分解求根",
        "[]",
        "数学",
        null,
        0,
        10,
      ],
      [
        "km_math_formula",
        "公式法",
        "method",
        "利用求根公式求一元二次方程的根",
        "[]",
        "数学",
        null,
        0,
        20,
      ],
    ];
    const insertNode = this.database.prepare(`
      INSERT OR IGNORE INTO knowledge_nodes
      (id, name, type, description, aliases_json, subject, grade, primary_mother_id, trainable, sort_order, source, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '通用', ?, ?, ?, 'base', 1, 'active', ?, ?)
    `);
    const updateStructure = this.database.prepare(`
      UPDATE knowledge_nodes
      SET primary_mother_id = ?, trainable = ?, sort_order = ?
      WHERE id = ? AND source = 'base'
    `);
    const relations: Array<[string, string, KnowledgeRelationType, string]> = [
      [
        "kn_zh_effect_analysis",
        "kn_zh_metaphor",
        "examines",
        "句子赏析可以考查比喻",
      ],
      [
        "kn_zh_effect_analysis",
        "kn_zh_personification",
        "examines",
        "句子赏析可以考查比拟",
      ],
      [
        "kn_zh_effect_method",
        "kn_zh_effect_analysis",
        "applies-to",
        "该方法适用于句子表达效果题",
      ],
      [
        "kn_zh_scene_description",
        "kn_zh_reading_literary",
        "prerequisite",
        "景物描写分析是文学阅读的基础能力之一",
      ],
      [
        "kn_math_polynomial_operations",
        "kn_math_quadratic_equation",
        "prerequisite",
        "整式运算是一元二次方程变形的基础",
      ],
      [
        "kn_math_factorization",
        "kn_math_quadratic_equation",
        "prerequisite",
        "因式分解支持一元二次方程求解",
      ],
      [
        "kn_math_square_root",
        "kn_math_quadratic_equation",
        "prerequisite",
        "平方根知识支持配方法和公式法",
      ],
      [
        "kn_math_linear_equation",
        "kn_math_quadratic_equation",
        "prerequisite",
        "一元一次方程是方程求解的先修知识",
      ],
      [
        "kn_math_quadratic_equation",
        "kn_math_quadratic_function",
        "prerequisite",
        "一元二次方程支持理解二次函数与横轴交点",
      ],
      [
        "qt_math_solve_quadratic",
        "kn_math_quadratic_equation",
        "examines",
        "该题型直接考查一元二次方程求解",
      ],
      [
        "qt_math_parameter_roots",
        "kn_math_discriminant",
        "examines",
        "该题型考查判别式与参数关系",
      ],
      [
        "km_math_factoring",
        "qt_math_solve_quadratic",
        "applies-to",
        "因式分解法适用于可分解的一元二次方程",
      ],
      [
        "km_math_formula",
        "qt_math_solve_quadratic",
        "applies-to",
        "公式法适用于一般一元二次方程",
      ],
    ];
    const insertRelation = this.database.prepare(`
      INSERT OR IGNORE INTO knowledge_relations
      (id, source_node_id, target_node_id, type, description, source, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'base', 1, 'active', ?, ?)
    `);
    this.database.transaction(() => {
      nodes.forEach((node) => {
        insertNode.run(...node, now, now);
        updateStructure.run(node[6], node[7], node[8], node[0]);
      });
      relations.forEach(([source, target, type, description]) =>
        insertRelation.run(
          `kr_${source}_${type}_${target}`,
          source,
          target,
          type,
          description,
          now,
          now,
        ),
      );
      this.database
        .prepare("DELETE FROM knowledge_relations WHERE type = 'parent'")
        .run();
    })();
  }

  createResource(
    input: Omit<
      StoredLibraryResource,
      "createdAt" | "updatedAt" | "summary" | "tags" | "pageCount" | "status"
    > & { pageCount?: number | null },
  ) {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `
      INSERT INTO resources
      (id, title, file_name, mime_type, kind, subject, grade, publisher, edition, is_primary, status, page_count, disk_path, public_url, summary, tags_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?, '', '[]', ?, ?)
    `,
      )
      .run(
        input.id,
        input.title,
        input.fileName,
        input.mimeType,
        input.kind,
        input.subject,
        input.grade,
        input.publisher,
        input.edition,
        input.isPrimary ? 1 : 0,
        input.pageCount ?? null,
        input.diskPath,
        input.publicUrl,
        now,
        now,
      );
    return this.getStoredResource(input.id)!;
  }

  listResources() {
    return (
      this.database
        .prepare("SELECT * FROM resources ORDER BY updated_at DESC")
        .all() as JsonObject[]
    ).map(toResource);
  }

  getStoredResource(id: string): StoredLibraryResource | undefined {
    const row = this.database
      .prepare("SELECT * FROM resources WHERE id = ?")
      .get(id) as JsonObject | undefined;
    return row
      ? { ...toResource(row), diskPath: String(row.disk_path) }
      : undefined;
  }

  updateResource(
    id: string,
    update: Partial<
      Pick<
        LibraryResource,
        | "title"
        | "kind"
        | "subject"
        | "grade"
        | "publisher"
        | "edition"
        | "isPrimary"
        | "status"
        | "pageCount"
        | "parseErrorCode"
        | "summary"
        | "tags"
        | "parsedPageStart"
        | "parsedPageEnd"
      >
    >,
  ) {
    const current = this.getStoredResource(id);
    if (!current) return undefined;
    const next = { ...current, ...update, updatedAt: new Date().toISOString() };
    this.database
      .prepare(
        `
      UPDATE resources SET title=?, kind=?, subject=?, grade=?, publisher=?, edition=?, is_primary=?, status=?, page_count=?,
      parse_error_code=?, summary=?, tags_json=?, parsed_page_start=?, parsed_page_end=?, updated_at=? WHERE id=?
    `,
      )
      .run(
        next.title,
        next.kind,
        next.subject,
        next.grade,
        next.publisher,
        next.edition,
        next.isPrimary ? 1 : 0,
        next.status,
        next.pageCount,
        next.parseErrorCode ?? null,
        next.summary,
        JSON.stringify(next.tags),
        next.parsedPageStart ?? null,
        next.parsedPageEnd ?? null,
        next.updatedAt,
        id,
      );
    return this.getStoredResource(id);
  }

  deleteResource(id: string) {
    return (
      this.database.prepare("DELETE FROM resources WHERE id = ?").run(id)
        .changes > 0
    );
  }

  replaceChunks(resourceId: string, chunks: ResourceChunk[]) {
    const now = new Date().toISOString();
    const remove = this.database.prepare(
      "DELETE FROM resource_chunks WHERE resource_id = ?",
    );
    const insert = this.database.prepare(`
      INSERT INTO resource_chunks
      (id, resource_id, parent_id, level, title, summary, text, tags_json, page_start, page_end, bounding_box_json, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.database.transaction(() => {
      remove.run(resourceId);
      chunks.forEach((chunk) =>
        insert.run(
          chunk.id,
          resourceId,
          chunk.parentId ?? null,
          chunk.level,
          chunk.title,
          chunk.summary,
          chunk.text,
          JSON.stringify(chunk.tags),
          chunk.pageStart,
          chunk.pageEnd,
          chunk.boundingBox ? JSON.stringify(chunk.boundingBox) : null,
          chunk.order,
          now,
          now,
        ),
      );
    })();
  }

  listChunks(resourceId: string) {
    return (
      this.database
        .prepare(
          "SELECT * FROM resource_chunks WHERE resource_id = ? ORDER BY sort_order",
        )
        .all(resourceId) as JsonObject[]
    ).map(toChunk);
  }

  searchChunks(query: string, limit = 20) {
    const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    return (
      this.database
        .prepare(
          `
      SELECT * FROM resource_chunks
      WHERE level = 'content' AND (title LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\' OR tags_json LIKE ? ESCAPE '\\')
      ORDER BY page_start, sort_order LIMIT ?
    `,
        )
        .all(pattern, pattern, pattern, limit) as JsonObject[]
    ).map(toChunk);
  }

  getChunksByIds(ids: string[]) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    return (
      this.database
        .prepare(`SELECT * FROM resource_chunks WHERE id IN (${placeholders})`)
        .all(...ids) as JsonObject[]
    ).map(toChunk);
  }

  replacePendingSuggestions(
    resourceId: string,
    suggestions: DiscoverySuggestion[],
  ) {
    const remove = this.database.prepare(
      "DELETE FROM discovery_suggestions WHERE resource_id = ? AND status = 'pending'",
    );
    const insert = this.database.prepare(`
      INSERT INTO discovery_suggestions
      (id, resource_id, kind, status, proposed_type, proposed_name, description, aliases_json, confidence, rationale, source_chunk_ids_json,
       existing_node_id, target_node_id, created_node_id, created_at, reviewed_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
    `);
    this.database.transaction(() => {
      remove.run(resourceId);
      suggestions.forEach((item) =>
        insert.run(
          item.id,
          resourceId,
          item.kind,
          item.proposedType,
          item.proposedName,
          item.description,
          JSON.stringify(item.aliases),
          item.confidence,
          item.rationale,
          JSON.stringify(item.sourceChunkIds),
          item.existingNodeId ?? null,
          item.targetNodeId ?? null,
          item.createdAt,
        ),
      );
    })();
  }

  listSuggestions(resourceId?: string) {
    const rows = resourceId
      ? this.database
          .prepare(
            "SELECT * FROM discovery_suggestions WHERE resource_id = ? ORDER BY status, confidence DESC",
          )
          .all(resourceId)
      : this.database
          .prepare(
            "SELECT * FROM discovery_suggestions ORDER BY status, confidence DESC",
          )
          .all();
    return (rows as JsonObject[]).map(toSuggestion);
  }

  listNodes(includeArchived = false) {
    const sql = includeArchived
      ? "SELECT * FROM knowledge_nodes ORDER BY type, name"
      : "SELECT * FROM knowledge_nodes WHERE status = 'active' ORDER BY type, name";
    return (this.database.prepare(sql).all() as JsonObject[]).map(toNode);
  }

  searchNodes(query: string, subject?: string, limit = 20) {
    const pattern = `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    const rows = subject
      ? this.database
          .prepare(
            `SELECT * FROM knowledge_nodes WHERE status='active' AND subject=? AND (name LIKE ? ESCAPE '\\' OR aliases_json LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY name LIMIT ?`,
          )
          .all(subject, pattern, pattern, pattern, limit)
      : this.database
          .prepare(
            `SELECT * FROM knowledge_nodes WHERE status='active' AND (name LIKE ? ESCAPE '\\' OR aliases_json LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY name LIMIT ?`,
          )
          .all(pattern, pattern, pattern, limit);
    return (rows as JsonObject[]).map(toNode);
  }

  getNode(id: string) {
    const row = this.database
      .prepare("SELECT * FROM knowledge_nodes WHERE id = ?")
      .get(id) as JsonObject | undefined;
    return row ? toNode(row) : undefined;
  }

  listKnowledgeTree(subject: string) {
    const structuralTypes = new Set<KnowledgeEntity["type"]>([
      "domain",
      "topic",
      "knowledge",
    ]);
    const nodes = this.listNodes()
      .filter(
        (node) =>
          node.subject === subject && structuralTypes.has(node.type),
      )
      .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name));
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
      subject,
      nodes,
      unclassified: nodes.filter(
        (node) =>
          node.type !== "domain" &&
          (!node.primaryMotherId || !nodeIds.has(node.primaryMotherId)),
      ),
    };
  }

  getKnowledgeFocus(id: string) {
    const node = this.getNode(id);
    if (!node || node.status !== "active") return undefined;
    const nodes = this.listNodes();
    const nodeById = new Map(nodes.map((item) => [item.id, item]));
    const relations = this.listRelations();
    const uniqueNodes = (ids: Iterable<string>) =>
      Array.from(new Set(ids))
        .map((nodeId) => nodeById.get(nodeId))
        .filter((item): item is KnowledgeEntity => Boolean(item));
    const motherChain: KnowledgeEntity[] = [];
    const visited = new Set<string>([node.id]);
    let motherId = node.primaryMotherId;
    while (motherId && !visited.has(motherId)) {
      visited.add(motherId);
      const mother = nodeById.get(motherId);
      if (!mother) break;
      motherChain.unshift(mother);
      motherId = mother.primaryMotherId;
    }
    const prerequisites = uniqueNodes(
      relations
        .filter((relation) => relation.type === "prerequisite" && relation.targetNodeId === id)
        .map((relation) => relation.sourceNodeId),
    );
    const dependents = uniqueNodes(
      relations
        .filter((relation) => relation.type === "prerequisite" && relation.sourceNodeId === id)
        .map((relation) => relation.targetNodeId),
    );
    const questionTypes = uniqueNodes(
      relations
        .filter((relation) => relation.type === "examines" && relation.targetNodeId === id)
        .map((relation) => relation.sourceNodeId),
    );
    const questionTypeIds = new Set(questionTypes.map((item) => item.id));
    if (node.type === "question-type") questionTypeIds.add(node.id);
    const methods = uniqueNodes(
      relations
        .filter(
          (relation) =>
            relation.type === "applies-to" &&
            (relation.targetNodeId === id || questionTypeIds.has(relation.targetNodeId)),
        )
        .map((relation) => relation.sourceNodeId),
    );
    const demonstrationTargets = new Set([
      id,
      ...questionTypeIds,
      ...methods.map((item) => item.id),
    ]);
    const examples = uniqueNodes(
      relations
        .filter(
          (relation) =>
            relation.type === "demonstrates" &&
            demonstrationTargets.has(relation.targetNodeId),
        )
        .map((relation) => relation.sourceNodeId),
    );
    const directlyConnectedIds = relations.flatMap((relation) => {
      if (relation.sourceNodeId === id) return [relation.targetNodeId];
      if (relation.targetNodeId === id) return [relation.sourceNodeId];
      return [];
    });
    const directNodes = uniqueNodes(directlyConnectedIds);
    const related = uniqueNodes(
      relations
        .filter(
          (relation) =>
            relation.type === "related" &&
            (relation.sourceNodeId === id || relation.targetNodeId === id),
        )
        .map((relation) =>
          relation.sourceNodeId === id
            ? relation.targetNodeId
            : relation.sourceNodeId,
        ),
    );
    const confusable = uniqueNodes(
      relations
        .filter(
          (relation) =>
            relation.type === "confusable" &&
            (relation.sourceNodeId === id || relation.targetNodeId === id),
        )
        .map((relation) =>
          relation.sourceNodeId === id
            ? relation.targetNodeId
            : relation.sourceNodeId,
        ),
    );
    const sourceLinks = this.listSourceLinks().filter((link) => link.nodeId === id);
    const resourceIds = new Set(sourceLinks.map((link) => link.resourceId));
    return {
      node,
      motherChain,
      children: nodes
        .filter((item) => item.primaryMotherId === id)
        .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name)),
      prerequisites,
      dependents,
      questionTypes,
      methods,
      examples,
      abilities: directNodes.filter((item) => item.type === "ability"),
      errors: directNodes.filter((item) => item.type === "error"),
      related,
      confusable,
      sourceLinks,
      resources: this.listResources().filter((resource) => resourceIds.has(resource.id)),
    };
  }

  createNode(
    input: Pick<
      KnowledgeEntity,
      "name" | "type" | "description" | "aliases" | "subject" | "grade"
    > & {
      id?: string;
      primaryMotherId?: string;
      trainable?: boolean;
      sortOrder?: number;
      source?: KnowledgeEntity["source"];
    },
  ) {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    if (input.primaryMotherId) {
      const mother = this.getNode(input.primaryMotherId);
      const structuralTypes = new Set<KnowledgeEntity["type"]>([
        "domain",
        "topic",
        "knowledge",
      ]);
      if (
        !mother ||
        mother.status !== "active" ||
        mother.subject !== input.subject ||
        !structuralTypes.has(mother.type) ||
        !structuralTypes.has(input.type)
      ) {
        throw new Error("INVALID_PRIMARY_MOTHER");
      }
    }
    const trainable =
      input.trainable ??
      (input.type === "knowledge" || input.type === "ability");
    this.database
      .prepare(
        `
      INSERT INTO knowledge_nodes (id, name, type, description, aliases_json, subject, grade, primary_mother_id, trainable, sort_order, source, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
    `,
      )
      .run(
        id,
        input.name,
        input.type,
        input.description,
        JSON.stringify(input.aliases),
        input.subject,
        input.grade,
        input.primaryMotherId ?? null,
        trainable ? 1 : 0,
        input.sortOrder ?? 0,
        input.source ?? "teacher",
        now,
        now,
      );
    const node = this.getNode(id)!;
    this.recordRevision("node", id, 1, "create", node);
    return node;
  }

  updateNode(
    id: string,
    update: Partial<
      Pick<
        KnowledgeEntity,
        | "name"
        | "type"
        | "description"
        | "aliases"
        | "subject"
        | "grade"
        | "trainable"
        | "sortOrder"
        | "status"
      >
    > & { primaryMotherId?: string | null },
  ) {
    const current = this.getNode(id);
    if (!current) return undefined;
    const next: KnowledgeEntity = {
      ...current,
      ...update,
      primaryMotherId:
        update.primaryMotherId === null
          ? undefined
          : update.primaryMotherId ?? current.primaryMotherId,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    const structuralTypes = new Set<KnowledgeEntity["type"]>([
      "domain",
      "topic",
      "knowledge",
    ]);
    const activeChildren = this.listNodes().filter(
      (node) => node.primaryMotherId === id,
    );
    if (
      activeChildren.length &&
      (next.subject !== current.subject || !structuralTypes.has(next.type))
    ) {
      throw new Error("KNOWLEDGE_STRUCTURE_HAS_CHILDREN");
    }
    if (next.primaryMotherId) {
      const mother = this.getNode(next.primaryMotherId);
      if (
        !mother ||
        mother.status !== "active" ||
        mother.subject !== next.subject ||
        !structuralTypes.has(mother.type) ||
        !structuralTypes.has(next.type)
      ) {
        throw new Error("INVALID_PRIMARY_MOTHER");
      }
      const visited = new Set([id]);
      let cursor: KnowledgeEntity | undefined = mother;
      while (cursor) {
        if (visited.has(cursor.id)) {
          throw new Error("KNOWLEDGE_STRUCTURE_CYCLE");
        }
        visited.add(cursor.id);
        cursor = cursor.primaryMotherId
          ? this.getNode(cursor.primaryMotherId)
          : undefined;
      }
    }
    if (!structuralTypes.has(next.type)) next.primaryMotherId = undefined;
    this.database
      .prepare(
        `UPDATE knowledge_nodes SET name=?, type=?, description=?, aliases_json=?, subject=?, grade=?, primary_mother_id=?, trainable=?, sort_order=?, status=?, version=?, updated_at=? WHERE id=?`,
      )
      .run(
        next.name,
        next.type,
        next.description,
        JSON.stringify(next.aliases),
        next.subject,
        next.grade,
        next.primaryMotherId ?? null,
        next.trainable ? 1 : 0,
        next.sortOrder,
        next.status,
        next.version,
        next.updatedAt,
        id,
      );
    this.recordRevision("node", id, next.version, "update", next);
    return this.getNode(id);
  }

  updateNodeStructure(
    id: string,
    update: {
      primaryMotherId?: string | null;
      trainable?: boolean;
      sortOrder?: number;
    },
  ) {
    const node = this.getNode(id);
    if (!node) return undefined;
    const nextMotherId =
      update.primaryMotherId === undefined
        ? node.primaryMotherId
        : update.primaryMotherId || undefined;
    return this.updateNode(id, {
      primaryMotherId: nextMotherId ?? null,
      trainable: update.trainable ?? node.trainable,
      sortOrder: update.sortOrder ?? node.sortOrder,
    });
  }

  mergeNode(sourceId: string, targetId: string) {
    const source = this.getNode(sourceId);
    const target = this.getNode(targetId);
    if (!source || !target || sourceId === targetId) return undefined;
    const now = new Date().toISOString();
    this.database.transaction(() => {
      if (target.primaryMotherId === sourceId) {
        this.database
          .prepare(
            "UPDATE knowledge_nodes SET primary_mother_id = ? WHERE id = ?",
          )
          .run(source.primaryMotherId ?? null, targetId);
      }
      this.database
        .prepare(
          "UPDATE knowledge_nodes SET primary_mother_id = ? WHERE primary_mother_id = ? AND id <> ?",
        )
        .run(targetId, sourceId, targetId);
      this.database
        .prepare(
          "UPDATE OR IGNORE knowledge_source_links SET node_id = ? WHERE node_id = ?",
        )
        .run(targetId, sourceId);
      this.database
        .prepare("DELETE FROM knowledge_source_links WHERE node_id = ?")
        .run(sourceId);
      this.database
        .prepare(
          "UPDATE OR IGNORE knowledge_relations SET source_node_id = ? WHERE source_node_id = ?",
        )
        .run(targetId, sourceId);
      this.database
        .prepare(
          "UPDATE OR IGNORE knowledge_relations SET target_node_id = ? WHERE target_node_id = ?",
        )
        .run(targetId, sourceId);
      this.database
        .prepare(
          "DELETE FROM knowledge_relations WHERE source_node_id = ? OR target_node_id = ?",
        )
        .run(sourceId, sourceId);
      this.database
        .prepare(
          "UPDATE knowledge_nodes SET status='merged', merged_into_id=?, version=version+1, updated_at=? WHERE id=?",
        )
        .run(targetId, now, sourceId);
    })();
    this.recordRevision("node", sourceId, source.version + 1, "merge", {
      ...source,
      status: "merged",
      mergedIntoId: targetId,
    });
    return this.getNode(sourceId);
  }

  createRelation(
    input: Pick<
      KnowledgeRelation,
      "sourceNodeId" | "targetNodeId" | "type" | "description"
    > & { source?: KnowledgeRelation["source"] },
  ) {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database
      .prepare(
        `
      INSERT INTO knowledge_relations (id, source_node_id, target_node_id, type, description, source, version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
    `,
      )
      .run(
        id,
        input.sourceNodeId,
        input.targetNodeId,
        input.type,
        input.description,
        input.source ?? "teacher",
        now,
        now,
      );
    const relation = toRelation(
      this.database
        .prepare("SELECT * FROM knowledge_relations WHERE id = ?")
        .get(id) as JsonObject,
    );
    this.recordRevision("relation", id, 1, "create", relation);
    return relation;
  }

  listRelations() {
    return (
      this.database
        .prepare(
          "SELECT * FROM knowledge_relations WHERE status = 'active' ORDER BY created_at",
        )
        .all() as JsonObject[]
    ).map(toRelation);
  }

  listSourceLinks() {
    return (
      this.database
        .prepare(
          "SELECT * FROM knowledge_source_links ORDER BY is_primary DESC, created_at DESC",
        )
        .all() as JsonObject[]
    ).map(toSourceLink);
  }

  listRevisions(entityType: "node" | "relation", entityId: string) {
    return this.database
      .prepare(
        "SELECT version, action, snapshot_json AS snapshot, actor, created_at AS createdAt FROM entity_revisions WHERE entity_type = ? AND entity_id = ? ORDER BY version DESC",
      )
      .all(entityType, entityId) as Array<{
      version: number;
      action: string;
      snapshot: string;
      actor: string;
      createdAt: string;
    }>;
  }

  reviewSuggestion(
    id: string,
    decision: "accepted" | "ignored" | "merged",
    mergeTargetId?: string,
  ) {
    const row = this.database
      .prepare("SELECT * FROM discovery_suggestions WHERE id = ?")
      .get(id) as JsonObject | undefined;
    if (!row) return undefined;
    const suggestion = toSuggestion(row);
    if (suggestion.status !== "pending") return suggestion;
    const resource = this.getStoredResource(suggestion.resourceId);
    const chunks = this.listChunks(suggestion.resourceId);
    const sourceChunk = chunks.find((chunk) =>
      suggestion.sourceChunkIds.includes(chunk.id),
    );
    const now = new Date().toISOString();
    let nodeId = suggestion.existingNodeId;
    this.database.transaction(() => {
      if (decision === "accepted" && suggestion.kind === "node") {
        nodeId =
          nodeId ??
          this.createNode({
            name: suggestion.proposedName,
            type: suggestion.proposedType as KnowledgeEntity["type"],
            description: suggestion.description,
            aliases: suggestion.aliases,
            subject: resource?.subject ?? "",
            grade: resource?.grade ?? "",
            source: "ai-confirmed",
          }).id;
        if (nodeId && sourceChunk)
          this.insertSourceLink(
            nodeId,
            sourceChunk,
            Boolean(resource?.isPrimary),
          );
      }
      if (
        decision === "accepted" &&
        suggestion.kind === "source-link" &&
        suggestion.existingNodeId &&
        sourceChunk
      ) {
        nodeId = suggestion.existingNodeId;
        this.insertSourceLink(
          nodeId,
          sourceChunk,
          Boolean(resource?.isPrimary),
        );
      }
      if (
        decision === "accepted" &&
        suggestion.kind === "relation" &&
        suggestion.existingNodeId &&
        suggestion.targetNodeId
      ) {
        if (suggestion.proposedType === "parent") {
          this.updateNodeStructure(suggestion.existingNodeId, {
            primaryMotherId: suggestion.targetNodeId,
          });
        } else {
          this.createRelation({
            sourceNodeId: suggestion.existingNodeId,
            targetNodeId: suggestion.targetNodeId,
            type: suggestion.proposedType as KnowledgeRelationType,
            description: suggestion.description,
            source: "ai-confirmed",
          });
        }
      }
      if (decision === "merged" && mergeTargetId && sourceChunk) {
        nodeId = mergeTargetId;
        this.insertSourceLink(
          mergeTargetId,
          sourceChunk,
          Boolean(resource?.isPrimary),
        );
      }
      this.database
        .prepare(
          "UPDATE discovery_suggestions SET status=?, created_node_id=?, target_node_id=COALESCE(?, target_node_id), reviewed_at=? WHERE id=?",
        )
        .run(decision, nodeId ?? null, mergeTargetId ?? null, now, id);
    })();
    return toSuggestion(
      this.database
        .prepare("SELECT * FROM discovery_suggestions WHERE id = ?")
        .get(id) as JsonObject,
    );
  }

  private insertSourceLink(
    nodeId: string,
    chunk: ResourceChunk,
    isPrimary: boolean,
  ) {
    this.database
      .prepare(
        `
      INSERT OR IGNORE INTO knowledge_source_links
      (id, node_id, resource_id, chunk_id, page_number, is_primary, quote, bounding_box_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        randomUUID(),
        nodeId,
        chunk.resourceId,
        chunk.id,
        chunk.pageStart,
        isPrimary ? 1 : 0,
        chunk.text.slice(0, 1000),
        chunk.boundingBox ? JSON.stringify(chunk.boundingBox) : null,
        new Date().toISOString(),
      );
  }

  private recordRevision(
    entityType: string,
    entityId: string,
    version: number,
    action: string,
    snapshot: unknown,
  ) {
    this.database
      .prepare(
        "INSERT INTO entity_revisions (entity_type, entity_id, version, action, snapshot_json, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        entityType,
        entityId,
        version,
        action,
        JSON.stringify(snapshot),
        "teacher",
        new Date().toISOString(),
      );
  }
}

export const resourceRepository = new ResourceRepository(getResourceDatabase());
resourceRepository.seedBaseKnowledge();
