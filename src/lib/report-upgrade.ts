import { Pool } from "pg";
import { generateReport, openAiConfigurationStatus } from "./kshc-ai-report";
import { TOTAL_QUESTIONS } from "./questions";
import { sanitizeFallbackReport } from "./report-quality";
import { getAssessmentState, getReport } from "./storage";
import type { ReportData } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAILURE_RETRY_MS = 6 * 60 * 60 * 1000;

export type ReportUpgradeResult =
  | "upgraded"
  | "already_openai"
  | "not_configured"
  | "incomplete"
  | "throttled"
  | "not_found";

function sameScores(before: ReportData, after: ReportData): boolean {
  if (before.overallScore !== after.overallScore) return false;
  const previous = new Map(before.departmentScores.map((item) => [item.chapter, item.score]));
  return after.departmentScores.every((item) => previous.get(item.chapter) === item.score);
}

function retryAllowed(report: ReportData): boolean {
  if (!report.generation) return true;
  if (report.generation.aiStatus === "ai_not_configured") return true;
  if (
    report.generation.aiStatus !== "ai_api_failed" &&
    report.generation.aiStatus !== "ai_schema_failed"
  ) {
    return true;
  }
  const generated = Date.parse(report.generatedAt);
  return !Number.isFinite(generated) || Date.now() - generated >= FAILURE_RETRY_MS;
}

async function replaceReportNarrative(
  assessmentId: string,
  report: ReportData,
): Promise<void> {
  const payload = {
    executive_summary: report.executiveSummary,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    recommendations: report.recommendations,
    ninety_day_plan: {
      plan30: report.plan30,
      plan60: report.plan60,
      plan90: report.plan90,
    },
    full_report: report,
  };

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/reports?assessment_id=eq.${encodeURIComponent(assessmentId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      throw new Error(`Report narrative replacement failed (${response.status}).`);
    }
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 8000,
  });
  try {
    await pool.query(
      `UPDATE reports
       SET executive_summary=$2,
           strengths=$3,
           weaknesses=$4,
           recommendations=$5,
           ninety_day_plan=$6,
           full_report=$7
       WHERE assessment_id=$1`,
      [
        assessmentId,
        report.executiveSummary,
        JSON.stringify(report.strengths),
        JSON.stringify(report.weaknesses),
        JSON.stringify(report.recommendations),
        JSON.stringify(payload.ninety_day_plan),
        JSON.stringify(report),
      ],
    );
  } finally {
    await pool.end();
  }
}

/**
 * Upgrades a legacy/fallback report to OpenAI narrative without reassessment,
 * without changing scores and without creating another analytics record.
 */
export async function upgradeStoredReportIfNeeded(
  assessmentId: string,
): Promise<ReportUpgradeResult> {
  const stored = await getReport(assessmentId);
  if (!stored) return "not_found";
  if (stored.report.engine === "openai") return "already_openai";
  if (!openAiConfigurationStatus().configured) return "not_configured";
  if (!retryAllowed(stored.report)) return "throttled";

  const state = await getAssessmentState(assessmentId);
  if (!state || state.answers.length < TOTAL_QUESTIONS) return "incomplete";

  const generated = await generateReport(state.school, state.answers);
  const next = generated.engine === "engine" ? sanitizeFallbackReport(generated) : generated;

  if (!sameScores(stored.report, next)) {
    throw new Error("KSHC report upgrade blocked because authoritative scores changed.");
  }

  await replaceReportNarrative(assessmentId, next);
  return next.engine === "openai" ? "upgraded" : "throttled";
}
