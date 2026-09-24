import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsYoungCeoCycle,
  actOnKhposOpsYoungCeoMember,
  actOnKhposOpsYoungCeoMemberEvidence,
  actOnKhposOpsYoungCeoMilestone,
  actOnKhposOpsYoungCeoSession,
  actOnKhposOpsYoungCeoVenture,
  addKhposOpsYoungCeoMemberEvidence,
  createKhposOpsYoungCeoCycle,
  createKhposOpsYoungCeoSession,
  createKhposOpsYoungCeoVenture,
  getKhposOpsYoungCeo,
  KhposOpsYoungCeoError,
  updateKhposOpsYoungCeoVentureCanvas,
} from "@/lib/khpos/ops/young-ceo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsYoungCeoError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] young-ceo failed:", error);
  return NextResponse.json(
    { ok: false, error: "Young CEO Hub operation could not be completed." },
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
    const youngCeo = await getKhposOpsYoungCeo(id, user.id);
    return NextResponse.json(
      { ok: true, youngCeo },
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
      { ok: false, error: "Invalid Young CEO Hub request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_cycle") {
      if (
        !validUuid(payload.termId) ||
        !validUuid(payload.campusId) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.title) ||
        !clean(payload.purpose) ||
        !clean(payload.startDate) ||
        !clean(payload.endDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Cycle requires term, campus, owner, title, purpose and dates." },
          { status: 400 },
        );
      }

      const youngCeo = await createKhposOpsYoungCeoCycle(id, user.id, {
        termId: payload.termId,
        campusId: payload.campusId,
        title: clean(payload.title),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
        startDate: clean(payload.startDate),
        endDate: clean(payload.endDate),
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "cycle_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.cycleId) ||
        !["activate", "complete", "cancel"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Cycle and supported action are required." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoCycle(id, user.id, {
        cycleId: payload.cycleId,
        action: action as "activate" | "complete" | "cancel",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "create_session") {
      if (
        !validUuid(payload.cycleId) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.sessionDate) ||
        !clean(payload.theme) ||
        !clean(payload.purpose)
      ) {
        return NextResponse.json(
          { ok: false, error: "Session requires cycle, date, theme, purpose and owner." },
          { status: 400 },
        );
      }

      const youngCeo = await createKhposOpsYoungCeoSession(id, user.id, {
        cycleId: payload.cycleId,
        sessionDate: clean(payload.sessionDate),
        theme: clean(payload.theme),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "session_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.sessionId) ||
        !["deliver", "miss", "recover", "waive_recovery", "cancel"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Session, supported action and outcome note are required." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoSession(id, user.id, {
        sessionId: payload.sessionId,
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
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "create_venture") {
      const ventureMode = clean(payload.ventureMode);
      if (
        !validUuid(payload.cycleId) ||
        !clean(payload.name) ||
        !["individual", "team"].includes(ventureMode) ||
        !clean(payload.problemStatement)
      ) {
        return NextResponse.json(
          { ok: false, error: "Venture requires cycle, name, mode and a real problem statement." },
          { status: 400 },
        );
      }

      const youngCeo = await createKhposOpsYoungCeoVenture(id, user.id, {
        cycleId: payload.cycleId,
        name: clean(payload.name),
        ventureMode: ventureMode as "individual" | "team",
        problemStatement: clean(payload.problemStatement),
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "update_venture_canvas") {
      const salesMode = clean(payload.salesMode);
      if (
        !validUuid(payload.ventureId) ||
        !clean(payload.problemStatement) ||
        !["simulation", "internal_school", "external_approved"].includes(salesMode)
      ) {
        return NextResponse.json(
          { ok: false, error: "Venture canvas requires venture, problem statement and supported sales mode." },
          { status: 400 },
        );
      }

      const youngCeo = await updateKhposOpsYoungCeoVentureCanvas(id, user.id, {
        ventureId: payload.ventureId,
        problemStatement: clean(payload.problemStatement),
        targetCustomer: clean(payload.targetCustomer) || null,
        solutionSummary: clean(payload.solutionSummary) || null,
        valueProposition: clean(payload.valueProposition) || null,
        salesMode: salesMode as "simulation" | "internal_school" | "external_approved",
        salesApprovalReference: clean(payload.salesApprovalReference) || null,
        financeReference: clean(payload.financeReference) || null,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "member_action") {
      const action = clean(payload.action);
      const memberRole = clean(payload.memberRole) || "member";
      if (
        !validUuid(payload.ventureId) ||
        !validUuid(payload.learnerId) ||
        !["add", "leave"].includes(action) ||
        !["lead", "member"].includes(memberRole)
      ) {
        return NextResponse.json(
          { ok: false, error: "Venture member action is invalid." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoMember(id, user.id, {
        ventureId: payload.ventureId,
        learnerId: payload.learnerId,
        action: action as "add" | "leave",
        memberRole: memberRole as "lead" | "member",
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "milestone_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.milestoneId) ||
        !["start", "submit_evidence", "verify", "return"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Milestone and supported action are required." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoMilestone(id, user.id, {
        milestoneId: payload.milestoneId,
        action: action as "start" | "submit_evidence" | "verify" | "return",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "venture_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.ventureId) ||
        !["activate", "build", "test", "sell", "iterate", "complete", "withdraw"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Venture and supported stage action are required." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoVenture(id, user.id, {
        ventureId: payload.ventureId,
        action: action as
          | "activate"
          | "build"
          | "test"
          | "sell"
          | "iterate"
          | "complete"
          | "withdraw",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "add_member_evidence") {
      if (
        !validUuid(payload.ventureId) ||
        !validUuid(payload.learnerId) ||
        !clean(payload.dimension) ||
        !clean(payload.contributionNote) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.observedAt)
      ) {
        return NextResponse.json(
          { ok: false, error: "Individual value evidence requires venture, learner, dimension, contribution, reference and observed time." },
          { status: 400 },
        );
      }

      const youngCeo = await addKhposOpsYoungCeoMemberEvidence(id, user.id, {
        ventureId: payload.ventureId,
        learnerId: payload.learnerId,
        dimension: clean(payload.dimension),
        contributionNote: clean(payload.contributionNote),
        evidenceReference: clean(payload.evidenceReference),
        observedAt: clean(payload.observedAt),
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    if (mode === "member_evidence_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.evidenceId) ||
        !["verify", "return", "withdraw"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Evidence, supported action and action note are required." },
          { status: 400 },
        );
      }

      const youngCeo = await actOnKhposOpsYoungCeoMemberEvidence(id, user.id, {
        evidenceId: payload.evidenceId,
        action: action as "verify" | "return" | "withdraw",
        note: clean(payload.note),
      });
      return NextResponse.json({ ok: true, youngCeo });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported Young CEO Hub request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
