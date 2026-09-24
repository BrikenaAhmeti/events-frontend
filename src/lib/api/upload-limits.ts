export const MAX_UPLOAD_BYTES = 20_000_000;
export const MAX_FUNCTION_UPLOAD_BYTES = 4_000_000;
export const MAX_FUNCTION_JSON_BYTES = 4_000_000;
export const UPLOAD_LIMIT_MESSAGE = 'Files must be 20 MB or smaller.';

export const uploadSizeError = (file: File): string | null =>
  file.size > MAX_UPLOAD_BYTES ? UPLOAD_LIMIT_MESSAGE : null;

export const assertUploadSize = (file: File): void => {
  const error = uploadSizeError(file);
  if (error) throw new Error(error);
};

export const assertFunctionUploadSize = (file: File): void => {
  assertUploadSize(file);
  if (file.size > MAX_FUNCTION_UPLOAD_BYTES)
    throw new Error('This file needs a secure direct upload.');
};
