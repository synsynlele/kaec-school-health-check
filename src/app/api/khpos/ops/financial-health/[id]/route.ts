import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/http";
import { bearerTokenFromRequest, KhposAuthError, verifyKhposAccessToken } from "@/lib/khpos/auth";
import {
  FinancialHealthError, requireFinancialHealthAccess, listFinancialPeriods,
  saveFinancialPeriod, transitionFinancialPeriod, financialSummaryForDates,
} from "@/lib/khpos/ops/school-financial-health";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers});}
function errorReply(cause:unknown){
  if(cause instanceof KhposAuthError||cause instanceof FinancialHealthError)
    return reply({ok:false,error:cause.message},cause.status);
  console.error("[khpos] financial health action failed:",cause instanceof Error?cause.name:"unknown");
  return reply({ok:false,error:"School Financial Health could not be processed."},500);
}
async function access(request:Request,schoolId:string){
  if(!UUID_RE.test(schoolId))throw new FinancialHealthError("School not found.",404);
  const token=bearerTokenFromRequest(request);
  if(!token)throw new KhposAuthError("Sign in to open School Financial Health.",401);
  const user=await verifyKhposAccessToken(token);
  return {user,roles:await requireFinancialHealthAccess(schoolId,user.id)};
}
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params;
    const {roles}=await access(request,id);
    const q=new URL(request.url).searchParams;
    if(q.has("from")||q.has("to")){
      const from=q.get("from")||"",to=q.get("to")||"";
      if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)
        throw new FinancialHealthError("Enter a valid reporting date range.");
      const summary=await financialSummaryForDates(id,from,to);
      return reply({ok:true,summary,canApprove:roles.canApprove});
    }
    const periods=await listFinancialPeriods(id);
    return reply({ok:true,schoolName:roles.schoolName,canEdit:roles.canEdit,
      canApprove:roles.canApprove,periods});
  }catch(cause){return errorReply(cause);}
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params;
    const {user}=await access(request,id);
    const raw=await request.text();
    if(raw.length>15000)throw new FinancialHealthError("Financial record is too large.",413);
    let input:unknown;
    try{input=JSON.parse(raw);}catch{throw new FinancialHealthError("Invalid financial record.");}
    if(!input||typeof input!=="object"||Array.isArray(input))throw new FinancialHealthError("Invalid financial record.");
    const body=input as {mode?:unknown;id?:unknown;reviewNote?:unknown};
    if(body.mode!=="save"&&body.mode!=="submit"&&body.mode!=="return"&&body.mode!=="approve")
      throw new FinancialHealthError("Choose a supported finance action.");
    if(body.mode!=="save"&&(typeof body.id!=="string"||!UUID_RE.test(body.id)))
      throw new FinancialHealthError("Choose a valid financial record.");
    if(body.mode!=="save"&&body.reviewNote!==undefined&&typeof body.reviewNote!=="string")
      throw new FinancialHealthError("Approval notes must be text.");
    const saved=body.mode==="save"
      ? await saveFinancialPeriod(id,user.id,body)
      : await transitionFinancialPeriod(id,user.id,body.id as string,body.mode,(body.reviewNote as string)||"");
    return reply({ok:true,id:saved,periods:await listFinancialPeriods(id)});
  }catch(cause){return errorReply(cause);}
}
