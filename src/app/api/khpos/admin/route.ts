import { NextResponse } from "next/server";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposAdminDashboard,
  KhposPlatformAdminError,
  manageKhposPlatformAdmin,
  type KhposPlatformRole,
} from "@/lib/khpos/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof KhposPlatformAdminError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  console.error("[khpos] platform admin operation failed:", error);
  return NextResponse.json(
    { ok: false, error: "Platform Administration could not complete this request." },
    { status: 500 },
  );
}

async function authenticatedUser(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(accessToken);
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    const dashboard = await getKhposAdminDashboard(user);
    return NextResponse.json(
      { ok: true, dashboard },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let payload: {
    action?: "grant" | "reactivate" | "suspend";
    targetEmail?: string;
    role?: KhposPlatformRole;
    reason?: string;
  } = {};
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid platform-governance request." },
      { status: 400 },
    );
  }

  if (
    !payload.action ||
    !payload.targetEmail ||
    !payload.role ||
    !payload.reason
  ) {
    return NextResponse.json(
      { ok: false, error: "Action, email, role and governance reason are required." },
      { status: 400 },
    );
  }

  try {
    const user = await authenticatedUser(request);
    const dashboard = await manageKhposPlatformAdmin(user, {
      action: payload.action,
      targetEmail: payload.targetEmail,
      role: payload.role,
      reason: payload.reason,
    });
    return NextResponse.json(
      { ok: true, dashboard },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
