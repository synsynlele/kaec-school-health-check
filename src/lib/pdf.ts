/**
 * KAEC School Health Check — PDF generator (pdf-lib, pure Node, no browser).
 * Produces a branded, multi-page School Health Report.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { ratingFor } from "./scoring";
import type { ReportData, SchoolInfo } from "./types";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const BLUE = rgb(0.075, 0.33, 0.85);
const NAVY = rgb(0.06, 0.09, 0.16);
const GREEN = rgb(0.02, 0.59, 0.41);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.945, 0.955, 0.97);
const LIGHT_GREEN = rgb(0.92, 0.98, 0.95);
const RED = rgb(0.85, 0.18, 0.18);

function hex(hexStr: string): RGB {
  const h = hexStr.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

/** Strip characters outside WinAnsi so pdf-lib never throws on AI output. */
function clean(s: string): string {
  return s
    .replace(/[\u2605\u2606]/g, "*")
    .replace(/[^\x09\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

class Writer {
  doc!: PDFDocument;
  page!: PDFPage;
  regular!: PDFFont;
  bold!: PDFFont;
  y = 0;
  pageNum = 0;
  school = "";

  static async create(): Promise<Writer> {
    const w = new Writer();
    w.doc = await PDFDocument.create();
    w.regular = await w.doc.embedFont(StandardFonts.Helvetica);
    w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    return w;
  }

  addPage() {
    this.page = this.doc.addPage(A4);
    this.pageNum += 1;
    this.y = A4[1] - MARGIN;
  }

  get width() {
    return A4[0] - MARGIN * 2;
  }

  ensure(h: number) {
    if (this.y - h < 70) this.addPage();
  }

  wrap(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
    const words = clean(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  para(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: RGB;
      gapBefore?: number;
      gapAfter?: number;
      indent?: number;
      lineHeight?: number;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.regular;
    const color = opts.color ?? NAVY;
    const indent = opts.indent ?? 0;
    const lh = opts.lineHeight ?? size * 1.5;
    this.y -= opts.gapBefore ?? 0;
    const lines = this.wrap(text, size, font, this.width - indent);
    this.ensure(lines.length * lh + (opts.gapAfter ?? 6));
    for (const line of lines) {
      if (this.y - lh < 70) this.addPage();
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    this.y -= opts.gapAfter ?? 6;
  }

  heading(text: string, opts: { gapBefore?: number; color?: RGB } = {}) {
    this.y -= opts.gapBefore ?? 16;
    this.ensure(50);
    const size = 16;
    const lines = this.wrap(text, size, this.bold, this.width - 30);
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: this.bold, color: opts.color ?? BLUE });
      this.y -= size * 1.35;
    }
    this.page.drawRectangle({ x: MARGIN, y: this.y + 2, width: 34, height: 3, color: GREEN });
    this.y -= 12;
  }

  subheading(text: string) {
    this.ensure(40);
    this.y -= 8;
    this.page.drawText(clean(text), { x: MARGIN, y: this.y - 12, size: 12, font: this.bold, color: NAVY });
    this.y -= 20;
  }

  bar(label: string, frac: number, colorHex: string) {
    this.ensure(26);
    const labelWidth = 170;
    this.page.drawText(clean(label), { x: MARGIN, y: this.y - 9, size: 9, font: this.regular, color: NAVY });
    const barX = MARGIN + labelWidth;
    const barW = this.width - labelWidth - 42;
    this.page.drawRectangle({ x: barX, y: this.y - 11, width: barW, height: 8, color: LIGHT });
    if (frac > 0) {
      this.page.drawRectangle({
        x: barX,
        y: this.y - 11,
        width: Math.max(6, barW * frac),
        height: 8,
        color: hex(colorHex),
      });
    }
    this.page.drawText(`${Math.round(frac * 100)}%`, {
      x: barX + barW + 8,
      y: this.y - 9,
      size: 9,
      font: this.bold,
      color: hex(colorHex),
    });
    this.y -= 18;
  }

  pill(x: number, y: number, text: string, colorHex: string) {
    const size = 8.5;
    const w = this.bold.widthOfTextAtSize(clean(text), size) + 16;
    const c = hex(colorHex);
    this.page.drawRectangle({ x, y, width: w, height: 18, color: c, opacity: 0.12 });
    this.page.drawRectangle({ x, y, width: w, height: 1.5, color: c });
    this.page.drawRectangle({ x, y: y + 16.5, width: w, height: 1.5, color: c });
    this.page.drawText(clean(text), { x: x + 8, y: y + 5.5, size, font: this.bold, color: c });
    return w;
  }

  box(lines: { text: string; size: number; bold?: boolean; color?: RGB }[], bg: RGB, gapBefore = 10) {
    this.y -= gapBefore;
    const allLines: { line: string; size: number; bold: boolean; color?: RGB }[] = [];
    for (const l of lines) {
      const font = l.bold ? this.bold : this.regular;
      for (const wrapped of this.wrap(l.text, l.size, font, this.width - 32)) {
        allLines.push({ line: wrapped, size: l.size, bold: l.bold ?? false, color: l.color });
      }
    }
    const height = allLines.reduce((s, l) => s + l.size * 1.5, 0) + 26;
    this.ensure(height);
    this.page.drawRectangle({ x: MARGIN, y: this.y - height, width: this.width, height, color: bg });
    let yy = this.y - 18;
    for (const l of allLines) {
      this.page.drawText(l.line, {
        x: MARGIN + 16,
        y: yy - l.size + 3,
        size: l.size,
        font: l.bold ? this.bold : this.regular,
        color: l.color ?? NAVY,
      });
      yy -= l.size * 1.5;
    }
    this.y -= height + 8;
  }

  numbered(n: number, title: string, detail: string, extra?: string, accent: RGB = BLUE) {
    this.ensure(60);
    this.y -= 6;
    this.page.drawCircle({ x: MARGIN + 9, y: this.y - 7, size: 9, color: accent });
    this.page.drawText(String(n), {
      x: MARGIN + (n > 9 ? 5 : 7),
      y: this.y - 11,
      size: 9,
      font: this.bold,
      color: rgb(1, 1, 1),
    });
    const tx = MARGIN + 26;
    for (const line of this.wrap(title, 10.5, this.bold, this.width - 26)) {
      if (this.y - 20 < 70) this.addPage();
      this.page.drawText(line, { x: tx, y: this.y - 12, size: 10.5, font: this.bold, color: NAVY });
      this.y -= 14;
    }
    for (const line of this.wrap(detail, 9.5, this.regular, this.width - 26)) {
      if (this.y - 20 < 70) this.addPage();
      this.page.drawText(line, { x: tx, y: this.y - 11, size: 9.5, font: this.regular, color: GRAY });
      this.y -= 13;
    }
    if (extra) {
      this.page.drawText(clean(extra), { x: tx, y: this.y - 11, size: 8.5, font: this.bold, color: accent });
      this.y -= 14;
    }
    this.y -= 6;
  }

  footers() {
    const total = this.doc.getPageCount();
    this.doc.getPages().forEach((p, i) => {
      p.drawRectangle({ x: 0, y: 0, width: A4[0], height: 34, color: LIGHT });
      p.drawText("KAEC SCHOOL HEALTH CHECK", { x: MARGIN, y: 13, size: 7.5, font: this.bold, color: BLUE });
      p.drawText(clean(`Confidential — prepared for ${this.school}`), {
        x: 175,
        y: 13,
        size: 7.5,
        font: this.regular,
        color: GRAY,
      });
      p.drawText(`Page ${i + 1} of ${total}`, {
        x: A4[0] - MARGIN - 55,
        y: 13,
        size: 7.5,
        font: this.regular,
        color: GRAY,
      });
    });
  }
}

export async function buildReportPdf(
  report: ReportData,
  school: SchoolInfo,
): Promise<Uint8Array> {
  const w = await Writer.create();
  w.school = school.schoolName;
  w.addPage();

  const rating = ratingFor(report.overallScore);
  const aiEnhanced = report.engine === "openai";

  /* ── Cover ─────────────────────────────────────────────── */
  w.page.drawRectangle({ x: 0, y: A4[1] - 150, width: A4[0], height: 150, color: BLUE });
  w.page.drawRectangle({ x: 0, y: A4[1] - 156, width: A4[0], height: 6, color: GREEN });
  w.page.drawText("KAEC", { x: MARGIN, y: A4[1] - 60, size: 26, font: w.bold, color: rgb(1, 1, 1) });
  w.page.drawText("SCHOOL HEALTH CHECK", {
    x: MARGIN + 78,
    y: A4[1] - 54,
    size: 12,
    font: w.bold,
    color: rgb(1, 1, 1),
  });
  w.page.drawText("Know the health of your school in minutes.", {
    x: MARGIN + 78,
    y: A4[1] - 70,
    size: 9,
    font: w.regular,
    color: rgb(0.85, 0.9, 1),
  });
  w.page.drawText("OFFICIAL SCHOOL HEALTH REPORT", {
    x: MARGIN,
    y: A4[1] - 118,
    size: 10,
    font: w.bold,
    color: rgb(0.82, 0.88, 1),
  });

  w.y = A4[1] - 200;
  w.para(school.schoolName, { size: 26, bold: true, gapAfter: 2 });
  w.para(
    [school.schoolType, school.schoolLevel, [school.state, school.country].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join("  ·  "),
    { size: 10.5, color: GRAY, gapAfter: 2 },
  );
  w.para(`Assessed on ${new Date(school.assessmentDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}  ·  ${school.studentPopulation} students  ·  ${school.staffPopulation} staff`, {
    size: 9.5,
    color: GRAY,
    gapAfter: 18,
  });

  /* Score block */
  w.ensure(130);
  w.page.drawRectangle({ x: MARGIN, y: w.y - 110, width: w.width, height: 110, color: LIGHT });
  w.page.drawText(String(report.overallScore), {
    x: MARGIN + 28,
    y: w.y - 72,
    size: 48,
    font: w.bold,
    color: hex(rating.hex),
  });
  w.page.drawText("/ 100", { x: MARGIN + 30 + w.bold.widthOfTextAtSize(String(report.overallScore), 48), y: w.y - 56, size: 13, font: w.regular, color: GRAY });
  w.pill(MARGIN + 150, w.y - 46, `HEALTH RATING: ${rating.label.toUpperCase()}`, rating.hex);
  w.page.drawText(clean(`Priority area: ${report.priorityArea}`), {
    x: MARGIN + 150,
    y: w.y - 66,
    size: 9.5,
    font: w.regular,
    color: NAVY,
  });
  w.page.drawText(clean(rating.message), {
    x: MARGIN + 150,
    y: w.y - 82,
    size: 8.5,
    font: w.regular,
    color: GRAY,
  });
  w.y -= 128;

  w.heading("Executive Summary", { gapBefore: 4 });
  w.para(report.executiveSummary, { size: 9.8, lineHeight: 15 });

  w.heading("Department Scores");
  for (const d of report.departmentScores) {
    w.bar(d.title, d.score / 100, ratingFor(d.score).hex);
  }
  w.y -= 6;
  w.box(
    [
      {
        text: `Strongest: ${[...report.departmentScores].sort((a, b) => b.score - a.score)[0]?.title ?? ""}    ·    Weakest: ${report.priorityArea}`,
        size: 9,
        bold: true,
      },
    ],
    LIGHT,
    4,
  );

  w.heading("Biggest Strengths");
  report.strengths.forEach((s, i) => w.numbered(i + 1, s.title, s.detail, undefined, GREEN));
  w.heading("Biggest Weaknesses");
  report.weaknesses.forEach((wk, i) =>
    w.numbered(i + 1, wk.title, wk.detail, `If ignored: ${wk.impact}`, RED),
  );

  w.heading("Priority Areas");
  report.priorityAreas.forEach((p, i) => {
    w.subheading(`${i + 1}. ${p.title}`);
    w.para(`Why first: ${p.why}`, { size: 9.5 });
    w.para(`First step: ${p.firstStep}`, { size: 9.5, color: BLUE, bold: true });
  });

  w.heading(`${school.schoolName} — Area-by-Area Analysis`);
  for (const c of report.chapterAnalyses) {
    w.ensure(70);
    w.subheading(`${c.title}   —   ${c.score}% · ${c.rating}`);
    w.para(c.analysis, { size: 9.3, lineHeight: 14, gapAfter: 4 });
  }

  w.heading(aiEnhanced ? "AI-Enhanced Recommendations" : "Diagnostic Recommendations");
  report.recommendations.forEach((r, i) =>
    w.numbered(
      i + 1,
      r.title,
      r.detail,
      `Priority: ${r.priority.toUpperCase()}   ·   Impact: ${r.impact}   ·   Effort: ${r.effort}`,
      r.priority === "high" ? RED : r.priority === "medium" ? rgb(0.83, 0.45, 0.02) : GREEN,
    ),
  );

  w.heading("Quick Wins — start this week");
  report.quickWins.forEach((q, i) => w.numbered(i + 1, q.title, q.detail, undefined, GREEN));

  w.heading("The 90-Day Improvement Plan");
  const phases: [string, string, ReportData["plan30"]][] = [
    ["Days 1–30 — Stabilise", "Quick, visible moves that build belief and momentum.", report.plan30],
    ["Days 31–60 — Systemise", "Install the routines and systems that hold the gains.", report.plan60],
    ["Days 61–90 — Embed & Measure", "Verify the change, communicate it, and reset the cycle.", report.plan90],
  ];
  for (const [title, subtitle, tasks] of phases) {
    w.subheading(title);
    w.para(subtitle, { size: 8.8, color: GRAY, gapAfter: 2 });
    tasks.forEach((t, i) => w.numbered(i + 1, t.task, `Outcome: ${t.outcome}`, undefined, BLUE));
  }

  w.heading("Long-Term Vision");
  w.para(report.longTermVision, { size: 9.8, lineHeight: 15 });
  w.box(
    [
      { text: "A closing word from KAEC", size: 10.5, bold: true, color: GREEN },
      { text: report.closingMessage, size: 9.6 },
    ],
    LIGHT_GREEN,
    12,
  );

  w.y -= 10;
  w.para(
    aiEnhanced
      ? "KSHC scores in this report are calculated deterministically from the school's own responses. OpenAI was used only to enhance the narrative interpretation and recommendations. KHP-OS can continue this diagnosis into a governed transformation cycle."
      : "KSHC scores in this report are calculated deterministically from the school's own responses. AI narrative enhancement was unavailable, so the KSHC diagnostic engine produced the narrative. KHP-OS can continue this diagnosis into a governed transformation cycle.",
    { size: 8, color: GRAY },
  );

  w.footers();
  return w.doc.save();
}
