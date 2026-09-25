import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getAssets, assetAction } from "@/lib/khpos/ops/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function access(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) throw new Error("Invalid school workspace.");
  const token = bearerTokenFromRequest(request);
  if (!token) throw new Error("Sign in to continue.");
  const user = await verifyKhposAccessToken(token);
  return { id, actor: user.id };
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Asset operation failed.";
  return NextResponse.json({ ok: false, error: message }, { status: /sign in/i.test(message) ? 401 : /not configured|function .* does not exist/i.test(message) ? 503 : 400, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(request: Request, context: Context) {
  try { const { id, actor } = await access(request, context); return NextResponse.json({ ok: true, assets: await getAssets(id, actor) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { id, actor } = await access(request, context);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid asset request.");
    const payload = body as Record<string, unknown>;
    if (typeof payload.mode !== "string" || !["create","report_fault","submit_service","resubmit_service","return_service","verify_service","retire"].includes(payload.mode)) throw new Error("Unsupported asset action.");
    const { mode, ...input } = payload;
    return NextResponse.json({ ok: true, assets: await assetAction(id, actor, mode, input) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
