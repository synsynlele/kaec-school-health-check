import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db=new PGlite();
const uid=n=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
const [founder,guide,alliance,school,flagship,engagement,commitment] =
  [1,2,3,10,11,20,21].map(uid);
const query=(sql,args=[])=>db.query(sql,args).then(x=>x.rows);
try{
  await db.exec("create schema auth; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
  await db.exec("create table public.organisations(id uuid primary key,name text not null,status text not null,partner_status text,partner_entitlements text[]);");
  await db.exec(fs.readFileSync("supabase/migrations/20261018100000_kaec_hq_corporate_foundation.sql","utf8"));
  await db.exec(fs.readFileSync("supabase/migrations/20261018113000_kaec_hq_operational_workflows.sql","utf8"));
  await db.exec(fs.readFileSync("supabase/migrations/20261018140000_kaec_hq_school_execution.sql","utf8"));
  const users=[founder,guide,alliance];
  for(const id of users)await query("insert into auth.users(id) values($1)",[id]);
  await query("insert into public.organisations(id,name,status,partner_status,partner_entitlements) values($1,'Partner School','active','active',array['khpos_core']),($2,'KAEC Nigerian Schools','active','active',array['khpos_core'])",[school,flagship]);
  await query("insert into public.kaec_hq_members(user_id,email,display_name,role,granted_by) values($1,'vision@test.invalid','Vision','vision_custodian',$1),($2,'guide@test.invalid','Pathfinder','school_pathfinder',$1),($3,'alliance@test.invalid','Alliance','alliance_catalyst',$1)",users);
  const roles=await query("select role from public.kaec_hq_members where user_id=$1",[guide]);
  assert.equal(roles[0].role,"school_pathfinder");
  const access=await query("select has_table_privilege('authenticated','public.kaec_hq_school_commitments','SELECT') as client_read,has_table_privilege('anon','public.kaec_hq_school_followups','INSERT') as anon_write,has_table_privilege('service_role','public.kaec_hq_school_commitments','SELECT') as server_read, (select relrowsecurity from pg_class where oid='public.kaec_hq_school_followups'::regclass) as rls_on");
  assert.deepEqual(access[0],{client_read:false,anon_write:false,server_read:true,rls_on:true});
  await assert.rejects(query("insert into public.kaec_hq_school_engagements(id,organisation_id,engagement_status,representative_user_id,updated_by) values($1,$2,'active',$3,$4)",[engagement,school,guide,founder]));
  await query("insert into public.kaec_hq_school_engagements(id,organisation_id,engagement_status,agreement_reference,agreed_scope,contract_verified_at,contract_verified_by,representative_user_id,updated_by) values($1,$2,'active','SIGNED-REF-01','Supervision on HQLS adoption, leadership execution and documented term deliverables',now(),$3,$4,$3)",[engagement,school,founder,guide]);
  await assert.rejects(query("insert into public.kaec_hq_school_commitments(id,engagement_id,title,agreed_expectation,agreement_clause,evidence_expected,status,created_by,updated_by) values($1,$2,'Lesson quality audit','Each school submits verifiable HQLS adoption evidence','Plan-2','School work sample','verified',$3,$3)",[commitment,engagement,alliance]));
  await query("insert into public.kaec_hq_school_commitments(id,engagement_id,title,agreed_expectation,agreement_clause,evidence_expected,status,created_by,updated_by) values($1,$2,'Lesson quality audit','Each school submits verifiable HQLS adoption evidence','Plan-2','School work sample','planned',$3,$3)",[commitment,engagement,alliance]);
  await query("insert into public.kaec_hq_school_followups(commitment_id,mode,outcome,next_followup_on,recorded_by) values($1,'video','Leader demonstrated use of the lesson planning workflow','2026-10-25',$2)",[commitment,guide]);
  await query("update public.kaec_hq_school_commitments set status='evidence_submitted', evidence_reference='Verified work sample 01',progress_note='Lesson quality sample submitted for independent review',updated_by=$2 where id=$1",[commitment,guide]);
  await query("update public.kaec_hq_school_commitments set status='verified',verified_by=$2,verified_at=now(),updated_by=$2 where id=$1",[commitment,alliance]);
  const commitmentAfter=await query("select status,verified_by from public.kaec_hq_school_commitments where id=$1",[commitment]);
  assert.equal(commitmentAfter[0].status,"verified");
  assert.equal(commitmentAfter[0].verified_by,alliance);
  const audit=await query("select action,count(*)::int as total from public.kaec_hq_school_events group by action order by action");
  assert(audit.reduce((sum,x)=>sum+x.total,0)>=5,"Every corporate school mutation must create audit history");
  assert(audit.some(x=>x.action==="insert"));
  assert(audit.some(x=>x.action==="update"));
  const trail=await query("select count(*)::int as total from public.kaec_hq_school_followups where commitment_id=$1",[commitment]);
  assert.equal(trail[0].total,1);
  console.log("KAEC HQ School Pathfinders: partner schema, corporate role, RLS/grants, agreement activation, evidence gate, follow-ups, independent verification, atomic audit passed.");
}finally{await db.close();}
