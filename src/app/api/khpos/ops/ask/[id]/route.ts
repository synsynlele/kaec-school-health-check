import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import { askKhpos, KhposAskError } from "@/lib/khpos/ops/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }

  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const body = (await request.json()) as { question?: string };
    const result = await askKhpos(id, user.id, body.question ?? "");
    return NextResponse.json(
      { ok: true, result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposAskError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[khpos][ask] request failed", error);
    return NextResponse.json(
      { ok: false, error: "Ask KHP-OS could not answer this question." },
      { status: 500 },
    );
  }
}
