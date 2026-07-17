/**
 * KAEC School Health Check — AI Layer
 *
 * Uses OpenAI (OPENAI_API_KEY) to write the deep narrative of each report.
 * The deterministic engine always produces a complete baseline first, so a
 * professional report is guaranteed even if the model is unreachable.
 */
import OpenAI from "openai";
import { z } from "zod";
import { CHAPTERS, CHAPTER_MAP, QUESTION_INDEX, RATING_OPTIONS } from "./questions";
import { computeScores, ratingFor } from "./scoring";
import { generateEngineReport } from "./report-engine";
import type { AnswerRecord, CoachMessage, ReportData, SchoolInfo } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function client(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/* ------------------------------------------------------------------ */
/* Report generation                                                    */
/* ------------------------------------------------------------------ */

const AiReportSchema = z.object({
  executiveSummary: z.string().min(40),
  strengths: z.array(z.object({ title: z.string(), detail: z.string() })).min(3),
  weaknesses: z
    .array(z.object({ title: z.string(), detail: z.string(), impact: z.string() }))
    .min(2),
  priorityAreas: z
    .array(z.object({ title: z.string(), why: z.string(), firstStep: z.string() }))
    .min(2),
  chapterAnalyses: z.array(z.string().min(20)).length(CHAPTERS.length),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        impact: z.string(),
        effort: z.string(),
      }),
    )
    .min(6),
  quickWins: z.array(z.object({ title: z.string(), detail: z.string() })).min(3),
  plan30: z.array(z.object({ task: z.string(), outcome: z.string() })).min(3),
  plan60: z.array(z.object({ task: z.string(), outcome: z.string() })).min(3),
  plan90: z.array(z.object({ task: z.string(), outcome: z.string() })).min(3),
  longTermVision: z.string().min(40),
  closingMessage: z.string().min(40),
});

function buildReportPrompt(
  school: SchoolInfo,
  answers: AnswerRecord[],
  base: ReportData,
): string {
  const summary = computeScores(answers);
  const label = (score: number) =>
    RATING_OPTIONS.find((o) => o.value === score)?.label ?? "";

  const chapterLines = summary.chapterScores
    .map((c) => `- ${c.title}: ${c.score}%`)
    .join("\n");

  const answerLines = answers
    .map((a) => {
      const q = CHAPTERS.find((c) => c.key === a.chapter)!;
      return `[${q.shortTitle}] ${a.questionId}: score ${a.score}/5 (${label(a.score)})`;
    })
    .join("\n");

  return `You are KAEC's senior school-improvement consultant writing a professional School Health Report for a school leadership team. Be specific, warm but honest, and relentlessly practical. Plain professional English. No markdown symbols inside JSON strings. Never invent statistics.

SCHOOL
- Name: ${school.schoolName}
- Type: ${school.schoolType} | Level: ${school.schoolLevel}
- Location: ${[school.state, school.country].filter(Boolean).join(", ")}
- Students: ${school.studentPopulation} | Staff: ${school.staffPopulation}

COMPUTED SCORES (overall ${summary.overall}/100, rating "${ratingFor(summary.overall).label}")
${chapterLines}

RAW ASSESSMENT ANSWERS (chapter_tag question_id: rating)
${answerLines}

QUESTION TEXT REFERENCE
${answers.map((a) => `${a.questionId} = "${questionText(a.questionId)}"`).join("\n")}

Draft baseline (improve on it, do not copy):
${JSON.stringify({ executiveSummary: base.executiveSummary, closingMessage: base.closingMessage })}

Produce STRICT JSON matching exactly this shape (no extra keys, no markdown fences):
{
  "executiveSummary": "2 dense paragraphs naming the school's context, overall score meaning, biggest asset, biggest risk and the promise of the plan",
  "strengths": [{"title": "...", "detail": "1-2 sentences tying the strength to a specific thing the school said"}],            // exactly 5
  "weaknesses": [{"title": "...", "detail": "what is wrong and how it shows up day to day", "impact": "concrete consequence if ignored"}],  // exactly 5
  "priorityAreas": [{"title": "<chapter name>", "why": "why this first", "firstStep": "the single first action, as one sentence"}],   // exactly 3
  "chapterAnalyses": ["ONE substantive 3-4 sentence analysis per chapter, in EXACTLY this order: ${CHAPTERS.map((c) => c.title).join(" | ")}"],
  "recommendations": [{"title": "...", "detail": "concrete how-to in 1-2 sentences", "priority": "high|medium|low", "impact": "expected result", "effort": "time/cost expectation"}],   // 8 to 10, weakest chapters first
  "quickWins": [{"title": "...", "detail": "achievable within days at near-zero cost"}],   // exactly 4
  "plan30": [{"task": "...", "outcome": "..."}],   // exactly 5, days 1-30
  "plan60": [{"task": "...", "outcome": "..."}],   // exactly 5, days 31-60
  "plan90": [{"task": "...", "outcome": "..."}],   // exactly 5, days 61-90
  "longTermVision": "2 sentences: where this school can be in 12 months if it executes",
  "closingMessage": "3-4 sentences, motivational and personal to ${school.schoolName}, ending with forward momentum"
}`;
}

