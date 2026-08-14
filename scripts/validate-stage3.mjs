import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260814181030_stage3_implementation_automation.sql", import.meta.url),
  "utf8",
);
const implementation = readFileSync(
  new URL("../src/lib/khpos/implementation.ts", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../src/app/api/khpos/implementation/[id]/route.ts", import.meta.url),
  "utf8",
);
const component = readFileSync(
  new URL("../src/components/khpos/ImplementationWorkspace.tsx", import.meta.url),
  "utf8",
);
const prioritiesPage = readFileSync(
  new URL("../src/app/khpos/[organisationId]/priorities/page.tsx", import.meta.url),
  "utf8",
);

for (const table of [
  "khpos_implementation_plans",
  "khpos_implementation_actions",
  "khpos_milestones",
  "khpos_evidence_requirements",
  "khpos_review_schedules",
]) {
  assert.ok(migration.includes(`public.${table}`), `${table} must exist in Stage 3 migration`);
}

assert.ok(
  migration.includes("khpos_private.generate_implementation_plan"),
  "Stage 3 must generate implementation plans automatically inside Postgres",
);
assert.ok(
  migration.includes("trg_khpos_sync_implementation_plan"),
  "Stage 3 must attach automatic generation to intervention lifecycle changes",
);
assert.ok(
  migration.includes("implementation_plan_generated"),
  "Stage 3 generation must be auditable",
);
assert.ok(
  migration.includes("(v_plan_id, 6,"),
  "Stage 3 must generate the six-step execution sequence",
);
assert.ok(
  migration.includes("'midpoint'") && migration.includes("'outcome'"),
  "Stage 3 must schedule midpoint and outcome reviews",
);
assert.ok(
  migration.includes("revoke all privileges on table public.khpos_implementation_plans from public, anon, authenticated"),
  "Implementation data must remain server-mediated",
);

assert.ok(
  implementation.includes("getKhposWorkspaceSnapshot"),
  "Implementation access must reuse verified organisation membership",
);
assert.ok(
  implementation.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "Implementation data must be read server-side",
);
assert.ok(
  route.includes("export async function GET"),
  "Implementation API must expose a read path",
);
assert.ok(
  !route.includes("export async function POST"),
  "Stage 3 must not expose manual plan creation or editing",
);
assert.ok(
  component.includes("KHP-OS builds the execution path"),
  "Implementation UI must communicate system-generated execution",
);
assert.ok(
  component.includes("Humans execute the real-world work and provide proof"),
  "Implementation UI must preserve the human execution/evidence boundary",
);
assert.ok(
  prioritiesPage.includes(`/implementation`),
  "Transformation Agenda must link into the generated implementation workspace",
);

console.log(
  "KHP-OS Stage 3 structural validation passed: approval-driven implementation automation is present.",
);
