import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getCulture, cultureAction } from "@/lib/khpos/ops/culture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const modes = new Set(["report", "triage", "create_action", "submit_action", "verify_action", "return_action", "submit_case", "verify_case", "refer_safeguarding"]);
async function access(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) throw new Error("Invalid school workspace.");
  const token = bearerTokenFromRequest(request);
  if (!token) throw new Error("Sign in to continue.");
  const user = await verifyKhposAccessToken(token);
  return { id, actor: user.id };
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Culture operation failed.";
  return NextResponse.json({ ok: false, error: message }, { status: /sign in/i.test(message) ? 401 : /not configured|function .* does not exist/i.test(message) ? 503 : 400 });
}
export async function GET(request: Request, context: Context) {
  try {
    const { id, actor } = await access(request, context);
    return NextResponse.json({ ok: true, culture: await getCulture(id, actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { id, actor } = await access(request, context);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid culture request.");
    const payload = body as Record<string, unknown>;
    if (typeof payload.mode !== "string" || !modes.has(payload.mode)) throw new Error("Unsupported culture action.");
    const { mode, ...input } = payload;
    return NextResponse.json({ ok: true, culture: await cultureAction(id, actor, mode, input) });
  } catch (error) { return failure(error); }
}
