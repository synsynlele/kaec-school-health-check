import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O1 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, "const operationsLinks", "school workspace navigation");
requireText(nav, 'suffix: "/team"', "school workspace navigation");
requireText(nav, "const dailyLinks", "school workspace navigation");
requireText(nav, "NavigationGroups", "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/team/page.tsx");
requireText(page, "OperationsTeamWorkspace", "team route");
requireText(page, "UUID_RE", "team route validation");

const api = read("src/app/api/khpos/ops/structure/[id]/route.ts");
for (const expected of [
  "bearerTokenFromRequest",
  "verifyKhposAccessToken",
  "getKhposOpsStructure",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "Operations structure API");
}

const service = read("src/lib/khpos/ops/structure.ts");
for (const expected of [
  "khpos_ops_get_structure_server",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KhposOpsRoleCharter",
  "KhposOpsRoleAssignment",
]) {
  requireText(service, expected, "Operations structure service");
}

const workspace = read("src/components/khpos/ops/OperationsTeamWorkspace.tsx");
for (const expected of [
  "Institutional Structure & Roles",
  "Operating hierarchy",
  "Reports to",
  "Owned outcomes",
  "Decision rights",
  "/api/khpos/ops/structure/",
]) {
  requireText(workspace, expected, "Operations team workspace");
}

const migration = read(
  "supabase/migrations/20260924113822_khpos_ops_o1_institutional_structure.sql",
);
for (const expected of [
  "create table if not exists public.khpos_ops_campuses",
  "create table if not exists public.khpos_ops_units",
  "create table if not exists public.khpos_ops_roles",
  "create table if not exists public.khpos_ops_role_assignments",
  "create table if not exists public.khpos_ops_role_charters",
  "create table if not exists public.khpos_ops_reporting_lines",
  "create table if not exists public.khpos_ops_backup_assignments",
  "create table if not exists public.khpos_ops_audit_events",
  "khpos_ops_get_structure_server",
  "revoke execute on function public.khpos_ops_get_structure_server(uuid,uuid)",
  "grant execute on function public.khpos_ops_get_structure_server(uuid,uuid)",
  "to service_role",
]) {
  requireText(migration.toLowerCase(), expected.toLowerCase(), "Operations O1 migration");
}

for (const role of ["public", "anon", "authenticated"]) {
  requireText(
    migration.toLowerCase(),
    `from public, anon, authenticated`,
    `Operations O1 function privilege boundary (${role})`,
  );
}

const hardeningMigration = read(
  "supabase/migrations/20260924114421_khpos_ops_o1_fk_index_hardening.sql",
);
for (const expected of [
  "idx_khpos_ops_campuses_created_by",
  "idx_khpos_ops_units_campus",
  "idx_khpos_ops_units_parent",
  "idx_khpos_ops_roles_reports_to",
  "idx_khpos_ops_role_assignments_campus",
  "idx_khpos_ops_role_assignments_unit",
  "idx_khpos_ops_role_charters_approved_by",
  "idx_khpos_ops_reporting_supervisor",
  "idx_khpos_ops_backup_backup",
  "idx_khpos_ops_audit_actor",
]) {
  requireText(
    hardeningMigration,
    expected,
    "Operations O1 foreign-key index hardening",
  );
}

const seed = read("supabase/seeds/khpos_ops_o1_kns.sql");
for (const expected of [
  "KAEC Nigerian Schools",
  "'IGANDO','Igando Campus'",
  "'VISION_CUSTODIAN','Vision Custodian'",
  "'SCHOOL_GUARDIAN','School Guardian'",
  "'ACADEMIC_INSPECTOR','Academic Inspector'",
  "'SKILL_INSPECTOR','Skill Inspector'",
  "'SECTIONAL_PROMOTER','Sectional Promoter'",
  "'TEACHER','Teacher'",
  "'SKILLS_FACILITATOR','Skills Facilitator'",
  "ops_o1_structure_bootstrapped",
]) {
  requireText(seed, expected, "KNS O1 seed");
}

for (const protectedFile of [
  "src/lib/khpos/priorities.ts",
  "src/lib/khpos/implementation.ts",
  "src/lib/khpos/evidence.ts",
  "src/lib/khpos/review.ts",
  "src/lib/khpos/improvement.ts",
]) {
  const source = read(protectedFile);
  if (source.includes("khpos_ops_")) {
    throw new Error(
      `Operations O1 contract failed: ${protectedFile} must not be repurposed for routine Operations data.`,
    );
  }
}

console.log("KHP-OS Operations O1 application, schema and KNS bootstrap validated.");
