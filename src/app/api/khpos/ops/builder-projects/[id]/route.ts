import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsBuilderProject,
  actOnKhposOpsProjectCycle,
  actOnKhposOpsProjectDefence,
  actOnKhposOpsProjectMember,
  actOnKhposOpsProjectMemberEvidence,
  actOnKhposOpsProjectMilestone,
  actOnKhposOpsProjectPortfolioLink,
  addKhposOpsProjectMemberEvidence,
  createKhposOpsBuilderProject,
  createKhposOpsProjectCycle,
  createKhposOpsProjectDefence,
  getKhposOpsBuilderProjects,
  KhposOpsBuilderProjectsError,
  submitKhposOpsProjectPortfolioLink,
  updateKhposOpsBuilderProject,
} from "@/lib/khpos/ops/builder-projects";

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
    error instanceof KhposOpsBuilderProjectsError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] builder-projects failed:", error);
  return NextResponse.json(
    { ok: false, error: "Builder Projects operation could not be completed." },
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
    const builderProjects = await getKhposOpsBuilderProjects(id, user.id);
    return NextResponse.json(
      { ok: true, builderProjects },
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
      { ok: false, error: "Invalid Builder Projects request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "create_cycle") {
      const schedule = payload.milestoneSchedule;
      if (
        !validUuid(payload.termId) ||
        !validUuid(payload.campusId) ||
        !validUuid(payload.ownerAssignmentId) ||
        !clean(payload.title) ||
        !clean(payload.purpose) ||
        !clean(payload.startDate) ||
        !clean(payload.endDate) ||
        !schedule ||
        typeof schedule !== "object" ||
        Array.isArray(schedule)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Project Cycle requires term, campus, owner, title, purpose, dates and all seven milestone dates.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await createKhposOpsProjectCycle(id, user.id, {
        termId: payload.termId,
        campusId: payload.campusId,
        title: clean(payload.title),
        purpose: clean(payload.purpose),
        ownerAssignmentId: payload.ownerAssignmentId,
        startDate: clean(payload.startDate),
        endDate: clean(payload.endDate),
        milestoneSchedule: schedule as Record<string, string>,
      });
      return NextResponse.json({ ok: true, builderProjects });
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

      const builderProjects = await actOnKhposOpsProjectCycle(id, user.id, {
        cycleId: payload.cycleId,
        action: action as "activate" | "complete" | "cancel",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "create_project") {
      const projectType = clean(payload.projectType);
      if (
        !validUuid(payload.cycleId) ||
        !validUuid(payload.mentorAssignmentId) ||
        !["builder_team", "personal"].includes(projectType) ||
        !clean(payload.title) ||
        !clean(payload.problemStatement)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Project requires cycle, type, title, meaningful problem and mentor.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await createKhposOpsBuilderProject(id, user.id, {
        cycleId: payload.cycleId,
        projectType: projectType as "builder_team" | "personal",
        title: clean(payload.title),
        problemStatement: clean(payload.problemStatement),
        intendedBeneficiary: clean(payload.intendedBeneficiary) || null,
        mentorAssignmentId: payload.mentorAssignmentId,
        learnerSharedPipupathReference:
          clean(payload.learnerSharedPipupathReference) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "update_project") {
      if (
        !validUuid(payload.projectId) ||
        !clean(payload.problemStatement)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Project and meaningful problem statement are required.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await updateKhposOpsBuilderProject(id, user.id, {
        projectId: payload.projectId,
        problemStatement: clean(payload.problemStatement),
        intendedBeneficiary: clean(payload.intendedBeneficiary) || null,
        solutionHypothesis: clean(payload.solutionHypothesis) || null,
        learnerSharedPipupathReference:
          clean(payload.learnerSharedPipupathReference) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "member_action") {
      const action = clean(payload.action);
      const memberRole = clean(payload.memberRole) || "member";
      if (
        !validUuid(payload.projectId) ||
        !validUuid(payload.learnerId) ||
        !["add", "leave"].includes(action) ||
        !["lead", "member", "owner"].includes(memberRole)
      ) {
        return NextResponse.json(
          { ok: false, error: "Project member and supported action are required." },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsProjectMember(id, user.id, {
        projectId: payload.projectId,
        learnerId: payload.learnerId,
        action: action as "add" | "leave",
        memberRole: memberRole as "lead" | "member" | "owner",
        note: clean(payload.note) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "milestone_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.milestoneId) ||
        !["start", "submit_evidence", "verify", "return", "miss"].includes(
          action,
        )
      ) {
        return NextResponse.json(
          { ok: false, error: "Milestone and supported action are required." },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsProjectMilestone(id, user.id, {
        milestoneId: payload.milestoneId,
        action: action as
          | "start"
          | "submit_evidence"
          | "verify"
          | "return"
          | "miss",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
        recoveryDueDate: clean(payload.recoveryDueDate) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "project_action") {
      const action = clean(payload.action);
      const actions = [
        "activate",
        "design",
        "build",
        "test",
        "reflect",
        "ready_defence",
        "complete",
        "withdraw",
      ] as const;

      if (
        !validUuid(payload.projectId) ||
        !(actions as readonly string[]).includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Project and supported stage action are required." },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsBuilderProject(id, user.id, {
        projectId: payload.projectId,
        action: action as (typeof actions)[number],
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "create_defence") {
      if (
        !validUuid(payload.projectId) ||
        !clean(payload.scheduledAt) ||
        !clean(payload.locationLabel) ||
        !clean(payload.panelReference)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Builder Defence requires project, scheduled time, location and panel reference.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await createKhposOpsProjectDefence(id, user.id, {
        projectId: payload.projectId,
        scheduledAt: clean(payload.scheduledAt),
        locationLabel: clean(payload.locationLabel),
        panelReference: clean(payload.panelReference),
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "defence_action") {
      const action = clean(payload.action);
      const outcome = clean(payload.outcome);
      if (
        !validUuid(payload.defenceId) ||
        !["complete", "cancel"].includes(action)
      ) {
        return NextResponse.json(
          { ok: false, error: "Builder Defence and supported action are required." },
          { status: 400 },
        );
      }

      if (
        action === "complete" &&
        !["completed", "showcase_ready", "revision_required"].includes(outcome)
      ) {
        return NextResponse.json(
          { ok: false, error: "A governed Builder Defence outcome is required." },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsProjectDefence(id, user.id, {
        defenceId: payload.defenceId,
        action: action as "complete" | "cancel",
        outcome:
          action === "complete"
            ? (outcome as "completed" | "showcase_ready" | "revision_required")
            : null,
        panelFeedback: clean(payload.panelFeedback) || null,
        learnerResponseSummary: clean(payload.learnerResponseSummary) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
        revisionDueDate: clean(payload.revisionDueDate) || null,
      });
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "add_member_evidence") {
      if (
        !validUuid(payload.projectId) ||
        !validUuid(payload.learnerId) ||
        !clean(payload.dimension) ||
        !clean(payload.contributionNote) ||
        !clean(payload.evidenceReference) ||
        !clean(payload.observedAt)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Individual evidence requires project, learner, dimension, contribution, evidence reference and observed time.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await addKhposOpsProjectMemberEvidence(
        id,
        user.id,
        {
          projectId: payload.projectId,
          learnerId: payload.learnerId,
          dimension: clean(payload.dimension),
          contributionNote: clean(payload.contributionNote),
          evidenceReference: clean(payload.evidenceReference),
          observedAt: clean(payload.observedAt),
        },
      );
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "member_evidence_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.evidenceId) ||
        !["verify", "return", "withdraw"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Evidence, supported action and action note are required.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsProjectMemberEvidence(
        id,
        user.id,
        {
          evidenceId: payload.evidenceId,
          action: action as "verify" | "return" | "withdraw",
          note: clean(payload.note),
        },
      );
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "submit_portfolio_link") {
      if (
        !validUuid(payload.projectId) ||
        !validUuid(payload.learnerId) ||
        !clean(payload.portfolioReference) ||
        !clean(payload.shareNote)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Portfolio handoff requires project, learner, reference and share note.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await submitKhposOpsProjectPortfolioLink(
        id,
        user.id,
        {
          projectId: payload.projectId,
          learnerId: payload.learnerId,
          portfolioReference: clean(payload.portfolioReference),
          shareNote: clean(payload.shareNote),
          shareConfirmed: payload.shareConfirmed === true,
        },
      );
      return NextResponse.json({ ok: true, builderProjects });
    }

    if (mode === "portfolio_link_action") {
      const action = clean(payload.action);
      if (
        !validUuid(payload.portfolioLinkId) ||
        !["verify", "return", "withdraw"].includes(action) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Portfolio link, supported action and action note are required.",
          },
          { status: 400 },
        );
      }

      const builderProjects = await actOnKhposOpsProjectPortfolioLink(
        id,
        user.id,
        {
          portfolioLinkId: payload.portfolioLinkId,
          action: action as "verify" | "return" | "withdraw",
          note: clean(payload.note),
        },
      );
      return NextResponse.json({ ok: true, builderProjects });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported Builder Projects request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
