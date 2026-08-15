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
    /A polite, scheduled WhatsApp\/SMS sequence before and after due dates typically recovers outstanding fees within days\.?/gi,
    "A polite, scheduled WhatsApp/SMS sequence before and after due dates creates a consistent follow-up rhythm for outstanding fees.",
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
  [
    /a foundation most schools never reach\.?/gi,
    "a strong foundation to protect.",
  ],
  [
    /Parents notice this before they notice anything else\.?/gi,
    "Families can see this discipline quickly when they visit the school.",
  ],
  [
    /A weekly communication habit is the cheapest growth strategy that exists\.?/gi,
    "A weekly communication habit is a low-cost system for strengthening trust and referrals.",
  ],
  [
    /Institutions with this discipline outlive their founders\.?/gi,
    "This discipline reduces institutional dependence on any one person.",
  ],
  [
    /Morale and retention rise visibly\.?/gi,
    "Creates a visible and repeatable staff-recognition routine.",
  ],
  [
    /The cheapest morale intervention in education\.?/gi,
    "A low-cost recognition habit that can be sustained every day.",
  ],
  [
    /Tell parents: this diligence is rare and precious\.?/gi,
    "Make this diligence visible to parents through clear safeguarding communication.",
  ],
  [
    /the first thing sophisticated parents and inspectors check/gi,
    "a core area parents and inspectors expect to see governed well",
  ],
  [
    /None of the findings are unusual for a school at this stage; all of them are fixable\.?/gi,
    "The findings provide a practical starting point for an evidence-led improvement cycle.",
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
 * It never changes a score. It removes duplicate display items, strips
 * unsupported generic claims and avoids pretending that future scores can be
 * predicted from the baseline assessment.
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
    longTermVision:
      `Over the next 12 months, ${report.schoolName} should aim to convert its weakest systems into documented, repeatable routines while protecting its strongest areas. ` +
      "Progress should be judged through implementation evidence and a fresh KSHC reassessment, not through a predicted future score.",
    closingMessage:
      `A ${report.overallScore}/100 is a diagnostic snapshot, not a verdict. ` +
      `For ${report.schoolName}, the next step is to give the first three actions clear owners and dates, review evidence consistently, and use reassessment to verify what actually improved. ` +
      "KAEC-NG can support the institution in turning this diagnosis into a governed transformation cycle.",
  };
}
