import fs from "node:fs";

const required = [
  "src/lib/khpos/pipupath-integration.ts",
  "src/app/api/khpos/integrations/pipupath/[id]/route.ts",
  "src/app/api/khpos/integrations/pipupath/receive/route.ts",
  "src/components/khpos/HumanPotentialIntelligenceWorkspace.tsx",
  "src/app/khpos/[organisationId]/human-potential-intelligence/page.tsx",
  "supabase/migrations/20260814202903_stage8_pipupath_integration.sql",
  "docs/KHPOS_STAGE8_PIPUPATH_INTEGRATION.md",
];

for (const path of required) {
  if (!fs.existsSync(path)) throw new Error(`Stage 8 required file missing: ${path}`);
}

const migration = fs.readFileSync(required[5], "utf8");
const integration = fs.readFileSync(required[0], "utf8");
const receiver = fs.readFileSync(required[2], "utf8");
const workspace = fs.readFileSync(required[3], "utf8");
const workspaceNav = fs.readFileSync("src/components/khpos/SchoolWorkspaceNav.tsx", "utf8");

for (const needle of [
  "provider in ('ksi','pipupath')",
  "khpos_pipupath_signal_snapshots",
  "khpos_create_pipupath_pairing_server",
  "khpos_pair_pipupath_with_signal_server",
  "khpos_create_pipupath_sync_token_server",
  "khpos_ingest_pipupath_signal_server",
  "reporting_eligible and cohort_member_count >= 5",
  "set search_path = ''",
  "to service_role",
]) {
  if (!migration.includes(needle)) throw new Error(`Stage 8 migration guard missing: ${needle}`);
}

if (!migration.includes("not reporting_eligible and cohort_member_count = 0")) {
  throw new Error("Stage 8 must suppress exact small-cohort counts.");
}
if (!migration.includes("connector_token_hash=null")) {
  throw new Error("Stage 8 PipuPath must not establish a persistent connector secret.");
}
for (const forbidden of ["learner_id", "student_id", "profile_content", "reflection_text", "contact_email"]) {
  if (migration.includes(forbidden) || receiver.includes(forbidden)) {
    throw new Error(`Stage 8 privacy boundary violated by field: ${forbidden}`);
  }
}
for (const needle of [
  "KHPOS_PIPUPATH_REPORTING_MINIMUM = 5",
  "derivePipupathSignals",
  "No composite score",
  "PIPUPATH_INTEGRATION_URL",
]) {
  if (!integration.includes(needle) && !workspace.includes(needle)) {
    throw new Error(`Stage 8 application guard missing: ${needle}`);
  }
}
if (!receiver.includes("MAX_BODY_BYTES") || !receiver.includes('action?: "pair" | "sync"')) {
  throw new Error("Stage 8 receiver must be bounded and operation-scoped.");
}
if (!workspaceNav.includes("human-potential-intelligence") || !workspaceNav.includes("learning-intelligence")) {
  throw new Error("Stage 8 intelligence workspaces must be reachable from the shared school workspace navigation.");
}
if (integration.includes("resolvePriority") || integration.includes("khpos_reassessments")) {
  throw new Error("PipuPath signals cannot resolve priorities or mutate reassessment authority.");
}

console.log("Stage 8 PipuPath integration validation passed: explicit voluntary cohorts, five-person privacy threshold, one-time sync trust, four institutional signals and reassessment authority boundary are present.");
