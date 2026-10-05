import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(
      "KHP-OS execution-closure Wave 5 contract failed: " +
        label +
        " is missing " +
        JSON.stringify(expected),
    );
  }
}

const migration = read(
  "supabase/migrations/20261005165000_khpos_execution_closure_wave5.sql",
);

for (const expected of [
  "khpos_ops_start_manual_process_server",
  "activation_mode='manual_on_demand'",
  "ops_manual_process_started",
  "khpos_ops_apply_safe_execution_mappings_server",
  "pr.participation='owner'",
  "owner_count=1",
  "khpos_ops_role_assignments",
  "a.status='active'",
  "'ops_execution_safe_mapped'",
  "'ops_execution_safe_mapping_batch'",
  "grant execute on function public.khpos_ops_start_manual_process_server",
  "grant execute on function public.khpos_ops_apply_safe_execution_mappings_server",
]) {
  requireText(migration, expected, "governed manual execution migration");
}

if (
  migration.includes("status='configured'\n      and ep.activation_mode='manual_on_demand'") &&
  !migration.includes("No active person is assigned to the accountable role")
) {
  throw new Error(
    "KHP-OS execution-closure Wave 5 contract failed: manual execution must refuse unstaffed accountable roles.",
  );
}

const hardening = read(
  "supabase/migrations/20261005165500_khpos_execution_closure_wave5_hardening.sql",
);
for (const expected of [
  "This manual process has no active accountable role.",
  "ops_hpd_has_membership(a.user_id,p_organisation_id)",
  "The accountable assignment campus is not active in this school.",
  "The accountable assignment unit does not match the target campus.",
]) {
  requireText(hardening, expected, "post-deploy ownership and scope hardening");
}

const executionService = read("src/lib/khpos/ops/execution.ts");
for (const expected of [
  "safeMappingCandidate",
  "blockedByMissingAssignment",
  "applySafeKhposExecutionMappings",
  "startKhposManualProcess",
  "khpos_ops_apply_safe_execution_mappings_server",
  "khpos_ops_start_manual_process_server",
]) {
  requireText(executionService, expected, "execution service");
}

const executionApi = read("src/app/api/khpos/ops/execution/[id]/route.ts");
for (const expected of [
  'body.action === "apply_safe_mappings"',
  'body.action === "start_manual"',
  "startKhposManualProcess",
  "applySafeKhposExecutionMappings",
]) {
  requireText(executionApi, expected, "execution API");
}

const executionUi = read(
  "src/components/khpos/ops/ExecutionControlWorkspace.tsx",
);
for (const expected of [
  "Apply safe mappings",
  "safeMappingCandidates",
  "blockedMissingAssignment",
  "Start Process",
  "safe owner mapping ready",
  "owner role is not staffed",
]) {
  requireText(executionUi, expected, "Execution Control experience");
}

const workService = read("src/lib/khpos/ops/work.ts");
for (const expected of [
  "KhposOpsAvailableProcess",
  "availableProcesses",
  "getAvailableManualProcesses",
  'eq("activation_mode", "manual_on_demand")',
  'eq("user_id", userId)',
  "campusId",
  "unitId",
]) {
  requireText(workService, expected, "owner-specific Today catalogue");
}

const workApi = read("src/app/api/khpos/ops/work/[id]/route.ts");
for (const expected of [
  '"start_process"',
  "KhposExecutionError",
  "startKhposManualProcess",
  "campusId: payload.campusId ?? null",
  "unitId: payload.unitId ?? null",
]) {
  requireText(workApi, expected, "Today manual-start API");
}

const workUi = read("src/components/khpos/ops/MyWorkWorkspace.tsx");
for (const expected of [
  "Available to start",
  "On-demand responsibilities you own",
  "startAvailableProcess",
  'action: "start_process"',
  "process.campusId",
  "process.unitId",
  "Start Process",
]) {
  requireText(workUi, expected, "Today on-demand execution experience");
}

console.log("KHP-OS execution-closure Wave 5 contract passed.");
