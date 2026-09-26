import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O7 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/people"', "school workspace navigation");
requireText(nav, 'label: "People & Staff"', "school workspace navigation");
requireText(nav, 'suffix: "/team"', "O1 Team & Roles navigation");

const page = read("src/app/khpos/[organisationId]/people/page.tsx");
requireText(page, "PeopleWorkspace", "people route");
requireText(page, "UUID_RE", "people route validation");

const api = read("src/app/api/khpos/ops/people/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsPeople",
  "createKhposOpsStaff",
  "linkKhposOpsStaffAccount",
  "actOnKhposOpsStaffOnboarding",
  "activateKhposOpsStaff",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O7 people API");
}

const service = read("src/lib/khpos/ops/people.ts");
for (const expected of [
  "khpos_ops_get_people_server",
  "khpos_ops_create_staff_server",
  "khpos_ops_link_staff_account_server",
  "khpos_ops_staff_onboarding_action_server",
  "khpos_ops_activate_staff_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O7 people service");
}

const workspace = read("src/components/khpos/ops/PeopleWorkspace.tsx");
for (const expected of [
  "People & staff",
  "People & Staff",
  "Appoint and onboard a person",
  "Minimal personnel data by design",
  "Deployment blockers",
  "Onboarding certification",
  "Activate operating role",
  "Approved campus for this school",
]) {
  requireText(workspace, expected, "O7 People workspace");
}
if (workspace.includes("What O7 deliberately does not do yet")) {
  throw new Error("People workspace still shows obsolete build notes.");
}

const migration = read(
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_staff",
  "create table if not exists public.khpos_ops_onboarding_requirements",
  "create table if not exists public.khpos_ops_staff_onboarding_items",
  "create table if not exists public.khpos_ops_staff_events",
  "ops_can_manage_people",
  "ops_can_review_staff",
  "ops_refresh_staff_readiness",
  "khpos_ops_get_people_server",
  "khpos_ops_create_staff_server",
  "khpos_ops_link_staff_account_server",
  "khpos_ops_staff_onboarding_action_server",
  "khpos_ops_activate_staff_server",
  "staff cannot be activated until onboarding, account access and the active role charter are all ready",
  "this mandatory onboarding requirement cannot be waived",
  "active organisation access is required before operational role activation",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O7 migration");
}

const seed = read("supabase/seeds/khpos_ops_o7_people.sql");
for (const expected of [
  "PEO-P03",
  "PEO-005",
  "PEO-006",
  "PEO-007",
  "PEO-ONB-004",
  "Safeguarding & professional boundaries",
  "PEO-ONB-013",
  "Initial workload & deployment confirmed",
  "ops_o7_people_foundation_bootstrapped",
  "sensitive safer-recruitment case detail",
]) {
  requireText(seed, expected, "KNS O7 people seed");
}

const o1 = read(
  "supabase/migrations/20260924113822_khpos_ops_o1_institutional_structure.sql",
);
if (o1.includes("khpos_ops_staff") || o1.includes("khpos_ops_onboarding")) {
  throw new Error(
    "Operations O7 contract failed: O1 historical institutional-structure migration must remain unchanged.",
  );
}

for (const path of [
  "supabase/migrations/20260924125010_khpos_ops_o3_work_execution.sql",
  "supabase/migrations/20260924130809_khpos_ops_o4_issue_engine.sql",
  "supabase/migrations/20260924133624_khpos_ops_o5_decisions.sql",
  "supabase/migrations/20260924135638_khpos_ops_o6_performance.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_staff_onboarding_items")) {
    throw new Error(
      `Operations O7 contract failed: historical migration ${path} must remain independent from O7.`,
    );
  }
}

console.log("KHP-OS Operations O7 people-foundation contracts validated.");
