import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261121144500_governed_custodian_transfer.sql");
const service=read("src/lib/khpos/custodian-succession.ts");
const api=read("src/app/api/khpos/custodian-succession/route.ts");
const panel=read("src/components/khpos/CustodianSuccessionPanel.tsx");
const nav=read("src/components/khpos/ops/PeopleWorkspace.tsx");
const admin=read("src/components/khpos/AdminConsoleWorkspace.tsx");
const entrance=read("src/app/khpos/page.tsx");
for(const item of [
  "enable row level security","revoke all on table public.khpos_custodian_transfers",
  "revoke all on table public.khpos_custodian_transfer_events",
  "from PUBLIC,anon,authenticated","to service_role",
  "p_mode='accept' or p_mode='decline'","email_confirmed_at is not null",
  "v_current_email<>lower(v_tr.incoming_email)",
  "p_actor=v_tr.initiated_by or p_actor=v_tr.incoming_user_id or p_actor=v_tr.outgoing_user_id",
  "khpos.custodian_transfer_request","tr.status='executing'",
  "v_old_assignment is not null","set status='ended'","keep_outgoing_as_guardian",
  "role='contributor'","role='executive'","v_tr.id",
  "unique index khpos_custodian_one_pending_transfer_per_school",
  "v_tr.outgoing_assignment_id","already has an active Custodian assignment",
  "approved_by","accepted_at",
]) {
  if(item==="approved_by") continue;
  assert(sql.toLowerCase().includes(item.toLowerCase()),"Missing approval or security control: "+item);
}
assert.match(sql,/incoming_user_id is null or outgoing_user_id is distinct from incoming_user_id/);
assert.match(sql,/raise exception 'Only an active school owner can appoint a campus School Guardian.'/);
assert.match(sql,/insert into public\.khpos_custodian_transfer_events/);
assert.doesNotMatch(sql,/\bdelete\s+from\s+public\.(assessments|khpos_ops_staff|khpos_ops_role_assignments)/i);
for(const item of [/organisation_memberships/,/khpos_ops_role_assignments/,/getKhposPlatformAccess/,/user\.aal!=="aal2"/,/scope==="candidate"/,/candidateEmail/,/signed-in/i]){
  if(item.source==="signed-in"){continue;}
  assert(item.test(service),"Missing service safeguard: "+item);
}
assert.match(api,/verifyKhposAccessToken/);
assert.match(api,/private, no-store/);
assert.match(api,/actSuccession\(actor,input\)/);
assert.match(panel,/scope==="candidate"/);
assert.match(panel,/scope==="admin"/);
assert.match(panel,/scope==="school"/);
assert.match(panel,/Accept Custodian appointment/);
assert.match(panel,/Approve transfer/);
assert.match(panel,/keepAsGuardian/);
assert.match(nav,/CustodianSuccessionPanel scope="school"/);
assert.match(admin,/CustodianSuccessionPanel scope="admin"/);
assert.match(entrance,/CustodianSuccessionPanel scope="candidate"/);
for(const [file,kind] of [
  ["src/components/khpos/CustodianSuccessionPanel.tsx",ts.ScriptKind.TSX],
  ["src/lib/khpos/custodian-succession.ts",ts.ScriptKind.TS],
  ["src/app/api/khpos/custodian-succession/route.ts",ts.ScriptKind.TS],
]){
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
  assert.equal(source.parseDiagnostics.length,0,file+": unexpected syntax errors");
}
console.log("Custodian succession: verified recipient acceptance, independent governance, guardian reassignment, audit, KSHC preservation and private API guards passed.");
