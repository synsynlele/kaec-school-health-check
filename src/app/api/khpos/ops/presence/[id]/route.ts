import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { actOnPresence, getPresenceWorkspace, KhposPresenceError } from "@/lib/khpos/ops/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Preview must be bound to an isolated Supabase branch before this feature is usable.
function verifyPreviewIsolation() {
  if (process.env.VERCEL_ENV !== "preview") return;
  const ref = process.env.KHPOS_TEACHING_PREVIEW_DB_REF?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!ref || !/^[a-z0-9]{20}$/.test(ref) || !url) {
    throw new KhposPresenceError("Teaching preview requires an isolated Supabase branch.", 503);
  }
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); }
  catch { throw new KhposPresenceError("Invalid preview Supabase URL.", 503); }
  if (ref === "rlpciatblisxnuuiekkf" || hostname !== ref + ".supabase.co") {
    throw new KhposPresenceError("Teaching preview cannot use the live KHP-OS database.", 503);
  }
}
const MODES = new Set(["pilot_enable","school_in","school_out","period_add","period_disable","class_in","class_out","hqls_create","hqls_acknowledge","hqls_enable","school_reconcile","class_reconcile"]);
function responseError(cause: unknown) {
  if (cause instanceof KhposAuthError || cause instanceof KhposPresenceError) {
    return NextResponse.json({ ok:false, error:cause.message }, { status:cause.status, headers:{ "Cache-Control":"private, no-store" } });
  }
  console.error("[khpos][presence] operation failed:",cause);
  return NextResponse.json({ ok:false, error:"Attendance or teaching observation could not be processed." }, { status:500 });
}
async function actor(request: Request) {
  const token = bearerTokenFromRequest(request);
  if (!token) throw new KhposAuthError("Sign in to continue.",401);
  return verifyKhposAccessToken(token);
}
function validId(id: string) {
  if (!UUID_RE.test(id)) throw new KhposPresenceError("School not found.",404);
}
export async function GET(request: Request, context: { params: Promise<{ id:string }> }) {
  try {
    verifyPreviewIsolation();
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    return NextResponse.json({ok:true,workspace:await getPresenceWorkspace(id,user.id)},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(cause) { return responseError(cause); }
}
export async function POST(request: Request, context: { params: Promise<{ id:string }> }) {
  try {
    verifyPreviewIsolation();
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    let payload: unknown;
    try { payload = await request.json(); } catch { throw new KhposPresenceError("Invalid request."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new KhposPresenceError("Invalid request.");
    const body=payload as Record<string,unknown>;
    if (typeof body.mode !== "string" || !MODES.has(body.mode)) throw new KhposPresenceError("Unsupported attendance action.");
    for (const field of ["campusId","streamId","periodId","classSessionId","observationId","presenceId"]) {
      if (body[field]!=null && body[field]!=="" && (typeof body[field]!=="string" || !UUID_RE.test(body[field] as string))) {
        throw new KhposPresenceError("Invalid record reference.");
      }
    }
    if (body.mode==="hqls_create") {
      if (typeof body.requestKey!=="string" || !UUID_RE.test(body.requestKey)) throw new KhposPresenceError("Observation request reference is invalid.");
      const data=body.domains;
      if (!Array.isArray(data) || data.length>8 || data.length===0) throw new KhposPresenceError("Select the observed HQLS stages.");
      if (JSON.stringify(body).length>12000) throw new KhposPresenceError("Observation notes are too long.");
    }
    await actOnPresence(id,user.id,body.mode,body);
    return NextResponse.json({ok:true,workspace:await getPresenceWorkspace(id,user.id)},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(cause) { return responseError(cause); }
}
