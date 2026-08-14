import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  createKhposKsiPairing,
  getKhposKsiWorkspace,
  KhposKsiIntegrationError,
} from "@/lib/khpos/ksi-integration";
import { KhposWorkspaceError } from "@/lib/khpos/workspace";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposWorkspaceError ||
    error instanceof KhposKsiIntegrationError
  ) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error("[khpos] KSI integration operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "KSI integration could not complete this request." },
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
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }
  try {
    const user = await authenticatedUser(request);
    const workspace = await getKhposKsiWorkspace(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
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
  let payload: { action?: "create_pairing" } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid KSI integration request." }, { status: 400 });
  }
  try {
    const user = await authenticatedUser(request);
    if (payload.action !== "create_pairing") {
      throw new KhposKsiIntegrationError("Choose a valid KSI integration operation.", 400);
    }
    const pairing = await createKhposKsiPairing(id, user.id);
    return NextResponse.json({ ok: true, pairing });
  } catch (error) {
    return responseForError(error);
  }
}
