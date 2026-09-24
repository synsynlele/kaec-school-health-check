import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O2 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/library"', "school workspace navigation");
requireText(nav, "Institutional Library", "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/library/page.tsx");
requireText(page, "InstitutionalLibrary", "library route");
requireText(page, "UUID_RE", "library route validation");

const api = read("src/app/api/khpos/ops/library/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsLibrary",
  "acknowledgeKhposOpsPolicy",
  "acknowledge_policy",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "Operations library API");
}

const service = read("src/lib/khpos/ops/library.ts");
for (const expected of [
  "khpos_ops_get_library_server",
  "khpos_ops_acknowledge_policy_server",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KhposOpsPolicyVersion",
  "KhposOpsProcessVersion",
]) {
  requireText(service, expected, "Operations library service");
}

const workspace = read("src/components/khpos/ops/InstitutionalLibrary.tsx");
for (const expected of [
  "Institutional Control Library",
  "Policy Register",
  "Process Register",
  "Tools Registry",
  "Registered · document pending",
  "Controlled Institutional Policy",
  "Transformation Playbooks remain intact",
]) {
  requireText(workspace, expected, "Institutional Library workspace");
}

const migration = read(
  "supabase/migrations/20260924122456_khpos_ops_o2_control_library.sql",
).toLowerCase();
for (const expected of [
  "create table if not exists public.khpos_ops_policies",
  "create table if not exists public.khpos_ops_policy_versions",
  "create table if not exists public.khpos_ops_policy_roles",
  "create table if not exists public.khpos_ops_policy_acknowledgements",
  "create table if not exists public.khpos_ops_processes",
  "create table if not exists public.khpos_ops_process_versions",
  "create table if not exists public.khpos_ops_process_roles",
  "create table if not exists public.khpos_ops_tool_templates",
  "approved policy versions are immutable",
  "approved process versions are immutable",
  "khpos_ops_get_library_server",
  "khpos_ops_acknowledge_policy_server",
  "from public, anon, authenticated",
  "to service_role",
]) {
  requireText(migration, expected.toLowerCase(), "Operations O2 migration");
}

const policySeed = read("supabase/seeds/khpos_ops_o2_policies.sql");
for (const expected of [
  "GOV-P01",
  "PEO-P02",
  "ACD-P01",
  "LPI-P01",
  "HPD-P01",
  "CUL-P01",
  "PAR-P02",
  "IPA-P01",
  "SAF-P01",
  "ops_o2_policy_register_bootstrapped",
]) {
  requireText(policySeed, expected, "KNS O2 policy seed");
}

const processSeed = read("supabase/seeds/khpos_ops_o2_processes.sql");
for (const expected of [
  "GOV-001",
  "PEO-001",
  "ACD-001",
  "LPI-001",
  "HPD-001",
  "CUL-001",
  "SAF-001",
  "PAR-001",
  "FIN-001",
  "OPS-001",
  "EVT-001",
  "IPA-001",
  "GOV-007",
  "ops_o2_process_register_bootstrapped",
]) {
  requireText(processSeed, expected, "KNS O2 process seed");
}

const toolSeed = read("supabase/seeds/khpos_ops_o2_tools.sql");
for (const expected of [
  "UTL-001",
  "UTL-030",
  "Issue Record",
  "Policy Acknowledgement",
  "ops_o2_tools_registry_bootstrapped",
]) {
  requireText(toolSeed, expected, "KNS O2 tools seed");
}

const playbooks = read("src/lib/khpos/playbooks.ts");
if (!playbooks.includes("UNIVERSAL_SCHOOL_PLAYBOOKS")) {
  throw new Error("Operations O2 contract failed: transformation playbooks must remain intact.");
}

for (const protectedFile of [
  "src/lib/khpos/priorities.ts",
  "src/lib/khpos/implementation.ts",
  "src/lib/khpos/evidence.ts",
  "src/lib/khpos/review.ts",
  "src/lib/khpos/improvement.ts",
]) {
  const source = read(protectedFile);
  if (source.includes("khpos_ops_policies") || source.includes("khpos_ops_processes")) {
    throw new Error(
      `Operations O2 contract failed: ${protectedFile} must remain independent from the Operations control library.`,
    );
  }
}

console.log("KHP-OS Operations O2 control library contracts validated.");
