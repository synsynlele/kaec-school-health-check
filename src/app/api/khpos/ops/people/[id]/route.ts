import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  actOnKhposOpsStaffOnboarding,
  activateKhposOpsStaff,
  createKhposOpsStaff,
  getKhposOpsPeople,
  KhposOpsPeopleError,
  linkKhposOpsStaffAccount,
  type KhposOpsEmploymentType,
  type KhposOpsOnboardingAction,
} from "@/lib/khpos/ops/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposOpsPeopleError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] people operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "People operation could not be completed." },
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
    const people = await getKhposOpsPeople(id, user.id);
    return NextResponse.json(
      { ok: true, people },
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
    mode?: "create_staff" | "link_account" | "onboarding_action" | "activate";
    displayName?: string;
    accountEmail?: string;
    employmentType?: KhposOpsEmploymentType;
    roleId?: string;
    campusId?: string | null;
    unitId?: string | null;
    startDate?: string;
    onboardingDueDate?: string | null;
    probationReviewDate?: string | null;
    staffId?: string;
    itemId?: string;
    action?: KhposOpsOnboardingAction;
    note?: string | null;
    evidenceReference?: string | null;
  } = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid people request." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);

    if (payload.mode === "create_staff") {
      if (
        !payload.displayName?.trim() ||
        !payload.accountEmail?.trim() ||
        !payload.employmentType ||
        !payload.roleId ||
        !UUID_RE.test(payload.roleId) ||
        !payload.startDate
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Staff name, account email, employment type, operating role and start date are required.",
          },
          { status: 400 },
        );
      }

      for (const value of [payload.campusId, payload.unitId]) {
        if (value && !UUID_RE.test(value)) {
          return NextResponse.json(
            { ok: false, error: "One of the staff placement identifiers is invalid." },
            { status: 400 },
          );
        }
      }

      for (const value of [
        payload.startDate,
        payload.onboardingDueDate,
        payload.probationReviewDate,
      ]) {
        if (value && Number.isNaN(Date.parse(value))) {
          return NextResponse.json(
            { ok: false, error: "One of the staff dates is invalid." },
            { status: 400 },
          );
        }
      }

      const people = await createKhposOpsStaff(id, user.id, {
        displayName: payload.displayName.trim(),
        accountEmail: payload.accountEmail.trim().toLowerCase(),
        employmentType: payload.employmentType,
        roleId: payload.roleId,
        campusId: payload.campusId || null,
        unitId: payload.unitId || null,
        startDate: payload.startDate,
        onboardingDueDate: payload.onboardingDueDate || null,
        probationReviewDate: payload.probationReviewDate || null,
      });

      return NextResponse.json({ ok: true, people });
    }

    if (
      payload.mode === "link_account" &&
      payload.staffId &&
      UUID_RE.test(payload.staffId)
    ) {
      const people = await linkKhposOpsStaffAccount(
        id,
        user.id,
        payload.staffId,
      );
      return NextResponse.json({ ok: true, people });
    }

    if (
      payload.mode === "onboarding_action" &&
      payload.staffId &&
      UUID_RE.test(payload.staffId) &&
      payload.itemId &&
      UUID_RE.test(payload.itemId) &&
      payload.action
    ) {
      const people = await actOnKhposOpsStaffOnboarding(id, user.id, {
        staffId: payload.staffId,
        itemId: payload.itemId,
        action: payload.action,
        note: payload.note?.trim() || null,
        evidenceReference: payload.evidenceReference?.trim() || null,
      });
      return NextResponse.json({ ok: true, people });
    }

    if (
      payload.mode === "activate" &&
      payload.staffId &&
      UUID_RE.test(payload.staffId)
    ) {
      const people = await activateKhposOpsStaff(id, user.id, payload.staffId);
      return NextResponse.json({ ok: true, people });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported people request." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
