import type { Row, Worksheet } from 'exceljs';

export type EventBriefTemplateFormat = 'docx' | 'xlsx' | 'txt';

const eventBasics = [
  ['Event name', null],
  ['Event type or purpose', null],
  ['Description', null],
  ['Destination or city', null],
  ['Venue', null],
  ['Venue address', null],
  ['Start date and time', null],
  ['End date and time', null],
  ['Timezone, for example Europe/Madrid', null],
  ['Organizer name', null],
  ['Organizer email', null],
] as const;

const detailExamples = [
  ['Dress code', 'Business casual'],
  ['Shuttle pickup', 'Meet in the hotel lobby at 08:30'],
  ['Accessibility', 'Step-free entrance is on the east side'],
  ['Wi-Fi', 'Network and access instructions will be shared at check-in'],
] as const;

export async function downloadEventBriefTemplate(format: EventBriefTemplateFormat) {
  if (format === 'docx') {
    saveBlob(await createWordTemplateBlob(), 'feliam-event-brief-template.docx');
    return;
  }
  if (format === 'xlsx') {
    saveBlob(await createExcelTemplateBlob(), 'feliam-event-brief-template.xlsx');
    return;
  }
  saveBlob(createTextTemplateBlob(), 'feliam-event-brief-template.txt');
}

