import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VerifiedKhposUser } from "@/lib/khpos/auth";
import { HQ_ROLES, type HqRole } from "@/lib/khpos/hq";

export type SchoolEngagement = {
  id: string; organisation_id: string; engagement_status: "setup"|"active"|"paused"|"ended";
  agreement_reference: string; agreed_scope: string; contract_verified_at: string|null; contract_verified_by:string|null;
  representative_user_id: string|null; school_liaison: string;
  next_virtual_check_on: string|null; next_site_visit_on: string|null;
  updated_at: string; created_at: string;
};
export type SchoolCommitment = {
  id: string; engagement_id: string; title: string; agreed_expectation: string;
  agreement_clause: string; evidence_expected: string;
  status: "planned"|"in_progress"|"blocked"|"evidence_submitted"|"verified"|"cancelled";
  priority: "low"|"normal"|"high"|"critical"; due_on: string|null;
  next_followup_on: string|null; followup_mode: "virtual"|"onsite";
  progress_note: string; evidence_reference: string; verified_by: string|null;
  verified_at: string|null; created_by: string; updated_by:string; updated_at: string;
};
export type SchoolFollowup = {
  id: string; commitment_id: string; mode: "phone"|"whatsapp"|"video"|"email"|"site_visit";
  outcome: string; evidence_reference: string; next_followup_on: string|null;
  next_visit_on: string|null; recorded_by: string; happened_at: string; created_at: string;
};
export type SchoolDeskSnapshot = {
  viewer: { userId: string; role: HqRole; aal: string };
  organisations: {id:string;name:string;partner_status:string}[];
  members: {user_id:string;display_name:string;role:string;status:string}[];
  engagements: SchoolEngagement[];
  commitments: SchoolCommitment[];
  followups: SchoolFollowup[];
  capped: boolean; generated_at: string;
};
export class SchoolDeskError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); this.name="SchoolDeskError"; }
}
let service: SupabaseClient|null=null;
function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new SchoolDeskError("KAEC HQ database is not configured.",503);
  if (!service) service=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  return service;
}
function object(v:unknown):Record<string,unknown> {
  if(!v || typeof v!=="object" || Array.isArray(v))throw new SchoolDeskError("Invalid school action.");
  return v as Record<string,unknown>;
}
function text(v:unknown,label:string,min:number,max:number):string {
  if(typeof v!=="string" || v.trim().length<min || v.trim().length>max)
    throw new SchoolDeskError(label+" must have "+min+"–"+max+" characters.");
  return v.trim();
}
function optionalText(v:unknown,label:string,max:number):string {
  return text(v??"",label,0,max);
}
function choice<T extends string>(v:unknown,values:readonly T[],label:string):T {
  if(typeof v!=="string" || !values.includes(v as T))throw new SchoolDeskError("Invalid "+label+".");
  return v as T;
}
function uuid(v:unknown,label:string):string {
  if(typeof v!=="string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v))
    throw new SchoolDeskError("Invalid "+label+".");
  return v;
}
function dateOrNull(v:unknown,label:string):string|null {
  if(v===null || v==="" || v===undefined)return null;
  const d=text(v,label,10,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d+"T00:00:00Z")))
    throw new SchoolDeskError("Invalid "+label+" date.");
  return d;
}
type Member={user_id:string;email:string;role:HqRole;status:string};
async function actorFor(user:VerifiedKhposUser):Promise<Member> {
  const {data,error}=await db().from("kaec_hq_members").select("user_id,email,role,status").eq("user_id",user.id).maybeSingle();
  if(error)throw new SchoolDeskError("Corporate role could not be checked.",503);
  if(!data || data.status!=="active" || data.email.toLowerCase()!==user.email || !HQ_ROLES.includes(data.role))
    throw new SchoolDeskError("An active KAEC corporate role is required.",403);
  if(!["vision_custodian","system_steward","alliance_catalyst","school_pathfinder"].includes(data.role))
    throw new SchoolDeskError("School oversight is not assigned to your corporate role.",403);
  return data as Member;
}
function requireMfa(user:VerifiedKhposUser) {
  if(user.aal!=="aal2")throw new SchoolDeskError("Verify MFA for licensed agreement activation.",403);
}
function mayGovern(member:Member) {return ["vision_custodian","alliance_catalyst"].includes(member.role);}
function maySeeAll(member:Member) {return ["vision_custodian","system_steward","alliance_catalyst"].includes(member.role);}
function canExecute(member:Member,engagement:SchoolEngagement,user:VerifiedKhposUser) {
  return mayGovern(member) || (member.role==="school_pathfinder" && engagement.representative_user_id===user.id);
}
async function loadEngagement(id:string):Promise<SchoolEngagement> {
  const {data,error}=await db().from("kaec_hq_school_engagements").select("*").eq("id",id).maybeSingle();
  if(error)throw new SchoolDeskError("School engagement could not be loaded.",503);
  if(!data)throw new SchoolDeskError("School engagement not found.",404);
  return data as SchoolEngagement;
}
async function loadCommitment(id:string):Promise<SchoolCommitment> {
  const {data,error}=await db().from("kaec_hq_school_commitments").select("*").eq("id",id).maybeSingle();
  if(error)throw new SchoolDeskError("School commitment could not be loaded.",503);
  if(!data)throw new SchoolDeskError("School commitment not found.",404);
  return data as SchoolCommitment;
}
async function validPartner(organisationId:string) {
  const {data,error}=await db().from("organisations")
    .select("id,name,status,partner_status,partner_entitlements").eq("id",organisationId).maybeSingle();
  if(error || !data)throw new SchoolDeskError("This school could not be found in the existing Partnership Registry.",404);
  if(data.name.trim().toLowerCase()==="kaec nigerian schools")
    throw new SchoolDeskError("KNS is the flagship campus, not a licensed partner school.",400);
  if(data.status!=="active" || data.partner_status!=="active" || !data.partner_entitlements?.includes("khpos_core"))
    throw new SchoolDeskError("Only schools with active KHP-OS partner entitlement can be linked.",400);
  return data as {id:string;name:string;status:string;partner_status:string;partner_entitlements:string[]};
}
async function validRepresentative(rep:string) {
  const {data,error}=await db().from("kaec_hq_members").select("user_id,role,status").eq("user_id",rep).maybeSingle();
  if(error || !data || data.status!=="active" || !["school_pathfinder","alliance_catalyst","vision_custodian"].includes(data.role))
    throw new SchoolDeskError("Assign an active School Pathfinder, Alliance Catalyst or interim Vision Custodian.",400);
}
export async function getSchoolDesk(user:VerifiedKhposUser):Promise<SchoolDeskSnapshot> {
  const member=await actorFor(user);
  let engagementQuery=db().from("kaec_hq_school_engagements").select("*").order("updated_at",{ascending:false}).limit(201);
  if(!maySeeAll(member))engagementQuery=engagementQuery.eq("representative_user_id",user.id);
  const {data:allEngagements,error:engagementError}=await engagementQuery;
  if(engagementError)throw new SchoolDeskError("School assignments could not be loaded.",503);
  const engagements=((allEngagements??[]) as SchoolEngagement[]).slice(0,200);
  const ids=engagements.map(e=>e.id);
  const {data:allCommitments,error:commitmentError}=ids.length
    ? await db().from("kaec_hq_school_commitments").select("*").in("engagement_id",ids)
      .order("updated_at",{ascending:false}).limit(301)
    : {data:[],error:null};
  if(commitmentError)throw new SchoolDeskError("School expectations could not be loaded.",503);
  const commitments=((allCommitments??[]) as SchoolCommitment[]).slice(0,300);
  const commitmentIds=commitments.map(c=>c.id);
  const {data:allFollowups,error:followupError}=commitmentIds.length
    ? await db().from("kaec_hq_school_followups").select("*").in("commitment_id",commitmentIds)
      .order("created_at",{ascending:false}).limit(301)
    : {data:[],error:null};
  if(followupError)throw new SchoolDeskError("Follow-up history could not be loaded.",503);
  const [schoolsResult,membersResult]=await Promise.all([
    mayGovern(member)
      ? db().from("organisations").select("id,name,partner_status,partner_entitlements,status")
          .eq("partner_status","active").eq("status","active").order("name").limit(150)
      : engagements.length
        ? db().from("organisations").select("id,name,partner_status,partner_entitlements,status")
            .in("id",engagements.map(e=>e.organisation_id))
        : Promise.resolve({data:[],error:null}),
    mayGovern(member)
      ? db().from("kaec_hq_members").select("user_id,display_name,role,status").order("display_name")
      : db().from("kaec_hq_members").select("user_id,display_name,role,status").eq("user_id",user.id)
  ]);
  if(schoolsResult.error || membersResult.error)throw new SchoolDeskError("School register or corporate people could not be loaded.",503);
  const organisations=((schoolsResult.data??[]) as {id:string;name:string;partner_status:string;status:string;partner_entitlements:string[]}[])
    .filter(s=>s.name.trim().toLowerCase()!=="kaec nigerian schools" &&
      s.partner_status==="active" && s.status==="active" && s.partner_entitlements?.includes("khpos_core"))
    .map(({id,name,partner_status})=>({id,name,partner_status}));
  return {viewer:{userId:user.id,role:member.role,aal:user.aal},organisations,
    members:(membersResult.data??[]) as SchoolDeskSnapshot["members"],
    engagements, commitments, followups:((allFollowups??[]) as SchoolFollowup[]).slice(0,300),
    capped:(allEngagements??[]).length>200 || (allCommitments??[]).length>300 || (allFollowups??[]).length>300,
    generated_at:new Date().toISOString()};
}
export async function createSchoolEngagement(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const member=await actorFor(user);
  if(!mayGovern(member))throw new SchoolDeskError("Only corporate partnership leads can link schools.",403);
  const input=object(raw);const organisationId=uuid(input.organisation_id,"school");
  await validPartner(organisationId);
  const {data:prior,error:lookupError}=await db().from("kaec_hq_school_engagements").select("id")
    .eq("organisation_id",organisationId).maybeSingle();
  if(lookupError)throw new SchoolDeskError("Existing engagement could not be checked.",503);
  if(prior)throw new SchoolDeskError("This school is already listed. Open its existing engagement.",409);
  const {error}=await db().from("kaec_hq_school_engagements").insert({
    organisation_id:organisationId, engagement_status:"setup", updated_by:user.id,
    agreement_reference:"",agreed_scope:"",school_liaison:""
  });
  if(error)throw new SchoolDeskError("Could not create the school setup: "+error.message,500);
  return getSchoolDesk(user);
}
export async function updateSchoolEngagement(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const actor=await actorFor(user);
  if(!mayGovern(actor))throw new SchoolDeskError("Only corporate partnership leads can edit agreements.",403);
  const input=object(raw),id=uuid(input.id,"engagement");
  const prior=await loadEngagement(id);
  if(prior.engagement_status==="ended")throw new SchoolDeskError("Ended engagements cannot be reopened silently.",409);
  const status=choice(input.engagement_status??prior.engagement_status,
    ["setup","active","paused","ended"] as const,"engagement status");
  if(actor.role!=="vision_custodian" && (status==="active" || status==="ended" ||
      prior.engagement_status==="active" || prior.contract_verified_at))
    throw new SchoolDeskError("Only the Vision Custodian can activate, end, or revise a verified agreement.",403);
  const representative=input.representative_user_id===null || input.representative_user_id===""
    ? null : (input.representative_user_id===undefined ? prior.representative_user_id : uuid(input.representative_user_id,"representative"));
  if(representative)await validRepresentative(representative);
  const reference=optionalText(input.agreement_reference??prior.agreement_reference,"Agreement reference",240);
  const scope=optionalText(input.agreed_scope??prior.agreed_scope,"Agreed scope",3000);
  const liaison=optionalText(input.school_liaison??prior.school_liaison,"School liaison",140);
  const checked=input.confirm_verified===true;
  const agreementChanged=reference!==prior.agreement_reference || scope!==prior.agreed_scope;
  if(agreementChanged && prior.contract_verified_at && !checked && status==="active")
    throw new SchoolDeskError("The agreement reference or scope changed. Re-check the actual signed terms before keeping supervision active.",409);
  if(status==="active") {
    requireMfa(user);
    await validPartner(prior.organisation_id);
    if(reference.length<6||scope.length<20||!representative)
      throw new SchoolDeskError("Before activation, provide the signed agreement reference, scope and assigned School Pathfinder.",400);
    if(!prior.contract_verified_at && !checked)
      throw new SchoolDeskError("Confirm that you checked the actual signed agreement outside HQ.",400);
  }
  if(checked && actor.role!=="vision_custodian")throw new SchoolDeskError("Only the Vision Custodian may verify the agreement.",403);
  if(checked)requireMfa(user);
  const values={
    engagement_status:status,agreement_reference:reference,agreed_scope:scope,
    representative_user_id:representative,school_liaison:liaison,
    next_virtual_check_on:dateOrNull(input.next_virtual_check_on??prior.next_virtual_check_on,"next virtual check"),
    next_site_visit_on:dateOrNull(input.next_site_visit_on??prior.next_site_visit_on,"next site visit"),
    contract_verified_at:checked?new Date().toISOString():agreementChanged?null:prior.contract_verified_at,
    contract_verified_by:checked?user.id:agreementChanged?null:prior.contract_verified_by,
    updated_by:user.id,updated_at:new Date().toISOString()
  };
  const {data,error}=await db().from("kaec_hq_school_engagements").update(values)
    .eq("id",id).eq("updated_at",prior.updated_at).select("id");
  if(error)throw new SchoolDeskError("Could not update the engagement: "+error.message,500);
  if(!data?.length)throw new SchoolDeskError("Engagement changed. Refresh and retry.",409);
  return getSchoolDesk(user);
}
export async function addSchoolCommitment(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const member=await actorFor(user);
  if(!mayGovern(member))throw new SchoolDeskError("Only partnership leads can register agreed school expectations.",403);
  const input=object(raw),engagement=await loadEngagement(uuid(input.engagement_id,"engagement"));
  if(engagement.engagement_status!=="active")throw new SchoolDeskError("Activate a verified supervision agreement before assigning commitments.",409);
  await validPartner(engagement.organisation_id);
  const title=text(input.title,"Commitment title",4,180);
  const expectation=text(input.agreed_expectation,"Agreed expectation",15,3000);
  const clause=text(input.agreement_clause,"Agreement clause or signed plan reference",4,200);
  const evidence=text(input.evidence_expected,"Evidence expected",8,800);
  const {error}=await db().from("kaec_hq_school_commitments").insert({
    engagement_id:engagement.id,title,agreed_expectation:expectation,
    agreement_clause:clause,evidence_expected:evidence,status:"planned",
    priority:choice(input.priority??"normal",["low","normal","high","critical"] as const,"priority"),
    due_on:dateOrNull(input.due_on,"due date"),next_followup_on:dateOrNull(input.next_followup_on,"follow-up date"),
    followup_mode:choice(input.followup_mode??"virtual",["virtual","onsite"] as const,"follow-up mode"),
    created_by:user.id,updated_by:user.id
  });
  if(error)throw new SchoolDeskError("Could not save the school expectation: "+error.message,500);
  return getSchoolDesk(user);
}
export async function updateSchoolCommitment(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const member=await actorFor(user),input=object(raw);
  const prior=await loadCommitment(uuid(input.id,"commitment"));
  const engagement=await loadEngagement(prior.engagement_id);
  if(!canExecute(member,engagement,user))throw new SchoolDeskError("Only the school's appointed Pathfinder or alliance lead may record progress.",403);
  if(engagement.engagement_status!=="active")throw new SchoolDeskError("This agreement is not active for execution.",409);
  await validPartner(engagement.organisation_id);
  if(prior.status==="verified" || prior.status==="cancelled")throw new SchoolDeskError("Closed expectations cannot be silently overwritten.",409);
  const status=choice(input.status,["planned","in_progress","blocked","evidence_submitted"] as const,"progress");
  const note=text(input.progress_note,"Progress or blocker note",15,3000);
  const reference=optionalText(input.evidence_reference,"Evidence reference",700);
  if(status==="evidence_submitted" && reference.length<6)
    throw new SchoolDeskError("Provide a real reference to the evidence before submitting for verification.",400);
  const {data,error}=await db().from("kaec_hq_school_commitments").update({
    status,progress_note:note,evidence_reference:reference,
    next_followup_on:dateOrNull(input.next_followup_on,"follow-up date"),
    updated_by:user.id,updated_at:new Date().toISOString()
  }).eq("id",prior.id).eq("updated_at",prior.updated_at).select("id");
  if(error)throw new SchoolDeskError("Could not log the school progress: "+error.message,500);
  if(!data?.length)throw new SchoolDeskError("This commitment was updated. Refresh and retry.",409);
  return getSchoolDesk(user);
}
export async function verifySchoolCommitment(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const actor=await actorFor(user);
  if(!mayGovern(actor))throw new SchoolDeskError("School Pathfinders cannot verify their own evidence.",403);
  const input=object(raw),prior=await loadCommitment(uuid(input.id,"commitment"));
  const engagement=await loadEngagement(prior.engagement_id);
  if(engagement.engagement_status!=="active")throw new SchoolDeskError("School engagement is not active.",409);
  await validPartner(engagement.organisation_id);
  if(prior.status!=="evidence_submitted")throw new SchoolDeskError("Only submitted evidence can be verified.",409);
  if(prior.updated_by===user.id || engagement.representative_user_id===user.id)
    throw new SchoolDeskError("An independent corporate lead must verify the Pathfinder's evidence.",403);
  const note=text(input.decision_note,"Verification reason",15,1500);
  const decision=choice(input.decision,["verify","return"] as const,"decision");
  if(prior.priority==="critical")requireMfa(user);
  const {data,error}=await db().from("kaec_hq_school_commitments").update({
    status:decision==="verify"?"verified":"in_progress",
    progress_note:note, verified_by:decision==="verify"?user.id:null,
    verified_at:decision==="verify"?new Date().toISOString():null,
    updated_by:user.id,updated_at:new Date().toISOString()
  }).eq("id",prior.id).eq("status","evidence_submitted").eq("updated_at",prior.updated_at).select("id");
  if(error)throw new SchoolDeskError("Verification could not be saved: "+error.message,500);
  if(!data?.length)throw new SchoolDeskError("This submission changed. Refresh and retry.",409);
  return getSchoolDesk(user);
}
export async function logSchoolFollowup(user:VerifiedKhposUser,raw:unknown):Promise<SchoolDeskSnapshot> {
  const actor=await actorFor(user),input=object(raw);
  const commitment=await loadCommitment(uuid(input.commitment_id,"commitment"));
  const engagement=await loadEngagement(commitment.engagement_id);
  if(!canExecute(actor,engagement,user))throw new SchoolDeskError("You are not assigned to this school.",403);
  if(engagement.engagement_status!=="active" || ["verified","cancelled"].includes(commitment.status))
    throw new SchoolDeskError("Only open commitments under an active agreement can receive follow-ups.",409);
  await validPartner(engagement.organisation_id);
  const mode=choice(input.mode,["phone","whatsapp","video","email","site_visit"] as const,"follow-up channel");
  const outcome=text(input.outcome,"Follow-up outcome",15,3000);
  const evidence=optionalText(input.evidence_reference,"Evidence reference",700);
  const nextFollowup=dateOrNull(input.next_followup_on,"next follow-up");
  const nextVisit=dateOrNull(input.next_visit_on,"next site visit");
  const {error}=await db().from("kaec_hq_school_followups").insert({
    commitment_id:commitment.id,mode,outcome,evidence_reference:evidence,
    next_followup_on:nextFollowup,next_visit_on:nextVisit,recorded_by:user.id
  });
  if(error)throw new SchoolDeskError("Could not log follow-up: "+error.message,500);
  // The immutable follow-up contains the next check date. If the owner is
  // changed or two contacts race, the latest follow-up remains authoritative.
  return getSchoolDesk(user);
}
