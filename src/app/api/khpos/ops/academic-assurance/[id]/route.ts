import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsAcademicCloseout,
  actOnKhposOpsAssessmentCycle,
  actOnKhposOpsAssessmentPackage,
  actOnKhposOpsIntegrityCase,
  actOnKhposOpsReadinessItem,
  actOnKhposOpsResultCorrection,
  addKhposOpsIntegrityEvidence,
  createKhposOpsAcademicCloseout,
  createKhposOpsAssessmentCycle,
  createKhposOpsAssessmentPackage,
  createKhposOpsReadinessItem,
  decideKhposOpsIntegrityCase,
  getKhposOpsAcademicAssurance,
  KhposOpsAcademicAssuranceError,
  recordKhposOpsIntegrityRepresentation,
  reportKhposOpsIntegrityCase,
  requestKhposOpsResultCorrection,
  updateKhposOpsAcademicCloseout,
  updateKhposOpsAssessmentPackage,
} from "@/lib/khpos/ops/academic-assurance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsAcademicAssuranceError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos][ops] academic assurance operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Academic Assurance operation could not be completed." },
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
    const academicAssurance = await getKhposOpsAcademicAssurance(id, user.id);
    return NextResponse.json(
      { ok: true, academicAssurance },
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
      { ok: false, error: "Invalid academic-assurance request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_cycle") {
      const campusId = optionalUuid(payload.campusId);
      const resultsDueOn = clean(payload.resultsDueOn)
        ? dateString(payload.resultsDueOn)
        : null;
      if (
        !validUuid(payload.termId) ||
        campusId === undefined ||
        !clean(payload.title) ||
        !clean(payload.cycleType) ||
        !dateString(payload.startsOn) ||
        !dateString(payload.endsOn) ||
        (clean(payload.resultsDueOn) && !resultsDueOn)
      ) {
        return NextResponse.json(
          { ok: false, error: "Term, cycle title/type and valid dates are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await createKhposOpsAssessmentCycle(id, user.id, {
        ...payload,
        termId: payload.termId,
        campusId,
        title: clean(payload.title),
        cycleType: clean(payload.cycleType),
        examBodyLabel: clean(payload.examBodyLabel) || null,
        startsOn: dateString(payload.startsOn),
        endsOn: dateString(payload.endsOn),
        resultsDueOn,
        externalSystem: clean(payload.externalSystem) || null,
        externalReference: clean(payload.externalReference) || null,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "cycle_action") {
      if (!validUuid(payload.cycleId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Assessment cycle and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsAssessmentCycle(
        id,
        user.id,
        payload.cycleId,
        clean(payload.action),
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "create_package" || mode === "update_package") {
      const packageId = optionalUuid(payload.packageId);
      if (
        (mode === "create_package" &&
          (!validUuid(payload.cycleId) || !validUuid(payload.streamId))) ||
        (mode === "update_package" &&
          (packageId === undefined || packageId === null)) ||
        !clean(payload.assessmentSource) ||
        !clean(payload.sourceReference) ||
        !clean(payload.blueprintReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Assessment package source, blueprint and required cycle/stream reference are required.",
          },
          { status: 400 },
        );
      }
      const academicAssurance =
        mode === "create_package"
          ? await createKhposOpsAssessmentPackage(id, user.id, {
              ...payload,
              cycleId: payload.cycleId,
              streamId: payload.streamId,
              assessmentSource: clean(payload.assessmentSource),
              sourceReference: clean(payload.sourceReference),
              blueprintReference: clean(payload.blueprintReference),
              integrityDeclaration: payload.integrityDeclaration === true,
            })
          : await updateKhposOpsAssessmentPackage(id, user.id, {
              packageId,
              assessmentSource: clean(payload.assessmentSource),
              sourceReference: clean(payload.sourceReference),
              blueprintReference: clean(payload.blueprintReference),
              integrityDeclaration: payload.integrityDeclaration === true,
            });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "package_action") {
      if (!validUuid(payload.packageId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Assessment package and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsAssessmentPackage(
        id,
        user.id,
        payload.packageId,
        clean(payload.action),
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "create_readiness") {
      const streamId = optionalUuid(payload.streamId);
      if (
        !validUuid(payload.cycleId) ||
        streamId === undefined ||
        !clean(payload.category) ||
        !clean(payload.title) ||
        !clean(payload.description) ||
        !validUuid(payload.ownerAssignmentId) ||
        !dateString(payload.dueDate)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Cycle, readiness category, title, owner, due date and description are required.",
          },
          { status: 400 },
        );
      }
      const academicAssurance = await createKhposOpsReadinessItem(id, user.id, {
        ...payload,
        cycleId: payload.cycleId,
        streamId,
        category: clean(payload.category),
        title: clean(payload.title),
        description: clean(payload.description),
        ownerAssignmentId: payload.ownerAssignmentId,
        dueDate: dateString(payload.dueDate),
        mandatory: payload.mandatory !== false,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "readiness_action") {
      if (!validUuid(payload.itemId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Readiness control and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsReadinessItem(id, user.id, {
        itemId: payload.itemId,
        action: clean(payload.action),
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "report_integrity") {
      const cycleId = optionalUuid(payload.cycleId);
      const streamId = optionalUuid(payload.streamId);
      const learnerId = optionalUuid(payload.learnerId);
      const subjectStaffId = optionalUuid(payload.subjectStaffId);
      if (
        !validUuid(payload.termId) ||
        cycleId === undefined ||
        streamId === undefined ||
        learnerId === undefined ||
        subjectStaffId === undefined ||
        !clean(payload.subjectType) ||
        !clean(payload.incidentType) ||
        !clean(payload.severity) ||
        !clean(payload.incidentSummary)
      ) {
        return NextResponse.json(
          { ok: false, error: "Integrity term, subject, incident, severity and summary are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await reportKhposOpsIntegrityCase(id, user.id, {
        termId: payload.termId,
        cycleId,
        streamId,
        subjectType: clean(payload.subjectType),
        learnerId,
        subjectStaffId,
        incidentType: clean(payload.incidentType),
        severity: clean(payload.severity),
        incidentSummary: clean(payload.incidentSummary),
        sourceReference: clean(payload.sourceReference) || null,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "integrity_evidence") {
      if (
        !validUuid(payload.caseId) ||
        !clean(payload.evidenceType) ||
        !clean(payload.title) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Integrity case, evidence type, title and note are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await addKhposOpsIntegrityEvidence(id, user.id, {
        caseId: payload.caseId,
        evidenceType: clean(payload.evidenceType),
        title: clean(payload.title),
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "integrity_representation") {
      if (!validUuid(payload.caseId) || !clean(payload.representationNote)) {
        return NextResponse.json(
          { ok: false, error: "Integrity case and subject representation are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await recordKhposOpsIntegrityRepresentation(
        id,
        user.id,
        {
          caseId: payload.caseId,
          representationNote: clean(payload.representationNote),
          representationReference:
            clean(payload.representationReference) || null,
        },
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "integrity_decision") {
      if (
        !validUuid(payload.caseId) ||
        !clean(payload.outcome) ||
        !clean(payload.academicAction) ||
        !clean(payload.decisionNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Integrity outcome, academic action and reasoned decision are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await decideKhposOpsIntegrityCase(id, user.id, {
        caseId: payload.caseId,
        outcome: clean(payload.outcome),
        academicAction: clean(payload.academicAction),
        decisionNote: clean(payload.decisionNote),
        relatedProcessReference:
          clean(payload.relatedProcessReference) || null,
      });
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "integrity_action") {
      if (!validUuid(payload.caseId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Integrity case and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsIntegrityCase(
        id,
        user.id,
        payload.caseId,
        clean(payload.action),
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "request_correction") {
      const learnerId = optionalUuid(payload.learnerId);
      const integrityCaseId = optionalUuid(payload.integrityCaseId);
      if (
        !validUuid(payload.cycleId) ||
        !validUuid(payload.streamId) ||
        learnerId === undefined ||
        integrityCaseId === undefined ||
        !clean(payload.externalResultReference) ||
        !clean(payload.correctionType) ||
        !clean(payload.requestNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Cycle, stream, external result reference, correction type and reason are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await requestKhposOpsResultCorrection(
        id,
        user.id,
        {
          cycleId: payload.cycleId,
          streamId: payload.streamId,
          learnerId,
          integrityCaseId,
          externalResultReference: clean(payload.externalResultReference),
          correctionType: clean(payload.correctionType),
          requestNote: clean(payload.requestNote),
        },
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "correction_action") {
      if (!validUuid(payload.correctionId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Result correction and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsResultCorrection(
        id,
        user.id,
        {
          correctionId: payload.correctionId,
          action: clean(payload.action),
          note: clean(payload.note) || null,
          reference: clean(payload.reference) || null,
        },
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "create_closeout" || mode === "update_closeout") {
      const closeoutId = optionalUuid(payload.closeoutId);
      if (
        (mode === "create_closeout" && !validUuid(payload.termId)) ||
        (mode === "update_closeout" &&
          (closeoutId === undefined || closeoutId === null)) ||
        !clean(payload.curriculumSummary) ||
        !clean(payload.assessmentSummary) ||
        !clean(payload.learnerSupportSummary) ||
        !clean(payload.integritySummary) ||
        !clean(payload.lessonsSummary)
      ) {
        return NextResponse.json(
          { ok: false, error: "Close-out requires the five academic reconciliation summaries." },
          { status: 400 },
        );
      }
      const input = {
        ...payload,
        closeoutId,
        termId: payload.termId,
        curriculumSummary: clean(payload.curriculumSummary),
        assessmentSummary: clean(payload.assessmentSummary),
        learnerSupportSummary: clean(payload.learnerSupportSummary),
        integritySummary: clean(payload.integritySummary),
        externalExamSummary: clean(payload.externalExamSummary) || null,
        lessonsSummary: clean(payload.lessonsSummary),
        carryoverReference: clean(payload.carryoverReference) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      };
      const academicAssurance =
        mode === "create_closeout"
          ? await createKhposOpsAcademicCloseout(id, user.id, input)
          : await updateKhposOpsAcademicCloseout(id, user.id, input);
      return NextResponse.json({ ok: true, academicAssurance });
    }

    if (mode === "closeout_action") {
      if (!validUuid(payload.closeoutId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Academic close-out and action are required." },
          { status: 400 },
        );
      }
      const academicAssurance = await actOnKhposOpsAcademicCloseout(
        id,
        user.id,
        payload.closeoutId,
        clean(payload.action),
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, academicAssurance });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported academic-assurance request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
