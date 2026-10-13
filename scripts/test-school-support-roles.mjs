import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db=new PGlite();
const id=(n)=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
const org=id(1), otherOrg=id(2), campus=id(3), otherCampus=id(4);
const owner=id(10), otherOwner=id(11), guardian=id(12), teacher=id(13), otherTeacher=id(14);
const guardianRole=id(20), academicRole=id(21), skillRole=id(22), teacherRole=id(23);
let checks=0;
async function q(sql,args=[]){return (await db.query(sql,args)).rows;}
async function verify(ok,message){assert.ok(ok,message);checks++;}
try {
 await db.exec("create schema auth; create schema khpos_private; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
 await db.exec(fs.readFileSync("scripts/fixtures/staff-positions-schema.sql","utf8"));
 await db.exec("alter table public.khpos_ops_roles add constraint uq_o76_test_roles unique(organisation_id,code)");
 const script=fs.readFileSync("supabase/migrations/20261013113000_khpos_o76_school_support_roles.sql","utf8");
 const end=script.indexOf("-- Dedicated campus-scoped care permission.");
 assert.ok(end>0,"O76 helper must be present");
 await db.exec(script.slice(0,end));
 const careDef=script.slice(script.indexOf("create or replace function khpos_private.ops_school_care_campus"),script.indexOf("-- Reuse the existing independent-appointment workflow"));
 await db.exec(careDef);
 for(const [o,u] of [[org,owner],[otherOrg,otherOwner]]){
   await q("insert into auth.users(id) values($1)",[u]);
   await q("insert into organisations(id,name,status,partner_status) values($1,'School','active','active')",[o]);
   await q("insert into organisation_memberships(organisation_id,user_id,role,status) values($1,$2,'executive','active')",[o,u]);
 }
 for(const u of [guardian,teacher,otherTeacher]){
   await q("insert into auth.users(id) values($1)",[u]);
   await q("insert into organisation_memberships(organisation_id,user_id,role,status) values($1,$2,'contributor','active')",[u===otherTeacher?otherOrg:org,u]);
 }
 await q("insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,'Campus','active')",[campus,org]);
 await q("insert into khpos_ops_campuses(id,organisation_id,name,status) values($1,$2,'Other Campus','active')",[otherCampus,otherOrg]);
 for(const [idRole,code,level] of [[guardianRole,'SCHOOL_GUARDIAN',2],[academicRole,'ACADEMIC_INSPECTOR',3],[skillRole,'SKILL_INSPECTOR',3],[teacherRole,'TEACHER',5]]){
   await q("insert into khpos_ops_roles(id,organisation_id,code,title,category,role_level,status,created_by) values($1,$2,$3,$3,'leadership',$4,'active',$5)",[idRole,org,code,level,owner]);
 }
 await q("insert into khpos_ops_role_assignments(role_id,user_id,campus_id,status) values($1,$2,$3,'active')",[guardianRole,guardian,campus]);
 await q("insert into khpos_ops_role_assignments(role_id,user_id,campus_id,status) values($1,$2,$3,'active')",[teacherRole,teacher,campus]);
 for(const r of [academicRole,skillRole]){
   await q("insert into khpos_ops_role_charters(role_id,version,mission,responsibilities,decision_rights,escalation_rules,kpis,status) values($1,1,'Inspect','[\"Coordinate programmes\"]','[]','[]','[]','active')",[r]);
 }
 await q("select khpos_private.ops_ensure_school_support_roles($1)",[org]);
 const newRoles=await q("select code,role_level,category,reports_to_role_id from khpos_ops_roles where organisation_id=$1 and code in ('FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER') order by code",[org]);
 await verify(newRoles.length===2,"Both support roles seeded");
 await verify(newRoles.every(r=>r.role_level===3&&r.category==='leadership'&&r.reports_to_role_id===guardianRole),"Both positions report to School Guardian");
 const chars=await q("select r.code,c.responsibilities,c.decision_rights,c.required_policy_codes,c.status from khpos_ops_role_charters c join khpos_ops_roles r on r.id=c.role_id where r.organisation_id=$1 and c.status='active'",[org]);
 await verify(chars.some(c=>c.code==='FINANCE_ADMIN_OFFICER'&&c.required_policy_codes.includes('FIN-P01')),"Finance charter requires finance policy");
 await verify(chars.some(c=>c.code==='SCHOOL_CARE_OPERATIONS_OFFICER'&&c.required_policy_codes.includes('SAF-P01')&&c.required_policy_codes.includes('PAR-P02')),"Care charter links safeguarding/parent policies");
 await verify(chars.filter(c=>['ACADEMIC_INSPECTOR','SKILL_INSPECTOR'].includes(c.code)).every(c=>c.responsibilities.some(x=>/staff|facilitator|teacher|onboarding/i.test(x))&&c.status==='active'),"Inspector people coordination charters active");
 const old=await q("select count(*)::int as n from khpos_ops_role_charters where role_id=$1 and status='superseded'",[academicRole]);
 await verify(old[0].n===1,"Previous Inspector charter superseded without deletion");
 await verify((await q("select count(*)::int as n from khpos_ops_role_assignments where role_id in (select id from khpos_ops_roles where code in ('FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER'))"))[0].n===0,"Migration must not appoint anybody");
 await q("select khpos_private.ops_ensure_school_support_roles($1)",[org]);
 await verify((await q("select count(*)::int as n from khpos_ops_roles where organisation_id=$1 and code in ('FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER')",[org]))[0].n===2,"Seeder idempotent");
 await verify((await q("select count(*)::int as n from khpos_ops_role_charters where role_id=$1",[academicRole]))[0].n===2,"Inspector charter not versioned twice");
 await q("insert into khpos_ops_role_assignments(role_id,user_id,campus_id,status) select id,$1,$2,'active' from khpos_ops_roles where organisation_id=$3 and code='SCHOOL_CARE_OPERATIONS_OFFICER'",[teacher,campus,org]);
 await verify((await q("select khpos_private.ops_school_care_campus($1,$2,$3) as yes",[teacher,org,campus]))[0].yes===true,"Care officer can manage their campus");
 await verify((await q("select khpos_private.ops_school_care_campus($1,$2,$3) as yes",[teacher,org,otherCampus]))[0].yes===false,"Care officer cannot manage another campus");
 await verify((await q("select khpos_private.ops_school_care_campus($1,$2,$3) as yes",[otherTeacher,org,campus]))[0].yes===false,"Another school cannot access campus");
 await verify((await q("select khpos_private.ops_school_care_campus($1,$2,$3) as yes",[guardian,org,campus]))[0].yes===false,"Guardian is not a Care Officer by implication");
 await verify((await q("select has_function_privilege('anon','khpos_private.ops_school_care_campus(uuid,uuid,uuid)','EXECUTE') as ok"))[0].ok===false,"No anonymous helper execution");
 await verify((await q("select has_function_privilege('authenticated','khpos_private.ops_school_care_campus(uuid,uuid,uuid)','EXECUTE') as ok"))[0].ok===false,"No direct authenticated helper execution");
 await verify(script.includes("perform khpos_private.ops_ensure_school_support_roles(v_org);"),"Future partner bootstrap includes new roles");
 await verify(script.includes("role.code not in ('SCHOOL_GUARDIAN','ACADEMIC_INSPECTOR','SKILL_INSPECTOR','FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER'"),"New positions eligible for governed appointment");
 await verify(script.includes("khpos_private.ops_school_care_campus")&&script.includes("khpos_ops_parent_case_action_server")&&script.includes("khpos_ops_asset_action_server"),"Care integrates parent and facilities operations");
 await verify(!script.includes("create or replace function khpos_private.ops_safeguarding_case_access"),"Restricted safeguarding case-access primitive remains unchanged");
 await verify(!script.includes("create or replace function khpos_private.ops_can_manage_people"),"Inspectors are not granted staff hire/fire privileges");
 await q("insert into khpos_ops_roles(organisation_id,code,title,category,role_level,status,created_by) values($1,'SCHOOL_GUARDIAN','Guardian','leadership',2,'active',$2)",[otherOrg,otherOwner]);
 await q("select khpos_private.ops_ensure_school_support_roles($1)",[otherOrg]);
 await verify((await q("select count(*)::int as n from khpos_ops_roles where organisation_id=$1 and code in ('FINANCE_ADMIN_OFFICER','SCHOOL_CARE_OPERATIONS_OFFICER')",[otherOrg]))[0].n===2,"Second school independently seeded");
 await verify((await q("select count(*)::int as n from khpos_ops_role_assignments where user_id=$1",[otherOwner]))[0].n===0,"Seeding never creates staff appointments");
 console.log("O76 school support roles: "+checks+" isolated PostgreSQL checks passed.");
} finally { await db.close(); }
