import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposOpsStructure,
  KhposOpsStructureError,
} from "@/lib/khpos/ops/structure";

export const runtime = "nodejs";

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

  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Sign in to continue." },
      { status: 401 },
    );
  }

  try {
    const user = await verifyKhposAccessToken(accessToken);
    const structure = await getKhposOpsStructure(id, user.id);

    return NextResponse.json(
      { ok: true, structure },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposOpsStructureError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    console.error("[khpos][ops] structure load failed:", error);
    return NextResponse.json(
      { ok: false, error: "Institutional structure could not be loaded." },
      { status: 500 },
    );
  }
}
