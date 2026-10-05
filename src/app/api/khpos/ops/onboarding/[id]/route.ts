import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposMyOnboarding,
  KhposOnboardingError,
  saveKhposPractice,
  submitMyOnboardingItem,
} from "@/lib/khpos/ops/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOnboardingError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error("[khpos][onboarding] request failed", error);
  return NextResponse.json(
    { ok: false, error: "My Onboarding could not be loaded." },
    { status: 500 },
  );
}

async function user(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(token);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }
  try {
    const actor = await user(request);
    const onboarding = await getKhposMyOnboarding(id, actor.id);
    return NextResponse.json(
      { ok: true, onboarding },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }

  try {
    const actor = await user(request);
    const body = (await request.json()) as {
      mode?: "practice" | "submit_item";
      completedSteps?: string[];
      itemId?: string;
      note?: string | null;
      evidenceReference?: string | null;
    };

    const onboarding =
      body.mode === "practice"
        ? await saveKhposPractice(
            id,
            actor.id,
            Array.isArray(body.completedSteps) ? body.completedSteps : [],
          )
        : body.mode === "submit_item" && body.itemId && UUID_RE.test(body.itemId)
          ? await submitMyOnboardingItem(
              id,
              actor.id,
              body.itemId,
              body.note?.trim() || null,
              body.evidenceReference?.trim() || null,
            )
          : null;

    if (!onboarding) {
      return NextResponse.json(
        { ok: false, error: "Unsupported onboarding action." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, onboarding });
  } catch (error) {
    return errorResponse(error);
  }
}
