/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  KnowledgeEntity,
  LibraryResource,
  NormalizedDocument,
} from "../../../src/domain/types";
import { buildResourceChunks, ResourceAnalyzer } from "./resourceAnalyzer";

const resource: LibraryResource = {
  id: "resource-1",
  title: "中学教材全解",
  fileName: "book.pdf",
  mimeType: "application/pdf",
  kind: "supplement",
  subject: "语文",
  grade: "七年级",
  publisher: "",
  edition: "",
  isPrimary: false,
  status: "uploaded",
  pageCount: 334,
  publicUrl: "/api/resources/resource-1/content",
  summary: "",
  tags: [],
  createdAt: "",
  updatedAt: "",
};

test("normalized blocks become document, section and located content chunks", () => {
  const document: NormalizedDocument = {
    assetId: resource.id,
    sourceFormat: "pdf",
    markdown: "",
    resources: [],
    warnings: [],
    parsedAt: "",
    pageCount: 2,
    blocks: [
      {
        id: "heading",
        order: 1,
        type: "heading",
        text: "第一课 春",
        pageNumber: 1,
      },
      {
        id: "content",
        order: 2,
        type: "paragraph",
        text: "运用了比喻和拟人的修辞手法。",
        pageNumber: 2,
        boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
      },
    ],
  };
  const chunks = buildResourceChunks(resource, document, 9);
  assert.equal(chunks[0].level, "document");
  assert.equal(
    chunks.find((chunk) => chunk.level === "section")?.pageStart,
    10,
  );
  assert.equal(
    chunks.find((chunk) => chunk.text.includes("比喻"))?.pageStart,
    11,
  );
  assert.ok(chunks.find((chunk) => chunk.text.includes("比喻"))?.boundingBox);
});

test("unconfigured analyzer still proposes traceable matches to existing nodes", async () => {
  const chunks = [
    {
      id: "chunk-1",
      resourceId: resource.id,
      level: "content" as const,
      title: "内容",
      summary: "",
      text: "这一句使用了比喻，写出了春风的温柔。",
      tags: [],
      pageStart: 12,
      pageEnd: 12,
      order: 1,
    },
  ];
  const nodes: KnowledgeEntity[] = [
    {
      id: "kn-metaphor",
      name: "比喻",
      type: "knowledge",
      description: "",
      aliases: ["明喻"],
      subject: "语文",
      grade: "通用",
      source: "base",
      version: 1,
      status: "active",
      createdAt: "",
      updatedAt: "",
    },
  ];
  const result = await new ResourceAnalyzer({
    apiKey: "",
    baseUrl: "",
    visionModel: "",
  }).analyze(resource, chunks, nodes);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].existingNodeId, "kn-metaphor");
  assert.deepEqual(result.suggestions[0].sourceChunkIds, ["chunk-1"]);
});
