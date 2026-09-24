import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O10 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/staff-accountability"', "school workspace navigation");
requireText(nav, 'label: "Recognition & Accountability"', "school workspace navigation");
requireText(nav, 'suffix: "/staff-performance"', "O9 navigation continuity");
requireText(nav, 'suffix: "/availability"', "O8 navigation continuity");

const page = read("src/app/khpos/[organisationId]/staff-accountability/page.tsx");
requireText(page, "StaffAccountabilityWorkspace", "O10 route");
requireText(page, "UUID_RE", "O10 route validation");

const api = read("src/app/api/khpos/ops/accountability/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsStaffAccountability",
  "issueKhposOpsStaffRecognition",
  "createKhposOpsAccountabilityCase",
  "submitKhposOpsAccountabilityResponse",
  "recordKhposOpsAccountabilityNoResponse",
  "addKhposOpsAccountabilityEvidence",
  "recordKhposOpsAccountabilityHearing",
  "createKhposOpsCorrectiveAction",
  "actOnKhposOpsCorrectiveAction",
  "decideKhposOpsAccountabilityCase",
  "recordKhposOpsExternalAccountabilityReview",
  "acknowledgeKhposOpsAccountabilityOutcome",
  "actOnKhposOpsAccountabilityCase",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O10 accountability API");
}

const service = read("src/lib/khpos/ops/accountability.ts");
for (const expected of [
  "khpos_ops_get_staff_accountability_server",
  "khpos_ops_issue_staff_recognition_server",
  "khpos_ops_create_accountability_case_server",
  "khpos_ops_submit_accountability_response_server",
  "khpos_ops_add_accountability_evidence_server",
  "khpos_ops_record_accountability_hearing_server",
  "khpos_ops_create_corrective_action_server",
  "khpos_ops_corrective_action_server",
  "khpos_ops_accountability_decide_server",
  "khpos_ops_record_external_accountability_review_server",
  "khpos_ops_accountability_case_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O10 accountability service");
}

const workspace = read("src/components/khpos/ops/StaffAccountabilityWorkspace.tsx");
for (const expected of [
  "Operations · O10",
  "Recognition & Accountability",
  "Recognition is not a staff score",
  "Capability gap ≠ misconduct",
  "Independent external governance required",
  "Your response opportunity",
  "Record reasoned case decision",
  "A grievance is a request",
  "Employment-action boundary",
  "workspace.legalBoundary",
]) {
  requireText(workspace, expected, "O10 workspace");
}

const migration = read(
  "supabase/migrations/20260924154826_khpos_ops_o10_accountability.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_staff_recognition",
  "create table if not exists public.khpos_ops_staff_accountability_cases",
  "create table if not exists public.khpos_ops_staff_accountability_responses",
  "create table if not exists public.khpos_ops_staff_accountability_evidence",
  "create table if not exists public.khpos_ops_staff_corrective_actions",
  "create table if not exists public.khpos_ops_staff_accountability_events",
  "ops_accountability_can_manage_subject",
  "ops_accountability_can_manage_grievance",
  "ops_accountability_can_record_external_review",
  "khpos_ops_get_staff_accountability_server",
  "khpos_ops_issue_staff_recognition_server",
  "khpos_ops_create_accountability_case_server",
  "khpos_ops_submit_accountability_response_server",
  "khpos_ops_accountability_record_no_response_server",
  "khpos_ops_add_accountability_evidence_server",
  "khpos_ops_record_accountability_hearing_server",
  "khpos_ops_create_corrective_action_server",
  "khpos_ops_corrective_action_server",
  "khpos_ops_accountability_decide_server",
  "khpos_ops_record_external_accountability_review_server",
  "khpos_ops_accountability_acknowledge_outcome_server",
  "khpos_ops_accountability_case_action_server",
  "the corrective action owner cannot verify their own completion",
  "complete the staff response opportunity before a conduct decision",
  "complete the required hearing step before the disciplinary decision",
  "this outcome requires a contract/legal/authority review reference",
  "the subject cannot be managed through the internal reporting line",
  "independent external governance",
  "decision_source='external'",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O10 migration");
}

const seed = read("supabase/seeds/khpos_ops_o10_accountability.sql").toLowerCase();
for (const expected of [
  "peo-p06",
  "peo-012",
  "peo-013",
  "capability gap is not misconduct",
  "no fixed three-strikes algorithm",
  "never use hidden numerical disciplinary scores or automatic sanctions",
  "a grievance finding does not itself impose discipline",
  "khp-os may record warnings, corrective commitments and a recommendation for separation review; it does not directly terminate employment",
  "case involving vision custodian as subject → independent external governance",
  "seededrecognitions',0",
  "seededcases',0",
  "ops_o10_accountability_engine_bootstrapped",
]) {
  requireText(seed, expected, "KNS O10 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
  "supabase/migrations/20260924145203_khpos_ops_o8_availability.sql",
  "supabase/migrations/20260924151658_khpos_ops_o9_performance_development.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_staff_accountability_cases")) {
    throw new Error(
      `Operations O10 contract failed: historical migration ${path} must remain independent from O10.`,
    );
  }
}

console.log("KHP-OS Operations O10 recognition-accountability contracts validated.");
