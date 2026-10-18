import assert from "node:assert/strict";
import fs from "node:fs";
import {PGlite} from "@electric-sql/pglite";
const db=new PGlite();
const uid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [vision,alliance,pathfinder,steward,school,engagement,session,line,report] = [1,2,3,4,10,20,30,40,50].map(uid);
const query=(q,args=[])=>db.query(q,args).then(x=>x.rows);
try{
 await db.exec("create schema auth; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
 await db.exec("create table public.organisations(id uuid primary key,name text not null,status text not null,partner_status text,partner_entitlements text[]);");
 for(const name of ["20261018100000_kaec_hq_corporate_foundation.sql","20261018113000_kaec_hq_operational_workflows.sql",
 "20261018140000_kaec_hq_school_execution.sql","20261018170000_kaec_hq_pathfinder_sessions.sql",
 "20261018171000_kaec_hq_reporting_lines.sql"])
  await db.exec(fs.readFileSync("supabase/migrations/"+name,"utf8"));
 await query("insert into auth.users(id) values($1),($2),($3),($4)",[vision,alliance,pathfinder,steward]);
 await query("insert into public.kaec_hq_members(user_id,email,display_name,role,granted_by) values($1,'vision@test.invalid','Vision','vision_custodian',$1),($2,'alliance@test.invalid','Alliance','alliance_catalyst',$1),($3,'pathfinder@test.invalid','Pathfinder','school_pathfinder',$1),($4,'steward@test.invalid','Steward','system_steward',$1)",[vision,alliance,pathfinder,steward]);
 await query("insert into public.organisations(id,name,status,partner_status,partner_entitlements) values($1,'School A','active','active',array['khpos_core'])",[school]);
 await query("insert into public.kaec_hq_school_engagements(id,organisation_id,engagement_status,agreement_reference,agreed_scope,contract_verified_at,contract_verified_by,representative_user_id,updated_by) values($1,$2,'active','SIGNED-AGREE-1','School supervision for teaching and operations evidence',now(),$3,$4,$3)",[engagement,school,vision,pathfinder]);
 const privilege=await query("select has_table_privilege('anon','public.kaec_hq_pathfinder_sessions','SELECT') anon_session_read,has_table_privilege('authenticated','public.kaec_hq_reporting_submissions','INSERT') user_report_write,has_table_privilege('service_role','public.kaec_hq_reporting_submissions','INSERT') server_report_write,(select relrowsecurity from pg_class where oid='public.kaec_hq_reporting_lines'::regclass) reporting_rls,(select relrowsecurity from pg_class where oid='public.kaec_hq_pathfinder_sessions'::regclass) session_rls");
 assert.deepEqual(privilege[0],{anon_session_read:false,user_report_write:false,server_report_write:true,reporting_rls:true,session_rls:true});
 await query("insert into public.kaec_hq_pathfinder_sessions(id,engagement_id,representative_user_id,mode,title,objective,scheduled_start_at,status,created_by,updated_by) values($1,$2,$3,'onsite','Curriculum inspection','Review implementation and address assigned problems','2026-10-18T09:00:00Z','scheduled',$4,$4)",[session,engagement,pathfinder,alliance]);
 await assert.rejects(query("update public.kaec_hq_pathfinder_sessions set status='completed',outcome_note='I completed work at school' where id=$1",[session]),/check constraint|violates/i);
 await query("update public.kaec_hq_pathfinder_sessions set status='checked_in',check_in_at='2026-10-18T09:15:00Z',updated_by=$2 where id=$1",[session,pathfinder]);
 await query("update public.kaec_hq_pathfinder_sessions set status='completed',check_out_at='2026-10-18T11:15:00Z',outcome_note='Reviewed implementation and collected anonymized evidence',issues_note='Staff need training',resolution_note='Delivered a short mentoring session',updated_by=$2 where id=$1",[session,pathfinder]);
 await query("update public.kaec_hq_pathfinder_sessions set reviewed_by=$2,reviewed_at=now(),review_note='Work and mentoring were supported by evidence',updated_by=$2 where id=$1",[session,vision]);
 const checked=await query("select status,check_in_at is not null as checked_in,check_out_at is not null as checked_out,reviewed_by from public.kaec_hq_pathfinder_sessions where id=$1",[session]);
 assert.equal(checked[0].status,"completed");
 assert.equal(checked[0].checked_in,true);assert.equal(checked[0].checked_out,true);
 assert.equal(checked[0].reviewed_by,vision);
 await assert.rejects(query("insert into public.kaec_hq_reporting_lines(id,title,purpose,reporter_user_id,reviewer_user_id,cadence,anchor_due_on,next_due_on,created_by,updated_by) values($1,'Self report','My own work at school',$2,$2,'monthly','2026-01-31','2026-01-31',$2,$2)",[uid(41),pathfinder]),/constraint|violates/i);
 await query("insert into public.kaec_hq_reporting_lines(id,title,purpose,reporter_user_id,reviewer_user_id,engagement_id,cadence,anchor_due_on,next_due_on,created_by,updated_by) values($1,'Monthly supervision','Results, problems, and actions from agreed oversight',$2,$3,$4,'monthly','2026-01-31','2026-01-31',$3,$3)",[line,pathfinder,alliance,engagement]);
 await query("insert into public.kaec_hq_reporting_submissions(id,line_id,cycle_index,due_on,status,achievements,next_actions,submitted_by) values($1,$2,1,'2026-01-31','submitted','Completed school monitoring and discussed objectives','Review school implementation on the next visit',$3)",[report,line,pathfinder]);
 let schedule=await query("select next_cycle_index,next_due_on::text next_due_on from public.kaec_hq_reporting_lines where id=$1",[line]);
 assert.equal(schedule[0].next_cycle_index,2);assert.equal(schedule[0].next_due_on,"2026-02-28");
 await assert.rejects(query("insert into public.kaec_hq_reporting_submissions(line_id,cycle_index,due_on,status,achievements,next_actions,submitted_by) values($1,1,'2026-01-31','submitted','Extra duplicate report for original month','Continue follow-up',$2)",[line,pathfinder]),/constraint|duplicate|violates/i);
 await query("update public.kaec_hq_reporting_submissions set status='returned',reviewed_by=$2,reviewed_at=now(),review_note='Supply stronger evidence before this report is accepted' where id=$1",[report,alliance]);
 await query("update public.kaec_hq_reporting_submissions set status='submitted',reviewed_by=null,reviewed_at=null,review_note='',achievements='Completed school supervision and documented actions for approval' where id=$1",[report]);
 await query("update public.kaec_hq_reporting_submissions set status='accepted',reviewed_by=$2,reviewed_at=now(),review_note='Evidence reviewed, outcomes checked independently' where id=$1",[report,alliance]);
 await query("insert into public.kaec_hq_reporting_submissions(line_id,cycle_index,due_on,status,achievements,next_actions,submitted_by) values($1,2,'2026-02-28','submitted','Completed monthly school oversight and follow-up','Next reporting cycle action plan',$2)",[line,pathfinder]);
 schedule=await query("select next_cycle_index,next_due_on::text next_due_on from public.kaec_hq_reporting_lines where id=$1",[line]);
 assert.equal(schedule[0].next_cycle_index,3);assert.equal(schedule[0].next_due_on,"2026-03-31");
 const audit=await query("select count(*)::int n from public.kaec_hq_reporting_events");
 assert(audit[0].n>=8,"Expected schedule advancement and report review to be audited");
 const sessionAudit=await query("select count(*)::int n from public.kaec_hq_school_events where entity_kind='kaec_hq_pathfinder_sessions'");
 assert.equal(sessionAudit[0].n,4,"Create/checkin/checkout/review each generate auditable event");
 console.log("KAEC HQ pathfinder and reporting SQL passed: RLS/grants, onsite attendance constraints, independently reviewed work, atomic reports, due-cycle anchoring, return/resubmit and audit.");
}finally{await db.close();}
