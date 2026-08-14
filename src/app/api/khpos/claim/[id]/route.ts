import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { claimKshcAssessment, KhposClaimError } from "@/lib/khpos/claim";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
  }

  const accessToken = bearerTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Sign in before requesting KHP-OS partnership." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const user = await verifyKhposAccessToken(accessToken);
    const organisationId = await claimKshcAssessment(id, user);
    return NextResponse.json(
      { ok: true, organisationId },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposClaimError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    console.error("[khpos] partnership request failed:", error);
    return NextResponse.json(
      { ok: false, error: "KHP-OS partnership request failed. Please try again." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
