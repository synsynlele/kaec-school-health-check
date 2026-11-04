import { NextResponse } from "next/server";
import { z } from "zod";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { meetingOperation } from "@/lib/khpos/ops/meetings";
import { createGoogleMeetParts, GoogleMeetPreparationError } from "@/lib/khpos/ops/google-meet";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
 try {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "School not found." }, { status: 404 });
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.");
  const user = await verifyKhposAccessToken(token);
  const workspace = await meetingOperation(user.id, id, "list", { omitRoster: true });
  if (!workspace.canCreate) throw new KhposAuthError("School leadership is required to prepare calls.", 403);
  const raw = await request.text();
  if (raw.length > 1000) return NextResponse.json({ error: "Invalid request." }, { status: 413 });
  const { count } = z.object({ count: z.number().int().min(1).max(6) }).parse(JSON.parse(raw));
  const googleToken = request.headers.get("X-Google-Access-Token");
  if (!googleToken) return NextResponse.json({ error: "Connect Google with meeting permission first." }, { status: 400 });
  return NextResponse.json({ links: await createGoogleMeetParts(googleToken, count) }, { headers: { "Cache-Control": "private, no-store" } });
 } catch (error) {
  const status = error instanceof KhposAuthError ? error.status : error && typeof error === "object" && "status" in error ? Number(error.status) : 400;
  const googleError=error instanceof GoogleMeetPreparationError?error:null;
  const links=googleError?.links??[];
  return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare the calls.", links, code:googleError?.code, setupUrl:googleError?.setupUrl }, { status, headers: { "Cache-Control": "private, no-store" } });
 }
}
