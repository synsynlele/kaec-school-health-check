import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  createKhposPipupathConnection,
  getKhposPipupathWorkspace,
  KhposPipupathIntegrationError,
  refreshKhposPipupathSignals,
} from "@/lib/khpos/pipupath-integration";
import { KhposWorkspaceError } from "@/lib/khpos/workspace";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposWorkspaceError ||
    error instanceof KhposPipupathIntegrationError
  ) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error("[khpos] PipuPath integration operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "PipuPath integration could not complete this request." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }
  try {
    const user = await authenticatedUser(request);
    const workspace = await getKhposPipupathWorkspace(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }

  let payload: { action?: "connect" | "refresh" } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid PipuPath integration request." }, { status: 400 });
  }

  try {
    const user = await authenticatedUser(request);
    const workspace = payload.action === "connect"
      ? await createKhposPipupathConnection(id, user.id)
      : payload.action === "refresh"
        ? await refreshKhposPipupathSignals(id, user.id)
        : null;
    if (!workspace) {
      throw new KhposPipupathIntegrationError("Choose a valid PipuPath integration operation.", 400);
    }
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
  }
}
