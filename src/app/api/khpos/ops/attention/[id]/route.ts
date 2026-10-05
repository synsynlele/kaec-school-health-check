import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import { getKhposAttention } from "@/lib/khpos/ops/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const attention = await getKhposAttention(id, user.id);
    return NextResponse.json(
      { ok: true, attention },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos][ops] attention intelligence failed:", error);
    return NextResponse.json(
      { ok: false, error: "Your action-required view could not be loaded." },
      { status: 500 },
    );
  }
}
