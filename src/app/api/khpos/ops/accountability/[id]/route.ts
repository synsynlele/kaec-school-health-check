import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  acknowledgeKhposOpsAccountabilityOutcome,
  actOnKhposOpsAccountabilityCase,
  actOnKhposOpsCorrectiveAction,
  addKhposOpsAccountabilityEvidence,
  createKhposOpsAccountabilityCase,
  createKhposOpsCorrectiveAction,
  decideKhposOpsAccountabilityCase,
  getKhposOpsStaffAccountability,
  issueKhposOpsStaffRecognition,
  KhposOpsAccountabilityError,
  recordKhposOpsAccountabilityHearing,
  recordKhposOpsAccountabilityNoResponse,
  recordKhposOpsExternalAccountabilityReview,
  requestKhposOpsAccountabilityResponse,
  submitKhposOpsAccountabilityResponse,
  withdrawKhposOpsStaffRecognition,
  type KhposOpsAccountabilityOutcome,
} from "@/lib/khpos/ops/accountability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOpsAccountabilityError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] accountability operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Accountability operation could not be completed." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    const accountability = await getKhposOpsStaffAccountability(id, user.id);
    return NextResponse.json(
      { ok: true, accountability },
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
      { ok: false, error: "Invalid accountability request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const mode = clean(payload.mode);

    if (mode === "issue_recognition") {
      if (
        !validUuid(payload.staffId) ||
        !clean(payload.category) ||
        !clean(payload.title) ||
        !clean(payload.evidenceNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Staff, recognition category, title and specific evidence are required." },
          { status: 400 },
        );
      }

      const accountability = await issueKhposOpsStaffRecognition(id, user.id, {
        staffId: payload.staffId,
        category: clean(payload.category),
        title: clean(payload.title),
        evidenceNote: clean(payload.evidenceNote),
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "withdraw_recognition") {
      if (!validUuid(payload.recognitionId) || !clean(payload.reason)) {
        return NextResponse.json(
          { ok: false, error: "Recognition and withdrawal reason are required." },
          { status: 400 },
        );
      }
      const accountability = await withdrawKhposOpsStaffRecognition(
        id,
        user.id,
        payload.recognitionId,
        clean(payload.reason),
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "create_case") {
      if (!clean(payload.caseType) || !clean(payload.title) || !clean(payload.statement)) {
        return NextResponse.json(
          { ok: false, error: "Case type, title and specific statement are required." },
          { status: 400 },
        );
      }

      for (const key of ["subjectStaffId", "sourceCaseId"]) {
        const value = payload[key];
        if (value && !validUuid(value)) {
          return NextResponse.json(
            { ok: false, error: "One of the case references is invalid." },
            { status: 400 },
          );
        }
      }

      const accountability = await createKhposOpsAccountabilityCase(
        id,
        user.id,
        payload,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "request_response") {
      if (!validUuid(payload.caseId) || !clean(payload.responseDueAt)) {
        return NextResponse.json(
          { ok: false, error: "Case and response deadline are required." },
          { status: 400 },
        );
      }
      const accountability = await requestKhposOpsAccountabilityResponse(
        id,
        user.id,
        payload.caseId,
        clean(payload.responseDueAt),
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "submit_response") {
      if (!validUuid(payload.caseId) || !clean(payload.responseText)) {
        return NextResponse.json(
          { ok: false, error: "Case and response text are required." },
          { status: 400 },
        );
      }
      const accountability = await submitKhposOpsAccountabilityResponse(
        id,
        user.id,
        payload.caseId,
        clean(payload.responseText),
        clean(payload.evidenceReference) || null,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "record_no_response") {
      if (!validUuid(payload.caseId) || !clean(payload.note)) {
        return NextResponse.json(
          { ok: false, error: "Case and non-response note are required." },
          { status: 400 },
        );
      }
      const accountability = await recordKhposOpsAccountabilityNoResponse(
        id,
        user.id,
        payload.caseId,
        clean(payload.note),
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "add_evidence") {
      if (
        !validUuid(payload.caseId) ||
        !clean(payload.evidenceType) ||
        !clean(payload.title) ||
        !clean(payload.note)
      ) {
        return NextResponse.json(
          { ok: false, error: "Case, evidence type, title and evidence note are required." },
          { status: 400 },
        );
      }
      const accountability = await addKhposOpsAccountabilityEvidence(id, user.id, {
        caseId: payload.caseId,
        evidenceType: clean(payload.evidenceType),
        title: clean(payload.title),
        note: clean(payload.note),
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "record_hearing") {
      if (!validUuid(payload.caseId) || !clean(payload.hearingRecord)) {
        return NextResponse.json(
          { ok: false, error: "Case and hearing record are required." },
          { status: 400 },
        );
      }
      const accountability = await recordKhposOpsAccountabilityHearing(
        id,
        user.id,
        payload.caseId,
        clean(payload.hearingRecord),
        clean(payload.evidenceReference) || null,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "create_corrective_action") {
      if (
        !validUuid(payload.caseId) ||
        !clean(payload.actionType) ||
        !clean(payload.title) ||
        !clean(payload.expectedChange) ||
        !clean(payload.dueDate)
      ) {
        return NextResponse.json(
          { ok: false, error: "Corrective action type, title, expected change and due date are required." },
          { status: 400 },
        );
      }
      const accountability = await createKhposOpsCorrectiveAction(id, user.id, {
        caseId: payload.caseId,
        actionType: clean(payload.actionType),
        title: clean(payload.title),
        expectedChange: clean(payload.expectedChange),
        dueDate: clean(payload.dueDate),
      });
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "corrective_action") {
      if (!validUuid(payload.actionId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Corrective action and operation are required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      if (!["start", "submit_evidence", "verify", "reopen", "cancel"].includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported corrective action operation." },
          { status: 400 },
        );
      }
      const accountability = await actOnKhposOpsCorrectiveAction(id, user.id, {
        actionId: payload.actionId,
        action: action as "start" | "submit_evidence" | "verify" | "reopen" | "cancel",
        note: clean(payload.note) || null,
        evidenceReference: clean(payload.evidenceReference) || null,
      });
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "decide_case" || mode === "record_external_review") {
      if (
        !validUuid(payload.caseId) ||
        !clean(payload.outcome) ||
        !clean(payload.outcomeNote)
      ) {
        return NextResponse.json(
          { ok: false, error: "Case, outcome and reasoned outcome note are required." },
          { status: 400 },
        );
      }

      const outcome = clean(payload.outcome) as KhposOpsAccountabilityOutcome;

      const accountability =
        mode === "record_external_review"
          ? await recordKhposOpsExternalAccountabilityReview(id, user.id, {
              caseId: payload.caseId,
              outcome,
              outcomeNote: clean(payload.outcomeNote),
              externalReviewReference: clean(payload.externalReviewReference),
            })
          : await decideKhposOpsAccountabilityCase(id, user.id, {
              caseId: payload.caseId,
              outcome,
              outcomeNote: clean(payload.outcomeNote),
              authorityReviewReference:
                clean(payload.authorityReviewReference) || null,
            });

      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "acknowledge_outcome") {
      if (!validUuid(payload.caseId)) {
        return NextResponse.json(
          { ok: false, error: "Case is required." },
          { status: 400 },
        );
      }
      const accountability = await acknowledgeKhposOpsAccountabilityOutcome(
        id,
        user.id,
        payload.caseId,
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    if (mode === "case_action") {
      if (!validUuid(payload.caseId) || !clean(payload.action)) {
        return NextResponse.json(
          { ok: false, error: "Case and case action are required." },
          { status: 400 },
        );
      }
      const action = clean(payload.action);
      const allowed = [
        "acknowledge_grievance",
        "refer_formal",
        "resolve_corrective",
        "withdraw_grievance",
        "cancel",
        "close",
      ] as const;
      if (!(allowed as readonly string[]).includes(action)) {
        return NextResponse.json(
          { ok: false, error: "Unsupported accountability case action." },
          { status: 400 },
        );
      }
      const accountability = await actOnKhposOpsAccountabilityCase(
        id,
        user.id,
        payload.caseId,
        action as (typeof allowed)[number],
        clean(payload.note) || null,
      );
      return NextResponse.json({ ok: true, accountability });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported accountability request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
