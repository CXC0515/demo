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
