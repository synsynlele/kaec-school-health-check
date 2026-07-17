import { NextResponse } from "next/server";
import { getAssessmentState } from "@/lib/storage";
import { notFound, serverError, UUID_RE } from "@/lib/http";

export const runtime = "nodejs";

/** Full assessment state — used to resume an in-progress assessment. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Assessment not found.");

  try {
    const state = await getAssessmentState(id);
    if (!state) return notFound("Assessment not found.");
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    console.error("[kaec] get assessment failed:", err);
    return serverError();
  }
}
