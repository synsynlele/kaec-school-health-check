/**
 * KSHC report intelligence.
 *
 * Deterministic scoring remains authoritative. OpenAI only interprets the
 * completed assessment and writes the narrative layer. Every fallback records
 * why AI was not used so production can never fail silently again.
 */
import OpenAI from "openai";
import { z } from "zod";
import {
  CHAPTERS,
  QUESTION_INDEX,
  RATING_OPTIONS,
  TOTAL_QUESTIONS,
  type ChapterKey,
} from "./questions";
import { computeScores, ratingFor } from "./scoring";
import { generateEngineReport } from "./report-engine";
import type {
  AnswerRecord,
  ReportData,
  ReportGenerationStatus,
  SchoolInfo,
} from "./types";

const REPORT_MODEL =
  process.env.OPENAI_REPORT_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini-2025-04-14";

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function openAiConfigurationStatus() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    reportModel: REPORT_MODEL,
  };
}

export interface OpenAiProbeResult {
  ok: boolean;
  configured: boolean;
  model: string;
  latencyMs: number;
  reason?: string;
}

function classifyOpenAiError(error: unknown): string {
  const candidate = error as {
    status?: number;
    code?: string | null;
    name?: string;
  };
  if (candidate.status === 401) return "authentication_failed";
  if (candidate.status === 403) return "permission_denied";
  if (candidate.status === 404) return "model_not_available";
  if (candidate.status === 429) return "rate_limit_or_billing";
  if (candidate.status && candidate.status >= 500) return "provider_unavailable";
  if (candidate.code === "insufficient_quota") return "rate_limit_or_billing";
  return candidate.name === "AbortError" ? "request_timeout" : "request_failed";
}

