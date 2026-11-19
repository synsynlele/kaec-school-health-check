import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, verifyKhposAccessToken, KhposAuthError } from "@/lib/khpos/auth";
import {
  CustodianReportError, requireSchoolCustodian, getCustodianReports, getCustodianReport,
  saveCustodianReport, approveCustodianReport
} from "@/lib/khpos/ops/custodian-investor-reports";
import { makeCustodianReportPdf, makeCustodianReportDocx } from "@/lib/khpos/ops/custodian-report-export";
import { financialSummaryForDates } from "@/lib/khpos/ops/school-financial-health";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function fail(error:unknown) {
  if(error instanceof KhposAuthError||error instanceof CustodianReportError)
    return NextResponse.json({ok:false,error:error.message},{status:error.status,headers:privateHeaders});
  console.error("[khpos] custodian reporting failure",error instanceof Error?error.name:"unknown");
  return NextResponse.json({ok:false,error:"The custodian report could not be processed."},{status:500,headers:privateHeaders});
}
async function contextFor(request:Request, id:string) {
  if(!UUID_RE.test(id))throw new CustodianReportError("School not found.",404);
  const token=bearerTokenFromRequest(request);
  if(!token)throw new KhposAuthError("Sign in to open school reports.",401);
  const user=await verifyKhposAccessToken(token);
  const school=await requireSchoolCustodian(id,user.id);
  return {school,user};
}
export async function GET(request:Request, context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const {school}=await contextFor(request,id);
    const search=new URL(request.url).searchParams;
    const format=search.get("format");
    if(search.get("summary")==="1"){
      const from=search.get("from")||"",to=search.get("to")||"";
      if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)
        throw new CustodianReportError("Choose a valid term start and end date.");
      const summary=await financialSummaryForDates(id,from,to);
      return NextResponse.json({ok:true,summary},{headers:privateHeaders});
    }

    if(!format) {
      return NextResponse.json({ok:true,schoolName:school.schoolName,reports:await getCustodianReports(id)},{headers:privateHeaders});
    }
    if(format!=="pdf"&&format!=="docx")throw new CustodianReportError("Choose PDF or Word.",400);
    const reportId=search.get("report");
    if(!reportId||!UUID_RE.test(reportId))throw new CustodianReportError("Choose a valid report.",400);
    const report=await getCustodianReport(id,reportId);
    // Only the signed-in Custodian can download. No public or investor URLs.
    const bytes=format==="pdf" ? await makeCustodianReportPdf(report,school.schoolName)
                               : makeCustodianReportDocx(report,school.schoolName);
    const type=format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const name="KAEC-Confidential-"+report.term_label.replace(/[^a-zA-Z0-9-]+/g,"-").slice(0,60)+"."+format;
    return new Response(Uint8Array.from(bytes).buffer,{status:200,headers:{
      ...privateHeaders,"Content-Type":type,
      "Content-Disposition":'attachment; filename="'+name+'"',
    }});
  } catch(error){return fail(error);}
}
export async function POST(request:Request, context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const {user}=await contextFor(request,id);
    const raw=await request.text();
    if(raw.length>30000)throw new CustodianReportError("Report input is too long.",413);
    let input:unknown;
    try{input=JSON.parse(raw);}catch{throw new CustodianReportError("Invalid report form.");}
    if(!input||typeof input!=="object"||Array.isArray(input))throw new CustodianReportError("Invalid report form.");
    const mode=(input as {mode?:unknown}).mode;
    const reportId=mode==="save"
      ? await saveCustodianReport(id,user.id,input)
      : mode==="approve"
      ? await approveCustodianReport(id,user.id,input)
      : (()=>{throw new CustodianReportError("Unsupported report action.");})();
    return NextResponse.json({ok:true,id:reportId,reports:await getCustodianReports(id)},{headers:privateHeaders});
  }catch(error){return fail(error);}
}
