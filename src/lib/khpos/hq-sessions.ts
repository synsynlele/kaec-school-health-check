import { evaluateAttendanceLocation } from "@/lib/khpos/attendance-location-server";
import type { AttendanceLocation } from "@/lib/khpos/attendance-location";
import { UUID_RE } from "@/lib/http";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import type {VerifiedKhposUser} from "@/lib/khpos/auth";
import {getSchoolDesk,type SchoolEngagement, SchoolDeskError} from "@/lib/khpos/hq-schools";

export type PathfinderSession={
 campus_id:string|null;check_in_location:AttendanceLocation|null;check_out_location:AttendanceLocation|null;
 id:string;engagement_id:string;representative_user_id:string;
 mode:"virtual"|"onsite";title:string;objective:string;
 scheduled_start_at:string;scheduled_end_at:string|null;
 status:"scheduled"|"checked_in"|"completed"|"cancelled";
 check_in_at:string|null;check_out_at:string|null;
 outcome_note:string;issues_note:string;resolution_note:string;
 evidence_reference:string;next_action:string;cancellation_reason:string;
 reviewed_by:string|null;reviewed_at:string|null;review_note:string;
 created_by:string;updated_by:string;created_at:string;updated_at:string;
};
export type SessionDesk={
 viewer:{userId:string;role:string;aal:string};
 sessions:PathfinderSession[];capped:boolean;generated_at:string;
};
let admin:SupabaseClient|null=null;
function db(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new SchoolDeskError("Corporate supervision service is unavailable.",503);
 if(!admin)admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
 return admin;
}
function bodyOf(x:unknown):Record<string,unknown>{
 if(!x||typeof x!=="object"||Array.isArray(x))throw new SchoolDeskError("Invalid supervision request.");
 return x as Record<string,unknown>;
}
function uuid(x:unknown,label:string):string{
 if(typeof x!=="string"||!UUID_RE.test(x))
  throw new SchoolDeskError("Invalid "+label+".");
 return x;
}
function field(x:unknown,label:string,min:number,max:number):string{
 if(typeof x!=="string"||x.trim().length<min||x.trim().length>max)
  throw new SchoolDeskError(label+" requires "+min+"–"+max+" characters.");
 return x.trim();
}
function optional(x:unknown,label:string,max:number){return field(x??"",label,0,max);}
function iso(x:unknown,label:string):string{
 const value=field(x,label,19,40);
 const d=new Date(value);
 if(!Number.isFinite(d.getTime())||!/(Z|[+-]\d\d:\d\d)$/i.test(value))
  throw new SchoolDeskError("Use a date and time with a timezone for "+label+".");
 return d.toISOString();
}
async function validCampus(campus:string,school:string){
 const {data,error}=await db().from("khpos_ops_campuses").select("id").eq("id",campus).eq("organisation_id",school).eq("status","active").maybeSingle();
 if(error||!data)throw new SchoolDeskError("Select an active campus belonging to this school.",400);
}
async function loadSession(id:string):Promise<PathfinderSession>{
 const {data,error}=await db().from("kaec_hq_pathfinder_sessions").select("*").eq("id",id).maybeSingle();
 if(error)throw new SchoolDeskError("Scheduled activity could not load.",503);
 if(!data)throw new SchoolDeskError("Scheduled activity not found.",404);
 return data as PathfinderSession;
}
async function checkAccess(user:VerifiedKhposUser,engagementId:string){
 const desk=await getSchoolDesk(user);
 const engagement=desk.engagements.find(e=>e.id===engagementId);
 if(!engagement)throw new SchoolDeskError("School is outside your assigned supervision scope.",403);
 if(engagement.engagement_status!=="active")
  throw new SchoolDeskError("A verified active school agreement is required for actual supervision.",409);
 // Prevent work under suspended platform partner entitlement.
 const {data:org,error}=await db().from("organisations").select("id,status,partner_status,partner_entitlements")
  .eq("id",engagement.organisation_id).maybeSingle();
 if(error||!org||org.status!=="active"||org.partner_status!=="active"||
   !org.partner_entitlements?.includes("khpos_core"))
  throw new SchoolDeskError("The school no longer has an active KHP-OS partner entitlement.",403);
 return {desk,engagement};
}
function govern(role:string){return role==="vision_custodian"||role==="alliance_catalyst";}
function manager(role:string){return govern(role)||role==="system_steward";}
async function updateSession(id:string,old:PathfinderSession,changes:Record<string,unknown>){
 const {data,error}=await db().from("kaec_hq_pathfinder_sessions").update({
 ...changes,updated_at:new Date().toISOString()
 }).eq("id",id).eq("status",old.status).eq("updated_at",old.updated_at).select("id");
 if(error)throw new SchoolDeskError("Session update failed: "+error.message,500);
 if(!data?.length)throw new SchoolDeskError("This session changed. Refresh before retrying.",409);
}
export async function getPathfinderSessions(user:VerifiedKhposUser):Promise<SessionDesk>{
 const desk=await getSchoolDesk(user);
 const ids=desk.engagements.map(e=>e.id);
 if(!ids.length)return {viewer:desk.viewer,sessions:[],capped:desk.capped,generated_at:new Date().toISOString()};
 let query=db().from("kaec_hq_pathfinder_sessions").select("*")
  .in("engagement_id",ids).order("scheduled_start_at",{ascending:false}).limit(301);
 if(desk.viewer.role==="school_pathfinder")query=query.eq("representative_user_id",user.id);
 const {data,error}=await query;
 if(error)throw new SchoolDeskError("Pathfinder schedules could not load.",503);
 return {viewer:desk.viewer,sessions:((data??[]) as PathfinderSession[]).slice(0,300),
  capped:desk.capped||(data??[]).length>300,generated_at:new Date().toISOString()};
}
export async function schedulePathfinder(user:VerifiedKhposUser,raw:unknown):Promise<SessionDesk>{
 const x=bodyOf(raw),engagementId=uuid(x.engagement_id,"school engagement");
 const {desk,engagement}=await checkAccess(user,engagementId);
 if(!govern(desk.viewer.role))throw new SchoolDeskError("Only the Vision Custodian or Alliance Catalyst can schedule and assign Pathfinder sessions.",403);
 const representative=engagement.representative_user_id;
 if(!representative)throw new SchoolDeskError("Appoint a School Pathfinder to this school before scheduling.",409);
 const mode=x.mode==="virtual"?"virtual":x.mode==="onsite"?"onsite":null;
 if(!mode)throw new SchoolDeskError("Select virtual or on-site supervision.");
 const campus=mode==="onsite"?uuid(x.campus_id,"campus"):null;
 if(campus)await validCampus(campus,engagement.organisation_id);
 const start=iso(x.scheduled_start_at,"scheduled start");
 const end=x.scheduled_end_at?iso(x.scheduled_end_at,"scheduled end"):null;
 if(end&&end<=start)throw new SchoolDeskError("End time must follow the starting time.");
 const {error}=await db().from("kaec_hq_pathfinder_sessions").insert({
  engagement_id:engagementId,representative_user_id:representative,mode,campus_id:campus,
  title:field(x.title,"Title",4,180),objective:field(x.objective,"Expected outcome",15,2000),
  scheduled_start_at:start,scheduled_end_at:end,status:"scheduled",
  created_by:user.id,updated_by:user.id
 });
 if(error)throw new SchoolDeskError("The session could not be scheduled: "+error.message,500);
 return getPathfinderSessions(user);
}
export async function actOnPathfinderSession(user:VerifiedKhposUser,raw:unknown):Promise<SessionDesk>{
 const x=bodyOf(raw),id=uuid(x.id,"session"),action=String(x.action);
 const old=await loadSession(id);
 const {desk,engagement}=await checkAccess(user,old.engagement_id);
 const assigned=old.representative_user_id===user.id && engagement.representative_user_id===user.id;
 const lead=govern(desk.viewer.role);
 const now=new Date().toISOString();
 const changes:Record<string,unknown>={updated_by:user.id};
 if(action==="check_in"){
  if(old.mode!=="onsite"||old.status!=="scheduled"||!assigned)
   throw new SchoolDeskError("Only the assigned Pathfinder may check into a scheduled on-site visit.",403);
  const campus=old.campus_id??uuid(x.campus_id,"visit campus");
  await validCampus(campus,engagement.organisation_id);
  changes.campus_id=campus;
  changes.check_in_location=await evaluateAttendanceLocation(x.location,campus);
  changes.status="checked_in";changes.check_in_at=now;
 }else if(action==="check_out"){
  if(old.mode!=="onsite"||old.status!=="checked_in"||!assigned)
   throw new SchoolDeskError("You must check in before completing an on-site visit.",403);
  changes.check_out_location=await evaluateAttendanceLocation(x.location,old.campus_id);
  changes.status="completed";changes.check_out_at=now;
  changes.outcome_note=field(x.outcome_note,"Actual work completed",20,3000);
  changes.issues_note=optional(x.issues_note,"Problems discovered",2000);
  changes.resolution_note=optional(x.resolution_note,"Problems resolved",2000);
  changes.evidence_reference=optional(x.evidence_reference,"Evidence reference",700);
  changes.next_action=optional(x.next_action,"Next action",1500);
 }else if(action==="complete_virtual"){
  if(old.mode!=="virtual"||old.status!=="scheduled"||!assigned)
   throw new SchoolDeskError("Only the assigned Pathfinder may complete their scheduled virtual session.",403);
  changes.status="completed";
  changes.outcome_note=field(x.outcome_note,"Actual work completed",20,3000);
  changes.issues_note=optional(x.issues_note,"Problems discovered",2000);
  changes.resolution_note=optional(x.resolution_note,"Problems resolved",2000);
  changes.evidence_reference=optional(x.evidence_reference,"Evidence reference",700);
  changes.next_action=optional(x.next_action,"Next action",1500);
 }else if(action==="cancel_session"){
  if(!lead||old.status!=="scheduled")
   throw new SchoolDeskError("Only a corporate supervisor can cancel an unstarted session.",403);
  changes.status="cancelled";
  changes.cancellation_reason=field(x.cancellation_reason,"Cancellation reason",15,1000);
 }else if(action==="review_session"){
  if(!manager(desk.viewer.role)||old.status!=="completed"||old.reviewed_at)
   throw new SchoolDeskError("Only a completed, unreviewed session can be independently assessed.",403);
  if(old.representative_user_id===user.id||old.created_by===user.id)
   throw new SchoolDeskError("The Pathfinder and session creator cannot independently verify their own work.",403);
  changes.reviewed_by=user.id;changes.reviewed_at=now;
  changes.review_note=field(x.review_note,"Verification decision",15,1500);
 }else throw new SchoolDeskError("Unknown Pathfinder session action.");
 await updateSession(id,old,changes);
 return getPathfinderSessions(user);
}
