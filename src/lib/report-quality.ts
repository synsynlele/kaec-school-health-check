import type { ReportData } from "./types";

function uniqueByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SAFE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Typically lifts collection rates by 10–20% in a term\.?/gi,
    "Makes fee collection more predictable when the routine is followed consistently.",
  ],
  [
    /Growth-minded schools in this position usually dominate their market within three years\.?/gi,
    "This creates a stronger foundation for sustained enrolment and improvement.",
  ],
  [
    /Schools that run four consecutive 90-day cycles from this report typically move a full rating band within a year\.?/gi,
    "Four disciplined 90-day cycles create a clear evidence trail for measuring improvement over a year.",
  ],
  [
    /The single most-cited facility in parent decisions\.?/gi,
    "Sanitation quality is a highly visible signal of operational discipline to families and staff.",
  ],
  [
    /Trust rises measurably within a term\.?/gi,
    "Creates a more consistent parent communication rhythm and clearer trust signals.",
  ],
];

function safeText(value: string): string {
  return SAFE_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

/**
 * Makes the deterministic fallback safe to show when OpenAI is unavailable.
 * It never changes scores; it only removes duplicate display items and strips
 * unsupported generic claims from the fallback narrative library.
 */
export function sanitizeFallbackReport(report: ReportData): ReportData {
  if (report.engine !== "engine") return report;

  return {
    ...report,
    executiveSummary: safeText(report.executiveSummary),
    strengths: uniqueByTitle(report.strengths).map((item) => ({
      ...item,
      detail: safeText(item.detail),
    })),
    weaknesses: uniqueByTitle(report.weaknesses).map((item) => ({
      ...item,
      detail: safeText(item.detail),
      impact: safeText(item.impact),
    })),
    priorityAreas: report.priorityAreas.map((item) => ({
      ...item,
      why: safeText(item.why),
      firstStep: safeText(item.firstStep),
    })),
    chapterAnalyses: report.chapterAnalyses.map((item) => ({
      ...item,
      analysis: safeText(item.analysis),
    })),
    recommendations: uniqueByTitle(report.recommendations).map((item) => ({
      ...item,
      detail: safeText(item.detail),
      impact: safeText(item.impact),
      effort: safeText(item.effort),
    })),
    quickWins: uniqueByTitle(report.quickWins).map((item) => ({
      ...item,
      detail: safeText(item.detail),
    })),
    plan30: report.plan30.map((item) => ({
      task: safeText(item.task),
      outcome: safeText(item.outcome),
    })),
    plan60: report.plan60.map((item) => ({
      task: safeText(item.task),
      outcome: safeText(item.outcome),
    })),
    plan90: report.plan90.map((item) => ({
      task: safeText(item.task),
      outcome: safeText(item.outcome),
    })),
    longTermVision: safeText(report.longTermVision),
    closingMessage: safeText(report.closingMessage),
  };
}
