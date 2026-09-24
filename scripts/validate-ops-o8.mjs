import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O8 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/availability"', "school workspace navigation");
requireText(nav, 'label: "Availability & Coverage"', "school workspace navigation");
requireText(nav, 'suffix: "/people"', "O7 People & Staff navigation");

const page = read("src/app/khpos/[organisationId]/availability/page.tsx");
requireText(page, "AvailabilityWorkspace", "availability route");
requireText(page, "UUID_RE", "availability route validation");

const api = read("src/app/api/khpos/ops/availability/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsAvailability",
  "createKhposOpsAvailabilityCase",
  "actOnKhposOpsAvailabilityCase",
  "assignKhposOpsCoverage",
  "actOnKhposOpsCoverage",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O8 availability API");
}

const service = read("src/lib/khpos/ops/availability.ts");
for (const expected of [
  "khpos_ops_get_availability_server",
  "khpos_ops_create_availability_case_server",
  "khpos_ops_availability_action_server",
  "khpos_ops_assign_coverage_server",
  "khpos_ops_coverage_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O8 availability service");
}

const workspace = read("src/components/khpos/ops/AvailabilityWorkspace.tsx");
for (const expected of [
  "Operations · O8",
  "Availability & Coverage",
  "KHP-OS does not replace the school attendance system.",
  "Transactional boundary",
  "Coverage gaps",
  "Private reason hidden",
  "Confirm coverage plan",
  "Repeated absence is not solved by repeated reminders",
]) {
  requireText(workspace, expected, "O8 availability workspace");
}

const migration = read(
  "supabase/migrations/20260924145500_khpos_ops_o8_availability.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_staff_availability_cases",
  "create table if not exists public.khpos_ops_staff_coverage_assignments",
  "create table if not exists public.khpos_ops_staff_availability_events",
  "ops_availability_has_membership",
  "ops_availability_can_review_staff",
  "khpos_ops_get_availability_server",
  "khpos_ops_create_availability_case_server",
  "khpos_ops_availability_action_server",
  "khpos_ops_assign_coverage_server",
  "khpos_ops_coverage_action_server",
  "the unavailable person cannot cover their own absence through another role assignment",
  "active organisation membership and khp-os partnership are required",
  "covering staff received private reason information",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O8 migration");
}

const seed = read("supabase/seeds/khpos_ops_o8_availability.sql");
for (const expected of [
  "PEO-P04",
  "PEO-008",
  "PEO-009",
  "attendance transactions and payroll attendance calculations belong in the designated school/hr system",
  "a covering colleague needs the time and scope of coverage, not the unavailable staff member''s private reason",
  "seededAvailabilityCases',0",
  "seededCoverageAssignments',0",
  "ops_o8_availability_engine_bootstrapped",
]) {
  requireText(seed.toLowerCase(), expected.toLowerCase(), "KNS O8 availability seed");
}

const o7 = read(
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
);
if (o7.includes("khpos_ops_staff_availability_cases")) {
  throw new Error(
    "Operations O8 contract failed: O7 historical People migration must remain independent from O8.",
  );
}

for (const path of [
  "supabase/migrations/20260924125010_khpos_ops_o3_work_execution.sql",
  "supabase/migrations/20260924130809_khpos_ops_o4_issue_engine.sql",
  "supabase/migrations/20260924133624_khpos_ops_o5_decisions.sql",
  "supabase/migrations/20260924135638_khpos_ops_o6_performance.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_staff_coverage_assignments")) {
    throw new Error(
      `Operations O8 contract failed: historical migration ${path} must remain independent from O8.`,
    );
  }
}

console.log("KHP-OS Operations O8 availability-coverage contracts validated.");
