import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import { KhposWorkspaceError } from "@/lib/khpos/workspace";
import {
  applyKhposReviewDecision,
  getKhposReviewWorkspace,
  KhposReviewError,
  type KhposReviewDecision,
} from "@/lib/khpos/review";

export const runtime = "nodejs";

function responseForError(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposWorkspaceError ||
    error instanceof KhposReviewError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos] transformation review operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Transformation review automation could not complete this request." },
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
    const workspace = await getKhposReviewWorkspace(id, user.id);
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
    action?: "decide";
    reviewId?: string;
    decision?: KhposReviewDecision;
    note?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid transformation review request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    if (payload.action !== "decide") {
      throw new KhposReviewError("Choose a valid review operation.", 400);
    }

    const reviewId = payload.reviewId?.trim() ?? "";
    if (!UUID_RE.test(reviewId)) {
      throw new KhposReviewError("Transformation review not found.", 404);
    }
    if (!payload.decision) {
      throw new KhposReviewError("Choose a review decision.", 400);
    }

    const workspace = await applyKhposReviewDecision(
      id,
      user.id,
      reviewId,
      payload.decision,
      payload.note ?? "",
    );
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    return responseForError(error);
  }
}
