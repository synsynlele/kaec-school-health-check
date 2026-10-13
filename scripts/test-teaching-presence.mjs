import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12,"0");
const org=id(1), campus=id(2),otherOrg=id(3),otherCampus=id(4),unit=id(5);
const teacher=id(10), guardian=id(11),observer=id(12), other=id(13);
const teacherRole=id(20),guardianRole=id(21),inspectorRole=id(22);
const teacherAssignment=id(30),guardianAssignment=id(31),observerAssignment=id(32);
const staffId=id(40),term=id(50),stream=id(51);
let checks=0;
async function q(sql,args=[]) {return (await db.query(sql,args)).rows;}
async function fail(sql,args,regex) {await assert.rejects(q(sql,args),regex);checks++;}
async function act(actor,mode,input,school=org) {return (await q("select public.khpos_ops_presence_action_server($1,$2,$3,$4) as result",[actor,school,mode,input]))[0].result;}
async function read(actor,school=org){return (await q("select public.khpos_ops_presence_workspace_server($1,$2) as result",[actor,school]))[0].result;}

try {
 await db.exec("create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
 await db.exec(fs.readFileSync("scripts/fixtures/staff-positions-schema.sql","utf8"));
 await db.exec(`
  create table public.khpos_ops_academic_terms(
    id uuid primary key, organisation_id uuid, campus_id uuid, start_date date, end_date date,status text
  );
  create table public.khpos_ops_academic_delivery_streams(
    id uuid primary key, organisation_id uuid, term_id uuid, campus_id uuid, unit_id uuid,
    class_label text, subject_label text, teacher_assignment_id uuid, status text
  );
  create or replace function khpos_private.ops_academic_has_membership(p_actor uuid,p_org uuid)
  returns boolean language sql stable as $$
    select khpos_private.ops_hpd_has_membership(p_actor,p_org);
  $$;
 `);
 await db.exec(fs.readFileSync("supabase/migrations/20261013090000_khpos_presence_class_hqls.sql","utf8"));
 for(const [n,name] of [[org,"Test School"],[otherOrg,"Other School"]])
   await q("insert into organisations(id,name,status,partner_status,partner_entitlements) values($1,$2,'active','active',array['khpos_core'])",[n,name]);
 for(const u of [teacher,guardian,observer,other]) await q("insert into auth.users(id) values($1)",[u]);
 for(const u of [teacher,guardian,observer]) await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[org,u]);
 await q("insert into organisation_memberships(organisation_id,user_id,status) values($1,$2,'active')",[otherOrg,other]);
 for(const [c,o] of [[campus,org],[otherCampus,otherOrg]])
   await q("insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,'Campus','active')",[c,o]);
 await q("insert into khpos_ops_units(id,organisation_id,campus_id,name) values($1,$2,$3,'JSS')",[unit,org,campus]);
 for(const [r,code] of [[teacherRole,"TEACHER"],[guardianRole,"SCHOOL_GUARDIAN"],[inspectorRole,"ACADEMIC_INSPECTOR"]])
   await q("insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,$3,$3,'active')",[r,org,code]);
 for(const [a,r,u] of [[teacherAssignment,teacherRole,teacher],[guardianAssignment,guardianRole,guardian],[observerAssignment,inspectorRole,observer]])
   await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",[a,r,u,campus,null]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Mathematics Teacher',$4,'active')",[staffId,org,teacher,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Guardian',$4,'active')",[id(41),org,guardian,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Inspector',$4,'active')",[id(42),org,observer,campus]);
 await q("insert into khpos_ops_academic_terms(id,organisation_id,campus_id,start_date,end_date,status) values($1,$2,$3,current_date-30,current_date+30,'active')",[term,org,campus]);
 await q("insert into khpos_ops_academic_delivery_streams(id,organisation_id,term_id,campus_id,unit_id,class_label,subject_label,teacher_assignment_id,status) values($1,$2,$3,$4,$5,'JSS1','Mathematics',$6,'active')",[stream,org,term,campus,unit,teacherAssignment]);
 await fail("select public.khpos_ops_presence_workspace_server($1,$2)",[teacher,otherOrg],/membership/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_in',$3)",[teacher,org,{campusId:otherCampus}],/authorised/i);
 await act(teacher,"school_in",{campusId:campus});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_in',$3)",[teacher,org,{campusId:campus}],/already recorded/i);
 const day=(await q("select extract(isodow from (clock_timestamp() at time zone 'Africa/Lagos'))::integer as dow"))[0].dow;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",[teacher,org,{streamId:stream,weekday:day,start:"00:01",end:"23:59"}],/authorised/i);
 await act(guardian,"period_add",{streamId:stream,weekday:day,start:"00:01",end:"23:59",room:"Maths Room"});checks++;
 const ws=await read(teacher);assert.equal(ws.periods.length,1);checks++;
 const periodId=ws.periods[0].id;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'period_add',$3)",[guardian,org,{streamId:stream,weekday:day,start:"08:00",end:"09:00"}],/overlapping/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'class_in',$3)",[observer,org,{periodId}],/assigned active subject teacher/i);
 await act(teacher,"class_in",{periodId});checks++;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'school_out',$3)",[teacher,org,{}],/Finish the active class/i);
 await act(teacher,"class_out",{periodId,outcome:"completed",topic:"Fractions"});checks++;
 await act(teacher,"school_out",{});checks++;
 const strong=[
  "awakening","exploration","micro_illumination","first_trial",
  "full_illumination","second_trial","integration","teacher_role_fidelity"
 ].map((code)=>({code,score:3,evidence:"Students attempted the problem and explained their own thinking in groups.",automaticFailure:code==="awakening"}));
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_create',$3)",
   [teacher,org,{streamId:stream,observationMode:"full",domains:strong,strengths:"Students considered different ideas."}],/authorised/i);
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_create',$3)",
   [observer,org,{streamId:stream,observationMode:"full",domains:strong.slice(1),strengths:"Students considered different ideas."}],/all eight/i);
 await act(observer,"hqls_create",{streamId:stream,observationMode:"full",domains:strong,strengths:"Students considered different ideas."});checks++;
 const h=await read(teacher);assert.equal(h.observations.length,1);checks++;
 assert.equal(h.observations[0].total,24);assert.equal(h.observations[0].band,"model");assert.equal(h.observations[0].automaticFailure,true);
 assert.ok(h.observations[0].coachingWorkId);checks++;
 assert.equal((await q("select count(*)::int as n from khpos_ops_work_items where owner_assignment_id=$1",[teacherAssignment]))[0].n,1);checks++;
 const observationId=h.observations[0].id;
 await fail("select public.khpos_ops_presence_action_server($1,$2,'hqls_acknowledge',$3)",[observer,org,{observationId,teacherResponse:"I stepped in too early during exploration."}],/only the observed teacher/i);
 await act(teacher,"hqls_acknowledge",{observationId,teacherResponse:"At Exploration I wanted to correct ideas too quickly."});checks++;
 assert.ok((await read(teacher)).observations[0].acknowledgedAt);checks++;
 await act(observer,"hqls_create",{streamId:stream,observationMode:"walk",domains:[{code:"second_trial",score:2,evidence:"Students revised their original solution in pairs.",automaticFailure:false}],strengths:"Second trial enabled progress."});checks++;
 const observations=(await read(teacher)).observations;
 assert.equal(observations[0].total,null);assert.equal(observations[0].band,null);checks++;
 const observerWorkspace=await read(observer);assert.ok(observerWorkspace.observations.length>=2);checks++;
 console.log("Teaching presence/HQLS integration: "+checks+" checks passed.");
} finally {await db.close();}
