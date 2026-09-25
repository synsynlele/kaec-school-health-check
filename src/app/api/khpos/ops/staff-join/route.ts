import { NextResponse } from "next/server";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { redeemStaffAccess } from "@/lib/khpos/ops/staff-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const accessToken = bearerTokenFromRequest(request);
    if (!accessToken) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
    const user = await verifyKhposAccessToken(accessToken);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as Record<string, unknown>).token !== "string") throw new Error("Invalid staff access link.");
    const result = await redeemStaffAccess(user.id, (body as { token: string }).token);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Staff joining failed.";
    return NextResponse.json({ ok: false, error: message }, { status: /not configured|function .* does not exist/i.test(message) ? 503 : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
