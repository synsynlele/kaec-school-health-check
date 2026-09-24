import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsPotentialEvidence,
  actOnKhposOpsPotentialExploration,
  actOnKhposOpsPotentialHypothesis,
  actOnKhposOpsPotentialReview,
  addKhposOpsPotentialEvidence,
  createKhposOpsPotentialExploration,
  createKhposOpsPotentialHypothesis,
  createKhposOpsPotentialReview,
  getKhposOpsPotentialDiscovery,
  KhposOpsPotentialDiscoveryError,
  recordKhposOpsPotentialDiscovery,
  recordKhposOpsPotentialReflection,
  updateKhposOpsPotentialReview,
} from "@/lib/khpos/ops/potential-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsPotentialDiscoveryError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] potential development failed:", error);
  return NextResponse.json(
    { ok: false, error: "Potential Development operation could not be completed." },
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
    const potential = await getKhposOpsPotentialDiscovery(id, user.id);
    return NextResponse.json(
      { ok: true, potential },
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
      { ok: false, error: "Invalid Potential Development request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "record_discovery") {
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !clean(payload.discoveryNote) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          { ok: false, error: "Learner, term, discovery note and evidence reference are required." },
          { status: 400 },
        );
      }
      const potential = await recordKhposOpsPotentialDiscovery(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        interestsSummary: clean(payload.interestsSummary) || null,
        curiositySummary: clean(payload.curiositySummary) || null,
        meaningfulProblemsSummary: clean(payload.meaningfulProblemsSummary) || null,
        recurringStrengthsSummary: clean(payload.recurringStrengthsSummary) || null,
        repeatedChoicesSummary: clean(payload.repeatedChoicesSummary) || null,
        discoveryNote: clean(payload.discoveryNote),
        evidenceReference: clean(payload.evidenceReference),
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "create_hypothesis") {
      if (
        !validUuid(payload.learnerId) ||
        !clean(payload.themeLabel) ||
        !clean(payload.hypothesisSummary)
      ) {
        return NextResponse.json(
          { ok: false, error: "Learner, hypothesis theme and evidence-based summary are required." },
          { status: 400 },
        );
      }
      if (payload.originTermId && !validUuid(payload.originTermId)) {
        return NextResponse.json(
          { ok: false, error: "Origin term is invalid." },
          { status: 400 },
        );
      }
      const potential = await createKhposOpsPotentialHypothesis(id, user.id, {
        learnerId: payload.learnerId,
        originTermId: validUuid(payload.originTermId) ? payload.originTermId : null,
        themeLabel: clean(payload.themeLabel),
        hypothesisSummary: clean(payload.hypothesisSummary),
        currentNote: clean(payload.currentNote) || null,
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "hypothesis_action") {
      if (
        !validUuid(payload.hypothesisId) ||
        !["exploring", "emerging", "developing", "demonstrated", "retire"].includes(
          clean(payload.action),
        ) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Hypothesis, supported state/action and evidence-based note are required." },
          { status: 400 },
        );
      }
      const potential = await actOnKhposOpsPotentialHypothesis(id, user.id, {
        hypothesisId: payload.hypothesisId,
        action: clean(payload.action) as
          | "exploring"
          | "emerging"
          | "developing"
          | "demonstrated"
          | "retire",
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "add_evidence") {
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !clean(payload.evidenceType) ||
        !["school", "learner_shared", "external", "manual"].includes(clean(payload.evidenceOrigin)) ||
        !clean(payload.title) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.observedAt)
      ) {
        return NextResponse.json(
          { ok: false, error: "Evidence requires learner, term, type/origin, title, note, reference and observed time." },
          { status: 400 },
        );
      }
      const potential = await addKhposOpsPotentialEvidence(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        hypothesisId: validUuid(payload.hypothesisId) ? payload.hypothesisId : null,
        evidenceType: clean(payload.evidenceType),
        evidenceOrigin: clean(payload.evidenceOrigin) as
          | "school"
          | "learner_shared"
          | "external"
          | "manual",
        title: clean(payload.title),
        evidenceNote: clean(payload.evidenceNote),
        evidenceReference: clean(payload.evidenceReference),
        observedAt: clean(payload.observedAt),
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "withdraw_evidence") {
      if (!validUuid(payload.evidenceId) || !clean(payload.reason)) {
        return NextResponse.json(
          { ok: false, error: "Evidence and withdrawal reason are required." },
          { status: 400 },
        );
      }
      const potential = await actOnKhposOpsPotentialEvidence(
        id,
        user.id,
        payload.evidenceId,
        clean(payload.reason),
      );
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "create_exploration") {
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !clean(payload.explorationType) ||
        !clean(payload.areaLabel) ||
        !clean(payload.purpose) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.plannedDate) ||
        !clean(payload.reviewDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Exploration requires learner, term, type, area, purpose, owner and dates." },
          { status: 400 },
        );
      }
      const potential = await createKhposOpsPotentialExploration(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        hypothesisId: validUuid(payload.hypothesisId) ? payload.hypothesisId : null,
        explorationType: clean(payload.explorationType),
        areaLabel: clean(payload.areaLabel),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
        plannedDate: clean(payload.plannedDate),
        reviewDate: clean(payload.reviewDate),
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "exploration_action") {
      if (
        !validUuid(payload.explorationId) ||
        !["start", "complete", "cancel"].includes(clean(payload.action))
      ) {
        return NextResponse.json(
          { ok: false, error: "Exploration and supported action are required." },
          { status: 400 },
        );
      }
      const potential = await actOnKhposOpsPotentialExploration(id, user.id, {
        explorationId: payload.explorationId,
        action: clean(payload.action) as "start" | "complete" | "cancel",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "record_reflection") {
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !clean(payload.reflectionType) ||
        !clean(payload.learningSummary) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.reflectedAt)
      ) {
        return NextResponse.json(
          { ok: false, error: "Reflection requires learner, term, type, learning summary, evidence reference and time." },
          { status: 400 },
        );
      }
      const potential = await recordKhposOpsPotentialReflection(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        reflectionType: clean(payload.reflectionType),
        learningSummary: clean(payload.learningSummary),
        nextStep: clean(payload.nextStep) || null,
        evidenceReference: clean(payload.evidenceReference),
        reflectedAt: clean(payload.reflectedAt),
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "create_review" || mode === "update_review") {
      const required = [
        payload.discoverySummary,
        payload.hypothesisSummary,
        payload.evidenceSummary,
        payload.developmentSummary,
        payload.nextPriorities,
      ].every((value) => !!clean(value));

      if (!required) {
        return NextResponse.json(
          { ok: false, error: "Potential review requires discovery, hypothesis, evidence, development and next-priority summaries." },
          { status: 400 },
        );
      }

      if (mode === "create_review") {
        if (!validUuid(payload.learnerId) || !validUuid(payload.termId)) {
          return NextResponse.json(
            { ok: false, error: "Learner and term are required." },
            { status: 400 },
          );
        }
        const potential = await createKhposOpsPotentialReview(id, user.id, {
          learnerId: payload.learnerId,
          termId: payload.termId,
          discoverySummary: clean(payload.discoverySummary),
          hypothesisSummary: clean(payload.hypothesisSummary),
          evidenceSummary: clean(payload.evidenceSummary),
          developmentSummary: clean(payload.developmentSummary),
          contributionSummary: clean(payload.contributionSummary) || null,
          nextPriorities: clean(payload.nextPriorities),
          portfolioReference: clean(payload.portfolioReference) || null,
        });
        return NextResponse.json({ ok: true, potential });
      }

      if (!validUuid(payload.reviewId)) {
        return NextResponse.json(
          { ok: false, error: "Potential review is required." },
          { status: 400 },
        );
      }
      const potential = await updateKhposOpsPotentialReview(id, user.id, {
        reviewId: payload.reviewId,
        discoverySummary: clean(payload.discoverySummary),
        hypothesisSummary: clean(payload.hypothesisSummary),
        evidenceSummary: clean(payload.evidenceSummary),
        developmentSummary: clean(payload.developmentSummary),
        contributionSummary: clean(payload.contributionSummary) || null,
        nextPriorities: clean(payload.nextPriorities),
        portfolioReference: clean(payload.portfolioReference) || null,
      });
      return NextResponse.json({ ok: true, potential });
    }

    if (mode === "review_action") {
      if (
        !validUuid(payload.reviewId) ||
        !["submit", "approve", "return", "cancel"].includes(clean(payload.action))
      ) {
        return NextResponse.json(
          { ok: false, error: "Potential review and supported action are required." },
          { status: 400 },
        );
      }
      const potential = await actOnKhposOpsPotentialReview(id, user.id, {
        reviewId: payload.reviewId,
        action: clean(payload.action) as "submit" | "approve" | "return" | "cancel",
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, potential });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported Potential Development request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
