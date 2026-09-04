/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DiscoverySuggestion,
  KnowledgeEntity,
  KnowledgeFocusSnapshot,
  KnowledgeGraphSnapshot,
  KnowledgeSubject,
  KnowledgeTag,
  KnowledgeRelation,
  KnowledgeRelationType,
  KnowledgeTreeSnapshot,
  LibraryResource,
  ResourceDetail,
  ResourcePageState,
  ResourceKind,
  ResourceChunk,
} from "../domain/types";

const readErrorCode = async (response: Response) => {
  const body = (await response.json().catch(() => ({}))) as { code?: string };
  return body.code ?? `HTTP_${response.status}`;
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(await readErrorCode(response));
  return response.json() as Promise<T>;
};

export interface ResourceMetadataInput {
  title: string;
  kind: ResourceKind;
  subject: string;
  grade: string;
  publisher: string;
  edition: string;
  isPrimary: boolean;
}

export const listLibraryResources = async () =>
  (await requestJson<{ resources: LibraryResource[] }>("/api/resources"))
    .resources;

export const getLibraryResource = async (resourceId: string) =>
  (
    await requestJson<{ resource: ResourceDetail }>(
      `/api/resources/${resourceId}`,
    )
  ).resource;

export const uploadLibraryResource = async (
  file: File,
  metadata: ResourceMetadataInput,
) => {
  const form = new FormData();
  form.set("file", file);
  Object.entries(metadata).forEach(([key, value]) =>
    form.set(key, String(value)),
  );
  return (
    await requestJson<{ resource: LibraryResource }>("/api/resources", {
      method: "POST",
      body: form,
    })
  ).resource;
};

export const updateLibraryResource = async (
  resourceId: string,
  metadata: Partial<ResourceMetadataInput>,
) =>
  (
    await requestJson<{ resource: LibraryResource }>(
      `/api/resources/${resourceId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      },
    )
  ).resource;

export const deleteLibraryResource = async (resourceId: string) => {
  const response = await fetch(`/api/resources/${resourceId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
};

export const analyzeLibraryResource = async (
  resourceId: string,
  pageStart: number,
  pageEnd: number,
) =>
  (
    await requestJson<{ resource: LibraryResource }>(
      `/api/resources/${resourceId}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageStart, pageEnd }),
      },
    )
  ).resource;

export const setLibraryResourcePageIncluded = async (
  resourceId: string,
  pageNumber: number,
  included: boolean,
) => (
  await requestJson<{ page: ResourcePageState }>(
    `/api/resources/${resourceId}/pages/${pageNumber}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included }),
    },
  )
).page;

export const retrieveLibraryResource = async (resourceId: string, query: string) => (
  await requestJson<{ results: Array<ResourceChunk & { retrievalRank: number }> }>(
    `/api/resources/${resourceId}/retrieve?q=${encodeURIComponent(query)}`,
  )
).results;

export const getKnowledgeGraph = async (query = "") => {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return requestJson<KnowledgeGraphSnapshot>(`/api/knowledge${suffix}`);
};

export type KnowledgeNodeInput = Pick<
  KnowledgeEntity,
  "name" | "type" | "description" | "aliases" | "subject" | "grade" | "stageIds" | "tags"
> & Partial<Pick<KnowledgeEntity, "trainable" | "sortOrder">> & {
  primaryMotherId?: string | null;
};
export const createKnowledgeNode = async (input: KnowledgeNodeInput) =>
  (
    await requestJson<{ node: KnowledgeEntity }>("/api/knowledge/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  ).node;

export const updateKnowledgeNode = async (
  nodeId: string,
  input: Partial<KnowledgeNodeInput>,
) =>
  (
    await requestJson<{ node: KnowledgeEntity }>(
      `/api/knowledge/nodes/${nodeId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  ).node;

export const getKnowledgeTree = async (subject: string) =>
  requestJson<KnowledgeTreeSnapshot>(
    `/api/knowledge/tree?subject=${encodeURIComponent(subject)}`,
  );

export const getKnowledgeFocus = async (nodeId: string) =>
  requestJson<KnowledgeFocusSnapshot>(
    `/api/knowledge/nodes/${nodeId}/focus`,
  );

export const updateKnowledgeStructure = async (
  nodeId: string,
  input: {
    primaryMotherId?: string | null;
    trainable?: boolean;
    sortOrder?: number;
  },
) =>
  (
    await requestJson<{ node: KnowledgeEntity }>(
      `/api/knowledge/nodes/${nodeId}/structure`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  ).node;

export const createKnowledgeSubject = async (input: { name: string; code: string }) =>
  (await requestJson<{ subject: KnowledgeSubject }>("/api/knowledge/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })).subject;

export const updateKnowledgeSubject = async (
  subjectId: string,
  input: { name?: string; status?: "active" | "inactive" },
) => (await requestJson<{ subject: KnowledgeSubject }>(`/api/knowledge/subjects/${subjectId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
})).subject;

export const createKnowledgeTag = async (name: string) =>
  (await requestJson<{ tag: KnowledgeTag }>("/api/knowledge/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })).tag;

export const archiveKnowledgeNode = async (nodeId: string) => {
  const response = await fetch(`/api/knowledge/nodes/${nodeId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readErrorCode(response));
};

export const mergeKnowledgeNode = async (
  nodeId: string,
  targetNodeId: string,
) =>
  (
    await requestJson<{ node: KnowledgeEntity }>(
      `/api/knowledge/nodes/${nodeId}/merge`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodeId }),
      },
    )
  ).node;

export const createKnowledgeRelation = async (input: {
  sourceNodeId: string;
  targetNodeId: string;
  type: KnowledgeRelationType;
  description: string;
}) =>
  (
    await requestJson<{ relation: KnowledgeRelation }>(
      "/api/knowledge/relations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    )
  ).relation;

export const reviewSuggestion = async (
  suggestionId: string,
  decision: "accepted" | "ignored" | "merged",
  mergeTargetId?: string,
) =>
  (
    await requestJson<{ suggestion: DiscoverySuggestion }>(
      `/api/knowledge/suggestions/${suggestionId}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, mergeTargetId }),
      },
    )
  ).suggestion;

export const batchReviewSuggestions = async (
  suggestionIds: string[],
  decision: "accepted" | "ignored",
) =>
  (
    await requestJson<{ suggestions: DiscoverySuggestion[] }>(
      "/api/knowledge/suggestions/batch-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionIds, decision }),
      },
    )
  ).suggestions;
