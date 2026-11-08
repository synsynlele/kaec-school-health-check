import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/lib/khpos/ops/ai-budget.ts", "utf8");
const assistant = readFileSync("src/lib/khpos/ops/assistant.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261108100500_khpos_ai_budget_governance.sql", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
const environment = { ...process.env, KHPOS_AI_MONTHLY_USD_CAP: "0.30" };
delete environment.KHPOS_AI_INPUT_USD_PER_1M;
delete environment.KHPOS_AI_OUTPUT_USD_PER_1M;
vm.runInNewContext(compiled, {
  exports: moduleExports, process: { env: environment }, console,
}, { filename: "ai-budget.js" });

const { khposAiRates, khposAiCostMicroUsd, khposAiMonthlyCapMicroUsd,
  reserveKhposAi, settleKhposAi } = moduleExports;

assert.equal(khposAiRates("not-listed-model"), null, "unknown model pricing cannot be free");
assert.equal(khposAiRates("gpt-4.1-mini-2025-04-14").input, 0.4);
assert.equal(khposAiCostMicroUsd(2000, 500, { input: 0.4, output: 1.6 }), 1600);
assert.equal(khposAiMonthlyCapMicroUsd(), 300000);

const calls = [];
const fakeDb = { rpc: async (name, params) => {
  calls.push({ name, params });
  return { data: name === "khpos_ai_budget_reserve"
    ? "34b269ae-8001-4f14-b7c6-85b54a8f4f12" : true, error: null };
}};
const permit = await reserveKhposAi(fakeDb, {
  organisationId: "a1",
  actorUserId: "u1",
  feature: "ask",
  model: "gpt-4.1-mini-2025-04-14",
  inputCharacters: 5000,
  maxOutputTokens: 550,
});
assert.ok(permit);
assert.equal(calls[0].name, "khpos_ai_budget_reserve");
assert.equal(calls[0].params.p_limit_micro_usd, 300000);
assert.ok(calls[0].params.p_estimate_micro_usd > 0);
await settleKhposAi(fakeDb, permit, { inputTokens: 2000, outputTokens: 500 }, true);
assert.equal(calls[1].name, "khpos_ai_budget_settle");
assert.equal(calls[1].params.p_actual_micro_usd, 1600);

const failDb = { rpc: async () => ({ data: null, error: { code: "PGRST202" } }) };
assert.equal(await reserveKhposAi(failDb, {
  organisationId: "a1", actorUserId: "u1", feature: "ask",
  model: "gpt-4.1-mini-2025-04-14", inputCharacters: 10, maxOutputTokens: 50,
}), null, "missing migration must not cause an unmetered AI call");

environment.KHPOS_AI_INPUT_USD_PER_1M = "5";
assert.equal(khposAiRates("gpt-4.1-mini-2025-04-14"), null, "partially configured prices must block AI");
delete environment.KHPOS_AI_INPUT_USD_PER_1M;

assert.match(assistant, /!groundedContext \|\| !permit/);
assert.match(assistant, /reserveKhposAi\(/);
assert.match(assistant, /settleKhposAi\(/);
assert.match(assistant, /getKhposImprovementWorkspace/);
assert.match(assistant, /prepareKhposMeetingAgenda/);
assert.match(migration, /for update/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on function .* from public, anon, authenticated/i);
assert.match(migration, /grant execute on function .* to service_role/i);
assert.doesNotMatch(migration, /security definer/i);

// Exercise the real migration and atomic quota accounting against an ephemeral Postgres.
const { PGlite } = await import("@electric-sql/pglite");
const pg = new PGlite();
await pg.exec(`
  create table public.organisations (id uuid primary key);
  create role anon;
  create role authenticated;
  create role service_role;
  insert into public.organisations (id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
`);
await pg.exec(migration);
const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
async function reserveMicro(estimate, limit) {
  const res = await pg.query(
    "select public.khpos_ai_budget_reserve($1::uuid,$2::uuid,'ask',$3::bigint,$4::bigint) as id",
    [org, actor, estimate, limit],
  );
  return res.rows[0].id;
}
const first = await reserveMicro(2000, 3000);
assert.ok(first, "first request should be reserved");
assert.equal(await reserveMicro(2000, 3000), null, "reserved requests count towards budget");
const settled = await pg.query(
  "select public.khpos_ai_budget_settle($1::uuid,1000,1000,250,'gpt-4.1-mini',true) as ok",
  [first],
);
assert.equal(settled.rows[0].ok, true);
const twice = await pg.query(
  "select public.khpos_ai_budget_settle($1::uuid,1000,1000,250,'gpt-4.1-mini',true) as ok",
  [first],
);
assert.equal(twice.rows[0].ok, false, "settlement must be idempotent");
assert.ok(await reserveMicro(2000, 3000), "settlement releases unspent reservation");
assert.equal(await reserveMicro(1, 3000), null, "spent plus reserved reaches the cap");
const access = await pg.query(`
  select has_table_privilege('anon', 'public.khpos_ai_usage_months', 'SELECT') as anon_month,
         has_table_privilege('authenticated', 'public.kaec_ai_usage_events', 'SELECT') as member_kshc,
         has_function_privilege('anon','public.khpos_ai_budget_reserve(uuid,uuid,text,bigint,bigint)','EXECUTE') as anon_reserve;
`);
assert.deepEqual(access.rows[0], {
  anon_month: false, member_kshc: false, anon_reserve: false,
}, "AI spend history and spending controls must not be exposed to clients");
await pg.close();

console.log("KHP-OS agentic AI budget: model pricing, atomic reservation calls, fail-closed fallback, governance and KSHC reuse verified.");
