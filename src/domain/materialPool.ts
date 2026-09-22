export interface PoolFolder {
  id: string;
  parentId: string | null;
  name: string;
  presetKey: string | null;
  sortOrder: number;
}

export interface PoolItem {
  id: string;
  folderId: string | null;
  originalName: string;
  detectedMime: string;
  sizeBytes: number;
  sha256: string;
  state: 'saved' | 'trashed';
  source: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  resourceId: string | null;
  resourceStatus: string | null;
  contentUrl: string;
}
