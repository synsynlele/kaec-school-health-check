import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsSkillCompetencyEvidence,
  actOnKhposOpsSkillOffering,
  actOnKhposOpsSkillSession,
  actOnKhposOpsSkillWeeklyReview,
  addKhposOpsSkillCompetencyEvidence,
  createKhposOpsSkillOffering,
  createKhposOpsSkillSession,
  createKhposOpsSkillWeeklyReview,
  decideKhposOpsSkillChange,
  executeKhposOpsSkillChange,
  getKhposOpsSkillsWorkspace,
  KhposOpsSkillsError,
  requestKhposOpsSkillChange,
  selectKhposOpsSkillPathway,
} from "@/lib/khpos/ops/skills-development";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function intValue(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsSkillsError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] skills development failed:", error);
  return NextResponse.json(
    { ok: false, error: "Skills Development operation could not be completed." },
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
    const skills = await getKhposOpsSkillsWorkspace(id, user.id);
    return NextResponse.json(
      { ok: true, skills },
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
      { ok: false, error: "Invalid Skills Development request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_offering") {
      const weeklySessionTarget = intValue(payload.weeklySessionTarget);
      const capacity = payload.capacity === null || clean(payload.capacity) === ""
        ? null
        : intValue(payload.capacity);

      if (
        !validUuid(payload.pathwayId) ||
        !validUuid(payload.termId) ||
        !validUuid(payload.campusId) ||
        !weeklySessionTarget ||
        weeklySessionTarget < 1 ||
        weeklySessionTarget > 12 ||
        (payload.facilitatorAssignmentId &&
          !validUuid(payload.facilitatorAssignmentId)) ||
        (capacity !== null && capacity <= 0)
      ) {
        return NextResponse.json(
          { ok: false, error: "Offering requires pathway, term, campus, valid weekly target and optional valid facilitator/capacity." },
          { status: 400 },
        );
      }

      const skills = await createKhposOpsSkillOffering(id, user.id, {
        pathwayId: payload.pathwayId,
        termId: payload.termId,
        campusId: payload.campusId,
        facilitatorAssignmentId: validUuid(payload.facilitatorAssignmentId)
          ? payload.facilitatorAssignmentId
          : null,
        weeklySessionTarget,
        capacity,
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "offering_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.offeringId) ||
        !["mark_ready", "activate", "close", "cancel"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Offering and supported action are required." },
          { status: 400 },
        );
      }

      const skills = await actOnKhposOpsSkillOffering(id, user.id, {
        offeringId: payload.offeringId,
        action: action as "mark_ready" | "activate" | "close" | "cancel",
        safetyReadiness: clean(payload.safetyReadiness) || null,
        resourceReadiness: clean(payload.resourceReadiness) || null,
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "select_pathway") {
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.offeringId) ||
        !["learner_choice", "discovery_alignment", "continuation", "other"].includes(
          clean(payload.selectionBasis),
        ) ||
        !clean(payload.selectionNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Learner, offering, selection basis and selection note are required." },
          { status: 400 },
        );
      }

      const skills = await selectKhposOpsSkillPathway(id, user.id, {
        learnerId: payload.learnerId,
        offeringId: payload.offeringId,
        selectionBasis: clean(payload.selectionBasis),
        selectionNote: clean(payload.selectionNote),
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "request_change") {
      if (
        !validUuid(payload.currentSelectionId) ||
        !validUuid(payload.targetOfferingId) ||
        !clean(payload.reason) ||
        !clean(payload.requestedEffectiveDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Current selection, target offering, reason and requested effective date are required." },
          { status: 400 },
        );
      }

      const skills = await requestKhposOpsSkillChange(id, user.id, {
        currentSelectionId: payload.currentSelectionId,
        targetOfferingId: payload.targetOfferingId,
        reason: clean(payload.reason),
        requestedEffectiveDate: clean(payload.requestedEffectiveDate),
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "decide_change") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.changeRequestId) ||
        !["approve", "reject"].includes(action) ||
        !clean(payload.decisionNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Change request, decision and reasoned note are required." },
          { status: 400 },
        );
      }

      const skills = await decideKhposOpsSkillChange(id, user.id, {
        changeRequestId: payload.changeRequestId,
        action: action as "approve" | "reject",
        decisionNote: clean(payload.decisionNote),
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "execute_change") {
      if (!validUuid(payload.changeRequestId)) {
        return NextResponse.json(
          { ok: false, error: "Change request is required." },
          { status: 400 },
        );
      }
      const skills = await executeKhposOpsSkillChange(
        id,
        user.id,
        payload.changeRequestId,
      );
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "create_session") {
      if (
        !validUuid(payload.offeringId) ||
        !clean(payload.sessionDate) ||
        !clean(payload.focus) ||
        (payload.recoveryForSessionId &&
          !validUuid(payload.recoveryForSessionId))
      ) {
        return NextResponse.json(
          { ok: false, error: "Session requires offering, date, focus and optional valid recovery reference." },
          { status: 400 },
        );
      }

      const skills = await createKhposOpsSkillSession(id, user.id, {
        offeringId: payload.offeringId,
        sessionDate: clean(payload.sessionDate),
        focus: clean(payload.focus),
        recoveryForSessionId: validUuid(payload.recoveryForSessionId)
          ? payload.recoveryForSessionId
          : null,
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "session_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.sessionId) ||
        !["deliver", "miss", "cancel"].includes(action) ||
        !["safe", "concern"].includes(clean(payload.safetyState)) ||
        !["ready", "partial", "blocked"].includes(clean(payload.resourceState)) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Session action requires valid safety/resource state and an outcome note." },
          { status: 400 },
        );
      }

      const skills = await actOnKhposOpsSkillSession(id, user.id, {
        sessionId: payload.sessionId,
        action: action as "deliver" | "miss" | "cancel",
        safetyState: clean(payload.safetyState),
        resourceState: clean(payload.resourceState),
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
        recoveryDueDate: clean(payload.recoveryDueDate) || null,
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "add_competency_evidence") {
      if (
        !validUuid(payload.selectionId) ||
        !["exposure", "foundation", "independent", "applied", "value_creation"].includes(
          clean(payload.competencyLevel),
        ) ||
        !clean(payload.competencyArea) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.observedAt)
      ) {
        return NextResponse.json(
          { ok: false, error: "Competency evidence requires selection, level, area, note, evidence reference and observed time." },
          { status: 400 },
        );
      }

      const skills = await addKhposOpsSkillCompetencyEvidence(id, user.id, {
        selectionId: payload.selectionId,
        competencyLevel: clean(payload.competencyLevel),
        competencyArea: clean(payload.competencyArea),
        evidenceNote: clean(payload.evidenceNote),
        evidenceReference: clean(payload.evidenceReference),
        observedAt: clean(payload.observedAt),
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "competency_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.evidenceId) ||
        !["verify", "return", "withdraw"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Competency evidence, supported action and action note are required." },
          { status: 400 },
        );
      }

      const skills = await actOnKhposOpsSkillCompetencyEvidence(id, user.id, {
        evidenceId: payload.evidenceId,
        action: action as "verify" | "return" | "withdraw",
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "create_weekly_review") {
      if (
        !validUuid(payload.offeringId) ||
        !clean(payload.weekStart)
      ) {
        return NextResponse.json(
          { ok: false, error: "Weekly review requires offering and week start." },
          { status: 400 },
        );
      }

      const skills = await createKhposOpsSkillWeeklyReview(id, user.id, {
        offeringId: payload.offeringId,
        weekStart: clean(payload.weekStart),
        safetyResourceSummary: clean(payload.safetyResourceSummary) || null,
        recoveryActionNote: clean(payload.recoveryActionNote) || null,
        valueCreationNote: clean(payload.valueCreationNote) || null,
      });
      return NextResponse.json({ ok: true, skills });
    }

    if (mode === "weekly_review_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.reviewId) ||
        !["submit", "approve", "return", "cancel"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Weekly review and supported action are required." },
          { status: 400 },
        );
      }

      const skills = await actOnKhposOpsSkillWeeklyReview(id, user.id, {
        reviewId: payload.reviewId,
        action: action as "submit" | "approve" | "return" | "cancel",
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, skills });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported Skills Development request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
