import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/khpos/hq.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const users = [
  { user_id: "11111111-1111-4111-8111-111111111111", email: "worker@example.test", display_name: "Worker", role: "team_member", status: "active" },
  { user_id: "22222222-2222-4222-8222-222222222222", email: "finance@example.test", display_name: "Finance", role: "finance_steward", status: "active" },
  { user_id: "33333333-3333-4333-8333-333333333333", email: "vision@example.test", display_name: "Vision", role: "vision_custodian", status: "active" },
];
const records = [
  { id: "a", module: "work", title: "Assigned work", description: "", record_type: "task", status: "active", priority: "normal", created_by: users[0].user_id, owner_user_id: users[0].user_id, backup_user_id: null, updated_at: "2026-10-18T09:00:00Z" },
  { id: "b", module: "finance", title: "Private finance", description: "", record_type: "invoice", status: "active", priority: "normal", created_by: users[2].user_id, owner_user_id: users[2].user_id, backup_user_id: null, updated_at: "2026-10-18T10:00:00Z" },
  { id: "c", module: "governance", title: "Private charter", description: "", record_type: "policy", status: "active", priority: "normal", created_by: users[2].user_id, owner_user_id: users[2].user_id, backup_user_id: null, updated_at: "2026-10-18T11:00:00Z" },
];
const adapter = {
  from(table) {
    let rows = table === "kaec_hq_members" ? [...users] : table === "kaec_hq_records" ? [...records] : [];
    const query = {
      select() { return query; },
      eq(field, value) { rows = rows.filter((r) => r[field] === value); return query; },
      in(field, values) { rows = rows.filter((r) => values.includes(r[field])); return query; },
      order(field, { ascending = true } = {}) { rows.sort((a,b) => ascending ? String(a[field]).localeCompare(String(b[field])) : String(b[field]).localeCompare(String(a[field]))); return query; },
      limit(n) { rows = rows.slice(0,n); return query; },
      or(text) { const expressions = text.split(",").map((x) => x.split(".eq.")); rows = rows.filter((r) => expressions.some(([field,value]) => r[field] === value)); return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve,reject); },
    };
    return query;
  },
};
const exports = {};
const module = { exports };
const nativeEnvUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, nativeEnvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
new Function("require","module","exports",js)(
  (name) => {
    if (name === "@supabase/supabase-js") return { createClient: () => adapter };
    if (name === "@/lib/khpos/platform-admin") return { getKhposPlatformAccess: async () => null };
    throw new Error("Unexpected import: " + name);
  },
  module, exports,
);
const service = module.exports;
assert.equal(service.HQ_MODULES.length,7);
assert.equal(Object.keys(service.HQ_RECORD_TYPES).length,6);
const worker = { id: users[0].user_id, email: users[0].email, aal: "aal1" };
const finance = { id: users[1].user_id, email: users[1].email, aal: "aal1" };
const vision = { id: users[2].user_id, email: users[2].email, aal: "aal2" };
let snap = await service.getHqSnapshot(worker);
assert.deepEqual(snap.allowedModules, ["work","command"]);
assert.deepEqual(snap.records.map((r)=>r.id), ["a"]);
assert(snap.members.every((r) => r.email === ""), "Member emails must not be leaked to ordinary team accounts");
await assert.rejects(service.createHqRecord(worker, { module: "finance" }), (error)=>error.status===403);
await assert.rejects(service.createHqRecord(finance, { module: "finance" }), (error)=>error.status===403 && error.message.includes("MFA"));
snap = await service.getHqSnapshot(vision);
assert.deepEqual(snap.records.map((r)=>r.id), ["c","b","a"]);
assert(snap.members.some((r)=>r.email === users[1].email));
await assert.rejects(service.bootstrapHq(worker), (error)=>error.status===403);
await assert.rejects(service.getHqSnapshot({ ...worker, email: "wrong@example.test" }), (error)=>error.status===403);
const migration = fs.readFileSync("supabase/migrations/20261018100000_kaec_hq_corporate_foundation.sql","utf8");
for (const table of ["kaec_hq_members","kaec_hq_records","kaec_hq_audit_events"]) {
  assert(migration.includes("alter table public." + table + " enable row level security"));
}
assert(migration.includes("create trigger kaec_hq_record_audit"));
assert(migration.includes("create trigger kaec_hq_member_audit"));
console.log("KAEC HQ role isolation, seven modules, MFA gates, PII limitation and atomic audit triggers passed.");

if (nativeEnvUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = nativeEnvUrl;
if (nativeEnvKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = nativeEnvKey;