function questionText(id: string): string {
  return QUESTION_INDEX[id]?.text ?? id;
}

export async function generateReport(
  school: SchoolInfo,
  answers: AnswerRecord[],
): Promise<ReportData> {
  const base = generateEngineReport(school, answers);
  const openai = client();
  if (!openai || answers.length < CHAPTERS.length) return base;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_completion_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are KAEC's senior school-improvement consultant. You write rigorous, practical, kind health reports for schools. You only output valid JSON.",
        },
        { role: "user", content: buildReportPrompt(school, answers, base) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = AiReportSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return base;
    const ai = parsed.data;

    const chapterOfTitle = (title: string) =>
      CHAPTERS.find(
        (c) =>
          c.title.toLowerCase() === title.toLowerCase() ||
          c.shortTitle.toLowerCase() === title.toLowerCase(),
      )?.key;

    return {
      ...base,
      executiveSummary: ai.executiveSummary,
      strengths: ai.strengths.map((s) => ({ ...s })),
      weaknesses: ai.weaknesses.map((w) => ({ ...w })),
      priorityAreas: base.priorityAreas.map((p, i) => ({
        chapter: p.chapter,
        title: ai.priorityAreas[i]?.title ?? p.title,
        why: ai.priorityAreas[i]?.why ?? p.why,
        firstStep: ai.priorityAreas[i]?.firstStep ?? p.firstStep,
      })),
      chapterAnalyses: base.chapterAnalyses.map((c, i) => ({
        ...c,
        analysis: ai.chapterAnalyses[i] || c.analysis,
      })),
      recommendations: ai.recommendations.map((r) => ({
        ...r,
        chapter: chapterOfTitle(r.title),
      })),
      quickWins: ai.quickWins.map((qw) => ({ ...qw })),
      plan30: ai.plan30,
      plan60: ai.plan60,
      plan90: ai.plan90,
      longTermVision: ai.longTermVision,
      closingMessage: ai.closingMessage,
      engine: "openai",
    };
  } catch (err) {
    console.error("[kaec] OpenAI report generation failed, using engine report:", err);
    return base;
  }
}

/* ------------------------------------------------------------------ */
/* AI Coach                                                             */
/* ------------------------------------------------------------------ */

export function buildCoachSystemPrompt(
  school: SchoolInfo,
  report: ReportData,
): string {
  const chapters = report.departmentScores
    .map((d) => `${d.title} ${d.score}%`)
    .join(", ");
  const strengths = report.strengths.map((s) => s.title).join("; ");
  const weaknesses = report.weaknesses.map((w) => `${w.title} (impact: ${w.impact})`).join("; ");
  const recs = report.recommendations
    .map((r) => `- [${r.priority}] ${r.title}: ${r.detail}`)
    .join("\n");
  const quickWins = report.quickWins.map((q) => `- ${q.title}: ${q.detail}`).join("\n");
  const plan30 = report.plan30.map((p) => `- ${p.task}`).join("\n");

  return `You are the KAEC AI School Coach inside the "${school.schoolName}" health report.
Answer as a world-class but practical school-improvement consultant. Be specific to THIS school's data. Keep answers under 220 words. Use short paragraphs or up to 4 bullet points. End with one concrete next step. No markdown headers.

SCHOOL: ${school.schoolName} — ${school.schoolType}, ${school.schoolLevel}, ${school.studentPopulation} students, ${school.staffPopulation} staff, ${[school.state, school.country].filter(Boolean).join(", ")}.
OVERALL: ${report.overallScore}/100 — ${report.healthRating}. Priority area: ${report.priorityArea}.
CHAPTER SCORES: ${chapters}.
STRENGTHS: ${strengths}.
WEAKNESSES: ${weaknesses}.
TOP RECOMMENDATIONS:
${recs}
QUICK WINS:
${quickWins}
30-DAY PLAN:
${plan30}
VISION: ${report.longTermVision}`;
}

