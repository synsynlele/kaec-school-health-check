import { NextResponse } from "next/server";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import {
  bootstrapHq, changeHqMember, completeRoutineHqRecord, createHqRecord,
  getHqSnapshot, HqError, reviewHqRecord, submitHqRecord, updateHqRecord,
} from "@/lib/khpos/hq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
function errorResponse(error: unknown) {
  if (error instanceof KhposAuthError || error instanceof HqError) {
    return json({ ok: false, error: error.message }, error.status);
  }
  console.error("[kaec-hq] request failed", error);
  return json({ ok: false, error: "KAEC HQ could not complete this request." }, 500);
}
async function authenticated(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.", 401);
  return verifyKhposAccessToken(token);
}
export async function GET(request: Request) {
  try {
    const user = await authenticated(request);
    return json({ ok: true, snapshot: await getHqSnapshot(user) });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await authenticated(request);
    if (Number(request.headers.get("content-length") ?? 0) > 24000) {
      return json({ ok: false, error: "Corporate requests must be under 24 KB." }, 413);
    }
    const payload = await request.json() as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ ok: false, error: "Invalid corporate request." }, 400);
    }
    const body = payload as Record<string, unknown>;
    let snapshot;
    switch (body.action) {
      case "bootstrap": snapshot = await bootstrapHq(user); break;
      case "create": snapshot = await createHqRecord(user, body.record); break;
      case "update": snapshot = await updateHqRecord(user, body.record); break;
      case "submit": snapshot = await submitHqRecord(user, body); break;
      case "complete": snapshot = await completeRoutineHqRecord(user, body); break;
      case "review": snapshot = await reviewHqRecord(user, body); break;
      case "member": snapshot = await changeHqMember(user, body); break;
      default: return json({ ok: false, error: "Unknown KAEC HQ operation." }, 400);
    }
    return json({ ok: true, snapshot });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ ok: false, error: "Invalid JSON request." }, 400);
    return errorResponse(error);
  }
}
