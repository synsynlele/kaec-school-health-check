import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsDecision,
  createKhposOpsDecision,
  getKhposOpsDecisions,
  KhposOpsDecisionError,
  type KhposOpsDecisionAction,
  type KhposOpsDecisionActionPayload,
  type KhposOpsDecisionPriority,
} from "@/lib/khpos/ops/decisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsDecisionError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] decision operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Decision operation could not be completed." },
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
    const decisions = await getKhposOpsDecisions(id, user.id);
    return NextResponse.json(
      { ok: true, decisions },
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

  let payload: {
    mode?: "create" | "action";
    decisionMode?: "request" | "record";
    requesterAssignmentId?: string;
    authorityRoleId?: string;
    title?: string;
    context?: string;
    category?: string;
    priority?: KhposOpsDecisionPriority;
    recommendation?: string | null;
    decisionDueAt?: string | null;
    sourceIssueId?: string | null;
    decisionText?: string | null;
    actionRequired?: boolean;
    implementationOwnerAssignmentId?: string | null;
    implementationTitle?: string | null;
    implementationExpectedOutcome?: string | null;
    implementationDueAt?: string | null;
    decisionId?: string;
    action?: KhposOpsDecisionAction;
    actionPayload?: KhposOpsDecisionActionPayload;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid decision request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create") {
      if (
        !payload.decisionMode ||
        !payload.requesterAssignmentId ||
        !UUID_RE.test(payload.requesterAssignmentId) ||
        !payload.authorityRoleId ||
        !UUID_RE.test(payload.authorityRoleId) ||
        !payload.title?.trim() ||
        !payload.context?.trim() ||
        !payload.category?.trim() ||
        !payload.priority ||
        !["P1", "P2", "P3", "P4"].includes(payload.priority)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Decision mode, operating role, authority, title, context, category and priority are required.",
          },
          { status: 400 },
        );
      }

      for (const value of [
        payload.decisionDueAt,
        payload.implementationDueAt,
      ]) {
        if (value && Number.isNaN(Date.parse(value))) {
          return NextResponse.json(
            { ok: false, error: "One of the decision dates is invalid." },
            { status: 400 },
          );
        }
      }

      if (
        payload.implementationOwnerAssignmentId &&
        !UUID_RE.test(payload.implementationOwnerAssignmentId)
      ) {
        return NextResponse.json(
          { ok: false, error: "Implementation owner is invalid." },
          { status: 400 },
        );
      }

      if (payload.sourceIssueId && !UUID_RE.test(payload.sourceIssueId)) {
        return NextResponse.json(
          { ok: false, error: "Source issue is invalid." },
          { status: 400 },
        );
      }

      const decisions = await createKhposOpsDecision(id, user.id, {
        mode: payload.decisionMode,
        requesterAssignmentId: payload.requesterAssignmentId,
        authorityRoleId: payload.authorityRoleId,
        title: payload.title.trim(),
        context: payload.context.trim(),
        category: payload.category.trim(),
        priority: payload.priority,
        recommendation: payload.recommendation?.trim() || null,
        decisionDueAt: payload.decisionDueAt ?? null,
        sourceIssueId: payload.sourceIssueId ?? null,
        decisionText: payload.decisionText?.trim() || null,
        actionRequired: payload.actionRequired ?? false,
        implementationOwnerAssignmentId:
          payload.implementationOwnerAssignmentId ?? null,
        implementationTitle: payload.implementationTitle?.trim() || null,
        implementationExpectedOutcome:
          payload.implementationExpectedOutcome?.trim() || null,
        implementationDueAt: payload.implementationDueAt ?? null,
      });

      return NextResponse.json({ ok: true, decisions });
    }

    if (
      payload.mode === "action" &&
      payload.decisionId &&
      UUID_RE.test(payload.decisionId) &&
      payload.action
    ) {
      const decisions = await actOnKhposOpsDecision(
        id,
        user.id,
        payload.decisionId,
        payload.action,
        payload.actionPayload ?? {},
      );
      return NextResponse.json({ ok: true, decisions });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported decision request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