const COACH_CHAPTER_KEYWORDS: [string, keyof ReportData | null, string][] = [
  ["leadership", null, "leadership"],
  ["leader", null, "leadership"],
  ["vision", null, "leadership"],
  ["teach", null, "teaching"],
  ["lesson", null, "teaching"],
  ["enrol", null, "innovation"],
  ["admission", null, "innovation"],
  ["growth", null, "innovation"],
  ["discipline", null, "student_dev"],
  ["behaviour", null, "student_dev"],
  ["behavior", null, "student_dev"],
  ["student", null, "student_dev"],
  ["fee", null, "finance"],
  ["finance", null, "finance"],
  ["money", null, "finance"],
  ["budget", null, "finance"],
  ["parent", null, "parents"],
  ["technolog", null, "technology"],
  ["computer", null, "technology"],
  ["safety", null, "safety"],
  ["safeguard", null, "safety"],
  ["bully", null, "safety"],
  ["culture", null, "culture"],
  ["morale", null, "culture"],
  ["staff", null, "culture"],
  ["building", null, "infrastructure"],
  ["toilet", null, "infrastructure"],
  ["facility", null, "infrastructure"],
  ["facilities", null, "infrastructure"],
  ["board", null, "governance"],
  ["policy", null, "governance"],
  ["policies", null, "governance"],
];

/** Keyword-guided offline coach answer built from the report itself. */
export function fallbackCoachReply(question: string, report: ReportData): string {
  const lower = question.toLowerCase();
  let chapterKey: string | null = null;
  for (const [kw, , ck] of COACH_CHAPTER_KEYWORDS) {
    if (lower.includes(kw)) {
      chapterKey = ck;
      break;
    }
  }

  const chapterName = chapterKey ? CHAPTER_MAP[chapterKey as keyof typeof CHAPTER_MAP]?.title : null;
  const recs = chapterKey
    ? report.recommendations.filter((r) => {
        if (r.chapter === chapterKey) return true;
        const needle = chapterKey === "student_dev" ? "student" : chapterKey.split("_")[0];
        return r.title.toLowerCase().includes(needle);
      })
    : [];

  const lines: string[] = [];
  if (chapterName) {
    const dept = report.departmentScores.find((d) => d.title === chapterName);
    lines.push(
      `In your report, ${chapterName} scored ${dept?.score ?? "—"}%, so this is exactly the right question to be asking.`,
    );
  } else {
    lines.push(
      `Based on ${report.schoolName}'s report (overall ${report.overallScore}/100, priority area: ${report.priorityArea}), here is where I would start:`,
    );
  }
  lines.push("");

  if (recs.length) {
    for (const r of recs.slice(0, 3)) {
      lines.push(`• ${r.title} — ${r.detail}`);
    }
  } else if (chapterKey) {
    const analysis = report.chapterAnalyses.find((c) => c.chapter === chapterKey);
    if (analysis) {
      lines.push(`What your report already observes about it: ${analysis.analysis}`);
      lines.push("");
      lines.push(
        `It did not enter your top-10 recommendations because other areas ranked lower. If this is a strategic focus for you, pick the single weakest indicator inside this chapter, give it an owner, and review it weekly for one term.`,
      );
    }
  } else {
    for (const r of report.recommendations.filter((r) => r.priority === "high").slice(0, 3)) {
      lines.push(`• ${r.title} — ${r.detail}`);
    }
  }
  if (report.quickWins.length) {
    lines.push("");
    lines.push(`Fastest early win: ${report.quickWins[0].title}. ${report.quickWins[0].detail}`);
  }
  lines.push("");
  lines.push(
    `Next step: pick the first point above, give it an owner and a date this week — then hold the review. If you would like KAEC to walk this with you, use the contact options below.`,
  );
  return lines.join("\n");
}

/** Streams a coach reply as UTF-8 text chunks. */
export async function streamCoachReply(
  system: string,
  history: CoachMessage[],
  question: string,
  report: ReportData,
): Promise<ReadableStream<Uint8Array>> {
  const openai = client();
  const encoder = new TextEncoder();

  if (!openai) {
    const text = fallbackCoachReply(question, report);
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const words = text.split(/(\s+)/);
        for (const w of words) {
          controller.enqueue(encoder.encode(w));
          await new Promise((r) => setTimeout(r, 18));
        }
        controller.close();
      },
    });
  }

  const stream = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    max_completion_tokens: 600,
    stream: true,
    messages: [
      { role: "system", content: system },
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ],
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode("\n\n(The coach connection was interrupted — please resend your question.)"),
        );
        console.error("[kaec] coach stream error:", err);
      } finally {
        controller.close();
      }
    },
  });
}
