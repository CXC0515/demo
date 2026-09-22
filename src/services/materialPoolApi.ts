import type { PoolFolder, PoolItem } from '../domain/materialPool';
import { apiFetch } from './apiClient';
import { RESOURCE_UPLOAD_LIMIT_BYTES } from '../domain/uploadPolicy';

const messages: Record<string, string> = {
  LIMIT_FILE_SIZE: '文件超过 80 MB，上次上传未保存；请压缩或拆分后重试',
  FILE_REQUIRED: '请先选择文件，本次没有保存',
  UNSUPPORTED_FILE: '暂不支持这个文件格式，本次没有保存；请使用 PDF、常见图片、Office 文件或 TXT',
  FILE_SAVE_FAILED: '服务器保存失败，本次文件没有保存；请稍后重试',
  ITEM_IN_USE: '这份材料已用于资料编辑，请先处理关联资料，原件没有移动到回收站',
  FOLDER_NOT_FOUND: '目标文件夹不存在，材料仍在原位置',
  FOLDER_DEPTH_EXCEEDED: '文件夹最多建三级，请选上一级位置',
  FOLDER_NAME_EXISTS: '同一位置已有同名文件夹，请换个名称',
  ITEM_NOT_AVAILABLE: '这份材料不在可整理状态，请刷新列表',
  ITEM_NOT_FOUND: '材料已不存在或当前账号无权访问',
  RATE_LIMITED: '15 分钟内上传次数已达上限；已成功的文件仍保留，请稍后继续上传剩余文件',
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { code?: string };
    throw new Error(messages[body.code ?? ''] ?? (response.status === 429 ? messages.RATE_LIMITED : response.status === 401 ? '登录已失效，请重新登录' : '操作失败，原有材料没有改变；请稍后重试'));
  }
  return response.json() as Promise<T>;
};

export const listPoolFolders = async () => (await request<{ folders: PoolFolder[] }>('/api/material-pool/folders')).folders;
export const listPoolItems = async (options: { folderId?: string | null; q?: string; mime?: string; state?: 'saved' | 'trashed'; offset?: number } = {}) => {
  const params = new URLSearchParams();
  if (options.folderId !== undefined) params.set('folderId', options.folderId ?? 'unfiled');
  if (options.q) params.set('q', options.q);
  if (options.mime) params.set('mime', options.mime);
  if (options.state) params.set('state', options.state);
  if (options.offset) params.set('offset', String(options.offset));
  return request<{ items: PoolItem[]; nextOffset: number | null }>(`/api/material-pool/items?${params}`);
};
export const createPoolFolder = async (name: string, parentId: string | null) =>
  (await request<{ folder: PoolFolder }>('/api/material-pool/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) })).folder;
export const renamePoolFolder = async (id: string, name: string) =>
  (await request<{ folder: PoolFolder }>(`/api/material-pool/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })).folder;
export const uploadPoolItem = async (file: File) => {
  if (file.size > RESOURCE_UPLOAD_LIMIT_BYTES) throw new Error(messages.LIMIT_FILE_SIZE);
  const form = new FormData();
  form.set('file', file);
  return (await request<{ item: PoolItem }>('/api/material-pool/items', { method: 'POST', body: form })).item;
};
export const updatePoolItem = async (id: string, update: { folderId?: string | null; tags?: string[] }) =>
  (await request<{ item: PoolItem }>(`/api/material-pool/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) })).item;
export const trashPoolItem = async (id: string) => (await request<{ item: PoolItem }>(`/api/material-pool/items/${id}/trash`, { method: 'POST' })).item;
export const restorePoolItem = async (id: string) => (await request<{ item: PoolItem }>(`/api/material-pool/items/${id}/restore`, { method: 'POST' })).item;
