import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposOnboardingGuide,
  KhposOnboardingError,
} from "@/lib/khpos/ops/onboarding";

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
    const onboarding = await getKhposOnboardingGuide(id, user.id);
    return NextResponse.json(
      { ok: true, onboarding },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposOnboardingError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos][ops] onboarding guide failed:", error);
    return NextResponse.json(
      { ok: false, error: "Your operating guide could not be loaded." },
      { status: 500 },
    );
  }
}
