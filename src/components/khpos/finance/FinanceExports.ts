import { str, type Row } from "./FinanceControls";

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function excel(name: string, sheets: { title: string; rows: (string | number)[][] }[]) {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  for (const sheet of sheets) {
    const page = book.addWorksheet(sheet.title, { views: [{ state: "frozen", ySplit: 1 }] });
    page.addRows(sheet.rows);
    page.getRow(1).font = { bold: true };
    page.columns.forEach(column => { column.width = 23; });
  }
  const file = await book.xlsx.writeBuffer();
  download(name + ".xlsx", new Blob([new Uint8Array(file)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
}

export function csv(name: string, rows: (string | number)[][]) {
  const data = rows.map(row => row.map(value => {
    const text = String(value);
    const safe = typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
  download(name + ".csv", new Blob(["\ufeff", data], { type: "text/csv;charset=utf-8" }));
}

const escape = (value: string | number) => String(value).replace(/[&<>"']/g, match =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[match]!);

export function printFinance(title: string, school: string, sections: { title: string; rows: (string | number)[][] }[]) {
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  const table = (rows: (string | number)[][]) => "<table>" + rows.map((row,i) => "<tr>" + row.map(cell => {
    const tag = i === 0 ? "th" : "td";
    return "<" + tag + ">" + escape(cell) + "</" + tag + ">";
  }).join("") + "</tr>").join("") + "</table>";
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title><style>
  @page{margin:17mm}body{font:13px system-ui,sans-serif;color:#162539}h1{font-size:26px;margin:4px 0 18px}
  header{border-bottom:3px solid #147668;margin-bottom:20px}h2{font-size:16px;margin-top:22px}table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:7px;border-bottom:1px solid #d6e1eb}th{background:#eff5f6}tr{break-inside:avoid}
  </style></head><body><header><strong>${escape(school)}</strong><h1>${escape(title)}</h1></header>${
    sections.map(section => "<h2>" + escape(section.title) + "</h2>" + table(section.rows)).join("")
  }</body></html>`;
  document.body.append(frame);
}

export async function allPages(load: (offset: number) => Promise<Row[]>) {
  const result: Row[] = [];
  for (let offset = 0; offset <= 250_000; offset += 50) {
    const rows = await load(offset);
    result.push(...rows.slice(0,50));
    if (rows.length <= 50) return result;
  }
  throw new Error("Too many records for one export. Choose a narrower view.");
}

export const cells = (row: Row, names: string[]) => names.map(name => str(row[name]));
