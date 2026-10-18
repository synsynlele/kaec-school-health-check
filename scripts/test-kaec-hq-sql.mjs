import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const uid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const [founder,steward,task,termly] = [uid(1),uid(2),uid(10),uid(11)];
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
try {
  await db.exec("create schema auth; create role anon; create role authenticated; create role service_role; create table auth.users(id uuid primary key);");
  await db.exec(fs.readFileSync("supabase/migrations/20261018100000_kaec_hq_corporate_foundation.sql","utf8"));
  await db.exec(fs.readFileSync("supabase/migrations/20261018113000_kaec_hq_operational_workflows.sql","utf8"));
  await query("insert into auth.users(id) values($1),($2)",[founder,steward]);
  await query("insert into public.kaec_hq_members(user_id,email,display_name,role,granted_by) values($1,'founder@test.invalid','Founder','vision_custodian',$1),($2,'steward@test.invalid','Steward','system_steward',$1)",[founder,steward]);
  const checks=await query("select relrowsecurity from pg_class where oid='public.kaec_hq_records'::regclass");
  assert.equal(checks[0].relrowsecurity,true);
  const access=await query("select has_table_privilege('authenticated','public.kaec_hq_records','SELECT') as account_read,has_table_privilege('anon','public.kaec_hq_records','INSERT') as anon_write,has_table_privilege('service_role','public.kaec_hq_records','SELECT') as server_read");
  assert.deepEqual(access[0],{account_read:false,anon_write:false,server_read:true});
  await query("insert into public.kaec_hq_records (id,module,record_type,title,status,priority,owner_user_id,backup_user_id,due_on,cadence,created_by,updated_by,evidence_note) values($1,'work','recurring_obligation','Monthly operations reporting','active','normal',$2,null,'2026-01-31','monthly',$2,$2,'Evidence for the first month')",[task,founder]);
  await query("update public.kaec_hq_records set status='completed',review_note='Owner attested ordinary report',updated_at=now() where id=$1",[task]);
  let cycles=await query("select cycle_index,due_on::text as due_on,status,series_root_id,previous_cycle_id from public.kaec_hq_records where id=$1 or series_root_id=$1 order by cycle_index",[task]);
  assert.equal(cycles.length,2,"One next occurrence created atomically");
  assert.equal(cycles[1].due_on,"2026-02-28");
  assert.equal(cycles[1].status,"active");
  assert.equal(cycles[1].previous_cycle_id,task);
  assert.equal(cycles[1].series_root_id,task);
  const second=await query("select id from public.kaec_hq_records where series_root_id=$1 and cycle_index=2",[task]);
  await query("update public.kaec_hq_records set status='completed',updated_at=now() where id=$1",[second[0].id]);
  cycles=await query("select cycle_index,due_on::text as due_on from public.kaec_hq_records where id=$1 or series_root_id=$1 order by cycle_index",[task]);
  assert.deepEqual(cycles.map(c=>c.due_on),["2026-01-31","2026-02-28","2026-03-31"],"Month-end recurrence must not drift");
  await query("update public.kaec_hq_records set title='Updated completed task' where id=$1",[task]);
  const afterDuplicate=await query("select count(*)::int as total from public.kaec_hq_records where series_root_id=$1",[task]);
  assert.equal(afterDuplicate[0].total,2,"Repeated updates cannot generate duplicates");
  await query("insert into public.kaec_hq_records (id,module,record_type,title,status,priority,owner_user_id,due_on,cadence,created_by,updated_by) values($1,'work','task','Termly school partnership check','active','normal',$2,'2026-10-18','termly',$2,$2)",[termly,founder]);
  await query("update public.kaec_hq_records set status='completed' where id=$1",[termly]);
  const termlyCycles=await query("select count(*)::int as total from public.kaec_hq_records where series_root_id=$1",[termly]);
  assert.equal(termlyCycles[0].total,0,"Termly work must never invent a next academic term date");
  const audits=await query("select count(*)::int as total from public.kaec_hq_audit_events");
  assert(audits[0].total>=9,"Appointment and record mutations must be audited");
  console.log("KAEC HQ database integration: RLS grants, audit events, one-cycle atomic rollover, month-end anchoring, replay safety, and manual termly scheduling passed.");
} finally {
  await db.close();
}
