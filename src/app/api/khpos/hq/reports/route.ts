import {NextResponse} from "next/server";
import {bearerTokenFromRequest,verifyKhposAccessToken,KhposAuthError} from "@/lib/khpos/auth";
import {HqError} from "@/lib/khpos/hq";
import {getHqReportingDesk,createHqReportingLine,changeHqReportingLine,
 submitHqScheduledReport,reviewHqScheduledReport} from "@/lib/khpos/hq-reports";
export const runtime="nodejs";export const dynamic="force-dynamic";
function json(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});}
function fail(e:unknown){
 if(e instanceof KhposAuthError||e instanceof HqError)return json({ok:false,error:e.message},e.status);
 console.error("[kaec-hq-reports]",e);
 return json({ok:false,error:"Corporate reporting could not complete this operation."},500);
}
async function auth(req:Request){
 const token=bearerTokenFromRequest(req);if(!token)throw new KhposAuthError("Sign in first.",401);
 return verifyKhposAccessToken(token);
}
export async function GET(req:Request){
 try{return json({ok:true,desk:await getHqReportingDesk(await auth(req))});}
 catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  const user=await auth(req);
  if(Number(req.headers.get("content-length")??0)>16000)return json({ok:false,error:"Request too large."},413);
  const raw=await req.json() as Record<string,unknown>;
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new HqError("Provide a valid reporting action.");
  let desk;
  switch(raw.action){
   case "create_line":desk=await createHqReportingLine(user,raw);break;
   case "line_status":desk=await changeHqReportingLine(user,raw);break;
   case "submit_report":desk=await submitHqScheduledReport(user,raw);break;
   case "review_report":desk=await reviewHqScheduledReport(user,raw);break;
   default:throw new HqError("Unknown reporting action.");
  }
  return json({ok:true,desk});
 }catch(e){return fail(e);}
}
