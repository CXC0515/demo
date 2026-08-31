/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  DiscoverySuggestion,
  KnowledgeEntity,
  KnowledgeRelationType,
  LibraryResource,
  NormalizedDocument,
  ResourceChunk,
} from "../../../src/domain/types";
import { ModelConfig, isModelConfigured } from "../../config/modelConfig";
import { extractJson } from "../model/extractJson";

const entityTypes = [
  "knowledge",
  "question-type",
  "method",
  "example",
  "ability",
  "error",
] as const;
const relationTypes = [
  "parent",
  "prerequisite",
  "related",
  "confusable",
  "examines",
  "applies-to",
  "demonstrates",
  "explains",
] as const;

const modelResultSchema = z.object({
  summary: z.string().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  discoveries: z
    .array(
      z.object({
        kind: z.enum(["node", "relation", "source-link"]),
        proposedType: z.union([z.enum(entityTypes), z.enum(relationTypes)]),
        proposedName: z.string().trim().min(1).max(120),
        description: z.string().max(1000).default(""),
        aliases: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
        confidence: z.number().min(0).max(1),
        rationale: z.string().max(500).default(""),
        sourceChunkIds: z.array(z.string().min(1)).min(1).max(12),
        existingNodeId: z.string().nullable().default(null),
        targetNodeId: z.string().nullable().default(null),
      }),
    )
    .max(80)
    .default([]),
});

export interface ResourceAnalysisResult {
  summary: string;
  tags: string[];
  suggestions: DiscoverySuggestion[];
}

export const buildResourceChunks = (
  resource: LibraryResource,
  document: NormalizedDocument,
  pageOffset = 0,
): ResourceChunk[] => {
  const blocks = [...document.blocks].sort(
    (first, second) => first.order - second.order,
  );
  const pageNumbers = blocks.map(
    (block) => (block.pageNumber ?? 1) + pageOffset,
  );
  const firstPage = pageNumbers.length
    ? Math.min(...pageNumbers)
    : pageOffset + 1;
  const lastPage = pageNumbers.length ? Math.max(...pageNumbers) : firstPage;
  const rootId = `${resource.id}:document`;
  const chunks: ResourceChunk[] = [
    {
      id: rootId,
      resourceId: resource.id,
      level: "document",
      title: resource.title,
      summary: "",
      text: "",
      tags: [],
      pageStart: firstPage,
      pageEnd: lastPage,
      order: 0,
    },
  ];
  let sectionId = rootId;
  let sectionOrder = 1;
  blocks.forEach((block, index) => {
    const pageNumber = (block.pageNumber ?? 1) + pageOffset;
    if (block.type === "heading") {
      sectionId = `${resource.id}:section:${block.id}`;
      chunks.push({
        id: sectionId,
        resourceId: resource.id,
        parentId: rootId,
        level: "section",
        title: block.text.slice(0, 120),
        summary: "",
        text: block.text,
        tags: [],
        pageStart: pageNumber,
        pageEnd: pageNumber,
        boundingBox: block.boundingBox,
        order: sectionOrder++ * 10_000,
      });
    }
    chunks.push({
      id: `${resource.id}:content:${block.id}`,
      resourceId: resource.id,
      parentId: sectionId,
      level: "content",
      title:
        block.type === "heading"
          ? block.text.slice(0, 80)
          : `第 ${pageNumber} 页内容`,
      summary: "",
      text: block.text,
      tags: [],
      pageStart: pageNumber,
      pageEnd: pageNumber,
      boundingBox: block.boundingBox,
      order: index + 1,
    });
  });
  const sectionChunks = chunks.filter((chunk) => chunk.level === "section");
  sectionChunks.forEach((section, index) => {
    const next = sectionChunks[index + 1];
    section.pageEnd = next
      ? Math.max(section.pageStart, next.pageStart - 1)
      : lastPage;
  });
  return chunks;
};

