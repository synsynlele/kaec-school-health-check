import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposBenchmarkWorkspace,
  KhposBenchmarkingError,
} from "@/lib/khpos/benchmarking";

export const runtime = "nodejs";

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
    const workspace = await getKhposBenchmarkWorkspace(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposBenchmarkingError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos] benchmark intelligence failed:", error);
    return NextResponse.json(
      { ok: false, error: "Benchmark Intelligence could not be loaded." },
      { status: 500 },
    );
  }
}
