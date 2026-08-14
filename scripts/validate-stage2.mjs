import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const required = [
  "src/lib/khpos/priorities.ts",
  "src/components/khpos/PriorityInterventionWorkspace.tsx",
  "src/app/khpos/[organisationId]/priorities/page.tsx",
  "src/app/api/khpos/priorities/[id]/route.ts",
  "supabase/migrations/20260814174453_stage2_priority_intervention_engine.sql",
  "docs/KHPOS_STAGE2_PRIORITY_INTERVENTION.md",
];
for (const file of required) assert.ok(existsSync(file), `${file} must exist`);

const foundation = JSON.parse(readFileSync("src/lib/khpos/foundation.v1.json", "utf8"));
assert.equal(foundation.indicatorRegistry.length, 55, "Stage 2 must preserve the frozen 55-indicator registry");

const migration = readFileSync(
  "supabase/migrations/20260814174453_stage2_priority_intervention_engine.sql",
  "utf8",
);
for (const table of [
  "khpos_interventions",
  "khpos_intervention_versions",
  "khpos_indicator_intervention_map",
  "khpos_priorities",
  "khpos_organisation_interventions",
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}
for (const indicator of foundation.indicatorRegistry) {
  assert.match(migration, new RegExp(`'${indicator.indicatorId}'`), `${indicator.indicatorId} must be mapped into Intervention Library v1.0`);
}
assert.match(migration, /khpos_approve_priority_server/);
assert.match(migration, /khpos_archive_priority_server/);
assert.match(migration, /v_active_count >= 3/i, "database must enforce the three-priority focus cap");
assert.match(migration, /status in \('approved','active'\)/i);
assert.match(migration, /grant execute .*service_role/is);
assert.match(migration, /from public, anon, authenticated/is);
assert.match(migration, /priority_approved/);
assert.match(migration, /priority_archived/);

const priorities = readFileSync("src/lib/khpos/priorities.ts", "utf8");
assert.match(priorities, /QUESTION_INDEX/);
assert.match(priorities, /getKhposIndicatorMapping/);
assert.match(priorities, /getKhposRoute/);
assert.match(priorities, /score < 1 \|\| score > 3/);
assert.match(priorities, /selected\.length >= 8/);
assert.match(priorities, /count >= 2/);
assert.match(priorities, /agendaLimit: 3/);
assert.match(priorities, /khpos_approve_priority_server/);
assert.match(priorities, /khpos_archive_priority_server/);

const route = readFileSync("src/app/api/khpos/priorities/[id]/route.ts", "utf8");
assert.match(route, /verifyKhposAccessToken/);
assert.match(route, /action === "approve"/);
assert.match(route, /action === "archive"/);

const ui = readFileSync("src/components/khpos/PriorityInterventionWorkspace.tsx", "utf8");
assert.match(ui, /Maximum 3 active priorities/);
assert.match(ui, /Approve priority & intervention/);
assert.match(ui, /Deterministic, not AI-guessed/);
assert.match(ui, /Archive from active agenda/);

const commandCentre = readFileSync("src/components/khpos/CommandCentre.tsx", "utf8");
assert.match(commandCentre, /Build transformation agenda/);
assert.match(commandCentre, /\/priorities/);
assert.match(commandCentre, /activePriorityCount/);

console.log("KHP-OS Stage 2 structural validation passed: deterministic priority ranking, human approval and mapped interventions are present.");
