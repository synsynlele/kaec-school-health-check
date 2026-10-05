import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposOperationalLearning,
  KhposOpsLearningError,
} from "@/lib/khpos/ops/learning";

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
    const accessToken = bearerTokenFromRequest(request);
    if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);

    const user = await verifyKhposAccessToken(accessToken);
    const workspace = await getKhposOperationalLearning(id, user.id);

    return NextResponse.json(
      { ok: true, workspace },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposOpsLearningError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("[khpos][ops-learning] request failed", error);
    return NextResponse.json(
      { ok: false, error: "Operational learning could not be loaded." },
      { status: 500 },
    );
  }
}
