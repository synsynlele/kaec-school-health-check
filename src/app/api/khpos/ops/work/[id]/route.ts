import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  addKhposOpsWorkEvidence,
  getKhposOpsMyWork,
  KhposOpsWorkError,
  setKhposOpsChecklistResponse,
  updateKhposOpsWork,
} from "@/lib/khpos/ops/work";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsWorkError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos][ops] work operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "My Work operation could not be completed." },
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
    const work = await getKhposOpsMyWork(id, user.id);
    return NextResponse.json(
      { ok: true, work },
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
    action?: "start" | "block" | "complete" | "checklist" | "evidence";
    workItemId?: string;
    note?: string;
    templateItemId?: string;
    response?: unknown;
    evidenceType?: "note" | "link";
    externalUrl?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid work request." },
      { status: 400 },
    );
  }

  if (!payload.workItemId || !UUID_RE.test(payload.workItemId)) {
    return NextResponse.json(
      { ok: false, error: "A valid work item is required." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (
      payload.action === "start" ||
      payload.action === "block" ||
      payload.action === "complete"
    ) {
      const work = await updateKhposOpsWork(
        id,
        user.id,
        payload.workItemId,
        payload.action,
        payload.note,
      );
      return NextResponse.json({ ok: true, work });
    }

    if (
      payload.action === "checklist" &&
      payload.templateItemId &&
      UUID_RE.test(payload.templateItemId) &&
      payload.response !== undefined
    ) {
      const work = await setKhposOpsChecklistResponse(
        id,
        user.id,
        payload.workItemId,
        payload.templateItemId,
        payload.response,
        payload.note,
      );
      return NextResponse.json({ ok: true, work });
    }

    if (
      payload.action === "evidence" &&
      (payload.evidenceType === "note" || payload.evidenceType === "link")
    ) {
      const work = await addKhposOpsWorkEvidence(
        id,
        user.id,
        payload.workItemId,
        {
          evidenceType: payload.evidenceType,
          note: payload.note,
          externalUrl: payload.externalUrl,
        },
      );
      return NextResponse.json({ ok: true, work });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported work action." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
