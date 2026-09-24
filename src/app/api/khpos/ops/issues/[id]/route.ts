import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsIssue,
  createKhposOpsIssue,
  getKhposOpsIssues,
  KhposOpsIssueError,
  type KhposOpsIssueSeverity,
} from "@/lib/khpos/ops/issues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsIssueError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] issue operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Issue operation could not be completed." },
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
    const issues = await getKhposOpsIssues(id, user.id);
    return NextResponse.json(
      { ok: true, issues },
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
    issueId?: string;
    action?:
      | "claim"
      | "start"
      | "await"
      | "resolve"
      | "verify"
      | "close"
      | "escalate"
      | "comment";
    note?: string;
    title?: string;
    description?: string;
    category?: string;
    severity?: KhposOpsIssueSeverity;
    dueAt?: string | null;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid issue request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create") {
      if (
        !payload.title?.trim() ||
        !payload.description?.trim() ||
        !payload.category?.trim() ||
        !payload.severity ||
        !["P1", "P2", "P3", "P4"].includes(payload.severity)
      ) {
        return NextResponse.json(
          { ok: false, error: "Title, description, category and severity are required." },
          { status: 400 },
        );
      }

      if (payload.dueAt && Number.isNaN(Date.parse(payload.dueAt))) {
        return NextResponse.json(
          { ok: false, error: "Issue deadline is invalid." },
          { status: 400 },
        );
      }

      const issues = await createKhposOpsIssue(id, user.id, {
        title: payload.title.trim(),
        description: payload.description.trim(),
        category: payload.category.trim(),
        severity: payload.severity,
        dueAt: payload.dueAt ?? null,
      });
      return NextResponse.json({ ok: true, issues });
    }

    if (
      payload.mode === "action" &&
      payload.issueId &&
      UUID_RE.test(payload.issueId) &&
      payload.action
    ) {
      const issues = await actOnKhposOpsIssue(
        id,
        user.id,
        payload.issueId,
        payload.action,
        payload.note,
      );
      return NextResponse.json({ ok: true, issues });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported issue request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
