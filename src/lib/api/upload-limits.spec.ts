import { assertUploadSize, MAX_UPLOAD_BYTES, uploadSizeError } from './upload-limits';

describe('upload limits', () => {
  it('accepts a file at the app limit and rejects one byte more before upload', () => {
    const atLimit = new File([new Uint8Array(MAX_UPLOAD_BYTES)], 'brief.pdf');
    const overLimit = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'brief.pdf');

    expect(uploadSizeError(atLimit)).toBeNull();
    expect(() => assertUploadSize(atLimit)).not.toThrow();
    expect(uploadSizeError(overLimit)).toBe('Files must be 20 MB or smaller.');
    expect(() => assertUploadSize(overLimit)).toThrow('Files must be 20 MB or smaller.');
  });
});
