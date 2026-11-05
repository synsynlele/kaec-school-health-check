import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import { actOnPresence, getPresenceWorkspace, getWeeklyClassRecords, getPresenceHistory, getFilteredPresenceHistory, KhposPresenceError, verifyTeachingPreviewIsolation } from "@/lib/khpos/ops/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MODES = new Set(["pilot_enable","school_in","school_out","period_add","period_edit","period_disable","class_in","class_out","hqls_create","hqls_acknowledge","hqls_enable","school_reconcile","class_reconcile"]);
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
    verifyTeachingPreviewIsolation();
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    const params = new URL(request.url).searchParams;
    if (params.get("week") === "1") {
      return NextResponse.json(await getWeeklyClassRecords(id, user.id), { headers: { "Cache-Control": "private, no-store" } });
    }
    if (params.get("history") === "1") {
      const from=params.get("from")??"";
      const to=params.get("to")??"";
      const pageRaw=params.get("page")??"0";
      const isDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(value+"T00:00:00Z"));
      if (!isDate(from) || !isDate(to) || !/^(0|[1-9]\d{0,4})$/.test(pageRaw))
        throw new KhposPresenceError("Choose valid start/end dates and a valid page.");
      if (params.get("category")) {
        const category=params.get("category")??"";
        const search=(params.get("search")??"").trim();
        const sort=params.get("sort")??"newest";
        const sizeRaw=params.get("pageSize")??"20";
        if ((category!=="school"&&category!=="class") || !["newest","oldest","name"].includes(sort)
          || !["20","50"].includes(sizeRaw) || search.length>120)
          throw new KhposPresenceError("Choose valid attendance search, sorting and page size options.");
        return NextResponse.json({ok:true,history:await getFilteredPresenceHistory(
          id,user.id,from,to,category,search,sort as "newest"|"oldest"|"name",
          Number(pageRaw),Number(sizeRaw) as 20|50
        )},{headers:{"Cache-Control":"private, no-store"}});
      }
      return NextResponse.json({ok:true,history:await getPresenceHistory(id,user.id,from,to,Number(pageRaw))},
        {headers:{"Cache-Control":"private, no-store"}});
    }
    return NextResponse.json({ok:true,workspace:await getPresenceWorkspace(id,user.id)},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch(cause) { return responseError(cause); }
}
export async function POST(request: Request, context: { params: Promise<{ id:string }> }) {
  try {
    verifyTeachingPreviewIsolation();
    const { id } = await context.params;validId(id);
    const user = await actor(request);
    let payload: unknown;
    try { payload = await request.json(); } catch { throw new KhposPresenceError("Invalid request."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new KhposPresenceError("Invalid request.");
    const body=payload as Record<string,unknown>;
    if(JSON.stringify(body).length>16000) throw new KhposPresenceError("Attendance request is too long.");
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
