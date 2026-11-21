import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getKhposPlatformAccess } from "@/lib/khpos/platform-admin";
import type { VerifiedKhposUser } from "@/lib/khpos/auth";

let client:SupabaseClient|null=null;
const db=()=>{
  if(!client){
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!secret)throw new SuccessionError("Custodian succession is unavailable.",503);
    client=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  return client;
};
export class SuccessionError extends Error {
  constructor(message:string,public status=400){super(message);this.name="SuccessionError";}
}
const uuid=z.string().uuid();
const intent=z.discriminatedUnion("mode",[
  z.object({mode:z.literal("propose"),schoolId:uuid,candidateEmail:z.email().max(254),
    reason:z.string().trim().min(20).max(3000),keepAsGuardian:z.boolean(),
    guardianCampusId:uuid.nullable().optional()}).strict(),
  z.object({mode:z.enum(["accept","decline"]),transferId:uuid}).strict(),
  z.object({mode:z.enum(["approve","reject","cancel"]),transferId:uuid,
    reason:z.string().trim().min(20).max(3000)}).strict(),
]);
export type SuccessionTransfer={
 id:string;organisation_id:string;incoming_email:string;
 outgoing_user_id:string|null;incoming_user_id:string|null;
 keep_outgoing_as_guardian:boolean;guardian_campus_id:string|null;
 reason:string;status:string;is_recovery:boolean;initiated_by:string;
 accepted_at:string|null;reviewed_at:string|null;review_note:string|null;
 completed_at:string|null;created_at:string;
};
const columns="id,organisation_id,incoming_email,outgoing_user_id,incoming_user_id,keep_outgoing_as_guardian,guardian_campus_id,reason,status,is_recovery,initiated_by,accepted_at,reviewed_at,review_note,completed_at,created_at";
async function isAdmin(userId:string){
  const a=await getKhposPlatformAccess(userId);
  return a?.status==="active"&&["super_admin","portfolio_admin"].includes(a.role);
}
async function requireCurrentSchoolCustodian(org:string,actor:string){
  const [membership,role]=await Promise.all([
    db().from("organisation_memberships").select("id").eq("organisation_id",org).eq("user_id",actor).eq("status","active").maybeSingle(),
    db().from("khpos_ops_roles").select("id").eq("organisation_id",org).eq("code","SCHOOL_CUSTODIAN").eq("status","active").maybeSingle(),
  ]);
  if(membership.error||role.error)throw new SuccessionError("Custodian appointment could not be verified.",503);
  if(!membership.data||!role.data)throw new SuccessionError("Only the active School Custodian can request ordinary succession.",403);
  const {data,error}=await db().from("khpos_ops_role_assignments").select("id,start_date,end_date,campus_id")
    .eq("role_id",role.data.id).eq("user_id",actor).eq("status","active").is("campus_id",null);
  if(error)throw new SuccessionError("Custodian appointment could not be verified.",503);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  if(!(data??[]).some(a=>a.start_date<=today&&(!a.end_date||a.end_date>=today)))
    throw new SuccessionError("Only the currently appointed school-wide Custodian can request succession.",403);
}
export async function listSuccession(user:VerifiedKhposUser,scope:string,schoolId:string|null){
  if(scope==="candidate"){
    const {data,error}=await db().from("khpos_custodian_transfers").select(columns)
      .eq("incoming_email",user.email).in("status",["awaiting_acceptance","awaiting_approval"])
      .order("created_at",{ascending:false}).limit(15);
    if(error)throw new SuccessionError("Your succession invitations could not be loaded.",503);
    const schoolIds=[...new Set((data??[]).map(row=>row.organisation_id as string))];
    const names=schoolIds.length?await db().from("organisations").select("id,name").in("id",schoolIds):null;
    if(names?.error)throw new SuccessionError("Succession schools could not be loaded.",503);
    const dict=new Map((names?.data??[]).map(row=>[row.id,row.name]));
    return {transfers:(data??[]).map(row=>({...row,schoolName:dict.get(row.organisation_id)||"School"})),canApprove:false};
  }
  if(scope==="admin"){
    if(!await isAdmin(user.id))throw new SuccessionError("Only authorised KAEC administration may review school succession.",403);
    const [q,schools,campuses]=await Promise.all([
      db().from("khpos_custodian_transfers").select(columns).order("created_at",{ascending:false}).limit(60),
      db().from("organisations").select("id,name").eq("status","active").eq("partner_status","active").order("name"),
      db().from("khpos_ops_campuses").select("id,name,organisation_id").eq("status","active"),
    ]);
    if(q.error||schools.error||campuses.error)throw new SuccessionError("Succession administration could not be loaded.",503);
    const names=new Map((schools.data??[]).map(o=>[o.id,o.name]));
    return {transfers:(q.data??[]).map(row=>({...row,schoolName:names.get(row.organisation_id)||"School"})),
      schools:schools.data??[],campuses:campuses.data??[],canApprove:user.aal==="aal2"};
  }
  if(scope!=="school"||!schoolId||!uuid.safeParse(schoolId).success)
    throw new SuccessionError("Choose a valid school.");
  await requireCurrentSchoolCustodian(schoolId,user.id);
  const [q,campuses,school]=await Promise.all([
    db().from("khpos_custodian_transfers").select(columns).eq("organisation_id",schoolId)
      .order("created_at",{ascending:false}).limit(30),
    db().from("khpos_ops_campuses").select("id,name").eq("organisation_id",schoolId).eq("status","active"),
    db().from("organisations").select("id,name").eq("id",schoolId).single(),
  ]);
  if(q.error||campuses.error||school.error)throw new SuccessionError("School succession information could not be loaded.",503);
  return {transfers:q.data??[],campuses:campuses.data??[],schoolName:school.data.name,canApprove:false};
}
export async function actSuccession(user:VerifiedKhposUser,raw:unknown){
  const parsed=intent.safeParse(raw);
  if(!parsed.success)throw new SuccessionError(parsed.error.issues[0]?.message||"Check the succession form.");
  const input=parsed.data;
  if(input.mode==="approve"||input.mode==="reject"||
     (input.mode==="propose"&&await isAdmin(user.id))){
    if(user.aal!=="aal2"&&input.mode!=="propose")
      throw new SuccessionError("Verify your administrator MFA before reviewing a change of school ownership.",403);
  }
  const args={
    p_actor:user.id,
    p_mode:input.mode,
    p_school:input.mode==="propose"?input.schoolId:null,
    p_transfer:input.mode==="propose"?null:input.transferId,
    p_incoming_email:input.mode==="propose"?input.candidateEmail.toLowerCase():null,
    p_reason:("reason" in input)?input.reason:null,
    p_keep_guardian:input.mode==="propose"?input.keepAsGuardian:true,
    p_guardian_campus:input.mode==="propose"?input.guardianCampusId||null:null,
  };
  const {data,error}=await db().rpc("khpos_custodian_transfer_action_server",args);
  if(error){
    const msg=error.message||"Succession could not be completed.";
    const safe=/^(Only|A |The |Choose|Enter|Record|School |Custodian |Outgoing |Incoming |Multiple |This |An |Unsupported|Required)/i.test(msg);
    throw new SuccessionError(safe?msg:"The succession request was not completed. Check the assignment details and try again.",safe?400:503);
  }
  return {id:data as string};
}
