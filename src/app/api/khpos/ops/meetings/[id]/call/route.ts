import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { meetingOperation } from "@/lib/khpos/ops/meetings";
import { createJaasSession } from "@/lib/khpos/ops/jaas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  const meetingId = new URL(request.url).searchParams.get("meeting");
  if (!UUID_RE.test(id) || !meetingId || !UUID_RE.test(meetingId)) return NextResponse.json({ error: "Meeting not found." }, { status: 404, headers });
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to join the call.");
  const user = await verifyKhposAccessToken(token);
  const workspace = await meetingOperation(user.id, id, "list", { meetingId, omitRoster: true });
  if (workspace.room?.meeting.id !== meetingId) return NextResponse.json({ error: "Meeting not found." }, { status: 404, headers });
  return NextResponse.json(createJaasSession(workspace), { headers });
 } catch (error) {
  const status = error instanceof KhposAuthError ? error.status : error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
  return NextResponse.json({ error: status === 500 ? "Could not prepare the call. Please try again." : error instanceof Error ? error.message : "Could not join the call." }, { status, headers });
 }
}
