import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  adoptKhposStandard,
  getKhposStandardWorkspace,
  KhposStandardError,
} from "@/lib/khpos/ops/standard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposStandardError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][standard] request failed", error);
  return NextResponse.json(
    { ok: false, error: "KAEC Standard workspace could not be loaded." },
    { status: 500 },
  );
}

async function actor(request: Request) {
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
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  try {
    const user = await actor(request);
    const workspace = await getKhposStandardWorkspace(id, user.id);
    return NextResponse.json(
      { ok: true, workspace },
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
    const user = await actor(request);
    const body = (await request.json()) as {
      action?: string;
      installationId?: string;
    };

    if (
      body.action !== "adopt_standard" ||
      !body.installationId ||
      !UUID_RE.test(body.installationId)
    ) {
      return NextResponse.json(
        { ok: false, error: "A valid standard adoption request is required." },
        { status: 400 },
      );
    }

    const workspace = await adoptKhposStandard(
      id,
      user.id,
      body.installationId,
    );

    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return failure(error);
  }
}
