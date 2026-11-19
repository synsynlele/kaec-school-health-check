import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  deriveFinancialHealth, financialInputSchema, type FinancialInput, type FinancialPeriod,
} from "./school-financial-shared";

export class FinancialHealthError extends Error {
  constructor(message:string,public status=400){super(message);this.name="FinancialHealthError";}
}
let service:SupabaseClient|null=null;
function db(){
  if(!service){
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)throw new FinancialHealthError("School financial health is not configured.",503);
    service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  return service;
}
const relevantRoles=["FINANCE_ADMIN_OFFICER","SCHOOL_CUSTODIAN","VISION_CUSTODIAN"];
const custodianCodes=["SCHOOL_CUSTODIAN","VISION_CUSTODIAN"];
export async function requireFinancialHealthAccess(schoolId:string,userId:string){
  const [school,membership,roles]=await Promise.all([
    db().from("organisations").select("id,name,status,partner_status,partner_entitlements").eq("id",schoolId).maybeSingle(),
    db().from("organisation_memberships").select("user_id").eq("organisation_id",schoolId).eq("user_id",userId).eq("status","active").maybeSingle(),
    db().from("khpos_ops_roles").select("id,code").eq("organisation_id",schoolId).eq("status","active").in("code",relevantRoles),
  ]);
  if(school.error||membership.error||roles.error)throw new FinancialHealthError("Financial access could not be verified.",503);
  const org=school.data;
  if(!org||!membership.data||org.status!=="active"||org.partner_status!=="active"
      ||!Array.isArray(org.partner_entitlements)||!org.partner_entitlements.includes("khpos_core")){
    throw new FinancialHealthError("Financial health is restricted to authorised school leaders.",403);
  }
  const roleIds=(roles.data??[]).map(r=>r.id);
  if(!roleIds.length)throw new FinancialHealthError("You are not assigned to school finance.",403);
  const {data:assignments,error}=await db().from("khpos_ops_role_assignments")
    .select("role_id,campus_id,start_date,end_date").eq("user_id",userId).eq("status","active").in("role_id",roleIds);
  if(error)throw new FinancialHealthError("Financial access could not be verified.",503);
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const eligible=(assignments??[]).filter(a=>(!a.start_date||a.start_date<=date)&&(!a.end_date||a.end_date>=date));
  // Organisation-wide reports must not leak other campuses' finances to
  // an officer appointed to only one campus. For single-campus schools that
  // campus appointment naturally covers the complete school ledger.
  const {count:campusCount,error:campusError}=await db().from("khpos_ops_campuses")
    .select("id",{count:"exact",head:true}).eq("organisation_id",schoolId).eq("status","active");
  if(campusError)throw new FinancialHealthError("School financial scope could not be verified.",503);
  const activeCodes=new Set(eligible.filter(a=>
    a.campus_id===null || (campusCount??0)<=1
  ).map(a=>roles.data?.find(r=>r.id===a.role_id)?.code).filter(Boolean));
  if(!activeCodes.size)throw new FinancialHealthError(
    "School-wide financial health needs a school-wide appointment when the school has multiple campuses.",403
  );
  return {schoolId,schoolName:org.name as string,userId,
    canEdit:relevantRoles.some(code=>activeCodes.has(code)),
    canApprove:custodianCodes.some(code=>activeCodes.has(code)),
    financeAdmin:activeCodes.has("FINANCE_ADMIN_OFFICER")};
}
const columns="id,school_id,period_start,period_end,fee_income,other_income,operating_expenses,cash_available,outstanding_fees,learner_count,school_capacity,break_even_target,source_note,management_note,status,review_note,created_by,updated_by,approved_by,approved_at,created_at,updated_at";
export async function listFinancialPeriods(schoolId:string){
  const {data,error}=await db().from("khpos_school_financial_periods").select(columns)
    .eq("school_id",schoolId).order("period_end",{ascending:false}).limit(120);
  if(error)throw new FinancialHealthError("School financial records could not be loaded.",503);
  return (data??[]) as unknown as FinancialPeriod[];
}
export async function financialSummaryForDates(schoolId:string,start:string,end:string){
  const {data,error}=await db().from("khpos_school_financial_periods").select(columns)
    .eq("school_id",schoolId).eq("status","approved")
    .gte("period_start",start).lte("period_end",end)
    .order("period_start",{ascending:true}).limit(240);
  if(error)throw new FinancialHealthError("Financial source records could not be loaded.",503);
  return deriveFinancialHealth((data??[]) as unknown as FinancialPeriod[],start,end);
}
function inputColumns(v:FinancialInput){
  return {period_start:v.periodStart,period_end:v.periodEnd,
    fee_income:v.feeIncome,other_income:v.otherIncome,operating_expenses:v.operatingExpenses,
    cash_available:v.cashAvailable,outstanding_fees:v.outstandingFees,
    learner_count:v.learnerCount,school_capacity:v.schoolCapacity,
    break_even_target:v.breakEvenTarget,
    source_note:v.sourceNote,management_note:v.managementNote};
}
export async function saveFinancialPeriod(schoolId:string,userId:string,raw:unknown){
  const access=await requireFinancialHealthAccess(schoolId,userId);
  if(!access.canEdit)throw new FinancialHealthError("Only authorised school finance staff can save records.",403);
  const body=raw as {id?:unknown;input?:unknown};
  const parse=financialInputSchema.safeParse(body.input);
  if(!parse.success)throw new FinancialHealthError(parse.error.issues[0]?.message||"Review the financial figures.");
  const val=parse.data;
  const duration=(Date.parse(val.periodEnd)-Date.parse(val.periodStart))/86400000;
  if(duration>366)throw new FinancialHealthError("Choose a financial period of 12 months or less.");
  if(val.schoolCapacity>0&&val.learnerCount>val.schoolCapacity*2)throw new FinancialHealthError("Confirm enrolment and school capacity.");
  const input={...inputColumns(val),updated_by:userId,updated_at:new Date().toISOString()};
  const id=body.id;
  if(id!==undefined){
    if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))throw new FinancialHealthError("Invalid financial record reference.");
    const {data,error}=await db().from("khpos_school_financial_periods").update(input)
      .eq("school_id",schoolId).eq("id",id).in("status",["draft","returned"]).select("id").maybeSingle();
    if(error)throw new FinancialHealthError("Financial periods cannot overlap or this record could not be updated.");
    if(!data)throw new FinancialHealthError("Only draft or returned periods can be edited.",409);
    return data.id as string;
  }
  const {data,error}=await db().from("khpos_school_financial_periods")
    .insert({...input,school_id:schoolId,created_by:userId}).select("id").single();
  if(error||!data)throw new FinancialHealthError("This financial period overlaps an existing period or cannot be saved.");
  return data.id as string;
}
export async function transitionFinancialPeriod(
  schoolId:string,userId:string,id:string,mode:"submit"|"return"|"approve",reviewNote="",
){
  const access=await requireFinancialHealthAccess(schoolId,userId);
  if(mode==="approve"||mode==="return"){
    if(!access.canApprove)throw new FinancialHealthError("Only the School Custodian can approve or return financial figures.",403);
  } else if(!access.canEdit)throw new FinancialHealthError("Only authorised school finance staff can submit financial records.",403);
  const current=await db().from("khpos_school_financial_periods")
    .select("id,status,period_end,created_by").eq("school_id",schoolId).eq("id",id).maybeSingle();
  if(current.error)throw new FinancialHealthError("Financial record could not be verified.",503);
  if(!current.data)throw new FinancialHealthError("Financial record not found for this school.",404);
  const record=current.data;
  if(mode==="submit"&&!["draft","returned"].includes(record.status))throw new FinancialHealthError("Only drafts and returned records can be submitted.",409);
  if(mode!=="submit"&&record.status!=="submitted")throw new FinancialHealthError("The Custodian can only review a submitted record.",409);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(mode==="approve"&&record.period_end>today)throw new FinancialHealthError("Approve the financial period only after it has ended.",409);
  const comment=reviewNote.trim();
  if((mode==="approve"||mode==="return")&&(comment.length<10||comment.length>1000))
    throw new FinancialHealthError("The Custodian must record an approval or return note (10–1,000 characters).");
  const update={
    status: mode==="submit"?"submitted":mode==="approve"?"approved":"returned",
    review_note:mode==="submit"?"":comment,
    updated_by:userId,updated_at:new Date().toISOString(),
    approved_by:mode==="approve"?userId:null,
    approved_at:mode==="approve"?new Date().toISOString():null,
  };
  const {data,error}=await db().from("khpos_school_financial_periods").update(update)
    .eq("school_id",schoolId).eq("id",id)
    .eq("status",mode==="submit"?record.status:"submitted").select("id").maybeSingle();
  if(error||!data)throw new FinancialHealthError("This record has already changed. Reload and review it.",409);
  return data.id as string;
}
