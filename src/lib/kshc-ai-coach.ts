import OpenAI from "openai";
import { CHAPTER_MAP } from "./questions";
import type { CoachMessage, ReportData, SchoolInfo } from "./types";

const COACH_MODEL =
  process.env.OPENAI_COACH_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini-2025-04-14";

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? new OpenAI({ apiKey: key }) : null;
}

export function buildCoachSystemPrompt(
  school: SchoolInfo,
  report: ReportData,
): string {
  const chapters = report.departmentScores
    .map((department) => `${department.title} ${department.score}%`)
    .join(", ");
  const strengths = report.strengths.map((strength) => strength.title).join("; ");
  const weaknesses = report.weaknesses
    .map((weakness) => `${weakness.title} (impact: ${weakness.impact})`)
    .join("; ");
  const recommendations = report.recommendations
    .map((recommendation) => `- [${recommendation.priority}] ${recommendation.title}: ${recommendation.detail}`)
    .join("\n");
  const quickWins = report.quickWins
    .map((quickWin) => `- ${quickWin.title}: ${quickWin.detail}`)
    .join("\n");
  const plan30 = report.plan30.map((item) => `- ${item.task}`).join("\n");

  return `You are the KAEC AI School Coach inside the "${school.schoolName}" KSHC report.
Act as a rigorous, practical institutional-transformation advisor. Be specific to THIS school's report. The KSHC scores are authoritative; never recalculate or contradict them. Do not invent statistics, benchmarks or evidence. Keep answers under 220 words. Use short paragraphs or up to 4 bullet points. End with one concrete next step. No markdown headers.

SCHOOL: ${school.schoolName} — ${school.schoolType}, ${school.schoolLevel}, ${school.studentPopulation} students, ${school.staffPopulation} staff, ${[school.state, school.country].filter(Boolean).join(", ")}.
OVERALL: ${report.overallScore}/100 — ${report.healthRating}. Priority area: ${report.priorityArea}.
CHAPTER SCORES: ${chapters}.
STRENGTHS: ${strengths}.
WEAKNESSES: ${weaknesses}.
TOP RECOMMENDATIONS:
${recommendations}
QUICK WINS:
${quickWins}
30-DAY PLAN:
${plan30}
VISION: ${report.longTermVision}`;
}

const COACH_CHAPTER_KEYWORDS: Array<[string, string]> = [
  ["leadership", "leadership"],
  ["leader", "leadership"],
  ["vision", "leadership"],
  ["teach", "teaching"],
  ["lesson", "teaching"],
  ["enrol", "innovation"],
  ["admission", "innovation"],
  ["growth", "innovation"],
  ["discipline", "student_dev"],
  ["behaviour", "student_dev"],
  ["behavior", "student_dev"],
  ["student", "student_dev"],
  ["fee", "finance"],
  ["finance", "finance"],
  ["money", "finance"],
  ["budget", "finance"],
  ["parent", "parents"],
  ["technolog", "technology"],
  ["computer", "technology"],
  ["safety", "safety"],
  ["safeguard", "safety"],
  ["bully", "safety"],
  ["culture", "culture"],
  ["morale", "culture"],
  ["staff", "culture"],
  ["building", "infrastructure"],
  ["toilet", "infrastructure"],
  ["facility", "infrastructure"],
  ["facilities", "infrastructure"],
  ["board", "governance"],
  ["policy", "governance"],
  ["policies", "governance"],
];

export function fallbackCoachReply(question: string, report: ReportData): string {
  const lower = question.toLowerCase();
  const chapterKey = COACH_CHAPTER_KEYWORDS.find(([keyword]) => lower.includes(keyword))?.[1] ?? null;
  const chapterName = chapterKey
    ? CHAPTER_MAP[chapterKey as keyof typeof CHAPTER_MAP]?.title
    : null;
  const recommendations = chapterKey
    ? report.recommendations.filter((recommendation) => {
        if (recommendation.chapter === chapterKey) return true;
        const needle = chapterKey === "student_dev" ? "student" : chapterKey.split("_")[0];
        return recommendation.title.toLowerCase().includes(needle);
      })
    : [];

  const lines: string[] = [];
  if (chapterName) {
    const department = report.departmentScores.find((item) => item.title === chapterName);
    lines.push(
      `In this report, ${chapterName} scored ${department?.score ?? "—"}%. Here is the most practical way to approach it:`,
    );
  } else {
    lines.push(
      `Based on ${report.schoolName}'s report (overall ${report.overallScore}/100, priority area: ${report.priorityArea}), here is a practical starting point:`,
    );
  }
  lines.push("");

  if (recommendations.length) {
    for (const recommendation of recommendations.slice(0, 3)) {
      lines.push(`• ${recommendation.title} — ${recommendation.detail}`);
    }
  } else if (chapterKey) {
    const analysis = report.chapterAnalyses.find((item) => item.chapter === chapterKey);
    if (analysis) {
      lines.push(`The report currently observes: ${analysis.analysis}`);
      lines.push("");
      lines.push(
        "If this area is a strategic focus, identify the weakest indicator inside the chapter, assign one owner and review evidence weekly for one term.",
      );
    }
  } else {
    for (const recommendation of report.recommendations
      .filter((item) => item.priority === "high")
      .slice(0, 3)) {
      lines.push(`• ${recommendation.title} — ${recommendation.detail}`);
    }
  }

  if (report.quickWins.length) {
    lines.push("");
    lines.push(`A practical early win: ${report.quickWins[0].title}. ${report.quickWins[0].detail}`);
  }
  lines.push("");
  lines.push(
    "Next step: choose one action, give it an owner and date this week, then capture evidence of implementation. KHP-OS can continue that work through the full transformation cycle.",
  );
  return lines.join("\n");
}

function textStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const words = text.split(/(\s+)/);
      for (const word of words) {
        controller.enqueue(encoder.encode(word));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      controller.close();
    },
  });
}

export interface CoachStreamResult {
  stream: ReadableStream<Uint8Array>;
  engine: "openai" | "engine";
  model: string | null;
}

export async function streamCoachReply(
  system: string,
  history: CoachMessage[],
  question: string,
  report: ReportData,
): Promise<CoachStreamResult> {
  const openai = client();
  const encoder = new TextEncoder();

  if (!openai) {
    console.warn("[kshc][ai_coach] OpenAI is not configured; deterministic coach fallback used.");
    return {
      stream: textStream(fallbackCoachReply(question, report)),
      engine: "engine",
      model: null,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: COACH_MODEL,
      temperature: 0.45,
      max_completion_tokens: 600,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
        { role: "user", content: question },
      ],
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode("\n\n(The AI connection was interrupted. Please resend your question.)"),
          );
          console.error("[kshc][ai_coach] stream interrupted", error);
        } finally {
          controller.close();
        }
      },
    });

    return { stream, engine: "openai", model: COACH_MODEL };
  } catch (error) {
    console.error("[kshc][ai_coach] OpenAI request failed; deterministic fallback used", {
      model: COACH_MODEL,
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return {
      stream: textStream(fallbackCoachReply(question, report)),
      engine: "engine",
      model: null,
    };
  }
}
