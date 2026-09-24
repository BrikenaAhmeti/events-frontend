import { z } from 'zod';

export const guestImportRowSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  company: z.string().trim().max(200).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(80).optional(),
  guestGroup: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(5_000).optional(),
  dietaryInformation: z.string().trim().max(2_000).optional(),
  accessibilityInformation: z.string().trim().max(2_000).optional(),
  accommodation: z.string().trim().max(2_000).optional(),
  travelInformation: z.string().trim().max(2_000).optional(),
});

export type GuestImportRow = z.infer<typeof guestImportRowSchema>;
export type GuestImportPreview = {
  mapping: Record<string, string | null>;
  rows?: Array<{
    row: number;
    values: Record<string, string>;
    data: Partial<GuestImportRow>;
    errors: string[];
    duplicate: boolean;
  }>;
  validRows: GuestImportRow[];
  invalidRows: Array<{ row: number; values?: Record<string, string>; errors: string[] }>;
  duplicates: Array<{ row: number; email: string }>;
  summary: { total: number; valid: number; invalid: number; duplicates: number };
};

const headers = [
  'Full name', 'Email', 'First name', 'Last name', 'Company', 'Job title', 'Phone',
  'Guest group', 'Notes', 'Dietary information', 'Accessibility information',
  'Accommodation', 'Travel information',
];

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadGuestTemplate(format: 'csv' | 'xlsx') {
  if (format === 'csv') {
    download(new Blob([`\uFEFF${headers.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' }), 'feliam-guests-template.csv');
    return;
  }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Guests', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(headers);
  sheet.columns = headers.map((header) => ({ width: Math.max(20, header.length + 4) }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173A3A' } };
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'feliam-guests-template.xlsx');
}