export async function probeOpenAiConnection(): Promise<OpenAiProbeResult> {
  const started = Date.now();
  const openai = client();
  if (!openai) {
    return {
      ok: false,
      configured: false,
      model: REPORT_MODEL,
      latencyMs: Date.now() - started,
      reason: "not_configured",
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: REPORT_MODEL,
      temperature: 0,
      max_completion_tokens: 16,
      messages: [
        {
          role: "system",
          content: "You are a connectivity probe. Follow the user's instruction exactly.",
        },
        { role: "user", content: "Reply with exactly KSHC_AI_OK" },
      ],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return {
      ok: text === "KSHC_AI_OK",
      configured: true,
      model: REPORT_MODEL,
      latencyMs: Date.now() - started,
      ...(text === "KSHC_AI_OK" ? {} : { reason: "unexpected_response" }),
    };
  } catch (error) {
    const reason = classifyOpenAiError(error);
    console.error("[kshc][openai_probe] failed", {
      model: REPORT_MODEL,
      reason,
    });
    return {
      ok: false,
      configured: true,
      model: REPORT_MODEL,
      latencyMs: Date.now() - started,
      reason,
    };
  }
}

const AiReportSchema = z.object({
  executiveSummary: z.string().min(120),
  strengths: z
    .array(
      z.object({
        questionId: z.string(),
        title: z.string().min(4),
        detail: z.string().min(40),
      }),
    )
    .length(5),
  weaknesses: z
    .array(
      z.object({
        questionId: z.string(),
        title: z.string().min(4),
        detail: z.string().min(40),
        impact: z.string().min(30),
      }),
    )
    .length(5),
  priorityAreas: z
    .array(
      z.object({
        chapter: z.string(),
        title: z.string(),
        why: z.string().min(40),
        firstStep: z.string().min(20),
      }),
    )
    .length(3),
  chapterAnalyses: z.array(z.string().min(80)).length(CHAPTERS.length),
  recommendations: z
    .array(
      z.object({
        chapter: z.string(),
        title: z.string().min(4),
        detail: z.string().min(40),
        priority: z.enum(["high", "medium", "low"]),
        impact: z.string().min(20),
        effort: z.string().min(10),
      }),
    )
    .min(8)
    .max(10),
  quickWins: z
    .array(
      z.object({
        chapter: z.string(),
        title: z.string().min(4),
        detail: z.string().min(30),
      }),
    )
    .length(4),
  plan30: z.array(z.object({ task: z.string().min(10), outcome: z.string().min(20) })).length(5),
  plan60: z.array(z.object({ task: z.string().min(10), outcome: z.string().min(20) })).length(5),
  plan90: z.array(z.object({ task: z.string().min(10), outcome: z.string().min(20) })).length(5),
  longTermVision: z.string().min(100),
  closingMessage: z.string().min(100),
});

type AiReport = z.infer<typeof AiReportSchema>;

function questionText(id: string): string {
  return QUESTION_INDEX[id]?.text ?? id;
}

function buildReportPrompt(
  school: SchoolInfo,
  answers: AnswerRecord[],
  base: ReportData,
): string {
  const summary = computeScores(answers);
  const label = (score: number) =>
    RATING_OPTIONS.find((option) => option.value === score)?.label ?? "";

  const chapterLines = summary.chapterScores
    .map((chapter) => `- ${chapter.title}: ${chapter.score}%`)
    .join("\n");

  const answerLines = answers
    .map((answer) => {
      const chapter = CHAPTERS.find((item) => item.key === answer.chapter)!;
      return `[${chapter.shortTitle}] ${answer.questionId}: ${answer.score}/5 (${label(answer.score)}) — ${questionText(answer.questionId)}`;
    })
    .join("\n");

  return `You are the institutional-intelligence layer of the KAEC School Health Check (KSHC). Write for a school owner and leadership team as an elite school-transformation analyst, not as a generic chatbot.

NON-NEGOTIABLE RULES
1. The computed scores below are authoritative. Never alter, recalculate or contradict them.
2. Ground every claim in the supplied school context and assessment responses. Never invent evidence.
3. Interpret patterns ACROSS the 55 indicators: dependencies, contradictions, reinforcing strengths, root causes and institutional risks.
4. Do not merely restate ratings such as "rated 4/5". Explain what the pattern means operationally.
5. Never invent industry statistics, improvement percentages, benchmark claims, market dominance claims or causal research claims.
6. Do not repeat a strength, weakness, recommendation or quick-win title.
7. Recommendations must be realistic for the school's context, sequenced and executable. Prefer systems, routines and ownership over expensive purchases.
8. Preserve human authority: write recommendations, not irreversible decisions.
9. Plain professional English. No markdown symbols inside JSON strings.

SCHOOL
- Name: ${school.schoolName}
- Type: ${school.schoolType}
- Level: ${school.schoolLevel}
- Location: ${[school.state, school.country].filter(Boolean).join(", ")}
- Students: ${school.studentPopulation}
- Staff: ${school.staffPopulation}

COMPUTED SCORES
Overall: ${summary.overall}/100 — ${ratingFor(summary.overall).label}
${chapterLines}

ALL ${answers.length} ASSESSMENT INDICATORS
${answerLines}

DETERMINISTIC BASELINE CONTEXT
${JSON.stringify({
  priorityAreas: base.priorityAreas.map((item) => ({ chapter: item.chapter, title: item.title })),
  executiveSummary: base.executiveSummary,
})}

Return STRICT JSON only with this exact shape:
{
  "executiveSummary": "Two substantive paragraphs explaining the school's overall institutional picture, strongest system, most material risk, cross-area patterns and what leadership should focus on first.",
  "strengths": [{"questionId":"exact supplied indicator id","title":"unique title","detail":"specific interpretation grounded in the indicator and wider pattern"}],
  "weaknesses": [{"questionId":"exact supplied indicator id","title":"unique title","detail":"specific operational gap","impact":"what the gap constrains or risks"}],
  "priorityAreas": [{"chapter":"exact chapter key","title":"chapter title","why":"why this area should be addressed now, including cross-system dependencies","firstStep":"one precise first action"}],
  "chapterAnalyses": ["One 3-5 sentence analysis for every chapter in exactly this order: ${CHAPTERS.map((chapter) => chapter.title).join(" | ")}"],
  "recommendations": [{"chapter":"exact chapter key","title":"unique action title","detail":"specific implementation guidance","priority":"high|medium|low","impact":"expected operational result without invented statistics","effort":"realistic time/cost/coordination expectation"}],
  "quickWins": [{"chapter":"exact chapter key","title":"unique action title","detail":"achievable within days at low or near-zero cost"}],
  "plan30": [{"task":"specific task","outcome":"observable outcome"}],
  "plan60": [{"task":"specific task","outcome":"observable outcome"}],
  "plan90": [{"task":"specific task","outcome":"observable outcome"}],
  "longTermVision": "A grounded 12-month institutional picture. No invented statistics or unsupported benchmark claims.",
  "closingMessage": "A specific, credible closing message to ${school.schoolName} that creates urgency without hype."
}

Exact counts: 5 strengths, 5 weaknesses, 3 priority areas, ${CHAPTERS.length} chapter analyses, 8-10 recommendations, 4 quick wins, and exactly 5 items in each 30/60/90-day plan.`;
}

function uniqueTitles(values: Array<{ title: string }>): boolean {
  const normalised = values.map((value) => value.title.trim().toLowerCase());
  return new Set(normalised).size === normalised.length;
}

function validateGrounding(ai: AiReport): string[] {
  const issues: string[] = [];
  const validQuestions = new Set(Object.keys(QUESTION_INDEX));
  const validChapters = new Set(CHAPTERS.map((chapter) => chapter.key));

  for (const item of [...ai.strengths, ...ai.weaknesses]) {
    if (!validQuestions.has(item.questionId)) issues.push(`unknown questionId ${item.questionId}`);
  }
  for (const item of [...ai.priorityAreas, ...ai.recommendations, ...ai.quickWins]) {
    if (!validChapters.has(item.chapter as ChapterKey)) issues.push(`unknown chapter ${item.chapter}`);
  }
  for (const [label, items] of [
    ["strengths", ai.strengths],
    ["weaknesses", ai.weaknesses],
    ["recommendations", ai.recommendations],
    ["quickWins", ai.quickWins],
  ] as const) {
    if (!uniqueTitles(items)) issues.push(`duplicate ${label} titles`);
  }
  return issues;
}

function parseAiReport(raw: string): { data?: AiReport; issues: string[] } {
  if (!raw.trim()) return { issues: ["empty model response"] };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { issues: ["model response was not valid JSON"] };
  }
  const parsed = AiReportSchema.safeParse(json);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  const groundingIssues = validateGrounding(parsed.data);
  if (groundingIssues.length) return { issues: groundingIssues };
  return { data: parsed.data, issues: [] };
}