const heuristicAnalysis = (
  resource: LibraryResource,
  chunks: ResourceChunk[],
  nodes: KnowledgeEntity[],
): ResourceAnalysisResult => {
  const content = chunks.filter((chunk) => chunk.level === "content");
  const suggestions: DiscoverySuggestion[] = [];
  nodes.forEach((node) => {
    const terms = [node.name, ...node.aliases].filter(
      (term) => term.length >= 2,
    );
    const matches = content
      .filter((chunk) => terms.some((term) => chunk.text.includes(term)))
      .slice(0, 3);
    if (!matches.length) return;
    suggestions.push({
      id: randomUUID(),
      resourceId: resource.id,
      kind: "source-link",
      status: "pending",
      proposedType: node.type,
      proposedName: node.name,
      description: `资料中出现了“${node.name}”相关内容`,
      aliases: node.aliases,
      confidence: 0.72,
      rationale: `在 ${matches.map((chunk) => `第 ${chunk.pageStart} 页`).join("、")} 找到名称或别名`,
      sourceChunkIds: matches.map((chunk) => chunk.id),
      existingNodeId: node.id,
      createdAt: new Date().toISOString(),
    });
  });
  return {
    summary: `${resource.title} 已完成指定范围的文字识别，等待教师审核知识关联。`,
    tags: [resource.subject, resource.grade, resource.kind].filter(Boolean),
    suggestions,
  };
};

export class ResourceAnalyzer {
  constructor(private readonly config: ModelConfig) {}

  async analyze(
    resource: LibraryResource,
    chunks: ResourceChunk[],
    nodes: KnowledgeEntity[],
  ): Promise<ResourceAnalysisResult> {
    const fallback = heuristicAnalysis(resource, chunks, nodes);
    if (!isModelConfigured(this.config)) return fallback;
    try {
      const contentChunks = chunks
        .filter((chunk) => chunk.level === "content" && chunk.text.trim())
        .slice(0, 240);
      const catalog = nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        aliases: node.aliases,
        description: node.description,
      }));
      const prompt = [
        "你是教师个人资料库的内容分析器。请理解资料，但只能根据提供的原文提出可追溯建议。",
        "对象严格区分：knowledge 知识点、question-type 题型、method 解法、example 例题、ability 能力点、error 错误类型。章节和原文块不是知识节点。",
        "优先匹配已有节点。匹配时 kind=source-link 且 existingNodeId 必须引用目录真实 ID；确实没有对应项才建议 kind=node。",
        "关系建议 kind=relation，existingNodeId 是关系起点，targetNodeId 是终点。所有来源必须引用真实 sourceChunkIds。不要把每个标题都当知识点。",
        '请输出 JSON：{"summary":"","tags":[],"discoveries":[{"kind":"node|relation|source-link","proposedType":"knowledge|question-type|method|example|ability|error|parent|prerequisite|related|confusable|examines|applies-to|demonstrates|explains","proposedName":"","description":"","aliases":[],"confidence":0.8,"rationale":"","sourceChunkIds":[],"existingNodeId":null,"targetNodeId":null}]}。',
        `资料：${JSON.stringify({ title: resource.title, kind: resource.kind, subject: resource.subject, grade: resource.grade })}`,
        `已有图谱：${JSON.stringify(catalog)}`,
        `原文块：${JSON.stringify(contentChunks.map((chunk) => ({ id: chunk.id, page: chunk.pageStart, text: chunk.text.slice(0, 2500) })))}`,
      ].join("\n\n");
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.visionModel,
          messages: [
            {
              role: "system",
              content: "只返回符合要求的 JSON，不要输出解释性文字。",
            },
            { role: "user", content: prompt },
          ],
          reasoning_effort: "low",
        }),
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok)
        throw new Error(`MODEL_REQUEST_FAILED:${response.status}`);
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("MODEL_EMPTY_RESPONSE");
      const result = modelResultSchema.parse(extractJson(content));
      const validChunkIds = new Set(contentChunks.map((chunk) => chunk.id));
      const validNodeIds = new Set(nodes.map((node) => node.id));
      const suggestions = result.discoveries.flatMap((item) => {
        const sourceChunkIds = item.sourceChunkIds.filter((id) =>
          validChunkIds.has(id),
        );
        if (!sourceChunkIds.length) return [];
        if (item.existingNodeId && !validNodeIds.has(item.existingNodeId))
          return [];
        if (item.targetNodeId && !validNodeIds.has(item.targetNodeId))
          return [];
        return [
          {
            id: randomUUID(),
            resourceId: resource.id,
            kind: item.kind,
            status: "pending" as const,
            proposedType: item.proposedType,
            proposedName: item.proposedName,
            description: item.description,
            aliases: item.aliases,
            confidence: item.confidence,
            rationale: item.rationale,
            sourceChunkIds,
            existingNodeId: item.existingNodeId ?? undefined,
            targetNodeId: item.targetNodeId ?? undefined,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      return {
        summary: result.summary || fallback.summary,
        tags: result.tags,
        suggestions,
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "resource_ai_analysis_fallback",
          resourceId: resource.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return fallback;
    }
  }
}
