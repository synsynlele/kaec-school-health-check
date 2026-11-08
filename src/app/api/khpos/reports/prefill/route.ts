import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import { getReports } from "@/lib/khpos/reports";
import { getOwnClassRecordsForReport } from "@/lib/khpos/ops/presence";
import { buildEvidencePrefill } from "@/lib/khpos/report-prefill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const token=bearerTokenFromRequest(request);
    if(!token)throw new KhposAuthError("Sign in to use report pre-fill.",401);
    const actor=await verifyKhposAccessToken(token);
    const params=new URL(request.url).searchParams;
    const school=params.get("school"),reportId=params.get("report");
    if(!school||!reportId||!UUID_RE.test(school)||!UUID_RE.test(reportId))
      return NextResponse.json({error:"Select a valid report."},{status:400,headers});
    // Reuse the reporting RPC's independent author/school/campus role checks.
    const workspace=await getReports(actor.id,school,{view:"mine",report:reportId});
    const report=workspace.items.find(r=>r.id===reportId && r.isMine && r.canEdit);
    if(!report) return NextResponse.json({error:"This report is not an editable assignment belonging to you."},{status:403,headers});
    // Fresh logged class data is available only from the signed-in user's
    // authorised visible periods; never query other staff's report answers.
    const sessions=await getOwnClassRecordsForReport(school,actor.id,report.period_start,report.period_end);
    const prefill=buildEvidencePrefill(report,sessions,school);
    if(sessions.tooMany) {
      prefill.narrative="";
      prefill.recordCount=0;
      prefill.suggested=[];
      prefill.caveat="This period contains too many logged sessions to summarise accurately here. Review the source attendance history; nothing has been pre-filled.";
    }
    return NextResponse.json({ok:true,prefill},{headers});
  } catch(cause) {
    const status=cause instanceof KhposAuthError?cause.status:500;
    console.warn("[khpos][report_prefill] rejected",cause instanceof Error?cause.name:"unknown");
    return NextResponse.json({error:status===500?"Verified report evidence is temporarily unavailable. You may continue entering your answers manually.":cause instanceof Error?cause.message:"Not authorised."},{status,headers});
  }
}
