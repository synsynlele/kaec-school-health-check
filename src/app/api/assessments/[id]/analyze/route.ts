import { NextResponse } from "next/server";
import { generateReport } from "@/lib/kshc-ai-report";
import { TOTAL_QUESTIONS } from "@/lib/questions";
import { chapterScoresRecord } from "@/lib/report-engine";
import { sanitizeFallbackReport } from "@/lib/report-quality";
import { appUrl } from "@/lib/site";
import {
  getAssessmentState,
  hasReport,
  saveReportAndComplete,
} from "@/lib/storage";
import { sendReportEmail } from "@/lib/email";
import { badRequest, notFound, serverError, UUID_RE } from "@/lib/http";
import { canAccessKshcAssessment, kshcUserFromRequest } from "@/lib/kshc-access";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Assessment not found.");
  const user = await kshcUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  if (!(await canAccessKshcAssessment(id, user.email))) return notFound("Assessment not found.");

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

    const generated = await generateReport(state.school, state.answers);
    const report = generated.engine === "engine" ? sanitizeFallbackReport(generated) : generated;

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
      aiStatus: report.generation?.aiStatus ?? (report.engine === "openai" ? "openai_success" : "legacy_engine"),
      aiModel: report.generation?.model ?? null,
      email: email.status,
      reportUrl: `/report/${id}`,
    });
  } catch (err) {
    console.error("[kaec] analyze failed:", err);
    return serverError("Analysis hit a problem. Please retry — your answers are safe.");
  }
}
