import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsExitCase,
  actOnKhposOpsPromotionCase,
  actOnKhposOpsSuccessionPlan,
  actOnKhposOpsTransitionItem,
  addKhposOpsProgressionEvidence,
  addKhposOpsTransitionItem,
  approveKhposOpsPromotion,
  createKhposOpsExitCase,
  createKhposOpsPromotionCase,
  createKhposOpsSuccessionPlan,
  executeKhposOpsPromotion,
  finalizeKhposOpsStaffExit,
  getKhposOpsStaffTransition,
  KhposOpsStaffTransitionError,
  respondToKhposOpsPromotion,
  startKhposOpsExitClearance,
  updateKhposOpsExitSchedule,
  updateKhposOpsSuccessionPlan,
} from "@/lib/khpos/ops/staff-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsStaffTransitionError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] staff transition operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Staff transition operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function optionalUuid(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return validUuid(value) ? value : undefined;
}

function dateString(value: unknown) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
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
    const transition = await getKhposOpsStaffTransition(id, user.id);
    return NextResponse.json(
      { ok: true, transition },
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

  let payload: Record<string, unknown> = {};
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid staff-transition request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_succession") {
      if (
        !validUuid(payload.staffId) ||
        !validUuid(payload.targetRoleId) ||
        !clean(payload.readinessState) ||
        !clean(payload.readinessSummary)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Staff, target role, readiness state and readiness summary are required.",
          },
          { status: 400 },
        );
      }

      const horizon = dateString(payload.targetHorizon);
      const transition = await createKhposOpsSuccessionPlan(id, user.id, {
        staffId: payload.staffId,
        targetRoleId: payload.targetRoleId,
        readinessState: clean(payload.readinessState),
        readinessSummary: clean(payload.readinessSummary),
        developmentPriorities: clean(payload.developmentPriorities) || null,
        targetHorizon: horizon || null,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "update_succession") {
      if (
        !validUuid(payload.planId) ||
        !clean(payload.readinessState) ||
        !clean(payload.readinessSummary)
      ) {
        return NextResponse.json(
          { ok: false, error: "Plan, readiness state and summary are required." },
          { status: 400 },
        );
      }
      const horizon = dateString(payload.targetHorizon);
      const transition = await updateKhposOpsSuccessionPlan(id, user.id, {
        planId: payload.planId,
        readinessState: clean(payload.readinessState),
        readinessSummary: clean(payload.readinessSummary),
        developmentPriorities: clean(payload.developmentPriorities) || null,
        targetHorizon: horizon || null,
        reviewNote: clean(payload.reviewNote) || null,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "succession_action") {
      if (!validUuid(payload.planId)) {
        return NextResponse.json(
          { ok: false, error: "Succession plan is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["withdraw", "archive"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported succession-plan action." },
          { status: 400 },
        );
      }
      const transition = await actOnKhposOpsSuccessionPlan(
        id,
        user.id,
        payload.planId,
        action as "withdraw" | "archive",
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "add_progression_evidence") {
      if (
        !validUuid(payload.parentId) ||
        !["succession", "promotion"].includes(clean(payload.parentType)) ||
        !clean(payload.evidenceType) ||
        !clean(payload.title) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Progression record, evidence type, title and evidence note are required.",
          },
          { status: 400 },
        );
      }

      const performanceReviewId = optionalUuid(payload.sourcePerformanceReviewId);
      const recognitionId = optionalUuid(payload.sourceRecognitionId);
      if (performanceReviewId === undefined || recognitionId === undefined) {
        return NextResponse.json(
          { ok: false, error: "One of the linked evidence references is invalid." },
          { status: 400 },
        );
      }

      const transition = await addKhposOpsProgressionEvidence(id, user.id, {
        parentType: clean(payload.parentType) as "succession" | "promotion",
        parentId: payload.parentId,
        evidenceType: clean(payload.evidenceType),
        title: clean(payload.title),
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
        sourcePerformanceReviewId: performanceReviewId,
        sourceRecognitionId: recognitionId,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "create_promotion") {
      if (
        !validUuid(payload.staffId) ||
        !validUuid(payload.targetRoleId) ||
        !dateString(payload.proposedEffectiveDate) ||
        !clean(payload.justification) ||
        !clean(payload.readinessSummary)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Staff, target role, effective date, justification and readiness summary are required.",
          },
          { status: 400 },
        );
      }

      const campusId = optionalUuid(payload.targetCampusId);
      const unitId = optionalUuid(payload.targetUnitId);
      const successionId = optionalUuid(payload.sourceSuccessionPlanId);
      if (
        campusId === undefined ||
        unitId === undefined ||
        successionId === undefined
      ) {
        return NextResponse.json(
          { ok: false, error: "One of the promotion references is invalid." },
          { status: 400 },
        );
      }

      const transition = await createKhposOpsPromotionCase(id, user.id, {
        staffId: payload.staffId,
        targetRoleId: payload.targetRoleId,
        targetCampusId: campusId,
        targetUnitId: unitId,
        proposedEffectiveDate: dateString(payload.proposedEffectiveDate),
        justification: clean(payload.justification),
        readinessSummary: clean(payload.readinessSummary),
        sourceSuccessionPlanId: successionId,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "promotion_response") {
      if (!validUuid(payload.promotionCaseId)) {
        return NextResponse.json(
          { ok: false, error: "Promotion case is required." },
          { status: 400 },
        );
      }
      const response = clean(payload.response);
      if (!["accept", "decline"].includes(response)) {
        return NextResponse.json(
          { ok: false, error: "Promotion response must be accept or decline." },
          { status: 400 },
        );
      }
      const transition = await respondToKhposOpsPromotion(
        id,
        user.id,
        payload.promotionCaseId,
        response as "accept" | "decline",
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "approve_promotion") {
      if (
        !validUuid(payload.promotionCaseId) ||
        !validUuid(payload.continuityRecipientAssignmentId) ||
        !validUuid(payload.targetSupervisorAssignmentId) ||
        !clean(payload.approvalNote)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Promotion, continuity recipient, target supervisor and approval note are required.",
          },
          { status: 400 },
        );
      }
      const transition = await approveKhposOpsPromotion(id, user.id, {
        promotionCaseId: payload.promotionCaseId,
        continuityRecipientAssignmentId:
          payload.continuityRecipientAssignmentId,
        targetSupervisorAssignmentId: payload.targetSupervisorAssignmentId,
        approvalNote: clean(payload.approvalNote),
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "add_transition_item") {
      if (
        !validUuid(payload.parentId) ||
        !["promotion", "exit"].includes(clean(payload.parentType)) ||
        !clean(payload.itemType) ||
        !clean(payload.title) ||
        !clean(payload.description) ||
        !validUuid(payload.ownerUserId) ||
        !dateString(payload.dueDate)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Transition case, type, title, description, owner and due date are required.",
          },
          { status: 400 },
        );
      }
      const recipientId = optionalUuid(payload.recipientAssignmentId);
      if (recipientId === undefined) {
        return NextResponse.json(
          { ok: false, error: "Transition recipient assignment is invalid." },
          { status: 400 },
        );
      }
      const transition = await addKhposOpsTransitionItem(id, user.id, {
        parentType: clean(payload.parentType) as "promotion" | "exit",
        parentId: payload.parentId,
        itemType: clean(payload.itemType),
        title: clean(payload.title),
        description: clean(payload.description),
        ownerUserId: payload.ownerUserId,
        recipientAssignmentId: recipientId,
        dueDate: dateString(payload.dueDate),
        mandatory:
          typeof payload.mandatory === "boolean" ? payload.mandatory : true,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "transition_item_action") {
      if (!validUuid(payload.itemId)) {
        return NextResponse.json(
          { ok: false, error: "Transition requirement is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (
        !["start", "submit_evidence", "verify", "reopen", "waive"].includes(
          action,
        )
      ) {
        return NextResponse.json(
          { ok: false, error: "Unsupported transition requirement action." },
          { status: 400 },
        );
      }
      const transition = await actOnKhposOpsTransitionItem(id, user.id, {
        itemId: payload.itemId,
        action: action as
          | "start"
          | "submit_evidence"
          | "verify"
          | "reopen"
          | "waive",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "execute_promotion") {
      if (!validUuid(payload.promotionCaseId)) {
        return NextResponse.json(
          { ok: false, error: "Promotion case is required." },
          { status: 400 },
        );
      }
      const transition = await executeKhposOpsPromotion(
        id,
        user.id,
        payload.promotionCaseId,
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "promotion_action") {
      if (!validUuid(payload.promotionCaseId) || clean(payload.action) !== "cancel") {
        return NextResponse.json(
          { ok: false, error: "Only promotion cancellation is supported here." },
          { status: 400 },
        );
      }
      const transition = await actOnKhposOpsPromotionCase(
        id,
        user.id,
        payload.promotionCaseId,
        "cancel",
        clean(payload.note),
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "create_exit") {
      if (
        !validUuid(payload.staffId) ||
        !clean(payload.exitType) ||
        !dateString(payload.proposedLastDay) ||
        !clean(payload.basisReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Staff, exit type, last day and notice/agreement/contract basis reference are required.",
          },
          { status: 400 },
        );
      }
      const sourceCaseId = optionalUuid(payload.sourceAccountabilityCaseId);
      if (sourceCaseId === undefined) {
        return NextResponse.json(
          { ok: false, error: "Source accountability case reference is invalid." },
          { status: 400 },
        );
      }
      const transition = await createKhposOpsExitCase(id, user.id, {
        staffId: payload.staffId,
        exitType: clean(payload.exitType),
        proposedLastDay: dateString(payload.proposedLastDay),
        basisReference: clean(payload.basisReference),
        reasonNote: clean(payload.reasonNote) || null,
        authorityReviewReference:
          clean(payload.authorityReviewReference) || null,
        sourceAccountabilityCaseId: sourceCaseId,
        replacementRequired:
          typeof payload.replacementRequired === "boolean"
            ? payload.replacementRequired
            : true,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "update_exit_schedule") {
      if (
        !validUuid(payload.exitCaseId) ||
        !dateString(payload.proposedLastDay) ||
        !clean(payload.basisReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Exit case, revised last day and revised basis reference are required.",
          },
          { status: 400 },
        );
      }
      const transition = await updateKhposOpsExitSchedule(id, user.id, {
        exitCaseId: payload.exitCaseId,
        proposedLastDay: dateString(payload.proposedLastDay),
        basisReference: clean(payload.basisReference),
        authorityReviewReference:
          clean(payload.authorityReviewReference) || null,
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "start_exit_clearance") {
      if (
        !validUuid(payload.exitCaseId) ||
        !validUuid(payload.continuityRecipientAssignmentId)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Exit case and continuity recipient are required.",
          },
          { status: 400 },
        );
      }
      const transition = await startKhposOpsExitClearance(
        id,
        user.id,
        payload.exitCaseId,
        payload.continuityRecipientAssignmentId,
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "finalize_exit") {
      if (!validUuid(payload.exitCaseId)) {
        return NextResponse.json(
          { ok: false, error: "Exit case is required." },
          { status: 400 },
        );
      }
      const transition = await finalizeKhposOpsStaffExit(
        id,
        user.id,
        payload.exitCaseId,
      );
      return NextResponse.json({ ok: true, transition });
    }

    if (mode === "exit_action") {
      if (!validUuid(payload.exitCaseId)) {
        return NextResponse.json(
          { ok: false, error: "Exit case is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["withdraw_request", "cancel", "close"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported exit-case action." },
          { status: 400 },
        );
      }
      const transition = await actOnKhposOpsExitCase(id, user.id, {
        exitCaseId: payload.exitCaseId,
        action: action as "withdraw_request" | "cancel" | "close",
        note: clean(payload.note) || null,
        reference: clean(payload.reference) || null,
      });
      return NextResponse.json({ ok: true, transition });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported staff-transition request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
