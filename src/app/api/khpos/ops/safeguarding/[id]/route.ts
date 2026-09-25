import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { getSafeguarding, safeguardingAction } from "@/lib/khpos/ops/safeguarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const modes = new Set(["designate", "report", "triage", "record_step", "close"]);
async function access(request: Request, context: Context) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) throw new Error("Invalid school workspace.");
  const token = bearerTokenFromRequest(request);
  if (!token) throw new Error("Sign in to continue.");
  const user = await verifyKhposAccessToken(token);
  return { id, actor: user.id };
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Safeguarding operation failed.";
  return NextResponse.json({ ok: false, error: message }, { status: /sign in/i.test(message) ? 401 : /not configured|function .* does not exist/i.test(message) ? 503 : 400, headers: { "Cache-Control": "private, no-store" } });
}
export async function GET(request: Request, context: Context) {
  try {
    const { id, actor } = await access(request, context);
    return NextResponse.json({ ok: true, safeguarding: await getSafeguarding(id, actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { id, actor } = await access(request, context);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid safeguarding request.");
    const payload = body as Record<string, unknown>;
    if (typeof payload.mode !== "string" || !modes.has(payload.mode)) throw new Error("Unsupported safeguarding action.");
    const { mode, ...input } = payload;
    const result = await safeguardingAction(id, actor, mode, input);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