export async function createWordTemplateBlob() {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx');
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
  const cellMargins = { top: 120, bottom: 120, left: 140, right: 140 };
  const headingCell = (text: string) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: '173A3A', color: 'auto' },
      margins: cellMargins,
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, color: 'FFFFFF' })],
          alignment: AlignmentType.LEFT,
        }),
      ],
    });
  const bodyCell = (text = '') =>
    new TableCell({
      margins: cellMargins,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ children: [new TextRun(text || ' ')] })],
    });
  const basicsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3100, 6200],
    borders,
    rows: [
      new TableRow({ children: [headingCell('Field'), headingCell('Response')] }),
      ...eventBasics.map(
        ([label]) => new TableRow({ children: [bodyCell(label), bodyCell()] }),
      ),
    ],
  });
  const scheduleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [1500, 1250, 1250, 3150, 2150],
    borders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Date', 'Start time', 'End time', 'Activity', 'Location'].map(headingCell),
      }),
      ...Array.from(
        { length: 7 },
        () => new TableRow({ children: Array.from({ length: 5 }, () => bodyCell()) }),
      ),
    ],
  });
  const detailsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3100, 6200],
    borders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headingCell('Title'), headingCell('Description')],
      }),
      ...Array.from(
        { length: 10 },
        () => new TableRow({ children: [bodyCell(), bodyCell()] }),
      ),
    ],
  });
  const document = new Document({
    creator: 'Feliam',
    title: 'Feliam Event Brief',
    description: 'Fillable event setup brief',
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22, color: '172B2B' } },
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 38, bold: true, color: '000000' },
          paragraph: { spacing: { after: 180 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 27, bold: true, color: '000000' },
          paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          new Paragraph({ text: 'Feliam Event Brief', style: 'Title' }),
          new Paragraph({
            children: [
              new TextRun(
                'Fill in what you know and leave anything else blank. Save this document, then attach it in the event setup chat.',
              ),
            ],
            spacing: { after: 220 },
          }),
          new Paragraph({ text: 'Event Basics', heading: HeadingLevel.HEADING_1 }),
          basicsTable,
          new Paragraph({ text: 'Schedule', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            text: 'Add one activity per row. Add more rows if the event has a longer schedule.',
            spacing: { after: 120 },
          }),
          scheduleTable,
          new Paragraph({ text: 'Additional Event Details', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            text: 'Add only the details that matter for this event. Examples include dress code, shuttle pickup, meeting points, accessibility, credentials, dining notes, and Wi-Fi.',
            spacing: { after: 120 },
          }),
          detailsTable,
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function createExcelTemplateBlob() {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Feliam';
  workbook.title = 'Feliam Event Brief';
  workbook.subject = 'Fillable event setup brief';
  const basics = workbook.addWorksheet('Event Basics', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  });
  const schedule = workbook.addWorksheet('Schedule', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  const details = workbook.addWorksheet('Additional Details', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  addSheetTitle(
    basics,
    'Feliam Event Brief',
    'Fill in the response column, then attach this workbook in the event setup chat.',
    2,
  );
  basics.columns = [{ width: 36 }, { width: 72 }];
  basics.addRow(['Field', 'Response']);
  for (const row of eventBasics) basics.addRow([...row]);
  styleHeaderRow(basics.getRow(4));
  styleInputRange(basics, 5, 4 + eventBasics.length, 2, 2);
  basics.getCell('B6').dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [
      '"Corporate incentive,Conference,Corporate retreat,Wedding,Sports travel,Group tour,Meeting,Other"',
    ],
  };
  addSheetTitle(
    schedule,
    'Event Schedule',
    'Add one activity per row. Keep dates and times in their own columns.',
    5,
  );
  schedule.columns = [
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 42 },
    { width: 30 },
  ];
  schedule.addRow(['Date', 'Start time', 'End time', 'Activity', 'Location']);
  for (let index = 0; index < 15; index += 1) schedule.addRow([null, null, null, null, null]);
  styleHeaderRow(schedule.getRow(4));
  styleInputRange(schedule, 5, 19, 1, 5);
  schedule.getColumn(1).numFmt = 'yyyy-mm-dd';
  schedule.getColumn(2).numFmt = 'hh:mm';
  schedule.getColumn(3).numFmt = 'hh:mm';
  addSheetTitle(
    details,
    'Additional Event Details',
    'Add only what matters for this event. Use a clear title and a practical description.',
    2,
  );
  details.columns = [{ width: 30 }, { width: 78 }];
  details.addRow(['Title', 'Description']);
  for (let index = 0; index < 15; index += 1) details.addRow([null, null]);
  styleHeaderRow(details.getRow(4));
  styleInputRange(details, 5, 19, 1, 2);
  details.addRow([]);
  details.addRow(['Examples', 'Reference description']);
  styleHeaderRow(details.getRow(21));
  for (const row of detailExamples) details.addRow([...row]);
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.font = { ...cell.font, name: 'Arial' };
        cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true };
      });
    });
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.65, bottom: 0.65, header: 0.2, footer: 0.2 },
    };
  }
  const output = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(output)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function addSheetTitle(
  worksheet: Worksheet,
  title: string,
  description: string,
  columns: number,
) {
  worksheet.mergeCells(1, 1, 1, columns);
  worksheet.mergeCells(2, 1, 2, columns);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FF000000' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 32;
  const descriptionCell = worksheet.getCell(2, 1);
  descriptionCell.value = description;
  descriptionCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF5F6F6F' } };
  descriptionCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  worksheet.getRow(2).height = 30;
  worksheet.getRow(3).height = 10;
}

function styleHeaderRow(row: Row) {
  row.height = 25;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173A3A' } };
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    };
  });
}

function styleInputRange(
  worksheet: Worksheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 28;
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = row.getCell(column);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DB' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }
  }
}

export function createTextTemplateBlob() {
  const content = `FELIAM EVENT BRIEF

Fill in what you know and leave anything else blank. Save this file, then attach it in the event setup chat.

EVENT BASICS
Event name:
Event type or purpose:
Description:
Destination or city:
Venue:
Venue address:
Start date and time:
End date and time:
Timezone, for example Europe/Madrid:
Organizer name:
Organizer email:

SCHEDULE
Add one activity per line using: Date | Start time | End time | Activity | Location


ADDITIONAL EVENT DETAILS
Add any details that matter for this event using: Title | Description
Examples: Dress code | Business casual
Examples: Shuttle pickup | Hotel lobby at 08:30
Examples: Accessibility | Step-free entrance is on the east side
Examples: Wi-Fi | Network and access instructions will be shared at check-in

`;
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
