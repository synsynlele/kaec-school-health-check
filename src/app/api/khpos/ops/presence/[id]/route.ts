import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { actOnPresence, getPresenceWorkspace, KhposPresenceError } from "@/lib/khpos/ops/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MODES = new Set(["school_in","school_out","period_add","period_disable","class_in","class_out","hqls_create","hqls_acknowledge"]);
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
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    return NextResponse.json({ok:true,workspace:await getPresenceWorkspace(id,user.id)},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(cause) { return responseError(cause); }
}
export async function POST(request: Request, context: { params: Promise<{ id:string }> }) {
  try {
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    let payload: unknown;
    try { payload = await request.json(); } catch { throw new KhposPresenceError("Invalid request."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new KhposPresenceError("Invalid request.");
    const body=payload as Record<string,unknown>;
    if (typeof body.mode !== "string" || !MODES.has(body.mode)) throw new KhposPresenceError("Unsupported attendance action.");
    for (const field of ["campusId","streamId","periodId","classSessionId","observationId"]) {
      if (body[field]!=null && body[field]!=="" && (typeof body[field]!=="string" || !UUID_RE.test(body[field] as string))) {
        throw new KhposPresenceError("Invalid record reference.");
      }
    }
    if (body.mode==="hqls_create") {
      const data=body.domains;
      if (!Array.isArray(data) || data.length>8 || data.length===0) throw new KhposPresenceError("Select the observed HQLS stages.");
      if (JSON.stringify(body).length>12000) throw new KhposPresenceError("Observation notes are too long.");
    }
    await actOnPresence(id,user.id,body.mode,body);
    return NextResponse.json({ok:true,workspace:await getPresenceWorkspace(id,user.id)},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(cause) { return responseError(cause); }
}
