import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O3 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/work"', "school workspace navigation");
requireText(nav, 'label: "My Work"', "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/work/page.tsx");
requireText(page, "MyWorkWorkspace", "My Work route");
requireText(page, "UUID_RE", "My Work route validation");

const api = read("src/app/api/khpos/ops/work/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsMyWork",
  "updateKhposOpsWork",
  "setKhposOpsChecklistResponse",
  "addKhposOpsWorkEvidence",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "My Work API");
}

const service = read("src/lib/khpos/ops/work.ts");
for (const expected of [
  "khpos_ops_get_my_work_server",
  "khpos_ops_update_work_server",
  "khpos_ops_set_checklist_response_server",
  "khpos_ops_add_work_evidence_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "My Work service");
}

const workspace = read("src/components/khpos/ops/MyWorkWorkspace.tsx");
for (const expected of [
  "Operations · O3",
  "My Work",
  "Your role decides what appears here.",
  "KHP-OS does not create busywork.",
  "Evidence / operating note",
]) {
  requireText(workspace, expected, "My Work workspace");
}

const migration = read(
  "supabase/migrations/20260924123500_khpos_ops_o3_work_execution.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_checklist_templates",
  "create table if not exists public.khpos_ops_checklist_template_items",
  "create table if not exists public.khpos_ops_recurring_rules",
  "create table if not exists public.khpos_ops_work_items",
  "create table if not exists public.khpos_ops_checklist_responses",
  "create table if not exists public.khpos_ops_evidence",
  "exception_on_response",
  "khpos_ops_materialize_due_work_server",
  "khpos_ops_get_my_work_server",
  "khpos_ops_update_work_server",
  "khpos_ops_set_checklist_response_server",
  "khpos_ops_add_work_evidence_server",
  "complete all required checklist items before closing this work",
  "this checklist contains an unresolved exception",
  "required evidence must be added before closing this work",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O3 migration");
}

const seed = read("supabase/seeds/khpos_ops_o3_execution.sql");
for (const expected of [
  "ACD-004",
  "ACD-009",
  "HPD-004",
  "IPA-007",
  "IPA-008",
  "CHK-ACD-004",
  "CHK-ACD-009",
  "CHK-HPD-004",
  "CHK-IPA-007",
  "CHK-IPA-008",
  "RCR-ACD-004-TEACHER",
  "RCR-ACD-009-AI",
  "RCR-HPD-004-SI",
  "RCR-IPA-007-SG",
  "RCR-IPA-008-VC",
  "ops_o3_execution_bootstrapped",
]) {
  requireText(seed, expected, "KNS O3 execution seed");
}

for (const protectedFile of [
  "src/lib/khpos/implementation.ts",
  "src/lib/khpos/evidence.ts",
]) {
  const source = read(protectedFile);
  if (
    source.includes("khpos_ops_work_items") ||
    source.includes("khpos_ops_evidence")
  ) {
    throw new Error(
      `Operations O3 contract failed: ${protectedFile} must remain separate from Operations execution.`,
    );
  }
}

console.log("KHP-OS Operations O3 work-execution contracts validated.");
