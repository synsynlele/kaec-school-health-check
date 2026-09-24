import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsCapabilityEvidence,
  actOnKhposOpsFinancialActivity,
  actOnKhposOpsLeadershipOpportunity,
  addKhposOpsCapabilityEvidence,
  createKhposOpsFinancialActivity,
  createKhposOpsLeadershipOpportunity,
  getKhposOpsLeadershipFinancial,
  KhposOpsCapabilityError,
} from "@/lib/khpos/ops/leadership-financial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsCapabilityError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] leadership-financial failed:", error);
  return NextResponse.json(
    { ok: false, error: "Leadership & Financial Capability operation could not be completed." },
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
    const capability = await getKhposOpsLeadershipFinancial(id, user.id);
    return NextResponse.json(
      { ok: true, capability },
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
      { ok: false, error: "Invalid Leadership & Financial Capability request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_leadership_opportunity") {
      if (
        !validUuid(payload.termId) ||
        !validUuid(payload.campusId) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.opportunityType) ||
        !clean(payload.title) ||
        !clean(payload.purpose) ||
        !clean(payload.plannedStartDate) ||
        (payload.plannedEndDate && !clean(payload.plannedEndDate))
      ) {
        return NextResponse.json(
          { ok: false, error: "Leadership opportunity requires term, campus, owner, type, title, purpose and start date." },
          { status: 400 },
        );
      }

      const capability = await createKhposOpsLeadershipOpportunity(id, user.id, {
        termId: payload.termId,
        campusId: payload.campusId,
        opportunityType: clean(payload.opportunityType),
        title: clean(payload.title),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
        plannedStartDate: clean(payload.plannedStartDate),
        plannedEndDate: clean(payload.plannedEndDate) || null,
      });
      return NextResponse.json({ ok: true, capability });
    }

    if (mode === "leadership_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.opportunityId) ||
        !["activate", "complete", "cancel"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Leadership opportunity and supported action are required." },
          { status: 400 },
        );
      }

      const capability = await actOnKhposOpsLeadershipOpportunity(id, user.id, {
        opportunityId: payload.opportunityId,
        action: action as "activate" | "complete" | "cancel",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, capability });
    }

    if (mode === "create_financial_activity") {
      if (
        !validUuid(payload.termId) ||
        !validUuid(payload.campusId) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.activityType) ||
        !clean(payload.title) ||
        !clean(payload.purpose) ||
        !clean(payload.activityDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Financial Capability activity requires term, campus, owner, type, title, purpose and date." },
          { status: 400 },
        );
      }

      const capability = await createKhposOpsFinancialActivity(id, user.id, {
        termId: payload.termId,
        campusId: payload.campusId,
        activityType: clean(payload.activityType),
        title: clean(payload.title),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
        activityDate: clean(payload.activityDate),
      });
      return NextResponse.json({ ok: true, capability });
    }

    if (mode === "financial_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.activityId) ||
        !["deliver", "miss", "recover", "waive_recovery", "cancel"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Financial Capability activity, supported action and outcome note are required." },
          { status: 400 },
        );
      }

      const capability = await actOnKhposOpsFinancialActivity(id, user.id, {
        activityId: payload.activityId,
        action: action as
          | "deliver"
          | "miss"
          | "recover"
          | "waive_recovery"
          | "cancel",
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
        recoveryDueDate: clean(payload.recoveryDueDate) || null,
      });
      return NextResponse.json({ ok: true, capability });
    }

    if (mode === "add_evidence") {
      const domain = clean(payload.domain);
      if (
        !validUuid(payload.learnerId) ||
        !validUuid(payload.termId) ||
        !["leadership", "financial_capability"].includes(domain) ||
        !clean(payload.dimension) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.observedAt) ||
        (payload.leadershipOpportunityId &&
          !validUuid(payload.leadershipOpportunityId)) ||
        (payload.financialActivityId &&
          !validUuid(payload.financialActivityId))
      ) {
        return NextResponse.json(
          { ok: false, error: "Capability evidence requires learner, term, domain, dimension, note, evidence reference and observed time." },
          { status: 400 },
        );
      }

      const capability = await addKhposOpsCapabilityEvidence(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        domain: domain as "leadership" | "financial_capability",
        dimension: clean(payload.dimension),
        leadershipOpportunityId: validUuid(payload.leadershipOpportunityId)
          ? payload.leadershipOpportunityId
          : null,
        financialActivityId: validUuid(payload.financialActivityId)
          ? payload.financialActivityId
          : null,
        evidenceNote: clean(payload.evidenceNote),
        evidenceReference: clean(payload.evidenceReference),
        observedAt: clean(payload.observedAt),
      });
      return NextResponse.json({ ok: true, capability });
    }

    if (mode === "evidence_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.evidenceId) ||
        !["verify", "return", "withdraw"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Evidence, supported action and reasoned note are required." },
          { status: 400 },
        );
      }

      const capability = await actOnKhposOpsCapabilityEvidence(
        id,
        user.id,
        payload.evidenceId,
        action as "verify" | "return" | "withdraw",
        clean(payload.note),
      );
      return NextResponse.json({ ok: true, capability });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported Leadership & Financial Capability request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
