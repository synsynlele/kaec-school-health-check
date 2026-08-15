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
  return (
    before.departmentScores.length === after.departmentScores.length &&
    after.departmentScores.every((item) => previous.get(item.chapter) === item.score)
  );
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

async function replaceSupabaseReportNarrative(
  assessmentId: string,
  report: ReportData,
): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/kshc_replace_report_narrative_server`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_assessment_id: assessmentId,
      p_full_report: report,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Report narrative replacement failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

async function replacePostgresReportNarrative(
  assessmentId: string,
  report: ReportData,
): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 8000,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS kshc_report_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id uuid NOT NULL,
        version_number integer NOT NULL,
        engine text NOT NULL DEFAULT 'engine',
        full_report jsonb NOT NULL,
        archived_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (assessment_id, version_number)
      )
    `);
    const current = await client.query<{ full_report: ReportData }>(
      "SELECT full_report FROM reports WHERE assessment_id=$1 FOR UPDATE",
      [assessmentId],
    );
    if (!current.rows.length) throw new Error("Report not found during narrative replacement.");
    if (!sameScores(current.rows[0].full_report, report)) {
      throw new Error("KSHC report upgrade blocked because authoritative scores changed.");
    }
    const version = await client.query<{ next_version: number }>(
      "SELECT COALESCE(MAX(version_number),0)+1 AS next_version FROM kshc_report_versions WHERE assessment_id=$1",
      [assessmentId],
    );
    const nextVersion = Number(version.rows[0]?.next_version ?? 1);
    await client.query(
      `INSERT INTO kshc_report_versions (assessment_id,version_number,engine,full_report)
       VALUES ($1,$2,$3,$4)`,
      [assessmentId, nextVersion, current.rows[0].full_report.engine, JSON.stringify(current.rows[0].full_report)],
    );
    await client.query(
      `UPDATE reports SET
        executive_summary=$2,
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
        JSON.stringify({ plan30: report.plan30, plan60: report.plan60, plan90: report.plan90 }),
        JSON.stringify(report),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function replaceReportNarrative(
  assessmentId: string,
  report: ReportData,
): Promise<void> {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    return replaceSupabaseReportNarrative(assessmentId, report);
  }
  return replacePostgresReportNarrative(assessmentId, report);
}

/**
 * Upgrades a legacy/fallback report to OpenAI narrative without reassessment
 * and without creating another analytics record. The previous report revision
 * is archived first so the narrative history remains auditable.
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
