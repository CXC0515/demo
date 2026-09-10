export const RESOURCE_UPLOAD_LIMIT_BYTES = 80 * 1024 * 1024;
export const RESOURCE_UPLOAD_LIMIT_LABEL = '80 MB';

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
};
