import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposLeadershipBrief,
  KhposLeadershipBriefError,
} from "@/lib/khpos/ops/briefing";

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
    const windowParam = new URL(request.url).searchParams.get("days");
    if (windowParam && windowParam !== "7" && windowParam !== "30") {
      return NextResponse.json({ok:false,error:"Choose a seven- or thirty-day report."},{status:400});
    }
    const days: 7 | 30 = windowParam === "30" ? 30 : 7;
    const brief = await getKhposLeadershipBrief(id, user.id, days);
    return NextResponse.json(
      { ok: true, brief },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof KhposAuthError ||
      error instanceof KhposLeadershipBriefError
    ) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos][ops] leadership brief failed:", error);
    return NextResponse.json(
      { ok: false, error: "Leadership brief could not be prepared." },
      { status: 500 },
    );
  }
}
