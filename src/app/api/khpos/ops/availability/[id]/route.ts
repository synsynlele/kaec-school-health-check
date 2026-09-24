import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsAvailabilityCase,
  actOnKhposOpsCoverage,
  assignKhposOpsCoverage,
  createKhposOpsAvailabilityCase,
  getKhposOpsAvailability,
  KhposOpsAvailabilityError,
  type KhposOpsAvailabilityCaseType,
  type KhposOpsAvailabilitySource,
} from "@/lib/khpos/ops/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsAvailabilityError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] availability operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Availability operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

function validTimestamp(value: string | undefined) {
  return !!value && !Number.isNaN(Date.parse(value));
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
    const availability = await getKhposOpsAvailability(id, user.id);
    return NextResponse.json(
      { ok: true, availability },
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
    mode?: "create_case" | "case_action" | "assign_coverage" | "coverage_action";
    staffId?: string;
    caseId?: string;
    coverageId?: string;
    caseType?: KhposOpsAvailabilityCaseType;
    sourceType?: KhposOpsAvailabilitySource;
    startAt?: string;
    endAt?: string;
    reasonCategory?: string;
    reasonNote?: string | null;
    sourceReference?: string | null;
    coverageRequired?: boolean | null;
    action?:
      | "approve"
      | "decline"
      | "cancel"
      | "require_coverage"
      | "confirm_coverage"
      | "return"
      | "close"
      | "accept"
      | "complete";
    note?: string | null;
    coverAssignmentId?: string;
    scope?: string;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid availability request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create_case") {
      if (
        !payload.staffId ||
        !UUID_RE.test(payload.staffId) ||
        !payload.caseType ||
        !payload.sourceType ||
        !validTimestamp(payload.startAt) ||
        !validTimestamp(payload.endAt) ||
        !payload.reasonCategory
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Staff, case type, source, period and reason category are required.",
          },
          { status: 400 },
        );
      }

      const availability = await createKhposOpsAvailabilityCase(id, user.id, {
        staffId: payload.staffId,
        caseType: payload.caseType,
        sourceType: payload.sourceType,
        startAt: payload.startAt!,
        endAt: payload.endAt!,
        reasonCategory: payload.reasonCategory,
        reasonNote: payload.reasonNote?.trim() || null,
        sourceReference: payload.sourceReference?.trim() || null,
        coverageRequired: payload.coverageRequired === true,
      });

      return NextResponse.json({ ok: true, availability });
    }

    if (
      payload.mode === "case_action" &&
      payload.caseId &&
      UUID_RE.test(payload.caseId) &&
      payload.action &&
      [
        "approve",
        "decline",
        "cancel",
        "require_coverage",
        "confirm_coverage",
        "return",
        "close",
      ].includes(payload.action)
    ) {
      const availability = await actOnKhposOpsAvailabilityCase(id, user.id, {
        caseId: payload.caseId,
        action: payload.action as
          | "approve"
          | "decline"
          | "cancel"
          | "require_coverage"
          | "confirm_coverage"
          | "return"
          | "close",
        note: payload.note?.trim() || null,
        coverageRequired:
          typeof payload.coverageRequired === "boolean"
            ? payload.coverageRequired
            : null,
      });

      return NextResponse.json({ ok: true, availability });
    }

    if (
      payload.mode === "assign_coverage" &&
      payload.caseId &&
      UUID_RE.test(payload.caseId) &&
      payload.coverAssignmentId &&
      UUID_RE.test(payload.coverAssignmentId) &&
      validTimestamp(payload.startAt) &&
      validTimestamp(payload.endAt) &&
      payload.scope?.trim()
    ) {
      const availability = await assignKhposOpsCoverage(id, user.id, {
        caseId: payload.caseId,
        coverAssignmentId: payload.coverAssignmentId,
        startAt: payload.startAt!,
        endAt: payload.endAt!,
        scope: payload.scope.trim(),
      });

      return NextResponse.json({ ok: true, availability });
    }

    if (
      payload.mode === "coverage_action" &&
      payload.coverageId &&
      UUID_RE.test(payload.coverageId) &&
      payload.action &&
      ["accept", "decline", "complete", "cancel"].includes(payload.action)
    ) {
      const availability = await actOnKhposOpsCoverage(id, user.id, {
        coverageId: payload.coverageId,
        action: payload.action as
          | "accept"
          | "decline"
          | "complete"
          | "cancel",
        note: payload.note?.trim() || null,
      });

      return NextResponse.json({ ok: true, availability });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported availability request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
