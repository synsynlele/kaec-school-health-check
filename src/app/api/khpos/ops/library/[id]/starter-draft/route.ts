import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  createPolicyStarterDraft,
  createProcessStarterDraft,
  KhposStarterDraftError,
  starterDraftModel,
} from "@/lib/khpos/ops/starter-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function failure(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposStarterDraftError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][starter-draft] failed:", error);
  return NextResponse.json(
    {
      ok: false,
      error: "Starter draft could not be prepared. No control was changed.",
    },
    { status: 500 },
  );
}

export async function POST(
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
    const body = (await request.json()) as {
      kind?: "policy" | "process";
      controlId?: string;
    };

    if (
      !body.controlId ||
      !UUID_RE.test(body.controlId) ||
      !["policy", "process"].includes(body.kind ?? "")
    ) {
      return NextResponse.json(
        { ok: false, error: "A valid control and draft type are required." },
        { status: 400 },
      );
    }

    const result =
      body.kind === "policy"
        ? await createPolicyStarterDraft(id, user.id, body.controlId)
        : await createProcessStarterDraft(id, user.id, body.controlId);

    return NextResponse.json(
      {
        ok: true,
        kind: body.kind,
        model: starterDraftModel(),
        ...result,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
