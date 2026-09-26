import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { actOnExtendedWorkspace, readExtendedWorkspace, type ExtendedWorkspace } from "@/lib/khpos/ops/extended";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const types: ExtendedWorkspace[] = ["events", "parent-journeys", "network-pulse"];

async function handler(request: Request, context: { params: Promise<{ id: string }> }, write: boolean) {
  const { id } = await context.params;
  const type = new URL(request.url).searchParams.get("type") as ExtendedWorkspace | null;
  if (!UUID_RE.test(id) || !type || !types.includes(type)) return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });
  try {
    const token = bearerTokenFromRequest(request);
    if (!token) return NextResponse.json({ ok: false, error: "Sign in to continue." }, { status: 401 });
    const user = await verifyKhposAccessToken(token);
    let workspace: unknown;
    if (write) {
      if (type === "network-pulse") return NextResponse.json({ ok: false, error: "The network pulse is read only." }, { status: 405 });
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
      const { mode, input } = body as { mode?: unknown; input?: unknown };
      if (typeof mode !== "string" || !input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ ok: false, error: "Invalid action." }, { status: 400 });
      workspace = await actOnExtendedWorkspace(type, user.id, id, mode, input as Record<string, unknown>);
    } else workspace = await readExtendedWorkspace(type, user.id, id);
    return NextResponse.json({ ok: true, workspace }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace unavailable.";
    return NextResponse.json({ ok: false, error: message }, { status: /membership|active school role|active leadership role|access required/i.test(message) ? 403 : 400, headers: { "Cache-Control": "private, no-store" } });
  }
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { return handler(request, context, false); }
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return handler(request, context, true); }
