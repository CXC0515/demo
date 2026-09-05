/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createResourceDatabase } from "../database/resourceDatabase";
import { ResourceRepository } from "./resourceRepository";

test("resource review creates an authoritative node and source link", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-repository-"));
  const database = createResourceDatabase(
    path.join(directory, "resources.sqlite"),
  );
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const resource = repository.createResource({
      id: randomUUID(),
      title: "中学教材全解",
      fileName: "book.pdf",
      mimeType: "application/pdf",
      kind: "supplement",
      subject: "语文",
      grade: "七年级",
      publisher: "示例出版社",
      edition: "七上",
      isPrimary: false,
      diskPath: path.join(directory, "book.pdf"),
      publicUrl: "/api/resources/book/content",
      pageCount: 334,
    });
    const chunkId = `${resource.id}:content:1`;
    repository.replaceChunks(resource.id, [
      {
        id: `${resource.id}:document`,
        resourceId: resource.id,
        level: "document",
        title: resource.title,
        summary: "",
        text: "",
        tags: [],
        pageStart: 10,
        pageEnd: 25,
        order: 0,
      },
      {
        id: chunkId,
        resourceId: resource.id,
        parentId: `${resource.id}:document`,
        level: "content",
        title: "第 12 页内容",
        summary: "",
        text: "这里讲解虚实结合的写景方法。",
        tags: [],
        pageStart: 12,
        pageEnd: 12,
        order: 1,
      },
    ]);
    const suggestionId = randomUUID();
    repository.replacePendingSuggestions(resource.id, [
      {
        id: suggestionId,
        resourceId: resource.id,
        kind: "node",
        status: "pending",
        proposedType: "method",
        proposedName: "虚实结合",
        description: "把眼前实景与联想内容结合",
        aliases: [],
        confidence: 0.9,
        rationale: "原文明确讲解",
        sourceChunkIds: [chunkId],
        createdAt: new Date().toISOString(),
      },
    ]);
    const reviewed = repository.reviewSuggestion(suggestionId, "accepted");
    assert.equal(reviewed?.status, "accepted");
    const node = repository
      .listNodes()
      .find((item) => item.name === "虚实结合");
    assert.ok(node);
    assert.equal(
      repository.listSourceLinks().find((item) => item.nodeId === node.id)
        ?.pageNumber,
      12,
    );
    const updated = repository.updateNode(node.id, {
      description: "更新后的说明",
    });
    assert.equal(updated?.version, 2);
    assert.equal(repository.listRevisions("node", node.id).length, 2);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("accepting a knowledge suggestion writes its confirmed primary mother", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-mother-review-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const resource = repository.createResource({
      id: randomUUID(), title: "八年级数学", fileName: "math.pdf", mimeType: "application/pdf",
      kind: "textbook", subject: "数学", grade: "八年级", publisher: "", edition: "",
      isPrimary: false, diskPath: path.join(directory, "math.pdf"), publicUrl: "/content", pageCount: 20,
    });
    const chunkId = `${resource.id}:content:18`;
    repository.replaceChunks(resource.id, [{
      id: chunkId, resourceId: resource.id, level: "content", title: "第 18 页",
      summary: "", text: "三角形的中线", tags: [], pageStart: 18, pageEnd: 18, order: 1,
    }]);
    const suggestionId = randomUUID();
    repository.replacePendingSuggestions(resource.id, [{
      id: suggestionId, resourceId: resource.id, kind: "node", status: "pending",
      proposedType: "knowledge", proposedName: "三角形的中线", description: "中线定义",
      aliases: [], confidence: 0.98, rationale: "原文给出定义", sourceChunkIds: [chunkId],
      primaryMotherId: "kt_math_triangles", createdAt: new Date().toISOString(),
    }]);
    repository.reviewSuggestion(suggestionId, "accepted");
    const node = repository.listNodes().find((item) => item.name === "三角形的中线");
    assert.equal(node?.primaryMotherId, "kt_math_triangles");
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("resource pages stay traceable across partial parses and exclusions", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-pages-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    const resource = repository.createResource({
      id: randomUUID(), title: "逐页资料", fileName: "pages.pdf", mimeType: "application/pdf",
      kind: "supplement", subject: "语文", grade: "七年级", publisher: "", edition: "",
      isPrimary: false, diskPath: path.join(directory, "pages.pdf"), publicUrl: "/content", pageCount: 3,
    });
    assert.equal(repository.listResourcePages(resource.id).length, 3);
    const chunk = (page: number, text: string) => ({
      id: `${resource.id}:content:${page}`, resourceId: resource.id, level: "content" as const,
      title: `第 ${page} 页`, summary: "", text, tags: [], pageStart: page, pageEnd: page, order: page,
    });
    repository.mergeChunksForPages(resource.id, 1, 1, [chunk(1, "共同关键词 第一页")]);
    repository.mergeChunksForPages(resource.id, 2, 2, [chunk(2, "共同关键词 第二页")]);
    assert.equal(repository.listChunks(resource.id).length, 2);
    repository.setResourcePageIncluded(resource.id, 1, false);
    assert.deepEqual(repository.searchChunks("共同关键词").map((item) => item.pageStart), [2]);
    repository.markResourcePages(resource.id, 2, 2, "ready");
    repository.markResourcePagesRag(resource.id, 2, 2, "indexed");
    const indexedPage = repository.listResourcePages(resource.id)[1];
    assert.equal(indexedPage.ragStatus, "indexed");
    assert.equal(indexedPage.ragChunkCount, 1);
    assert.deepEqual(repository.retrieveResourceChunks(resource.id, "共同关键词").map((item) => item.pageStart), [2]);
    const suggestion = (page: number, name: string) => ({
      id: randomUUID(), resourceId: resource.id, kind: "node" as const, status: "pending" as const,
      proposedType: "knowledge" as const, proposedName: name, description: "", aliases: [], confidence: 0.8,
      rationale: "测试", sourceChunkIds: [`${resource.id}:content:${page}`], createdAt: new Date().toISOString(),
    });
    repository.replacePendingSuggestions(resource.id, [suggestion(1, "第一页旧建议"), suggestion(2, "第二页旧建议")]);
    repository.replacePendingSuggestions(resource.id, [suggestion(2, "第二页新建议")], { start: 2, end: 2 });
    assert.deepEqual(repository.listSuggestions(resource.id).map((item) => item.proposedName).sort(), ["第一页旧建议", "第二页新建议"]);
    const job = repository.createProcessingJob(resource.id, 2, 2);
    repository.updateProcessingJob(job.id, { stage: "ocr", phase: "recognizing", metrics: { uploadingMs: 120 } });
    repository.updateProcessingJob(job.id, { status: "completed", stage: "completed", phase: undefined, metrics: { recognizingMs: 4200 }, completedAt: new Date().toISOString() });
    const completedJob = repository.listProcessingJobs(resource.id)[0];
    assert.equal(completedJob.status, "completed");
    assert.deepEqual(completedJob.metrics, { uploadingMs: 120, recognizingMs: 4200 });
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("merging nodes preserves the target and archives the source id", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-merge-"));
  const database = createResourceDatabase(
    path.join(directory, "resources.sqlite"),
  );
  try {
    const repository = new ResourceRepository(database);
    const first = repository.createNode({
      name: "句子赏析",
      type: "question-type",
      description: "",
      aliases: [],
      subject: "语文",
      grade: "通用",
    });
    const target = repository.createNode({
      name: "赏析句子表达效果",
      type: "question-type",
      description: "",
      aliases: [],
      subject: "语文",
      grade: "通用",
    });
    const merged = repository.mergeNode(first.id, target.id);
    assert.equal(merged?.status, "merged");
    assert.equal(merged?.mergedIntoId, target.id);
    assert.equal(
      repository.listNodes().some((node) => node.id === first.id),
      false,
    );
    assert.ok(repository.getNode(target.id));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("base knowledge is organized by a stable mother chain", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-tree-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const tree = repository.listKnowledgeTree("语文");
    assert.equal(tree.nodes.find((node) => node.id === "kt_zh_expression_techniques")?.primaryMotherId, "kd_zh_modern_reading");
    assert.equal(tree.nodes.find((node) => node.id === "kn_zh_rhetoric")?.primaryMotherId, "kt_zh_expression_techniques");
    assert.equal(repository.listRelations().some((relation) => relation.type === "parent"), false);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("knowledge structure rejects a mother-chain cycle", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-cycle-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    const domain = repository.createNode({
      name: "数与代数",
      type: "domain",
      description: "",
      aliases: [],
      subject: "数学",
      grade: "通用",
    });
    const topic = repository.createNode({
      name: "方程",
      type: "topic",
      description: "",
      aliases: [],
      subject: "数学",
      grade: "通用",
      primaryMotherId: domain.id,
    });
    assert.throws(
      () => repository.updateNodeStructure(domain.id, { primaryMotherId: topic.id }),
      /KNOWLEDGE_STRUCTURE_CYCLE/,
    );
    assert.throws(
      () => repository.updateNode(domain.id, { primaryMotherId: topic.id }),
      /KNOWLEDGE_STRUCTURE_CYCLE/,
    );
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("knowledge codes stay stable while names and stages change", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-code-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    repository.createKnowledgeTag("中考重点");
    const node = repository.createNode({
      name: "一次函数图象",
      type: "knowledge",
      description: "",
      aliases: [],
      subject: "数学",
      grade: "八年级上",
      stageIds: ["stage_grade8_1"],
      tags: ["中考重点"],
    });
    assert.match(node.code, /^MATH-KN-\d{6}$/);
    const updated = repository.updateNode(node.id, {
      name: "一次函数的图象",
      grade: "通用",
      stageIds: ["stage_general"],
    });
    assert.equal(updated?.id, node.id);
    assert.equal(updated?.code, node.code);
    assert.deepEqual(updated?.stageIds, ["stage_general"]);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("subject vocabulary controls names without rewriting node identity", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-subject-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const subject = repository.createKnowledgeSubject("信息技术", "IT");
    const node = repository.createNode({ name: "算法基础", type: "knowledge", description: "", aliases: [], subject: subject.name, grade: "通用" });
    repository.updateKnowledgeSubject(subject.id, { name: "信息科技" });
    const updated = repository.getNode(node.id);
    assert.equal(updated?.subject, "信息科技");
    assert.equal(updated?.id, node.id);
    assert.equal(updated?.code, node.code);
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("knowledge focus separates prerequisites, dependents, question types and methods", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-focus-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const focus = repository.getKnowledgeFocus("kn_math_quadratic_equation");
    assert.ok(focus);
    assert.deepEqual(focus.motherChain.map((node) => node.id), [
      "kd_math_number_algebra",
      "kt_math_quadratic_equations",
    ]);
    assert.ok(focus.prerequisites.some((node) => node.id === "kn_math_factorization"));
    assert.ok(focus.dependents.some((node) => node.id === "kn_math_quadratic_function"));
    assert.ok(focus.questionTypes.some((node) => node.id === "qt_math_solve_quadratic"));
    assert.ok(focus.methods.some((node) => node.id === "km_math_factoring"));
    assert.ok(focus.methods.some((node) => node.id === "km_math_completing_square"));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("middle school math backbone persists five domains and 23 visible topics idempotently", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "resource-math-backbone-"));
  const database = createResourceDatabase(path.join(directory, "resources.sqlite"));
  try {
    const repository = new ResourceRepository(database);
    repository.seedBaseKnowledge();
    const firstTree = repository.listKnowledgeTree("数学");
    assert.deepEqual(
      firstTree.nodes.filter((node) => node.type === "domain").map((node) => node.name),
      ["数与代数", "函数", "图形与几何", "统计与概率", "综合与实践"],
    );
    assert.equal(firstTree.nodes.filter((node) => node.type === "topic").length, 23);
    assert.equal(firstTree.unclassified.length, 0);
    assert.equal(
      repository.getNode("kt_math_probability_basics")?.description,
      "随机事件、概率的概念、列表法与树状图法求概率",
    );
    const firstNodeCount = repository.listNodes().length;
    const firstRelationCount = repository.listRelations().length;
    const firstRevisionCount = Number(
      (database.prepare("SELECT COUNT(*) AS count FROM entity_revisions").get() as { count: number }).count,
    );

    repository.seedBaseKnowledge();

    assert.equal(repository.listNodes().length, firstNodeCount);
    assert.equal(repository.listRelations().length, firstRelationCount);
    assert.equal(
      Number((database.prepare("SELECT COUNT(*) AS count FROM entity_revisions").get() as { count: number }).count),
      firstRevisionCount,
    );
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
