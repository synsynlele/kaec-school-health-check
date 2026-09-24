import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O11 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/staff-transition"', "school workspace navigation");
requireText(nav, 'label: "Progression & Exit"', "school workspace navigation");
requireText(nav, 'suffix: "/staff-accountability"', "O10 navigation continuity");
requireText(nav, 'suffix: "/staff-performance"', "O9 navigation continuity");

const page = read("src/app/khpos/[organisationId]/staff-transition/page.tsx");
requireText(page, "StaffTransitionWorkspace", "O11 route");
requireText(page, "UUID_RE", "O11 route validation");

const api = read("src/app/api/khpos/ops/staff-transition/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsStaffTransition",
  "createKhposOpsSuccessionPlan",
  "updateKhposOpsSuccessionPlan",
  "actOnKhposOpsSuccessionPlan",
  "addKhposOpsProgressionEvidence",
  "createKhposOpsPromotionCase",
  "respondToKhposOpsPromotion",
  "approveKhposOpsPromotion",
  "actOnKhposOpsTransitionItem",
  "executeKhposOpsPromotion",
  "createKhposOpsExitCase",
  "updateKhposOpsExitSchedule",
  "startKhposOpsExitClearance",
  "finalizeKhposOpsStaffExit",
  "actOnKhposOpsExitCase",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O11 staff-transition API");
}

const service = read("src/lib/khpos/ops/staff-transition.ts");
for (const expected of [
  "khpos_ops_get_staff_transition_server",
  "khpos_ops_create_succession_plan_server",
  "khpos_ops_update_succession_plan_server",
  "khpos_ops_succession_plan_action_server",
  "khpos_ops_add_progression_evidence_server",
  "khpos_ops_create_promotion_case_server",
  "khpos_ops_promotion_staff_response_server",
  "khpos_ops_approve_promotion_server",
  "khpos_ops_transition_item_action_server",
  "khpos_ops_execute_promotion_server",
  "khpos_ops_create_exit_case_server",
  "khpos_ops_update_exit_schedule_server",
  "khpos_ops_start_exit_clearance_server",
  "khpos_ops_finalize_staff_exit_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O11 staff-transition service");
}

const workspace = read("src/components/khpos/ops/StaffTransitionWorkspace.tsx");
for (const expected of [
  "Operations · O11",
  "Progression, Succession & Exit",
  "Succession is a development hypothesis, not a promotion promise.",
  "No score promotes a person.",
  "Your acceptance is required",
  "No departure without continuity, clearance and access closure",
  "Employment-action boundary",
  "workspace.legalBoundary",
]) {
  requireText(workspace, expected, "O11 workspace");
}

const migration = read(
  "supabase/migrations/20260924163528_khpos_ops_o11_progression_exit.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_staff_succession_plans",
  "create table if not exists public.khpos_ops_staff_promotion_cases",
  "create table if not exists public.khpos_ops_staff_progression_evidence",
  "create table if not exists public.khpos_ops_staff_exit_cases",
  "create table if not exists public.khpos_ops_staff_transition_items",
  "create table if not exists public.khpos_ops_staff_transition_events",
  "khpos_ops_get_staff_transition_server",
  "khpos_ops_create_succession_plan_server",
  "khpos_ops_update_succession_plan_server",
  "khpos_ops_succession_plan_action_server",
  "khpos_ops_add_progression_evidence_server",
  "khpos_ops_create_promotion_case_server",
  "khpos_ops_promotion_staff_response_server",
  "khpos_ops_approve_promotion_server",
  "khpos_ops_transition_item_action_server",
  "khpos_ops_execute_promotion_server",
  "khpos_ops_create_exit_case_server",
  "khpos_ops_update_exit_schedule_server",
  "khpos_ops_start_exit_clearance_server",
  "khpos_ops_finalize_staff_exit_server",
  "succession target must be a higher role in the staff member''s actual reporting path",
  "a staff member cannot open their own promotion case",
  "promotion approval requires staff acceptance",
  "add at least one specific readiness evidence item before promotion approval",
  "target role must have an active role charter before promotion approval",
  "responsibility handover and access closure are non-waivable continuity controls",
  "the transition item owner cannot verify their own completion",
  "promotion requires a completed responsibility handover to a named continuity recipient",
  "vision custodian appointment requires external governance",
  "dismissal exit requires a formal o10 separation-review case for the same staff member",
  "exit requires a verified responsibility handover to the named continuity recipient",
  "update public.organisation_memberships",
  "status='ended'",
  "system://khpos/o11/access-closed",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O11 migration");
}

const seed = read("supabase/seeds/khpos_ops_o11_progression_exit.sql").toLowerCase();
for (const expected of [
  "peo-p07",
  "peo-014",
  "peo-015",
  "succession is institutional risk management and staff development, not a promise or entitlement to promotion",
  "promotion is an evidence-based human decision",
  "a staff member must knowingly accept a proposed promotion",
  "every promotion has two responsibilities",
  "exit is a responsibility-transfer process",
  "notice periods, final pay, benefits, redundancy entitlement, payment in lieu",
  "organisation access closes at the governed exit execution point",
  "the underlying user account is not deleted by o11",
  "vision custodian appointment, succession or exit is a company-governance matter",
  "do not promote a staff member without their recorded acceptance",
  "do not use o11 to calculate notice periods, final pay, benefits",
  "ops_o11_progression_exit_bootstrapped",
  "seededsuccessionplans',0",
  "seededpromotioncases',0",
  "seededexitcases',0",
]) {
  requireText(seed, expected, "KNS O11 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
  "supabase/migrations/20260924151658_khpos_ops_o9_performance_development.sql",
  "supabase/migrations/20260924154826_khpos_ops_o10_accountability.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_staff_promotion_cases")) {
    throw new Error(
      `Operations O11 contract failed: historical migration ${path} must remain independent from O11.`,
    );
  }
}

console.log("KHP-OS Operations O11 progression-succession-exit contracts validated.");
