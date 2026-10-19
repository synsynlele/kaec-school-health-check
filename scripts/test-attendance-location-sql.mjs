import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const id = (n) => "00000000-0000-0000-0000-" + String(n).padStart(12,"0");
const org=id(1), campus=id(2),otherOrg=id(3),otherCampus=id(4),unit=id(5);
const teacher=id(10), guardian=id(11),observer=id(12), other=id(13);
const teacherRole=id(20),guardianRole=id(21),inspectorRole=id(22),custodianRole=id(23),otherCustodianRole=id(24);
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
 for(const [r,code] of [[teacherRole,"TEACHER"],[guardianRole,"SCHOOL_GUARDIAN"],[inspectorRole,"ACADEMIC_INSPECTOR"],[custodianRole,"SCHOOL_CUSTODIAN"]])
   await q("insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,$3,$3,'active')",[r,org,code]);
 for(const [a,r,u] of [[teacherAssignment,teacherRole,teacher],[guardianAssignment,guardianRole,guardian],[observerAssignment,inspectorRole,observer]])
   await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,$4,$5,'active')",[a,r,u,campus,null]);
 await q("insert into khpos_ops_roles(id,organisation_id,code,title,status) values($1,$2,'SCHOOL_CUSTODIAN','Custodian','active')",[otherCustodianRole,otherOrg]);
 await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,null,null,'active')",[id(33),custodianRole,guardian]);
 await q("insert into khpos_ops_role_assignments(id,role_id,user_id,campus_id,unit_id,status) values($1,$2,$3,null,null,'active')",[id(34),otherCustodianRole,other]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Mathematics Teacher',$4,'active')",[staffId,org,teacher,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Guardian',$4,'active')",[id(41),org,guardian,campus]);
 await q("insert into khpos_ops_staff(id,organisation_id,user_id,display_name,campus_id,status) values($1,$2,$3,'Inspector',$4,'active')",[id(42),org,observer,campus]);
 await q("insert into khpos_ops_academic_terms(id,organisation_id,campus_id,start_date,end_date,status) values($1,$2,$3,current_date-30,current_date+30,'active')",[term,org,campus]);
 await q("insert into khpos_ops_academic_delivery_streams(id,organisation_id,term_id,campus_id,unit_id,class_label,subject_label,teacher_assignment_id,status) values($1,$2,$3,$4,$5,'JSS1','Mathematics',$6,'active')",[stream,org,term,campus,unit,teacherAssignment]);

 await db.exec("create table public.khpos_platform_admins(user_id uuid,status text,platform_role text);");
 await db.exec(fs.readFileSync("supabase/migrations/20261016085446_staff_announcements.sql","utf8"));
 for(const file of ["20261018100000_kaec_hq_corporate_foundation.sql","20261018113000_kaec_hq_operational_workflows.sql","20261018140000_kaec_hq_school_execution.sql","20261018170000_kaec_hq_pathfinder_sessions.sql"])
  await db.exec(fs.readFileSync("supabase/migrations/"+file,"utf8"));
 await db.exec(fs.readFileSync("supabase/migrations/20261019065632_attendance_location_evidence.sql","utf8"));
 const pin={campusId:campus,latitude:6.55,longitude:3.25,radius:200,updatedAt:null,reason:"Verified campus entrance"};
 const save=(actor,school,input,hq=false)=>q("select khpos_attendance_campus_save_server($1,$2,$3,$4)",[actor,school,hq,input]);
 const campuses=(actor,school=org,hq=false)=>q("select khpos_attendance_campuses_server($1,$2,$3) data",[actor,school,hq]).then(r=>r[0].data);
 const evaluate=(input,c=campus)=>q("select khpos_attendance_location_evaluate_server($1,$2) data",[input,c]).then(r=>r[0].data);
 const capture=(changes={})=>({status:"captured",latitude:6.55,longitude:3.25,accuracy:5,capturedAt:new Date().toISOString(),...changes});
 await assert.rejects(save(teacher,org,pin),/Custodian|Guardian/);
 await assert.rejects(save(other,org,pin),/membership/);
 await assert.rejects(save(guardian,org,{...pin,campusId:otherCampus}),/not found/);
 await assert.rejects(save(guardian,org,{...pin,radius:1}),/boundary/);
 await save(guardian,org,pin);
 const configured=(await campuses(teacher))[0];assert.equal(configured.canManage,false);assert.equal(configured.location.radius,200);
 await assert.rejects(save(guardian,org,pin),/changed/);
 await assert.rejects(campuses(other),/membership/);
 assert.equal((await campuses(guardian))[0].canManage,true);
 assert.equal((await evaluate(null)).status,"not_recorded");
 assert.equal((await evaluate(capture())).status,"within_boundary");
 assert.equal((await evaluate(capture({longitude:3.26}))).status,"outside_boundary");
 assert.equal((await evaluate(capture({latitude:6.55175,accuracy:20}))).status,"boundary_uncertain");
 assert.equal((await evaluate(capture({accuracy:500}))).status,"poor_accuracy");
 assert.equal((await evaluate(capture({capturedAt:"2020-01-01T00:00:00Z"}))).status,"stale");
 assert.equal((await evaluate(capture(),otherCampus)).status,"campus_unset");
 assert.equal((await evaluate({status:"denied",reason:"Permission not available on this device"})).status,"denied");
 await assert.rejects(evaluate({status:"denied"}),/Explain/);
 await assert.rejects(evaluate(capture({latitude:91})),/range/);
 await assert.rejects(evaluate(capture({accuracy:-1})),/range/);
 await assert.rejects(evaluate(capture({latitude:null})),/valid/);
 await act(guardian,"pilot_enable",{enabled:true});
 await act(teacher,"school_in",{campusId:campus,location:capture()});
 let ws=await read(teacher);assert.equal(ws.todayPresence.checkInLocation.status,"within_boundary");
 const original=ws.todayPresence.checkInLocation.campus;
 await save(guardian,org,{...pin,longitude:3.26,updatedAt:configured.location.updatedAt,reason:"Corrected entrance location"});
 ws=await read(teacher);assert.deepEqual(ws.todayPresence.checkInLocation.campus,original);
 await act(teacher,"school_out",{location:{status:"timeout",reason:"GPS timed out while leaving school"}});
 ws=await read(teacher);assert.equal(ws.todayPresence.checkOutLocation.status,"timeout");
 const day=ws.localDay;
 const history=(await q("select khpos_ops_presence_history_server($1,$2,$3,$3) data",[guardian,org,day]))[0].data;
 assert.equal(history.schoolRecords[0].checkInLocation.status,"within_boundary");
 assert.equal(history.schoolRecords[0].checkOutLocation.status,"timeout");
 await assert.rejects(q("select khpos_ops_presence_history_server($1,$2,$3,$3)",[teacher,org,day]),/leaders/);
 await assert.rejects(q("select khpos_ops_presence_history_server($1,$2,$3,$3)",[other,org,day]),/membership/);
 const privileges=(await q("select has_function_privilege('anon','public.khpos_attendance_location_evaluate_server(jsonb,uuid)','execute') anon,has_function_privilege('authenticated','public.khpos_attendance_campus_save_server(uuid,uuid,boolean,jsonb)','execute') client,has_function_privilege('service_role','public.khpos_attendance_campus_save_server(uuid,uuid,boolean,jsonb)','execute') server"))[0];
 assert.deepEqual(privileges,{anon:false,client:false,server:true});
 // HQ staff have no access merely by holding a school role. Appointed Pathfinder sees only their active engagement.
 const engagement=id(200),visit=id(201);
 await q("insert into kaec_hq_members(user_id,email,display_name,role,granted_by) values($1,'hq@test.invalid','Supervisor','alliance_catalyst',$1),($2,'pathfinder@test.invalid','Pathfinder','school_pathfinder',$1)",[guardian,observer]);
 await q("insert into kaec_hq_school_engagements(id,organisation_id,engagement_status,agreement_reference,agreed_scope,contract_verified_at,contract_verified_by,representative_user_id,updated_by) values($1,$2,'active','SIGNED-1','School oversight and attendance review',now(),$3,$4,$3)",[engagement,org,guardian,observer]);
 assert.equal((await campuses(observer,org,true))[0].canManage,false);
 assert.equal((await campuses(guardian,org,true))[0].canManage,true);
 await assert.rejects(campuses(observer,otherOrg,true),/scope/);
 await assert.rejects(save(observer,org,{...pin,updatedAt:null},true),/supervisor/);
 await q("insert into kaec_hq_pathfinder_sessions(id,engagement_id,representative_user_id,mode,title,objective,scheduled_start_at,created_by,updated_by,campus_id) values($1,$2,$3,'onsite','School visit','Inspect implementation at school',now(),$4,$4,$5)",[visit,engagement,observer,guardian,campus]);
 await assert.rejects(q("update kaec_hq_pathfinder_sessions set campus_id=$2 where id=$1",[visit,otherCampus]),/belong/);
 const loc=await evaluate(capture());
 await q("update kaec_hq_pathfinder_sessions set status='checked_in',check_in_at=now(),check_in_location=$2,updated_by=$3 where id=$1",[visit,loc,observer]);
 await assert.rejects(q("update kaec_hq_pathfinder_sessions set campus_id=null where id=$1",[visit]),/change campus/);
 const stored=(await q("select check_in_location from kaec_hq_pathfinder_sessions where id=$1",[visit]))[0];assert.equal(stored.check_in_location.status,loc.status);
 console.log("Attendance location SQL passed: distance/accuracy/staleness, atomic staff in/out, historical snapshots, scoped school/HQ permissions, stale pin edits, cross-school rejection, service grants and scheduled Pathfinder campus guard.");
} catch(e) { console.error(e.message, e.where??""); process.exitCode=1; } finally { await db.close(); }
