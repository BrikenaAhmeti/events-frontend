import { apiClient } from './api-client';
import { assertUploadSize } from './upload-limits';

export async function uploadDirectly(file: File, signPath: string, context: Record<string, string> = {}): Promise<string> {
  assertUploadSize(file);
  const { uploadUrl, ticket } = await apiClient.post<{ uploadUrl: string; ticket: string }>(signPath, {
    ...context, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size,
  });
  const body = new FormData();
  body.append('cacheControl', '3600');
  body.append('', file);
  const response = await fetch(uploadUrl, { method: 'PUT', body, credentials: 'omit' });
  if (!response.ok) throw new Error('The file could not be uploaded to storage. Please try again.');
  return ticket;
}
