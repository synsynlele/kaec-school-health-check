import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import { actOnSchoolAssignment, actOnSchoolPosition, getSchoolPositions, getPendingRoleApprovals, SchoolPositionsError } from "@/lib/khpos/ops/positions";
import { acknowledgeKhposOpsPolicy, KhposOpsLibraryError } from "@/lib/khpos/ops/library";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function actor(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(token);
}
function error(cause: unknown) {
  if (cause instanceof KhposAuthError || cause instanceof SchoolPositionsError || cause instanceof KhposOpsLibraryError) return NextResponse.json({ ok: false, error: cause.message }, { status: cause.status });
  return NextResponse.json({ ok: false, error: "Positions could not be processed." }, { status: 500 });
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) throw new SchoolPositionsError("School not found.", 404);
    const staffId = new URL(request.url).searchParams.get("staffId");
    if (staffId && !UUID_RE.test(staffId)) throw new SchoolPositionsError("Invalid staff reference.");
    const user = await actor(request);
    if (new URL(request.url).searchParams.get("queue") === "1") {
      return NextResponse.json({ok: true, approvals: await getPendingRoleApprovals(id, user.id)}, {headers: {"Cache-Control": "private, no-store"}});
    }
    return NextResponse.json({ ok: true, positions: await getSchoolPositions(id, user.id, staffId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return error(cause); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) throw new SchoolPositionsError("School not found.", 404);
    const user = await actor(request);
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { throw new SchoolPositionsError("Invalid position request."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new SchoolPositionsError("Invalid position request.");
    for (const key of ["assignmentId", "replacementId", "staffId", "positionId", "roleId", "campusId", "unitId", "versionId"]) {
      if (body[key] != null && body[key] !== "" && (typeof body[key] !== "string" || !UUID_RE.test(body[key] as string))) throw new SchoolPositionsError("Invalid position reference.");
    }
    if (["assignment_disable", "assignment_restore", "assignment_end", "assignment_make_primary"].includes(String(body.mode))) {
      if (typeof body.staffId !== "string" || typeof body.assignmentId !== "string") throw new SchoolPositionsError("Staff and assignment references are required.");
      await actOnSchoolAssignment(id, user.id, body.staffId, body.assignmentId, String(body.mode).replace("assignment_", ""), body);
    } else if (body.mode === "policy_acknowledge" && typeof body.versionId === "string") {
      await acknowledgeKhposOpsPolicy(id, user.id, body.versionId);
    } else if (["propose", "activate", "acknowledge", "end"].includes(String(body.mode))) {
      await actOnSchoolPosition(id, user.id, String(body.mode), body);
    } else throw new SchoolPositionsError("Unsupported position action.");
    return NextResponse.json({ ok: true, positions: await getSchoolPositions(id, user.id, typeof body.staffId === "string" ? body.staffId : null) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) { return error(cause); }
}
