import { CHAPTERS, CHAPTER_MAP, type ChapterKey } from "./questions";
import type { AnswerRecord } from "./types";

export interface ScoreSummary {
  overall: number; // 0–100
  chapterScores: { chapter: ChapterKey; title: string; score: number; answeredCount: number }[];
  priorityChapter: ChapterKey;
  strengthChapter: ChapterKey;
}

export function computeScores(answers: AnswerRecord[]): ScoreSummary {
  const byChapter = new Map<ChapterKey, number[]>();
  for (const c of CHAPTERS) byChapter.set(c.key, []);
  for (const a of answers) {
    const list = byChapter.get(a.chapter);
    if (list && a.score >= 1 && a.score <= 5) list.push(a.score);
  }

  const chapterScores = CHAPTERS.map((c) => {
    const vals = byChapter.get(c.key) ?? [];
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    return {
      chapter: c.key,
      title: c.title,
      score: vals.length ? Math.round((avg / 5) * 100) : 0,
      answeredCount: vals.length,
    };
  });

  const answered = chapterScores.filter((c) => c.answeredCount > 0);
  const overall = answered.length
    ? Math.round(answered.reduce((s, c) => s + c.score, 0) / answered.length)
    : 0;

  const sorted = [...answered].sort((a, b) => a.score - b.score);
  return {
    overall,
    chapterScores,
    priorityChapter: sorted[0]?.chapter ?? "leadership",
    strengthChapter: sorted[sorted.length - 1]?.chapter ?? "leadership",
  };
}

export interface RatingBand {
  band: "thriving" | "healthy" | "developing" | "at_risk" | "critical";
  label: string;
  message: string;
  hex: string;
  textClass: string;
  bgClass: string;
  barClass: string;
  ringClass: string;
}

export function ratingFor(score: number): RatingBand {
  if (score >= 85)
    return {
      band: "thriving",
      label: "Thriving",
      message: "An exceptional school. Protect the standard and scale what works.",
      hex: "#059669",
      textClass: "text-emerald-600",
      bgClass: "bg-emerald-50 border-emerald-200",
      barClass: "bg-emerald-500",
      ringClass: "stroke-emerald-500",
    };
  if (score >= 70)
    return {
      band: "healthy",
      label: "Healthy",
      message: "A strong school with a few focused areas to sharpen.",
      hex: "#16a34a",
      textClass: "text-green-600",
      bgClass: "bg-green-50 border-green-200",
      barClass: "bg-green-500",
      ringClass: "stroke-green-500",
    };
  if (score >= 55)
    return {
      band: "developing",
      label: "Developing",
      message: "Solid foundations with clear gaps that attention will fix.",
      hex: "#d97706",
      textClass: "text-amber-600",
      bgClass: "bg-amber-50 border-amber-200",
      barClass: "bg-amber-500",
      ringClass: "stroke-amber-500",
    };
  if (score >= 40)
    return {
      band: "at_risk",
      label: "At Risk",
      message: "Important weaknesses need intervention before they compound.",
      hex: "#ea580c",
      textClass: "text-orange-600",
      bgClass: "bg-orange-50 border-orange-200",
      barClass: "bg-orange-500",
      ringClass: "stroke-orange-500",
    };
  return {
    band: "critical",
    label: "Critical",
    message: "Urgent, structured support is needed. The good news: it is fixable.",
    hex: "#dc2626",
    textClass: "text-red-600",
    bgClass: "bg-red-50 border-red-200",
    barClass: "bg-red-500",
    ringClass: "stroke-red-500",
  };
}

export function scoreWord(score: number): string {
  const r = ratingFor(score);
  return r.label;
}

export function chapterTitle(key: ChapterKey): string {
  return CHAPTER_MAP[key]?.title ?? key;
}
