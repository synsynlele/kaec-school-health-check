import { NextResponse } from "next/server";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getPartnerRegistry,
  KhposPartnershipError,
  managePartner,
  type KhposPartnerAction,
} from "@/lib/khpos/partnership";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const registry = await getPartnerRegistry(user);
    return response({ ok: true, registry });
  } catch (error) {
    const status =
      error instanceof KhposAuthError || error instanceof KhposPartnershipError
        ? error.status
        : 500;
    return response(
      { ok: false, error: error instanceof Error ? error.message : "Partnership Registry could not be loaded." },
      status,
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const input = (await request.json()) as {
      organisationId?: string;
      action?: KhposPartnerAction;
      reason?: string;
    };
    if (!input.organisationId || !input.action || !input.reason) {
      throw new KhposPartnershipError("Organisation, action and governance reason are required.", 400);
    }
    const registry = await managePartner(user, {
      organisationId: input.organisationId,
      action: input.action,
      reason: input.reason,
    });
    return response({ ok: true, registry });
  } catch (error) {
    const status =
      error instanceof KhposAuthError || error instanceof KhposPartnershipError
        ? error.status
        : 500;
    return response(
      { ok: false, error: error instanceof Error ? error.message : "Partnership could not be changed." },
      status,
    );
  }
}