function fallback(
  base: ReportData,
  status: ReportGenerationStatus,
  attempts: number,
  detail?: string,
): ReportData {
  return {
    ...base,
    engine: "engine",
    generation: {
      aiStatus: status,
      model: REPORT_MODEL,
      attempts,
      detail,
    },
  };
}

function chapterKey(value: string): ChapterKey | undefined {
  return CHAPTERS.find((chapter) => chapter.key === value)?.key;
}

function mergeAiReport(base: ReportData, ai: AiReport, attempts: number): ReportData {
  return {
    ...base,
    executiveSummary: ai.executiveSummary,
    strengths: ai.strengths.map((item) => ({
      title: item.title,
      detail: item.detail,
      chapter: QUESTION_INDEX[item.questionId]?.chapter,
    })),
    weaknesses: ai.weaknesses.map((item) => ({
      title: item.title,
      detail: item.detail,
      impact: item.impact,
      chapter: QUESTION_INDEX[item.questionId]?.chapter,
    })),
    priorityAreas: base.priorityAreas.map((priority, index) => ({
      ...priority,
      title: ai.priorityAreas[index]?.title || priority.title,
      why: ai.priorityAreas[index]?.why || priority.why,
      firstStep: ai.priorityAreas[index]?.firstStep || priority.firstStep,
    })),
    chapterAnalyses: base.chapterAnalyses.map((chapter, index) => ({
      ...chapter,
      analysis: ai.chapterAnalyses[index] || chapter.analysis,
    })),
    recommendations: ai.recommendations.map((item) => ({
      title: item.title,
      detail: item.detail,
      priority: item.priority,
      impact: item.impact,
      effort: item.effort,
      chapter: chapterKey(item.chapter),
    })),
    quickWins: ai.quickWins.map((item) => ({
      title: item.title,
      detail: item.detail,
      chapter: chapterKey(item.chapter),
    })),
    plan30: ai.plan30,
    plan60: ai.plan60,
    plan90: ai.plan90,
    longTermVision: ai.longTermVision,
    closingMessage: ai.closingMessage,
    engine: "openai",
    generation: {
      aiStatus: "openai_success",
      model: REPORT_MODEL,
      attempts,
    },
  };
}

export async function generateReport(
  school: SchoolInfo,
  answers: AnswerRecord[],
): Promise<ReportData> {
  const base = generateEngineReport(school, answers);
  const openai = client();

  if (!openai) {
    console.warn("[kshc][ai_report] OpenAI is not configured; deterministic report used.");
    return fallback(base, "ai_not_configured", 0);
  }
  if (answers.length < TOTAL_QUESTIONS) {
    console.warn("[kshc][ai_report] Incomplete assessment reached AI layer", {
      answered: answers.length,
      expected: TOTAL_QUESTIONS,
    });
    return fallback(base, "ai_incomplete_assessment", 0);
  }

  const prompt = buildReportPrompt(school, answers, base);
  let lastIssues: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const retryInstruction =
        attempt === 1
          ? ""
          : `\n\nVALIDATION FAILURE ON PREVIOUS ATTEMPT\n${lastIssues.join("\n")}\nRegenerate the complete JSON from scratch and correct every issue.`;

      const completion = await openai.chat.completions.create({
        model: REPORT_MODEL,
        temperature: 0.35,
        max_completion_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are KAEC's institutional school-transformation analyst. You produce evidence-grounded, practical KSHC reports and output valid JSON only.",
          },
          { role: "user", content: `${prompt}${retryInstruction}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = parseAiReport(raw);
      if (parsed.data) {
        console.info("[kshc][ai_report] OpenAI narrative generated", {
          model: REPORT_MODEL,
          attempt,
        });
        return mergeAiReport(base, parsed.data, attempt);
      }

      lastIssues = parsed.issues;
      console.warn("[kshc][ai_report] OpenAI output failed quality validation", {
        model: REPORT_MODEL,
        attempt,
        issues: lastIssues,
      });
    } catch (error) {
      const reason = classifyOpenAiError(error);
      console.error("[kshc][ai_report] OpenAI request failed", {
        model: REPORT_MODEL,
        attempt,
        reason,
      });
      return fallback(base, "ai_api_failed", attempt, reason);
    }
  }

  return fallback(
    base,
    "ai_schema_failed",
    2,
    lastIssues.slice(0, 4).join(" | "),
  );
}
