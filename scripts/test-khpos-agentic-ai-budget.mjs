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

console.log("KHP-OS agentic AI budget: model pricing, atomic reservation calls, fail-closed fallback, governance and KSHC reuse verified.");
