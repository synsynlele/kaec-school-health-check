import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O9 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/staff-performance"', "school workspace navigation");
requireText(nav, 'label: "Staff Performance"', "school workspace navigation");
requireText(nav, 'suffix: "/performance"', "O6 scorecard navigation");
requireText(nav, 'suffix: "/people"', "O7 People navigation");

const page = read("src/app/khpos/[organisationId]/staff-performance/page.tsx");
requireText(page, "StaffPerformanceWorkspace", "staff performance route");
requireText(page, "UUID_RE", "staff performance route validation");

const api = read("src/app/api/khpos/ops/staff-performance/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsStaffPerformance",
  "createKhposOpsStaffReview",
  "submitKhposOpsStaffReflection",
  "addKhposOpsStaffPerformanceEvidence",
  "leaderReviewKhposOpsStaff",
  "createKhposOpsDevelopmentAction",
  "actOnKhposOpsDevelopmentAction",
  "actOnKhposOpsStaffReview",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O9 staff performance API");
}

const service = read("src/lib/khpos/ops/staff-performance.ts");
for (const expected of [
  "khpos_ops_get_staff_performance_server",
  "khpos_ops_create_staff_review_server",
  "khpos_ops_submit_staff_reflection_server",
  "khpos_ops_add_staff_performance_evidence_server",
  "khpos_ops_leader_review_staff_server",
  "khpos_ops_create_development_action_server",
  "khpos_ops_development_action_server",
  "khpos_ops_staff_review_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O9 staff performance service");
}

const workspace = read("src/components/khpos/ops/StaffPerformanceWorkspace.tsx");
for (const expected of [
  "Operations · O9",
  "Staff Performance & Development",
  "Reflect → Evidence → Leader Review → Development → Verification.",
  "does not produce a one-number staff rating",
  "Capability gap ≠ conduct problem",
  "No KPI is better than a fake KPI",
  "This review cannot close until a proportionate development commitment is added and verified.",
  "Verify or formally cancel",
]) {
  requireText(workspace, expected, "O9 performance workspace");
}

const migration = read(
  "supabase/migrations/20260924151658_khpos_ops_o9_performance_development.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_staff_performance_reviews",
  "create table if not exists public.khpos_ops_staff_performance_evidence",
  "create table if not exists public.khpos_ops_staff_development_actions",
  "create table if not exists public.khpos_ops_staff_performance_events",
  "ops_performance_has_membership",
  "ops_performance_can_review_staff",
  "khpos_ops_get_staff_performance_server",
  "khpos_ops_create_staff_review_server",
  "khpos_ops_submit_staff_reflection_server",
  "khpos_ops_add_staff_performance_evidence_server",
  "khpos_ops_leader_review_staff_server",
  "khpos_ops_create_development_action_server",
  "khpos_ops_development_action_server",
  "khpos_ops_staff_review_action_server",
  "leader review requires the staff self-reflection first",
  "add at least one evidence item before making a leader performance judgment",
  "the development action owner cannot verify their own completion",
  "support or improvement reviews require at least one development action before closure",
  "verify the agreed development response before completing this review",
  "open development actions must be verified or cancelled before review completion",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O9 migration");
}

const seed = read("supabase/seeds/khpos_ops_o9_performance_development.sql").toLowerCase();
for (const expected of [
  "peo-p05",
  "peo-010",
  "peo-011",
  "no numerical staff rating, forced ranking or league table is created by o9",
  "teacher performance is not judged only by learner examination scores",
  "a support required or improvement required review remains open until",
  "development follows the loop: observe → identify gap → train/support → practise → re-observe → verify improvement",
  "seededstaffratings',0",
  "ops_o9_performance_development_bootstrapped",
]) {
  requireText(seed, expected, "KNS O9 performance seed");
}

for (const path of [
  "supabase/migrations/20260924135638_khpos_ops_o6_performance.sql",
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
  "supabase/migrations/20260924145203_khpos_ops_o8_availability.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_staff_performance_reviews")) {
    throw new Error(
      `Operations O9 contract failed: historical migration ${path} must remain independent from O9.`,
    );
  }
}

console.log("KHP-OS Operations O9 performance-development contracts validated.");
