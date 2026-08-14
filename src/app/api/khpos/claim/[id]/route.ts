import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { claimKshcAssessment, KhposClaimError } from "@/lib/khpos/claim";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return NextResponse.json(
      { ok: false, error: "Sign in before activating KHP-OS." },
      { status: 401 },
    );
  }

  try {
    const organisationId = await claimKshcAssessment(id, match[1]);
    return NextResponse.json({ ok: true, organisationId });
  } catch (error) {
    if (error instanceof KhposClaimError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("[khpos] assessment claim failed:", error);
    return NextResponse.json(
      { ok: false, error: "KHP-OS activation failed. Please try again." },
      { status: 500 },
    );
  }
}
