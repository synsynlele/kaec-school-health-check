import { NextResponse } from "next/server";
import { generateReport } from "@/lib/ai";
import { TOTAL_QUESTIONS } from "@/lib/questions";
import { chapterScoresRecord } from "@/lib/report-engine";
import { appUrl } from "@/lib/site";
import {
  getAssessmentState,
  hasReport,
  saveReportAndComplete,
} from "@/lib/storage";
import { sendReportEmail } from "@/lib/email";
import { badRequest, notFound, serverError, UUID_RE } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Runs the full AI diagnosis. Idempotent: a completed report is never
 * regenerated, and concurrent calls safely converge on one report.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Assessment not found.");

  try {
    if (await hasReport(id)) {
      return NextResponse.json({ ok: true, cached: true, reportUrl: `/report/${id}` });
    }

    const state = await getAssessmentState(id);
    if (!state) return notFound("Assessment not found.");
    if (state.answers.length < TOTAL_QUESTIONS) {
      return badRequest("The assessment is not complete yet.", {
        answered: state.answers.length,
        total: TOTAL_QUESTIONS,
      });
    }

    const report = await generateReport(state.school, state.answers);

    /* A concurrent request may have finished while the AI was thinking. */
    if (await hasReport(id)) {
      return NextResponse.json({ ok: true, cached: true, reportUrl: `/report/${id}` });
    }

    await saveReportAndComplete(id, report, chapterScoresRecord(state.answers));

    const email = await sendReportEmail(
      state.school.email,
      state.school.schoolName,
      report,
      appUrl(`/report/${id}`),
    );

    return NextResponse.json({
      ok: true,
      engine: report.engine,
      email: email.status,
      reportUrl: `/report/${id}`,
    });
  } catch (err) {
    console.error("[kaec] analyze failed:", err);
    return serverError("Analysis hit a problem. Please retry — your answers are safe.");
  }
}
