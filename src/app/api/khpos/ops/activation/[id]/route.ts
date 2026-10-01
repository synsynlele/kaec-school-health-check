import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposActivation,
  KhposActivationError,
  prepareKhposActivationPack,
} from "@/lib/khpos/ops/activation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposActivationError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][activation] failed:", error);
  return NextResponse.json(
    { ok: false, error: "Activation status could not be loaded." },
    { status: 500 },
  );
}

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
    const activation = await getKhposActivation(id, user.id);
    return NextResponse.json(
      { ok: true, activation },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
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
    const body = (await request.json()) as { action?: string };

    const kind =
      body.action === "prepare_critical_policy_drafts"
        ? "critical_policies"
        : body.action === "prepare_ready_process_drafts"
          ? "ready_processes"
          : null;

    if (!kind) {
      return NextResponse.json(
        { ok: false, error: "Unsupported activation action." },
        { status: 400 },
      );
    }

    const result = await prepareKhposActivationPack(id, user.id, kind);
    const activation = await getKhposActivation(id, user.id);

    return NextResponse.json(
      { ok: true, result, activation },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
