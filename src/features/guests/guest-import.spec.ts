import ExcelJS from 'exceljs';
import { downloadGuestTemplate } from './guest-import';

describe('guest templates', () => {
  it.each(['csv', 'xlsx'] as const)('downloads a usable %s guest list template', async (format) => {
    let filename = '';
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => 'blob:guest-template');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    await downloadGuestTemplate(format);
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(filename).toBe(`feliam-guests-template.${format}`);
    expect(blob).toBeInstanceOf(Blob);
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read guest template.'));
      reader.readAsArrayBuffer(blob);
    });
    if (format === 'csv') {
      const header = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '').trim();
      expect(header).toContain('Full name,Email');
      expect(header).toContain('Dietary information');
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes);
      expect(workbook.worksheets[0]?.getRow(1).getCell(1).text).toBe('Full name');
      expect(workbook.worksheets[0]?.getRow(1).getCell(2).text).toBe('Email');
    }
    click.mockRestore();
  });
});
