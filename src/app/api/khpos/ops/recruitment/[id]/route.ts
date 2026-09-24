import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsCandidateApplication,
  actOnKhposOpsCandidateClearance,
  actOnKhposOpsVacancy,
  addKhposOpsCandidateApplication,
  addKhposOpsCandidateEvaluation,
  appointKhposOpsClearedCandidate,
  completeKhposOpsCandidateClearance,
  createKhposOpsWorkforceRequest,
  decideKhposOpsWorkforceRequest,
  getKhposOpsRecruitment,
  KhposOpsRecruitmentError,
  updateKhposOpsVacancyBrief,
} from "@/lib/khpos/ops/recruitment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsRecruitmentError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] recruitment operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Recruitment operation could not be completed." },
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
    const recruitment = await getKhposOpsRecruitment(id, user.id);
    return NextResponse.json(
      { ok: true, recruitment },
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
      { ok: false, error: "Invalid recruitment request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_workforce") {
      const roleId = optionalUuid(payload.roleId);
      const campusId = optionalUuid(payload.campusId);
      const unitId = optionalUuid(payload.unitId);
      const desiredStartDate = dateString(payload.desiredStartDate);

      if (
        roleId === undefined ||
        !roleId ||
        campusId === undefined ||
        unitId === undefined ||
        !clean(payload.employmentType) ||
        !clean(payload.needType) ||
        !clean(payload.rationale) ||
        !desiredStartDate
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Role, employment type, need type, rationale and desired start date are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await createKhposOpsWorkforceRequest(id, user.id, {
        roleId,
        campusId,
        unitId,
        employmentType: clean(payload.employmentType),
        needType: clean(payload.needType),
        rationale: clean(payload.rationale),
        alternativesConsidered:
          clean(payload.alternativesConsidered) || null,
        desiredStartDate,
        budgetReference: clean(payload.budgetReference) || null,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "decide_workforce") {
      if (
        !validUuid(payload.requestId) ||
        !["approve", "decline"].includes(clean(payload.decision)) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Workforce request, decision and reasoned note are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await decideKhposOpsWorkforceRequest(
        id,
        user.id,
        payload.requestId,
        clean(payload.decision) as "approve" | "decline",
        clean(payload.note),
      );
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "update_vacancy") {
      const closingDate = clean(payload.closingDate)
        ? dateString(payload.closingDate)
        : null;

      if (
        !validUuid(payload.vacancyId) ||
        !clean(payload.title) ||
        !clean(payload.roleOutcomes) ||
        !clean(payload.minimumRequirements) ||
        !clean(payload.safeguardingStatement) ||
        (clean(payload.closingDate) && !closingDate)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Vacancy, title, role outcomes, minimum requirements and safeguarding statement are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await updateKhposOpsVacancyBrief(id, user.id, {
        vacancyId: payload.vacancyId,
        title: clean(payload.title),
        roleOutcomes: clean(payload.roleOutcomes),
        minimumRequirements: clean(payload.minimumRequirements),
        safeguardingStatement: clean(payload.safeguardingStatement),
        closingDate,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "vacancy_action") {
      const action = clean(payload.action);
      const closingDate = clean(payload.closingDate)
        ? dateString(payload.closingDate)
        : null;

      if (
        !validUuid(payload.vacancyId) ||
        !["open", "hold", "close"].includes(action) ||
        (clean(payload.closingDate) && !closingDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Valid vacancy action is required." },
          { status: 400 },
        );
      }

      const recruitment = await actOnKhposOpsVacancy(id, user.id, {
        vacancyId: payload.vacancyId,
        action: action as "open" | "hold" | "close",
        note: clean(payload.note) || null,
        closingDate,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "add_application") {
      if (
        !validUuid(payload.vacancyId) ||
        !clean(payload.fullName) ||
        !clean(payload.email)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Open vacancy, candidate name and candidate email are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await addKhposOpsCandidateApplication(id, user.id, {
        vacancyId: payload.vacancyId,
        fullName: clean(payload.fullName),
        email: clean(payload.email),
        phone: clean(payload.phone) || null,
        source: clean(payload.source) || null,
        applicationNote: clean(payload.applicationNote) || null,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "add_evaluation") {
      const recommendation = clean(payload.recommendation);
      if (
        !validUuid(payload.applicationId) ||
        !clean(payload.evaluationType) ||
        !clean(payload.competenceEvidence) ||
        !clean(payload.roleFitEvidence) ||
        !["progress", "needs_more_evidence", "do_not_progress"].includes(
          recommendation,
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Application, evaluation type, competence evidence, role-fit evidence and recommendation are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await addKhposOpsCandidateEvaluation(id, user.id, {
        applicationId: payload.applicationId,
        evaluationType: clean(payload.evaluationType),
        competenceEvidence: clean(payload.competenceEvidence),
        roleFitEvidence: clean(payload.roleFitEvidence),
        builderPhilosophyEvidence:
          clean(payload.builderPhilosophyEvidence) || null,
        concernOrGap: clean(payload.concernOrGap) || null,
        recommendation: recommendation as
          | "progress"
          | "needs_more_evidence"
          | "do_not_progress",
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "application_action") {
      const action = clean(payload.action);
      const allowed = [
        "start_screening",
        "invite_interview",
        "conditional_select",
        "start_clearance",
        "decline",
        "withdraw",
      ] as const;

      if (
        !validUuid(payload.applicationId) ||
        !(allowed as readonly string[]).includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Valid candidate-stage action is required." },
          { status: 400 },
        );
      }

      const recruitment = await actOnKhposOpsCandidateApplication(
        id,
        user.id,
        payload.applicationId,
        action as (typeof allowed)[number],
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "clearance_action") {
      const action = clean(payload.action);
      const allowed = ["verify", "needs_review", "not_clear", "waive"] as const;

      if (
        !validUuid(payload.itemId) ||
        !(allowed as readonly string[]).includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Clearance item, action and outcome note are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await actOnKhposOpsCandidateClearance(id, user.id, {
        itemId: payload.itemId,
        action: action as (typeof allowed)[number],
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "complete_clearance") {
      if (!validUuid(payload.applicationId) || !clean(payload.note)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Application and final clearance note are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await completeKhposOpsCandidateClearance(
        id,
        user.id,
        payload.applicationId,
        clean(payload.note),
      );
      return NextResponse.json({ ok: true, recruitment });
    }

    if (mode === "appoint_candidate") {
      const startDate = dateString(payload.startDate);
      const onboardingDueDate = clean(payload.onboardingDueDate)
        ? dateString(payload.onboardingDueDate)
        : null;
      const probationReviewDate = clean(payload.probationReviewDate)
        ? dateString(payload.probationReviewDate)
        : null;

      if (
        !validUuid(payload.applicationId) ||
        !startDate ||
        (clean(payload.onboardingDueDate) && !onboardingDueDate) ||
        (clean(payload.probationReviewDate) && !probationReviewDate)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Cleared application and valid appointment start date are required.",
          },
          { status: 400 },
        );
      }

      const recruitment = await appointKhposOpsClearedCandidate(id, user.id, {
        applicationId: payload.applicationId,
        startDate,
        onboardingDueDate,
        probationReviewDate,
      });
      return NextResponse.json({ ok: true, recruitment });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported recruitment request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
