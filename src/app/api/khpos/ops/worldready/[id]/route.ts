import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsWorldReadyAction,
  actOnKhposOpsWorldReadyEvidence,
  actOnKhposOpsWorldReadyRecord,
  addKhposOpsWorldReadyEvidence,
  createKhposOpsWorldReadyAction,
  createKhposOpsWorldReadyRecord,
  decideKhposOpsWorldReady,
  getKhposOpsWorldReady,
  KhposOpsWorldReadyError,
  reviewKhposOpsWorldReadyDomain,
  setKhposOpsWorldReadyPathway,
  submitKhposOpsWorldReadyReview,
} from "@/lib/khpos/ops/worldready";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsWorldReadyError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error("[khpos][ops] worldready failed:", error);
  return NextResponse.json(
    { ok: false, error: "WorldReady operation could not be completed." },
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
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }
  try {
    const user = await authenticatedUser(request);
    const worldReady = await getKhposOpsWorldReady(id, user.id);
    return NextResponse.json(
      { ok: true, worldReady },
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
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid WorldReady request." }, { status: 400 });
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_record") {
      if (!validUuid(payload.learnerId) || !validUuid(payload.termId) || !validUuid(payload.ownerAssignmentId)) {
        return NextResponse.json(
          { ok: false, error: "Learner, term and WorldReady owner are required." },
          { status: 400 },
        );
      }
      const worldReady = await createKhposOpsWorldReadyRecord(id, user.id, {
        learnerId: payload.learnerId,
        termId: payload.termId,
        ownerAssignmentId: payload.ownerAssignmentId,
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "set_pathway") {
      if (!validUuid(payload.recordId) || !clean(payload.transitionPathway) || !clean(payload.pathwaySummary)) {
        return NextResponse.json(
          { ok: false, error: "WorldReady record, pathway and pathway summary are required." },
          { status: 400 },
        );
      }
      const worldReady = await setKhposOpsWorldReadyPathway(id, user.id, {
        recordId: payload.recordId,
        transitionPathway: clean(payload.transitionPathway),
        pathwaySummary: clean(payload.pathwaySummary),
        pathwayReference: clean(payload.pathwayReference) || null,
        portfolioReference: clean(payload.portfolioReference) || null,
        humanPotentialRecordReference: clean(payload.humanPotentialRecordReference) || null,
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "add_evidence") {
      if (
        !validUuid(payload.recordId) ||
        !clean(payload.domainCode) ||
        !clean(payload.evidenceType) ||
        !clean(payload.title) ||
        !clean(payload.evidenceNote) ||
        !clean(payload.evidenceReference)
      ) {
        return NextResponse.json(
          { ok: false, error: "Record, domain, evidence type, title, note and reference are required." },
          { status: 400 },
        );
      }
      const worldReady = await addKhposOpsWorldReadyEvidence(id, user.id, {
        recordId: payload.recordId,
        domainCode: clean(payload.domainCode),
        evidenceType: clean(payload.evidenceType),
        title: clean(payload.title),
        evidenceNote: clean(payload.evidenceNote),
        evidenceReference: clean(payload.evidenceReference),
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "evidence_action") {
      const action = clean(payload.action);
      if (!validUuid(payload.evidenceId) || !["verify", "return", "withdraw"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Evidence and supported action are required." },
          { status: 400 },
        );
      }
      const worldReady = await actOnKhposOpsWorldReadyEvidence(id, user.id, {
        evidenceId: payload.evidenceId,
        action: action as "verify" | "return" | "withdraw",
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "review_domain") {
      const status = clean(payload.status);
      if (
        !validUuid(payload.recordId) ||
        !clean(payload.domainCode) ||
        !["not_evidenced", "emerging", "demonstrated"].includes(status) ||
        !clean(payload.reviewNote) ||
        !clean(payload.evidenceSummary)
      ) {
        return NextResponse.json(
          { ok: false, error: "Domain review requires record, status, review note and evidence summary." },
          { status: 400 },
        );
      }
      const worldReady = await reviewKhposOpsWorldReadyDomain(id, user.id, {
        recordId: payload.recordId,
        domainCode: clean(payload.domainCode),
        status: status as "not_evidenced" | "emerging" | "demonstrated",
        reviewNote: clean(payload.reviewNote),
        evidenceSummary: clean(payload.evidenceSummary),
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "create_action") {
      if (
        !validUuid(payload.recordId) ||
        !clean(payload.domainCode) ||
        !clean(payload.title) ||
        !clean(payload.expectedChange) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.dueDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Transition action requires domain, owner, due date, title and expected change." },
          { status: 400 },
        );
      }
      const worldReady = await createKhposOpsWorldReadyAction(id, user.id, {
        recordId: payload.recordId,
        domainCode: clean(payload.domainCode),
        title: clean(payload.title),
        expectedChange: clean(payload.expectedChange),
        ownerAssignmentId: payload.ownerAssignmentId,
        dueDate: clean(payload.dueDate),
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "action_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.actionId) ||
        !["start", "submit_evidence", "verify", "reopen", "waive"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Transition action and supported operation are required." },
          { status: 400 },
        );
      }
      const worldReady = await actOnKhposOpsWorldReadyAction(id, user.id, {
        actionId: payload.actionId,
        action: action as "start" | "submit_evidence" | "verify" | "reopen" | "waive",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "submit_review") {
      if (!validUuid(payload.recordId)) {
        return NextResponse.json({ ok: false, error: "WorldReady record is required." }, { status: 400 });
      }
      const worldReady = await submitKhposOpsWorldReadyReview(id, user.id, payload.recordId);
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "decide") {
      const outcome = clean(payload.outcome);
      if (
        !validUuid(payload.recordId) ||
        !["ready", "ready_with_actions", "not_ready"].includes(outcome) ||
        !clean(payload.readinessSummary) ||
        !clean(payload.reviewNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Final WorldReady review requires outcome, readiness summary and review note." },
          { status: 400 },
        );
      }
      const worldReady = await decideKhposOpsWorldReady(id, user.id, {
        recordId: payload.recordId,
        outcome: outcome as "ready" | "ready_with_actions" | "not_ready",
        readinessSummary: clean(payload.readinessSummary),
        reviewNote: clean(payload.reviewNote),
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    if (mode === "record_action") {
      const action = clean(payload.action);
      if (!validUuid(payload.recordId) || !["reopen", "close", "cancel"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "WorldReady record and supported action are required." },
          { status: 400 },
        );
      }
      const worldReady = await actOnKhposOpsWorldReadyRecord(id, user.id, {
        recordId: payload.recordId,
        action: action as "reopen" | "close" | "cancel",
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, worldReady });
    }

    return NextResponse.json({ ok: false, error: "Unsupported WorldReady request." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
