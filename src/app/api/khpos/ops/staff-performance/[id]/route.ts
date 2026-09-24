import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsDevelopmentAction,
  actOnKhposOpsStaffReview,
  addKhposOpsStaffPerformanceEvidence,
  createKhposOpsDevelopmentAction,
  createKhposOpsStaffReview,
  getKhposOpsStaffPerformance,
  KhposOpsStaffPerformanceError,
  leaderReviewKhposOpsStaff,
  submitKhposOpsStaffReflection,
  type KhposOpsDevelopmentActionType,
  type KhposOpsPerformanceEvidence,
  type KhposOpsPerformanceState,
  type KhposOpsStaffReviewType,
} from "@/lib/khpos/ops/staff-performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsStaffPerformanceError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] staff performance operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Staff performance operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

function validDate(value: string | undefined) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    const performance = await getKhposOpsStaffPerformance(id, user.id);
    return NextResponse.json(
      { ok: true, performance },
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
    mode?:
      | "create_review"
      | "self_reflection"
      | "add_evidence"
      | "leader_review"
      | "create_development"
      | "development_action"
      | "review_action";
    staffId?: string;
    reviewId?: string;
    reviewType?: KhposOpsStaffReviewType;
    periodStart?: string;
    periodEnd?: string;
    reflection?: string;
    strengths?: string;
    supportNeeded?: string | null;
    evidenceType?: KhposOpsPerformanceEvidence["evidenceType"];
    title?: string;
    note?: string | null;
    reference?: string | null;
    kpiMeasurementId?: string | null;
    performanceState?: Exclude<KhposOpsPerformanceState, "not_assessed">;
    summary?: string;
    growthAreas?: string;
    actionType?: KhposOpsDevelopmentActionType;
    description?: string;
    ownerUserId?: string;
    dueDate?: string;
    actionId?: string;
    evidenceReference?: string | null;
    action?:
      | "start"
      | "submit_evidence"
      | "verify"
      | "reopen"
      | "cancel"
      | "complete";
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid staff performance request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create_review") {
      if (
        !payload.staffId ||
        !UUID_RE.test(payload.staffId) ||
        !payload.reviewType ||
        !validDate(payload.periodStart) ||
        !validDate(payload.periodEnd)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Staff, review type and valid review period are required.",
          },
          { status: 400 },
        );
      }

      const performance = await createKhposOpsStaffReview(id, user.id, {
        staffId: payload.staffId,
        reviewType: payload.reviewType,
        periodStart: payload.periodStart!,
        periodEnd: payload.periodEnd!,
      });

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "self_reflection" &&
      payload.reviewId &&
      UUID_RE.test(payload.reviewId) &&
      payload.reflection?.trim() &&
      payload.strengths?.trim()
    ) {
      const performance = await submitKhposOpsStaffReflection(id, user.id, {
        reviewId: payload.reviewId,
        reflection: payload.reflection.trim(),
        strengths: payload.strengths.trim(),
        supportNeeded: payload.supportNeeded?.trim() || null,
      });

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "add_evidence" &&
      payload.reviewId &&
      UUID_RE.test(payload.reviewId) &&
      payload.evidenceType &&
      payload.title?.trim() &&
      payload.note?.trim() &&
      (!payload.kpiMeasurementId || UUID_RE.test(payload.kpiMeasurementId))
    ) {
      const performance = await addKhposOpsStaffPerformanceEvidence(
        id,
        user.id,
        {
          reviewId: payload.reviewId,
          evidenceType: payload.evidenceType,
          title: payload.title.trim(),
          note: payload.note.trim(),
          reference: payload.reference?.trim() || null,
          kpiMeasurementId: payload.kpiMeasurementId || null,
        },
      );

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "leader_review" &&
      payload.reviewId &&
      UUID_RE.test(payload.reviewId) &&
      payload.performanceState &&
      ["on_track", "support_required", "improvement_required"].includes(
        payload.performanceState,
      ) &&
      payload.summary?.trim() &&
      payload.strengths?.trim() &&
      payload.growthAreas?.trim()
    ) {
      const performance = await leaderReviewKhposOpsStaff(id, user.id, {
        reviewId: payload.reviewId,
        performanceState: payload.performanceState,
        summary: payload.summary.trim(),
        strengths: payload.strengths.trim(),
        growthAreas: payload.growthAreas.trim(),
      });

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "create_development" &&
      payload.reviewId &&
      UUID_RE.test(payload.reviewId) &&
      payload.actionType &&
      payload.title?.trim() &&
      payload.description?.trim() &&
      payload.ownerUserId &&
      UUID_RE.test(payload.ownerUserId) &&
      validDate(payload.dueDate)
    ) {
      const performance = await createKhposOpsDevelopmentAction(id, user.id, {
        reviewId: payload.reviewId,
        actionType: payload.actionType,
        title: payload.title.trim(),
        description: payload.description.trim(),
        ownerUserId: payload.ownerUserId,
        dueDate: payload.dueDate!,
      });

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "development_action" &&
      payload.actionId &&
      UUID_RE.test(payload.actionId) &&
      payload.action &&
      ["start", "submit_evidence", "verify", "reopen", "cancel"].includes(
        payload.action,
      )
    ) {
      const performance = await actOnKhposOpsDevelopmentAction(id, user.id, {
        actionId: payload.actionId,
        action: payload.action as
          | "start"
          | "submit_evidence"
          | "verify"
          | "reopen"
          | "cancel",
        note: payload.note?.trim() || null,
        evidenceReference: payload.evidenceReference?.trim() || null,
      });

      return NextResponse.json({ ok: true, performance });
    }

    if (
      payload.mode === "review_action" &&
      payload.reviewId &&
      UUID_RE.test(payload.reviewId) &&
      payload.action &&
      ["complete", "cancel"].includes(payload.action)
    ) {
      const performance = await actOnKhposOpsStaffReview(id, user.id, {
        reviewId: payload.reviewId,
        action: payload.action as "complete" | "cancel",
        note: payload.note?.trim() || null,
      });

      return NextResponse.json({ ok: true, performance });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported staff performance request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
