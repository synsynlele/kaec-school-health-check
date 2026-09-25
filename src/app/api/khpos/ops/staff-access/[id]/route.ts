import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { issueStaffAccess } from "@/lib/khpos/ops/staff-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) throw new Error("Invalid school workspace.");
    const token = bearerTokenFromRequest(request);
    if (!token) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
    const user = await verifyKhposAccessToken(token);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || !UUID_RE.test(String((body as Record<string, unknown>).staffId || ""))) throw new Error("A valid staff appointment is required.");
    const result = await issueStaffAccess(id, user.id, String((body as Record<string, unknown>).staffId));
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Staff access link could not be created.";
    return NextResponse.json({ ok: false, error: message }, { status: /not configured|function .* does not exist/i.test(message) ? 503 : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
