import { NextResponse } from "next/server";
import { getAssessmentState } from "@/lib/storage";
import { notFound, serverError, UUID_RE } from "@/lib/http";
import { canAccessKshcAssessment, kshcUserFromRequest } from "@/lib/kshc-access";

export const runtime = "nodejs";

/** Full assessment state — used to resume an in-progress assessment. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound("Assessment not found.");
  const user = await kshcUserFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  if (!(await canAccessKshcAssessment(id, user.email))) return notFound("Assessment not found.");

  try {
    const state = await getAssessmentState(id);
    if (!state) return notFound("Assessment not found.");
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    console.error("[kaec] get assessment failed:", err);
    return serverError();
  }
}
