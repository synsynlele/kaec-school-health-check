import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O5 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/decisions"', "school workspace navigation");
requireText(nav, 'label: "Decisions & Approvals"', "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/decisions/page.tsx");
requireText(page, "DecisionsWorkspace", "decisions route");
requireText(page, "UUID_RE", "decisions route validation");

const api = read("src/app/api/khpos/ops/decisions/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsDecisions",
  "createKhposOpsDecision",
  "actOnKhposOpsDecision",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O5 decisions API");
}

const service = read("src/lib/khpos/ops/decisions.ts");
for (const expected of [
  "khpos_ops_get_decisions_server",
  "khpos_ops_create_decision_server",
  "khpos_ops_decision_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
  '"approve"',
  '"return"',
  '"resubmit"',
  '"withdraw"',
]) {
  requireText(service, expected, "O5 decisions service");
}

const workspace = read("src/components/khpos/ops/DecisionsWorkspace.tsx");
for (const expected of [
  "Operations · O5",
  "Decisions & Approvals",
  "Make authority visible.",
  "Request authority",
  "Record decision",
  "Implementation in My Work",
  "KHP-OS will not guess authority.",
]) {
  requireText(workspace, expected, "O5 decisions workspace");
}

const migration = read(
  "supabase/migrations/20260924133624_khpos_ops_o5_decisions.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_decisions",
  "create table if not exists public.khpos_ops_decision_events",
  "source_decision_id",
  "ops_role_is_ancestor",
  "ops_create_decision_work",
  "ops_sync_decision_from_work",
  "khpos_ops_get_decisions_server",
  "khpos_ops_create_decision_server",
  "khpos_ops_decision_action_server",
  "decision requests can only move upward through the active reporting chain",
  "direct decision recording is limited to active kns leadership roles",
  "the linked implementation action must be completed before this decision can close",
  "sensitive safeguarding decisions must use the restricted safeguarding route",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O5 migration");
}

const seed = read("supabase/seeds/khpos_ops_o5_decisions.sql");
for (const expected of [
  "GOV-001",
  "GOV-005",
  "lowest competent level",
  "No material decision disappears in a meeting, chat or verbal instruction",
  "ops_o5_decision_engine_bootstrapped",
]) {
  requireText(seed, expected, "KNS O5 decision seed");
}

const o3 = read(
  "supabase/migrations/20260924125010_khpos_ops_o3_work_execution.sql",
);
const o4 = read(
  "supabase/migrations/20260924130809_khpos_ops_o4_issue_engine.sql",
);
if (o3.includes("khpos_ops_decisions") || o4.includes("khpos_ops_decisions")) {
  throw new Error(
    "Operations O5 contract failed: historical O3/O4 migrations must remain unchanged and independent from the O5 decision engine.",
  );
}

console.log("KHP-OS Operations O5 decision-engine contracts validated.");
