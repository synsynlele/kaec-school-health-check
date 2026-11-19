import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

let client: SupabaseClient | null = null;
function db() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new CustodianReportError("The financial report service is unavailable.", 503);
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export class CustodianReportError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "CustodianReportError"; }
}

const money = z.number().int().nonnegative().max(1_000_000_000_000_000);
const note = z.string().trim().min(10).max(5000);
export const custodianReportDataSchema = z.object({
  feeIncome: money,
  otherIncome: money,
  operatingExpenses: money,
  cashAvailable: money,
  outstandingFees: money,
  learnerCount: z.number().int().nonnegative().max(1000000),
  schoolCapacity: z.number().int().nonnegative().max(1000000),
  operationalHighlights: note,
  learningHighlights: note,
  managementRisks: note,
  nextTermPriorities: note,
  financialSourceNotes: note,
}).strict();
export type CustodianReportData = z.infer<typeof custodianReportDataSchema>;
export type CustodianReport = {
  id: string;
  school_id: string;
  term_label: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved";
  data: CustodianReportData;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
};
export const saveCustodianReportSchema = z.object({
  mode: z.literal("save"),
  id: z.string().uuid().optional(),
  termLabel: z.string().trim().min(4).max(120),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  data: custodianReportDataSchema,
}).strict().refine(v => v.periodStart <= v.periodEnd, { message: "The reporting end date must not precede the start date." });
export const approveCustodianReportSchema = z.object({
  mode: z.literal("approve"),
  id: z.string().uuid(),
}).strict();

export function custodianReportTotals(data: CustodianReportData) {
  const income = data.feeIncome + data.otherIncome;
  const operatingResult = income - data.operatingExpenses;
  const occupancy = data.schoolCapacity > 0 ? Math.round(data.learnerCount / data.schoolCapacity * 1000) / 10 : null;
  return { income, operatingResult, occupancy };
}

/**
 * Return this school's authorised Custodian context only.
 * Not an investor or school-owner membership shortcut: the user must have an
 * active SCHOOL_CUSTODIAN school-role assignment as well as active membership.
 * The service-role database key NEVER enters the browser.
 */
export async function requireSchoolCustodian(schoolId: string, actorId: string) {
  const [orgResult, membershipResult, rolesResult] = await Promise.all([
    db().from("organisations").select("id,name,status,partner_status,partner_entitlements").eq("id", schoolId).maybeSingle(),
    db().from("organisation_memberships").select("user_id,status").eq("organisation_id",schoolId).eq("user_id",actorId).eq("status","active").maybeSingle(),
    db().from("khpos_ops_roles").select("id,code,status").eq("organisation_id",schoolId).in("code",["SCHOOL_CUSTODIAN","VISION_CUSTODIAN"]).eq("status","active"),
  ]);
  if (orgResult.error || membershipResult.error || rolesResult.error) throw new CustodianReportError("Custodian access could not be verified.", 503);
  const org=orgResult.data;
  if (!org || !membershipResult.data || org.status !== "active" || org.partner_status !== "active" ||
      !Array.isArray(org.partner_entitlements) || !org.partner_entitlements.includes("khpos_core")) {
    throw new CustodianReportError("This report is available only to an active school Custodian.", 403);
  }
  const ids=(rolesResult.data ?? []).map(role=>role.id);
  if (!ids.length) throw new CustodianReportError("Only an authorised school Custodian can use investor reporting.", 403);
  const {data: assignments,error} = await db().from("khpos_ops_role_assignments")
    .select("id,start_date,end_date").eq("user_id",actorId).in("role_id",ids).eq("status","active");
  if (error) throw new CustodianReportError("Custodian access could not be verified.",503);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if (!(assignments??[]).some(a=>(!a.start_date||a.start_date<=today)&&(!a.end_date||a.end_date>=today)))
    throw new CustodianReportError("Only an authorised school Custodian can use investor reporting.",403);
  return { schoolId, schoolName: org.name as string, actorId };
}

export async function getCustodianReports(schoolId: string) {
  const {data,error}=await db().from("khpos_custodian_investor_reports")
    .select("id,school_id,term_label,period_start,period_end,status,data,created_at,updated_at,approved_at")
    .eq("school_id",schoolId).order("period_end",{ascending:false}).limit(60);
  if(error)throw new CustodianReportError("Custodian reports could not be loaded.",503);
  return (data??[]) as CustodianReport[];
}

export async function getCustodianReport(schoolId:string,id:string) {
  const {data,error}=await db().from("khpos_custodian_investor_reports")
    .select("id,school_id,term_label,period_start,period_end,status,data,created_at,updated_at,approved_at")
    .eq("school_id",schoolId).eq("id",id).maybeSingle();
  if(error)throw new CustodianReportError("The requested report could not be opened.",503);
  if(!data)throw new CustodianReportError("The report does not exist for this school.",404);
  return data as CustodianReport;
}

export async function saveCustodianReport(schoolId:string,actorId:string,raw:unknown) {
  const parsed=saveCustodianReportSchema.safeParse(raw);
  if(!parsed.success)throw new CustodianReportError(parsed.error.issues[0]?.message||"Check the financial figures and narrative.");
  const {id,termLabel,periodStart,periodEnd,data}=parsed.data;
  if(data.schoolCapacity > 0 && data.learnerCount > data.schoolCapacity * 2)
    throw new CustodianReportError("Review the enrolled learners and school capacity.");
  const common={term_label:termLabel,period_start:periodStart,period_end:periodEnd,data,updated_by:actorId,updated_at:new Date().toISOString()};
  if(id) {
    const {data:updated,error}=await db().from("khpos_custodian_investor_reports")
      .update(common).eq("school_id",schoolId).eq("id",id).eq("status","draft").select("id").maybeSingle();
    if(error)throw new CustodianReportError("This reporting period already exists or could not be saved.");
    if(!updated)throw new CustodianReportError("Approved reports cannot be edited. Create a new period or revision.",409);
    return id;
  }
  const {data:inserted,error}=await db().from("khpos_custodian_investor_reports")
    .insert({...common,school_id:schoolId,created_by:actorId}).select("id").single();
  if(error||!inserted)throw new CustodianReportError("A report for this period may already exist. Check the reporting dates.");
  return inserted.id as string;
}

export async function approveCustodianReport(schoolId:string,actorId:string,raw:unknown) {
  const parsed=approveCustodianReportSchema.safeParse(raw);
  if(!parsed.success)throw new CustodianReportError("Choose a valid report to approve.");
  const {data,error}=await db().from("khpos_custodian_investor_reports")
    .update({status:"approved",approved_by:actorId,approved_at:new Date().toISOString(),updated_by:actorId,updated_at:new Date().toISOString()})
    .eq("school_id",schoolId).eq("id",parsed.data.id).eq("status","draft")
    .select("id").maybeSingle();
  if(error||!data)throw new CustodianReportError("Only a draft report can be approved.",409);
  return data.id as string;
}
