import { NextResponse } from "next/server";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getUserPartnership,
  KhposPartnershipError,
} from "@/lib/khpos/partnership";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const { id } = await context.params;
    const partnership = await getUserPartnership(id, user.id);
    return NextResponse.json(
      { ok: true, partnership },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const status =
      error instanceof KhposAuthError || error instanceof KhposPartnershipError
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : "Partnership status could not be loaded.";
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
