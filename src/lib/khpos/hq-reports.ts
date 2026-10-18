import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import type {VerifiedKhposUser} from "@/lib/khpos/auth";
import {getHqSnapshot,type HqMember,HqError} from "@/lib/khpos/hq";

export type HqReportingLine={
 id:string;title:string;purpose:string;reporter_user_id:string;reviewer_user_id:string;
 engagement_id:string|null;cadence:"daily"|"weekly"|"monthly"|"quarterly"|"yearly";
 anchor_due_on:string;next_cycle_index:number;next_due_on:string;status:"active"|"paused";
 created_by:string;updated_by:string;created_at:string;updated_at:string;
};
export type HqReportSubmission={
 id:string;line_id:string;cycle_index:number;due_on:string;
 status:"submitted"|"accepted"|"returned";achievements:string;challenges:string;
 next_actions:string;evidence_reference:string;submitted_by:string;submitted_at:string;
 reviewed_by:string|null;reviewed_at:string|null;review_note:string;updated_at:string;
};
export type HqReportingDesk={
 viewer:{userId:string;role:string;email:string;aal:string};
 members:Pick<HqMember,"user_id"|"display_name"|"role"|"status">[];
 lines:HqReportingLine[];submissions:HqReportSubmission[];
 generated_at:string;capped:boolean;
};
let admin:SupabaseClient|null=null;
function db(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new HqError("Corporate reporting service is not configured.",503);
 if(!admin)admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{persistSession:false,autoRefreshToken:false}});
 return admin;
}
function object(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new HqError("Invalid report request.");
 return raw as Record<string,unknown>;
}
function field(v:unknown,label:string,min:number,max:number){
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)
  throw new HqError(label+" requires "+min+"–"+max+" characters.");
 return v.trim();
}
function uuid(v:unknown,label:string){
 if(typeof v!=="string"||!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v))
  throw new HqError("Invalid "+label+".");
 return v;
}
function date(v:unknown,label:string){
 const val=field(v,label,10,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(val)||isNaN(new Date(val+"T00:00:00Z").getTime()))
  throw new HqError("Invalid "+label+".");
 return val;
}
function canManage(role:string){return role==="vision_custodian"||role==="system_steward"||role==="alliance_catalyst";}
function maySee(line:HqReportingLine,viewer:{userId:string;role:string}){
 return viewer.role==="vision_custodian"||line.reporter_user_id===viewer.userId||line.reviewer_user_id===viewer.userId;
}
async function loadLine(id:string):Promise<HqReportingLine>{
 const {data,error}=await db().from("kaec_hq_reporting_lines").select("*").eq("id",id).maybeSingle();
 if(error)throw new HqError("The reporting line could not load.",503);
 if(!data)throw new HqError("Reporting line not found.",404);
 return data as HqReportingLine;
}
async function loadSubmission(id:string):Promise<HqReportSubmission>{
 const {data,error}=await db().from("kaec_hq_reporting_submissions").select("*").eq("id",id).maybeSingle();
 if(error)throw new HqError("This report could not load.",503);
 if(!data)throw new HqError("Submitted report not found.",404);
 return data as HqReportSubmission;
}
async function checkReporterAndReviewer(reporter:string,reviewer:string,role:string,userId:string,engagementId:string|null){
 if(reporter===reviewer)throw new HqError("Reporter and reviewer must be different people.");
 const {data:members,error}=await db().from("kaec_hq_members")
  .select("user_id,role,status").in("user_id",[reporter,reviewer]);
 if(error||!members||members.length!==2||members.some(x=>x.status!=="active"))
  throw new HqError("Both the reporter and reviewing leader must hold active corporate appointments.");
 const person=members.find(x=>x.user_id===reporter);
 const lead=members.find(x=>x.user_id===reviewer);
 if(!person||!lead)throw new HqError("Select valid corporate members.");
 if(!["vision_custodian","system_steward","alliance_catalyst","finance_steward"].includes(lead.role))
  throw new HqError("Select a Vision Custodian, System Steward, Alliance Catalyst or Finance Steward as reviewer.");
 if(role==="system_steward"&&
   (person.role==="vision_custodian"||lead.role==="finance_steward"||lead.role==="alliance_catalyst"))
  throw new HqError("System Stewards cannot assign Vision Custodian or independent Finance/Alliance reporting routes.",403);
 if(role==="alliance_catalyst"&&
  (person.role!=="school_pathfinder"||reviewer!==userId||!engagementId))
  throw new HqError("Alliance Catalysts can configure only their own school Pathfinder reporting lines.",403);
 if(person.role==="school_pathfinder"){
  if(!engagementId)throw new HqError("School Pathfinder reports must be tied to an assigned active partner school.");
  const {data:school,error:schoolError}=await db().from("kaec_hq_school_engagements").select("id,engagement_status,representative_user_id")
    .eq("id",engagementId).maybeSingle();
  if(schoolError||!school||school.engagement_status!=="active"||school.representative_user_id!==reporter)
   throw new HqError("The Pathfinder must be assigned to the active school named in this reporting line.");
 }else if(engagementId){
  throw new HqError("School-specific reporting lines are reserved for appointed School Pathfinders.");
 }
}
export async function getHqReportingDesk(user:VerifiedKhposUser):Promise<HqReportingDesk>{
 const snapshot=await getHqSnapshot(user);
 let linesQuery=db().from("kaec_hq_reporting_lines").select("*").order("next_due_on",{ascending:true}).limit(301);
 // Non-Vision users only see reports where they are a reporter or reviewer. 
 // System Stewards additionally have oversight of eligible corporate reporting lines.
 if(snapshot.viewer.role!=="vision_custodian")
  linesQuery=linesQuery.or("reporter_user_id.eq."+user.id+",reviewer_user_id.eq."+user.id);
 const {data:rawLines,error:lineError}=await linesQuery;
 if(lineError)throw new HqError("Corporate reporting lines could not load.",503);
 const lines=((rawLines??[]) as HqReportingLine[]).filter(line=>maySee(line,snapshot.viewer)).slice(0,300);
 const ids=lines.map(l=>l.id);
 const {data:rawSubmissions,error:submissionError}=ids.length
  ? await db().from("kaec_hq_reporting_submissions").select("*").in("line_id",ids)
    .order("submitted_at",{ascending:false}).limit(401)
  : {data:[],error:null};
 if(submissionError)throw new HqError("Reports could not load.",503);
 return {viewer:snapshot.viewer,
  members:snapshot.members.map(m=>({user_id:m.user_id,display_name:m.display_name,role:m.role,status:m.status})),
  lines,submissions:((rawSubmissions??[]) as HqReportSubmission[]).slice(0,400),
  capped:snapshot.hasMore||(rawLines??[]).length>300||(rawSubmissions??[]).length>400,
  generated_at:new Date().toISOString()};
}
export async function createHqReportingLine(user:VerifiedKhposUser,raw:unknown){
 const snapshot=await getHqSnapshot(user);
 if(!canManage(snapshot.viewer.role))throw new HqError("This role cannot configure reporting lines.",403);
 const x=object(raw);
 const reporter=uuid(x.reporter_user_id,"reporter");
 const reviewer=uuid(x.reviewer_user_id,"reviewer");
 const engagementId=x.engagement_id?uuid(x.engagement_id,"school engagement"):null;
 const cadence=x.cadence;
 if(typeof cadence!=="string"||!["daily","weekly","monthly","quarterly","yearly"].includes(cadence))
  throw new HqError("Select daily, weekly, monthly, quarterly or yearly.");
 await checkReporterAndReviewer(reporter,reviewer,snapshot.viewer.role,user.id,engagementId);
 const first=date(x.anchor_due_on,"first reporting due date");
 const {error}=await db().from("kaec_hq_reporting_lines").insert({
  title:field(x.title,"Report name",4,160),
  purpose:field(x.purpose,"Reporting expectations",15,2000),
  reporter_user_id:reporter,reviewer_user_id:reviewer,engagement_id:engagementId,
  cadence,anchor_due_on:first,next_due_on:first,status:"active",
  created_by:user.id,updated_by:user.id
 });
 if(error)throw new HqError("Reporting line could not be created: "+error.message,500);
 return getHqReportingDesk(user);
}
export async function changeHqReportingLine(user:VerifiedKhposUser,raw:unknown){
 const snapshot=await getHqSnapshot(user),x=object(raw);
 if(!canManage(snapshot.viewer.role))throw new HqError("This role cannot change reporting schedules.",403);
 const line=await loadLine(uuid(x.id,"reporting line"));
 if(snapshot.viewer.role==="alliance_catalyst" &&
   (line.reviewer_user_id!==user.id||!line.engagement_id))
  throw new HqError("You can manage only Pathfinder reports routed to you.",403);
 if(snapshot.viewer.role==="system_steward"){
  const {data:reporter}=await db().from("kaec_hq_members").select("role").eq("user_id",line.reporter_user_id).maybeSingle();
  if(reporter?.role==="vision_custodian")throw new HqError("Vision Custodian reporting routes require Vision Custodian authority.",403);
 }
 const status=x.status;
 if(status!=="active"&&status!=="paused")throw new HqError("Select Active or Paused.");
 if(line.status===status)return getHqReportingDesk(user);
 const {data,error}=await db().from("kaec_hq_reporting_lines")
   .update({status,updated_by:user.id,updated_at:new Date().toISOString()})
   .eq("id",line.id).eq("updated_at",line.updated_at).select("id");
 if(error)throw new HqError("Schedule status could not be updated.",500);
 if(!data?.length)throw new HqError("Reporting line changed. Refresh and retry.",409);
 return getHqReportingDesk(user);
}
export async function submitHqScheduledReport(user:VerifiedKhposUser,raw:unknown){
 const x=object(raw),line=await loadLine(uuid(x.line_id,"reporting line"));
 await getHqSnapshot(user);
 if(line.reporter_user_id!==user.id)throw new HqError("Only the appointed reporting officer can submit this report.",403);
 if(line.status!=="active")throw new HqError("The reporting line is paused.",409);
 const contents={
  achievements:field(x.achievements,"Actual achievements and evidence",20,3000),
  challenges:field(x.challenges??"","Challenges and blockers",0,2500),
  next_actions:field(x.next_actions,"Next actions",10,2500),
  evidence_reference:field(x.evidence_reference??"","Evidence reference",0,700)
 };
 let error;
 if(x.returned_submission_id){
  const report=await loadSubmission(uuid(x.returned_submission_id,"returned report"));
  if(report.status!=="returned"||report.line_id!==line.id||report.submitted_by!==user.id)
   throw new HqError("Only your own returned report can be corrected and resubmitted.",403);
  const revised=await db().from("kaec_hq_reporting_submissions").update({
    ...contents,status:"submitted",reviewed_by:null,reviewed_at:null,review_note:"",
    updated_at:new Date().toISOString(),submitted_at:new Date().toISOString()
  }).eq("id",report.id).eq("status","returned").eq("updated_at",report.updated_at).select("id");
  error=revised.error;
  if(!error&&!revised.data?.length)throw new HqError("Report changed. Refresh and retry.",409);
 }else{
  // Atomic PostgreSQL trigger validates cycle and moves the next due date.
  const inserted=await db().from("kaec_hq_reporting_submissions").insert({
   line_id:line.id,cycle_index:line.next_cycle_index,due_on:line.next_due_on,
   submitted_by:user.id,status:"submitted",...contents
  });
  error=inserted.error;
 }
 if(error)throw new HqError("Report submission failed: "+error.message,500);
 return getHqReportingDesk(user);
}
export async function reviewHqScheduledReport(user:VerifiedKhposUser,raw:unknown){
 const x=object(raw),report=await loadSubmission(uuid(x.id,"submitted report"));
 const line=await loadLine(report.line_id);
 await getHqSnapshot(user);
 if(line.reviewer_user_id!==user.id||line.reporter_user_id===user.id)
  throw new HqError("Only the appointed independent recipient can review this report.",403);
 if(report.status!=="submitted")throw new HqError("This report has already been reviewed.",409);
 const decision=x.decision;
 if(decision!=="accept"&&decision!=="return")throw new HqError("Select Accept or Return.");
 const note=field(x.review_note,"Reviewer decision and reason",15,1500);
 const {data,error}=await db().from("kaec_hq_reporting_submissions").update({
  status:decision==="accept"?"accepted":"returned",
  reviewed_by:user.id,reviewed_at:new Date().toISOString(),review_note:note,
  updated_at:new Date().toISOString()
 }).eq("id",report.id).eq("status","submitted").eq("updated_at",report.updated_at).select("id");
 if(error)throw new HqError("Report review could not be saved.",500);
 if(!data?.length)throw new HqError("Report changed. Refresh and retry.",409);
 return getHqReportingDesk(user);
}
