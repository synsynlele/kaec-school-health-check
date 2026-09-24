import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  acknowledgeKhposOpsPolicy,
  getKhposOpsLibrary,
  KhposOpsLibraryError,
} from "@/lib/khpos/ops/library";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsLibraryError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] library operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Institutional library operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
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
    const user = await authenticatedUser(request);
    const library = await getKhposOpsLibrary(id, user.id);
    return NextResponse.json(
      { ok: true, library },
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
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  let payload: {
    action?: "acknowledge_policy";
    policyVersionId?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid library request." },
      { status: 400 },
    );
  }

  if (
    payload.action !== "acknowledge_policy" ||
    !payload.policyVersionId ||
    !UUID_RE.test(payload.policyVersionId)
  ) {
    return NextResponse.json(
      { ok: false, error: "A valid policy version is required." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const library = await acknowledgeKhposOpsPolicy(
      id,
      user.id,
      payload.policyVersionId,
    );
    return NextResponse.json(
      { ok: true, library },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
