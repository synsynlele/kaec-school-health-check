import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import {
  bearerTokenFromRequest,
  KhposAuthError,
  verifyKhposAccessToken,
} from "@/lib/khpos/auth";
import {
  getKhposWorkspaceSnapshot,
  KhposWorkspaceError,
} from "@/lib/khpos/workspace";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "School workspace not found." }, { status: 404 });
  }

  const accessToken = bearerTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
  }

  try {
    const user = await verifyKhposAccessToken(accessToken);
    const workspace = await getKhposWorkspaceSnapshot(id, user.id);
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    if (error instanceof KhposAuthError || error instanceof KhposWorkspaceError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    console.error("[khpos] workspace load failed:", error);
    return NextResponse.json(
      { ok: false, error: "The KHP-OS workspace could not be loaded." },
      { status: 500 },
    );
  }
}
