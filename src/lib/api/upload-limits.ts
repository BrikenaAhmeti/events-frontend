// The backend runs behind Vercel's 4.5 MB request-body limit. Leave room for
// multipart fields and event setup text in the same request.
export const MAX_UPLOAD_BYTES = 4_000_000;
export const UPLOAD_LIMIT_MESSAGE = 'Files must be 4 MB or smaller.';

export const uploadSizeError = (file: File): string | null =>
  file.size > MAX_UPLOAD_BYTES ? UPLOAD_LIMIT_MESSAGE : null;

export const assertUploadSize = (file: File): void => {
  const error = uploadSizeError(file);
  if (error) throw new Error(error);
};
