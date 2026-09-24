import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsAcademicDebt,
  actOnKhposOpsAcademicObservation,
  actOnKhposOpsAcademicStream,
  actOnKhposOpsAcademicTarget,
  actOnKhposOpsAcademicTerm,
  addKhposOpsAcademicTarget,
  createKhposOpsAcademicObservation,
  createKhposOpsAcademicStream,
  createKhposOpsAcademicTerm,
  escalateKhposOpsAcademicDebt,
  getKhposOpsAcademicDelivery,
  KhposOpsAcademicDeliveryError,
  reassignKhposOpsAcademicDebt,
  updateKhposOpsAcademicStreamAssignment,
  verifyKhposOpsAcademicTarget,
} from "@/lib/khpos/ops/academic-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsAcademicDeliveryError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] academic delivery operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Academic Delivery operation could not be completed." },
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
    const academic = await getKhposOpsAcademicDelivery(id, user.id);
    return NextResponse.json(
      { ok: true, academic },
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
      { ok: false, error: "Invalid academic-delivery request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_term") {
      const campusId = optionalUuid(payload.campusId);
      if (
        campusId === undefined ||
        !clean(payload.sessionLabel) ||
        !clean(payload.termCode) ||
        !clean(payload.termName) ||
        !dateString(payload.startDate) ||
        !dateString(payload.endDate)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Campus, session, term code/name and valid start/end dates are required.",
          },
          { status: 400 },
        );
      }

      const academic = await createKhposOpsAcademicTerm(id, user.id, {
        campusId,
        sessionLabel: clean(payload.sessionLabel),
        termCode: clean(payload.termCode),
        termName: clean(payload.termName),
        startDate: dateString(payload.startDate),
        endDate: dateString(payload.endDate),
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "term_action") {
      if (!validUuid(payload.termId)) {
        return NextResponse.json(
          { ok: false, error: "Academic term is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["activate", "cancel"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported academic-term action." },
          { status: 400 },
        );
      }
      const academic = await actOnKhposOpsAcademicTerm(
        id,
        user.id,
        payload.termId,
        action as "activate" | "cancel",
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "create_stream") {
      const campusId = optionalUuid(payload.campusId);
      const unitId = optionalUuid(payload.unitId);
      if (
        campusId === undefined ||
        unitId === undefined ||
        !validUuid(payload.termId) ||
        !validUuid(payload.teacherAssignmentId) ||
        !clean(payload.classLabel) ||
        !clean(payload.subjectLabel) ||
        !["KSI", "SIS", "external", "manual"].includes(clean(payload.schemeSource)) ||
        !clean(payload.schemeReference) ||
        !clean(payload.timetableReference) ||
        typeof payload.expectedWeeks !== "number" ||
        !Number.isInteger(payload.expectedWeeks)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Term, class, subject, teacher, approved scheme source/reference, timetable reference and teaching weeks are required.",
          },
          { status: 400 },
        );
      }

      const academic = await createKhposOpsAcademicStream(id, user.id, {
        termId: payload.termId,
        campusId,
        unitId,
        classLabel: clean(payload.classLabel),
        sectionLabel: clean(payload.sectionLabel) || null,
        subjectLabel: clean(payload.subjectLabel),
        subjectCode: clean(payload.subjectCode) || null,
        teacherAssignmentId: payload.teacherAssignmentId,
        schemeSource: clean(payload.schemeSource) as
          | "KSI"
          | "SIS"
          | "external"
          | "manual",
        schemeReference: clean(payload.schemeReference),
        schemeVersion: clean(payload.schemeVersion) || null,
        timetableReference: clean(payload.timetableReference),
        expectedWeeks: payload.expectedWeeks,
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "stream_action") {
      if (!validUuid(payload.streamId)) {
        return NextResponse.json(
          { ok: false, error: "Academic delivery stream is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["approve", "cancel"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported academic-stream action." },
          { status: 400 },
        );
      }
      const academic = await actOnKhposOpsAcademicStream(
        id,
        user.id,
        payload.streamId,
        action as "approve" | "cancel",
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "update_stream_assignment") {
      if (
        !validUuid(payload.streamId) ||
        !validUuid(payload.teacherAssignmentId) ||
        !clean(payload.timetableReference) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Stream, replacement Teacher assignment, timetable/deployment reference and change note are required.",
          },
          { status: 400 },
        );
      }
      const academic = await updateKhposOpsAcademicStreamAssignment(id, user.id, {
        streamId: payload.streamId,
        teacherAssignmentId: payload.teacherAssignmentId,
        timetableReference: clean(payload.timetableReference),
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "add_target") {
      if (
        !validUuid(payload.streamId) ||
        typeof payload.weekNumber !== "number" ||
        !Number.isInteger(payload.weekNumber) ||
        !clean(payload.targetReference) ||
        !clean(payload.targetLabel)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Stream, week number, target reference and concise target label are required.",
          },
          { status: 400 },
        );
      }
      const startDate = dateString(payload.plannedStartDate);
      const endDate = dateString(payload.plannedEndDate);
      if (
        payload.plannedStartDate &&
        !startDate ||
        payload.plannedEndDate &&
        !endDate
      ) {
        return NextResponse.json(
          { ok: false, error: "Planned target dates are invalid." },
          { status: 400 },
        );
      }

      const academic = await addKhposOpsAcademicTarget(id, user.id, {
        streamId: payload.streamId,
        weekNumber: payload.weekNumber,
        targetReference: clean(payload.targetReference),
        targetLabel: clean(payload.targetLabel),
        plannedStartDate: startDate || null,
        plannedEndDate: endDate || null,
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "target_action") {
      if (!validUuid(payload.targetId)) {
        return NextResponse.json(
          { ok: false, error: "Academic target is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["ready", "start", "delivered", "partial", "missed"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported academic-target action." },
          { status: 400 },
        );
      }
      const severity = clean(payload.severity) || "P3";
      if (!["P2", "P3", "P4"].includes(severity)) {
        return NextResponse.json(
          { ok: false, error: "Academic debt severity must be P2, P3 or P4." },
          { status: 400 },
        );
      }

      const academic = await actOnKhposOpsAcademicTarget(id, user.id, {
        targetId: payload.targetId,
        action: action as "ready" | "start" | "delivered" | "partial" | "missed",
        note: clean(payload.note) || null,
        reference: clean(payload.reference) || null,
        causeCategory: clean(payload.causeCategory) || null,
        severity: severity as "P2" | "P3" | "P4",
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "verify_target") {
      if (
        !validUuid(payload.targetId) ||
        !["verify", "reject"].includes(clean(payload.decision)) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Target, verification decision and reasoned note are required.",
          },
          { status: 400 },
        );
      }
      const severity = clean(payload.severity) || "P3";
      if (!["P2", "P3", "P4"].includes(severity)) {
        return NextResponse.json(
          { ok: false, error: "Academic debt severity must be P2, P3 or P4." },
          { status: 400 },
        );
      }

      const academic = await verifyKhposOpsAcademicTarget(id, user.id, {
        targetId: payload.targetId,
        decision: clean(payload.decision) as "verify" | "reject",
        note: clean(payload.note),
        reference: clean(payload.reference) || null,
        rejectionCauseCategory: clean(payload.rejectionCauseCategory) || "other",
        severity: severity as "P2" | "P3" | "P4",
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "debt_action") {
      if (!validUuid(payload.debtId)) {
        return NextResponse.json(
          { ok: false, error: "Academic debt record is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["plan", "start", "submit_evidence", "verify", "reopen"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported academic-debt action." },
          { status: 400 },
        );
      }
      const dueDate = dateString(payload.dueDate);
      if (payload.dueDate && !dueDate) {
        return NextResponse.json(
          { ok: false, error: "Recovery due date is invalid." },
          { status: 400 },
        );
      }

      const academic = await actOnKhposOpsAcademicDebt(id, user.id, {
        debtId: payload.debtId,
        action: action as
          | "plan"
          | "start"
          | "submit_evidence"
          | "verify"
          | "reopen",
        note: clean(payload.note) || null,
        dueDate: dueDate || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "reassign_debt") {
      if (
        !validUuid(payload.debtId) ||
        !validUuid(payload.recoveryOwnerAssignmentId) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Debt, replacement Teacher assignment and reason are required.",
          },
          { status: 400 },
        );
      }
      const academic = await reassignKhposOpsAcademicDebt(id, user.id, {
        debtId: payload.debtId,
        recoveryOwnerAssignmentId: payload.recoveryOwnerAssignmentId,
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "escalate_debt") {
      if (
        !validUuid(payload.debtId) ||
        !["P1", "P2", "P3", "P4"].includes(clean(payload.severity)) ||
        !clean(payload.reason)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Debt, issue severity and escalation reason are required.",
          },
          { status: 400 },
        );
      }
      const academic = await escalateKhposOpsAcademicDebt(id, user.id, {
        debtId: payload.debtId,
        severity: clean(payload.severity) as "P1" | "P2" | "P3" | "P4",
        reason: clean(payload.reason),
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "create_observation") {
      const targetId = optionalUuid(payload.targetId);
      if (
        targetId === undefined ||
        !validUuid(payload.streamId) ||
        !["micro", "development", "qa"].includes(clean(payload.observationType)) ||
        !clean(payload.strengths)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Stream, observation type and specific observed strengths/evidence are required.",
          },
          { status: 400 },
        );
      }
      const dueDate = dateString(payload.actionDueDate);
      if (payload.actionDueDate && !dueDate) {
        return NextResponse.json(
          { ok: false, error: "Observation follow-up due date is invalid." },
          { status: 400 },
        );
      }

      const academic = await createKhposOpsAcademicObservation(id, user.id, {
        streamId: payload.streamId,
        targetId,
        observationType: clean(payload.observationType) as
          | "micro"
          | "development"
          | "qa",
        observedAt: clean(payload.observedAt) || null,
        strengths: clean(payload.strengths),
        improvementArea: clean(payload.improvementArea) || null,
        requiredAction: clean(payload.requiredAction) || null,
        actionDueDate: dueDate || null,
      });
      return NextResponse.json({ ok: true, academic });
    }

    if (mode === "observation_action") {
      if (!validUuid(payload.observationId)) {
        return NextResponse.json(
          { ok: false, error: "Teaching observation is required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["submit_followup", "verify_followup", "reopen_followup"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported observation follow-up action." },
          { status: 400 },
        );
      }
      const academic = await actOnKhposOpsAcademicObservation(id, user.id, {
        observationId: payload.observationId,
        action: action as
          | "submit_followup"
          | "verify_followup"
          | "reopen_followup",
        note: clean(payload.note) || null,
        reference: clean(payload.reference) || null,
      });
      return NextResponse.json({ ok: true, academic });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported academic-delivery request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
