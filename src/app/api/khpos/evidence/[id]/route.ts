import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  assessKhposEvidenceSubmission,
  getKhposEvidenceWorkspace,
  KhposEvidenceError,
  prepareKhposEvidenceUpload,
} from "@/lib/khpos/evidence";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposEvidenceError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos] evidence workspace operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Evidence automation could not complete this request." },
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
    const workspace = await getKhposEvidenceWorkspace(id, user.id);
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
    return NextResponse.json(
      { ok: false, error: "School workspace not found." },
      { status: 404 },
    );
  }

  let payload: {
    action?: "prepare_upload" | "assess";
    planId?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    submissionId?: string;
    note?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid evidence request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.action === "prepare_upload") {
      const planId = payload.planId?.trim() ?? "";
      if (!UUID_RE.test(planId)) {
        throw new KhposEvidenceError("Active implementation plan not found.", 404);
      }
      const fileName = payload.fileName?.trim() ?? "";
      const mimeType = payload.mimeType?.trim().toLowerCase() ?? "";
      const sizeBytes = Number(payload.sizeBytes);
      if (!fileName) {
        throw new KhposEvidenceError("Choose an evidence file to upload.", 400);
      }

      const upload = await prepareKhposEvidenceUpload(
        id,
        user.id,
        planId,
        fileName,
        mimeType,
        sizeBytes,
      );
      return NextResponse.json({ ok: true, upload });
    }

    if (payload.action === "assess") {
      const submissionId = payload.submissionId?.trim() ?? "";
      if (!UUID_RE.test(submissionId)) {
        throw new KhposEvidenceError("Evidence submission not found.", 404);
      }
      const note = (payload.note ?? "").trim().slice(0, 2000);
      const workspace = await assessKhposEvidenceSubmission(
        id,
        user.id,
        submissionId,
        note,
      );
      return NextResponse.json({ ok: true, workspace });
    }

    throw new KhposEvidenceError("Choose a valid evidence operation.", 400);
  } catch (error) {
    return responseForError(error);
  }
}
