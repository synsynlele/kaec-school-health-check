import { NextResponse } from "next/server";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposPortfolioIntelligence,
  KhposBenchmarkingError,
} from "@/lib/khpos/benchmarking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const accessToken = bearerTokenFromRequest(request);
    if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(accessToken);
    const portfolio = await getKhposPortfolioIntelligence(user.id);
    return NextResponse.json({ ok: true, portfolio });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposBenchmarkingError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos] portfolio intelligence failed:", error);
    return NextResponse.json(
      { ok: false, error: "Portfolio Intelligence could not be loaded." },
      { status: 500 },
    );
  }
}
