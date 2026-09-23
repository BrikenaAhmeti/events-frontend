import { downloadEventBriefTemplate } from './event-brief-templates';

describe('event brief template downloads', () => {
  it.each([
    [
      'docx' as const,
      'feliam-event-brief-template.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'xlsx' as const,
      'feliam-event-brief-template.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['txt' as const, 'feliam-event-brief-template.txt', 'text/plain;charset=utf-8'],
  ])('creates a genuine %s download', async (format, expectedName, expectedType) => {
    let downloadedName = '';
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => 'blob:event-brief');
    const revokeObjectUrl = vi.fn<(url: string) => void>();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    await downloadEventBriefTemplate(format);

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(expectedType);
    expect(downloadedName).toBe(expectedName);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:event-brief');
    if (format !== 'txt') {
      const bytes = new Uint8Array(await readBlob(blob));
      expect(String.fromCharCode(...bytes.slice(0, 2))).toBe('PK');
    }

    click.mockRestore();
  });
});

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read generated template.'));
    reader.readAsArrayBuffer(blob);
  });
}
