import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposImprovementWorkspace,
  KhposImprovementError,
  startKhposReassessment,
} from "@/lib/khpos/improvement";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposImprovementError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos] improvement intelligence operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Improvement intelligence could not complete this request." },
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
    const workspace = await getKhposImprovementWorkspace(id, user.id);
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

  let payload: { action?: "start_reassessment" } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid reassessment request." }, { status: 400 });
  }

  try {
    const user = await authenticatedUser(request);
    if (payload.action !== "start_reassessment") {
      throw new KhposImprovementError("Choose a valid improvement operation.", 400);
    }

    const reassessment = await startKhposReassessment(id, user.id);
    return NextResponse.json({ ok: true, reassessment });
  } catch (error) {
    return responseForError(error);
  }
}