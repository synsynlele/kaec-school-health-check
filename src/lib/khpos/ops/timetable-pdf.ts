import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

export async function downloadTimetablePdf(headings: string[], rows: string[][], options?: {
  title: string; subtitle: string; filename: string; widths: number[];
}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.04, 0.28, 0.22);
  const white = rgb(1, 1, 1);
  const text = rgb(0.12, 0.17, 0.19);
  const margin = 28;
  const widths = options?.widths ?? [76, 89, 110, 132, 128, 66, 185];
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const size = 9;
  const lineHeight = 12;

  function wrap(value: string, width: number, font: PDFFont) {
    const safe = [...value.normalize("NFC")].map(character => {
      try { font.encodeText(character); return character; }
      catch { return character.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^ -~]/g, "?"); }
    }).join("");
    const lines: string[] = [];
    let line = "";
    for (const word of safe.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(line + character, size) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
    return lines;
  }

  let page: PDFPage;
  let y = 0;
  function addPage() {
    page = document.addPage([842, 595]);
    page.drawText(options?.title ?? "KHP-OS  |  Weekly lesson timetable", { x: margin, y: 547, font: bold, size: 20, color: green });
    page.drawText(options?.subtitle ?? "Recurring weekly schedule  |  Lagos time (WAT)", { x: margin, y: 527, font: regular, size, color: text });
    page.drawRectangle({ x: margin, y: 483, width: tableWidth, height: 26, color: green });
    let x = margin;
    headings.forEach((heading, index) => {
      page.drawText(heading, { x: x + 6, y: 493, font: bold, size, color: white });
      x += widths[index];
    });
    y = 483;
    return page;
  }

  page = addPage();
  rows.forEach((row, rowIndex) => {
    const cells = row.map((value, index) => wrap(value, widths[index] - 12, regular));
    const lineCount = Math.max(...cells.map(cell => cell.length));
    let offset = 0;
    while (offset < lineCount) {
      const remaining = lineCount - offset;
      const capacity = Math.floor((y - margin - 10) / lineHeight);
      if (capacity < 1 || (offset === 0 && remaining > capacity && remaining <= 37)) page = addPage();
      const count = Math.min(remaining, Math.floor((y - margin - 10) / lineHeight));
      const height = count * lineHeight + 10;
      page.drawRectangle({ x: margin, y: y - height, width: tableWidth, height,
        color: rowIndex % 2 ? rgb(0.94, 0.97, 0.96) : white, borderColor: rgb(0.85, 0.9, 0.88), borderWidth: 0.5 });
      let x = margin;
      cells.forEach((lines, index) => {
        lines.slice(offset, offset + count).forEach((line, lineIndex) => {
          page.drawText(line, { x: x + 6, y: y - 13 - lineIndex * lineHeight, font: regular, size, color: text });
        });
        x += widths[index];
      });
      y -= height;
      offset += count;
    }
  });

  const pages = document.getPages();
  pages.forEach((sheet, index) => sheet.drawText(`KHP-OS  |  Page ${index + 1} of ${pages.length}`,
    { x: margin, y: 14, font: regular, size: 8, color: green }));
  const bytes = await document.save();
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = options?.filename ?? "KHP-OS-weekly-timetable.pdf";
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
