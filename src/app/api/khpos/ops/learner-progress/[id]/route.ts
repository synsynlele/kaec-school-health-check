import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  addKhposOpsLearnerInterventionActivity,
  closeKhposOpsLearnerSupportCase,
  confirmKhposOpsLearnerProgressionDecision,
  createKhposOpsLearnerIntervention,
  createKhposOpsLearnerProgressionDecision,
  createKhposOpsLearnerRiskSignal,
  createKhposOpsLearnerSupportCase,
  escalateKhposOpsLearnerSupportCase,
  getKhposOpsLearnerProgress,
  KhposOpsLearnerProgressError,
  reassessKhposOpsLearnerSupportCase,
  recordKhposOpsLearnerBaseline,
  recordKhposOpsLearnerDiagnosis,
  recordKhposOpsLearnerParentPartnership,
  resolveKhposOpsLearnerRiskSignal,
  upsertKhposOpsLearnerAnchor,
  upsertKhposOpsLearnerTermReview,
} from "@/lib/khpos/ops/learner-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsLearnerProgressError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] learner progress operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Learner Progress operation could not be completed." },
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

function timestampString(value: unknown) {
  const text = clean(value);
  const parsed = Date.parse(text);
  return text && Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
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
    const learnerProgress = await getKhposOpsLearnerProgress(id, user.id);
    return NextResponse.json(
      { ok: true, learnerProgress },
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
      { ok: false, error: "Invalid learner-progress request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "upsert_learner") {
      const campusId = optionalUuid(payload.campusId);
      const externalSystem = clean(payload.externalSystem);
      if (
        campusId === undefined ||
        !["SIS", "external", "manual"].includes(externalSystem) ||
        !clean(payload.externalLearnerReference) ||
        !clean(payload.displayName) ||
        !clean(payload.classLabel)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner source, external reference, display name and class are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await upsertKhposOpsLearnerAnchor(id, user.id, {
        externalSystem: externalSystem as "SIS" | "external" | "manual",
        externalLearnerReference: clean(payload.externalLearnerReference),
        displayName: clean(payload.displayName),
        classLabel: clean(payload.classLabel),
        sectionLabel: clean(payload.sectionLabel) || null,
        campusId,
        status: "active",
      });
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "record_baseline") {
      const termId = optionalUuid(payload.termId);
      const source = clean(payload.baselineSource);
      if (
        !validUuid(payload.learnerId) ||
        termId === undefined ||
        !["SIS", "KSI", "external", "manual"].includes(source) ||
        !clean(payload.startingPointSummary) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner, baseline source, starting point and evidence reference are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await recordKhposOpsLearnerBaseline(id, user.id, {
        learnerId: payload.learnerId,
        termId,
        baselineSource: source as "SIS" | "KSI" | "external" | "manual",
        startingPointSummary: clean(payload.startingPointSummary),
        strengthsSummary: clean(payload.strengthsSummary) || null,
        priorityGapsSummary: clean(payload.priorityGapsSummary) || null,
        evidenceReference: clean(payload.evidenceReference),
      });
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "create_signal") {
      const termId = optionalUuid(payload.termId);
      const streamId = optionalUuid(payload.streamId);
      const academicDebtId = optionalUuid(payload.academicDebtId);
      const severity = clean(payload.severity);
      const sourceSystem = clean(payload.sourceSystem);
      const observedAt = timestampString(payload.observedAt);
      if (
        !validUuid(payload.learnerId) ||
        termId === undefined ||
        streamId === undefined ||
        academicDebtId === undefined ||
        !clean(payload.signalType) ||
        !["amber", "red", "critical"].includes(severity) ||
        !["SIS", "KSI", "KHP", "external", "manual"].includes(sourceSystem) ||
        !clean(payload.signalNote) ||
        !observedAt
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner, signal type, severity, source, evidence note and observation time are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await createKhposOpsLearnerRiskSignal(
        id,
        user.id,
        {
          learnerId: payload.learnerId,
          termId,
          streamId,
          academicDebtId,
          signalType: clean(payload.signalType),
          severity: severity as "amber" | "red" | "critical",
          sourceSystem: sourceSystem as
            | "SIS"
            | "KSI"
            | "KHP"
            | "external"
            | "manual",
          sourceReference: clean(payload.sourceReference) || null,
          signalNote: clean(payload.signalNote),
          observedAt,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "resolve_signal") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.signalId) ||
        !["resolve", "dismiss"].includes(action) ||
        !clean(payload.responseNote)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Signal, action and response/reason are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await resolveKhposOpsLearnerRiskSignal(
        id,
        user.id,
        {
          signalId: payload.signalId,
          action: action as "resolve" | "dismiss",
          responseNote: clean(payload.responseNote),
          evidenceReference: clean(payload.evidenceReference) || null,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "create_case") {
      const primarySignalId = optionalUuid(payload.primarySignalId);
      const termId = optionalUuid(payload.termId);
      const severity = clean(payload.severity);
      const reviewDueDate = dateString(payload.reviewDueDate);
      if (
        !validUuid(payload.learnerId) ||
        primarySignalId === undefined ||
        termId === undefined ||
        !["amber", "red", "critical"].includes(severity) ||
        !clean(payload.concernSummary) ||
        !validUuid(payload.caseOwnerAssignmentId) ||
        !reviewDueDate
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner, concern, severity, case owner and review date are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await createKhposOpsLearnerSupportCase(
        id,
        user.id,
        {
          learnerId: payload.learnerId,
          primarySignalId,
          termId,
          severity: severity as "amber" | "red" | "critical",
          concernSummary: clean(payload.concernSummary),
          caseOwnerAssignmentId: payload.caseOwnerAssignmentId,
          reviewDueDate,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "record_diagnosis") {
      const source = clean(payload.diagnosisSource);
      if (
        !validUuid(payload.caseId) ||
        !["KSI", "SIS", "external", "manual"].includes(source) ||
        !clean(payload.diagnosisSummary) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Case, diagnosis, evidence note/reference and source are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await recordKhposOpsLearnerDiagnosis(
        id,
        user.id,
        {
          caseId: payload.caseId,
          barrierCategories: stringArray(payload.barrierCategories),
          diagnosisSummary: clean(payload.diagnosisSummary),
          evidenceNote: clean(payload.evidenceNote),
          evidenceReference: clean(payload.evidenceReference),
          diagnosisSource: source as "KSI" | "SIS" | "external" | "manual",
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "create_intervention") {
      const tier = Number(payload.tier);
      const startDate = dateString(payload.startDate);
      const reviewDate = dateString(payload.reviewDate);
      if (
        !validUuid(payload.caseId) ||
        !Number.isInteger(tier) ||
        tier < 1 ||
        tier > 4 ||
        !clean(payload.targetOutcome) ||
        !clean(payload.responsePlan) ||
        !validUuid(payload.ownerAssignmentId) ||
        !startDate ||
        !reviewDate ||
        !clean(payload.successCriteria)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Case, tier, target, plan, owner, dates and success criteria are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await createKhposOpsLearnerIntervention(
        id,
        user.id,
        {
          caseId: payload.caseId,
          tier,
          targetOutcome: clean(payload.targetOutcome),
          responsePlan: clean(payload.responsePlan),
          ownerAssignmentId: payload.ownerAssignmentId,
          startDate,
          reviewDate,
          successCriteria: clean(payload.successCriteria),
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "add_activity") {
      const activityDate = dateString(payload.activityDate);
      if (
        !validUuid(payload.interventionId) ||
        !activityDate ||
        !clean(payload.activityNote)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Intervention, activity date and activity note are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await addKhposOpsLearnerInterventionActivity(
        id,
        user.id,
        {
          interventionId: payload.interventionId,
          activityDate,
          activityNote: clean(payload.activityNote),
          evidenceReference: clean(payload.evidenceReference) || null,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "record_parent_partnership") {
      const contactDate = dateString(payload.contactDate);
      const parentActionDueDate = dateString(payload.parentActionDueDate);
      const staffActionDueDate = dateString(payload.staffActionDueDate);
      const channel = clean(payload.channel);
      if (
        !validUuid(payload.caseId) ||
        !contactDate ||
        !["meeting", "phone", "message", "email", "letter", "other"].includes(
          channel,
        ) ||
        !clean(payload.summary)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Case, date, channel and parent-partnership summary are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await recordKhposOpsLearnerParentPartnership(
        id,
        user.id,
        {
          caseId: payload.caseId,
          contactDate,
          channel,
          summary: clean(payload.summary),
          agreedAction: clean(payload.agreedAction) || null,
          parentActionDueDate: parentActionDueDate || null,
          staffActionDueDate: staffActionDueDate || null,
          evidenceReference: clean(payload.evidenceReference) || null,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "reassess_case") {
      const interventionId = optionalUuid(payload.interventionId);
      const outcome = clean(payload.outcome);
      if (
        !validUuid(payload.caseId) ||
        interventionId === undefined ||
        !["recovered", "improving", "no_improvement", "redirect"].includes(
          outcome,
        ) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Case, reassessment outcome and evidence note/reference are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await reassessKhposOpsLearnerSupportCase(
        id,
        user.id,
        {
          caseId: payload.caseId,
          interventionId,
          outcome: outcome as
            | "recovered"
            | "improving"
            | "no_improvement"
            | "redirect",
          evidenceNote: clean(payload.evidenceNote),
          evidenceReference: clean(payload.evidenceReference),
          nextAction: clean(payload.nextAction) || null,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "escalate_case") {
      const linkedIssueId = optionalUuid(payload.linkedIssueId);
      const severity = clean(payload.newSeverity);
      if (
        !validUuid(payload.caseId) ||
        !["red", "critical"].includes(severity) ||
        !validUuid(payload.newOwnerAssignmentId) ||
        !clean(payload.escalationNote) ||
        linkedIssueId === undefined
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Case, escalated severity, new owner and escalation note are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await escalateKhposOpsLearnerSupportCase(
        id,
        user.id,
        {
          caseId: payload.caseId,
          newSeverity: severity as "red" | "critical",
          newOwnerAssignmentId: payload.newOwnerAssignmentId,
          escalationNote: clean(payload.escalationNote),
          linkedIssueId,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "close_case") {
      if (!validUuid(payload.caseId) || !clean(payload.closureNote)) {
        return NextResponse.json(
          { ok: false, error: "Case and closure note are required." },
          { status: 400 },
        );
      }

      const learnerProgress = await closeKhposOpsLearnerSupportCase(
        id,
        user.id,
        payload.caseId,
        clean(payload.closureNote),
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "create_progression") {
      if (
        !validUuid(payload.learnerId) ||
        !clean(payload.academicYear) ||
        !clean(payload.fromClassLabel) ||
        !clean(payload.decision) ||
        !clean(payload.attainmentReference) ||
        !clean(payload.trajectorySummary) ||
        !clean(payload.decisionRationale)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner, academic year, current class, decision, attainment evidence, trajectory and rationale are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await createKhposOpsLearnerProgressionDecision(
        id,
        user.id,
        {
          learnerId: payload.learnerId,
          academicYear: clean(payload.academicYear),
          fromClassLabel: clean(payload.fromClassLabel),
          proposedNextClassLabel:
            clean(payload.proposedNextClassLabel) || null,
          decision: clean(payload.decision),
          attainmentReference: clean(payload.attainmentReference),
          foundationalGapSummary:
            clean(payload.foundationalGapSummary) || null,
          trajectorySummary: clean(payload.trajectorySummary),
          interventionSummary: clean(payload.interventionSummary) || null,
          attendanceReference: clean(payload.attendanceReference) || null,
          examRequirementSummary:
            clean(payload.examRequirementSummary) || null,
          decisionRationale: clean(payload.decisionRationale),
          requiredSupport: clean(payload.requiredSupport) || null,
          parentMeetingReference:
            clean(payload.parentMeetingReference) || null,
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "progression_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.decisionId) ||
        !["confirm", "cancel"].includes(action) ||
        !clean(payload.confirmationNote)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Progression decision, action and confirmation note are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress =
        await confirmKhposOpsLearnerProgressionDecision(
          id,
          user.id,
          payload.decisionId,
          action as "confirm" | "cancel",
          clean(payload.confirmationNote),
        );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    if (mode === "term_review") {
      const status = clean(payload.overallStatus);
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !["green", "amber", "red", "critical"].includes(status) ||
        !clean(payload.progressSummary) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Learner, term, status, progress summary and evidence reference are required.",
          },
          { status: 400 },
        );
      }

      const learnerProgress = await upsertKhposOpsLearnerTermReview(
        id,
        user.id,
        {
          learnerId: payload.learnerId,
          termId: payload.termId,
          overallStatus: status as "green" | "amber" | "red" | "critical",
          progressSummary: clean(payload.progressSummary),
          openRisksSummary: clean(payload.openRisksSummary) || null,
          interventionSummary: clean(payload.interventionSummary) || null,
          nextTermActions: clean(payload.nextTermActions) || null,
          evidenceReference: clean(payload.evidenceReference),
        },
      );
      return NextResponse.json({ ok: true, learnerProgress });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported learner-progress request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
