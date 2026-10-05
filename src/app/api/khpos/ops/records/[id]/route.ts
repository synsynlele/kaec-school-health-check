import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposOperationalRecords,
  KhposOperationalRecordsError,
} from "@/lib/khpos/ops/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (
    error instanceof KhposAuthError ||
    error instanceof KhposOperationalRecordsError
  ) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }

  console.error("[khpos][ops] operational records failed:", error);
  return NextResponse.json(
    { ok: false, error: "Operational records could not be loaded." },
    { status: 500 },
  );
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
    const token = bearerTokenFromRequest(request);
    if (!token) throw new KhposAuthError("Sign in to continue.", 401);
    const user = await verifyKhposAccessToken(token);
    const records = await getKhposOperationalRecords(id, user.id);
    return NextResponse.json(
      { ok: true, records },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
