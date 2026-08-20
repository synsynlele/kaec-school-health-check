import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read(
  "supabase/migrations/20260814203947_stage3_implementation_automation.sql",
);
const implementation = read("src/lib/khpos/implementation.ts");
const route = read(
  "src/app/api/khpos/implementation/[organisationId]/route.ts",
);
const component = read("src/components/khpos/ImplementationWorkspace.tsx");
const prioritiesPage = read(
  "src/components/khpos/PriorityInterventionWorkspace.tsx",
);

assert.ok(
  migration.includes("create table if not exists public.khpos_implementation_plans"),
  "Implementation plans table must exist",
);
assert.ok(
  migration.includes("create table if not exists public.khpos_implementation_actions"),
  "Implementation actions table must exist",
);
assert.ok(
  migration.includes("create table if not exists public.khpos_implementation_events"),
  "Implementation events table must exist",
);
assert.ok(
  migration.includes("create function public.khpos_create_implementation_plan_for_priority"),
  "Approval-driven plan creation function must exist",
);
assert.ok(
  migration.includes("create function public.khpos_generate_due_followups"),
  "Deterministic follow-up generation must exist",
);
assert.ok(
  migration.includes("create function public.khpos_touch_implementation_action"),
  "Action immutability guard must exist",
);
assert.ok(
  migration.includes("create trigger trg_khpos_priority_create_implementation"),
  "Priority approval must trigger implementation plan generation",
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
  component.includes("The intervention stays disciplined. The execution becomes specific."),
  "Implementation UI must communicate system-governed, institution-specific execution",
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
