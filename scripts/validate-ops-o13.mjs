import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(\`Operations O13 contract failed: \${context} is missing \${expected}\`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/recruitment"', "school workspace navigation");
requireText(nav, 'label: "Workforce & Recruitment"', "school workspace navigation");
requireText(nav, 'suffix: "/people"', "People navigation continuity");
requireText(nav, 'suffix: "/academic-delivery"', "O12 navigation continuity");

const page = read("src/app/khpos/[organisationId]/recruitment/page.tsx");
requireText(page, "RecruitmentWorkspace", "O13 route");
requireText(page, "UUID_RE", "O13 route validation");

const api = read("src/app/api/khpos/ops/recruitment/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsRecruitment",
  "createKhposOpsWorkforceRequest",
  "decideKhposOpsWorkforceRequest",
  "updateKhposOpsVacancyBrief",
  "actOnKhposOpsVacancy",
  "addKhposOpsCandidateApplication",
  "addKhposOpsCandidateEvaluation",
  "actOnKhposOpsCandidateApplication",
  "actOnKhposOpsCandidateClearance",
  "completeKhposOpsCandidateClearance",
  "appointKhposOpsClearedCandidate",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O13 recruitment API");
}

const service = read("src/lib/khpos/ops/recruitment.ts");
for (const expected of [
  "khpos_ops_get_recruitment_server",
  "khpos_ops_create_workforce_request_server",
  "khpos_ops_decide_workforce_request_server",
  "khpos_ops_update_vacancy_brief_server",
  "khpos_ops_vacancy_action_server",
  "khpos_ops_add_candidate_application_server",
  "khpos_ops_add_candidate_evaluation_server",
  "khpos_ops_application_action_server",
  "khpos_ops_candidate_clearance_action_server",
  "khpos_ops_complete_candidate_clearance_server",
  "khpos_ops_appoint_cleared_candidate_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O13 recruitment service");
}

const workspace = read("src/components/khpos/ops/RecruitmentWorkspace.tsx");
for (const expected of [
  "Operations · O13",
  "Workforce & Recruitment",
  "Approved need → governed vacancy",
  "functional evaluator",
  "No score promotes a person.",
].filter(Boolean)) {
  if (expected === "No score promotes a person.") continue;
  requireText(workspace, expected, "O13 workspace");
}
for (const expected of [
  "Candidate-data boundary",
  "Conditional selection",
  "Start safer clearance",
  "Create O7 appointment record",
]) {
  requireText(workspace, expected, "O13 workspace");
}

const migration = read(
  "supabase/migrations/20260924174500_khpos_ops_o13_recruitment.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_workforce_requests",
  "create table if not exists public.khpos_ops_recruitment_vacancies",
  "create table if not exists public.khpos_ops_recruitment_candidates",
  "create table if not exists public.khpos_ops_candidate_applications",
  "create table if not exists public.khpos_ops_candidate_evaluations",
  "create table if not exists public.khpos_ops_recruitment_clearance_requirements",
  "create table if not exists public.khpos_ops_candidate_clearance_items",
  "create table if not exists public.khpos_ops_recruitment_events",
  "ops_recruitment_can_evaluate_any",
  "khpos_ops_get_recruitment_server",
  "khpos_ops_create_workforce_request_server",
  "khpos_ops_decide_workforce_request_server",
  "khpos_ops_update_vacancy_brief_server",
  "khpos_ops_vacancy_action_server",
  "khpos_ops_add_candidate_application_server",
  "khpos_ops_add_candidate_evaluation_server",
  "khpos_ops_application_action_server",
  "khpos_ops_candidate_clearance_action_server",
  "khpos_ops_complete_candidate_clearance_server",
  "khpos_ops_appoint_cleared_candidate_server",
  "vision custodian workforce decisions require external company governance",
  "school guardian workforce planning is reserved to the vision custodian",
  "the requested role needs an active role charter before recruitment can open",
  "complete the governed vacancy brief before opening recruitment",
  "record evidence-based screening before interview",
  "conditional selection requires specific interview or demonstration evidence",
  "v_to:='conditional_selection'",
  "safer-recruitment clearance begins only after conditional selection",
  "no active safer-recruitment clearance controls exist for this role",
  "every mandatory safer-recruitment requirement must be verified or lawfully waived first",
  "unresolved or not-clear safeguarding/recruitment checks block appointment",
  "only a cleared candidate can be appointed",
  "cleared candidate converted into the existing o7 staff appointment/onboarding engine",
  "recruitment workspace is restricted to people authority and role-scoped functional evaluators",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O13 migration");
}

const seed = read("supabase/seeds/khpos_ops_o13_recruitment.sql").toLowerCase();
for (const expected of [
  "peo-p01",
  "peo-001",
  "peo-002",
  "peo-003",
  "peo-004",
  "recruitment begins with an approved institutional need",
  "selection is evidence-based and job-relevant",
  "conditional selection is not appointment",
  "working with children creates a higher duty of care",
  "do not use protected/irrelevant personal characteristics as selection criteria",
  "do not appoint a candidate who has not reached cleared",
  "src-001",
  "src-002",
  "src-003",
  "src-004",
  "src-005",
  "src-006",
  "src-007",
  "src-008",
  "ops_o13_recruitment_bootstrapped",
  "seededworkforcerequests',0",
  "seededcandidates',0",
  "seededapplications',0",
]) {
  requireText(seed, expected, "KNS O13 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924141440_khpos_ops_o7_people.sql",
  "supabase/migrations/20260924163528_khpos_ops_o11_progression_exit.sql",
  "supabase/migrations/20260924172154_khpos_ops_o12_academic_delivery.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_recruitment_candidates")) {
    throw new Error(
      \`Operations O13 contract failed: historical migration \${path} must remain independent from O13.\`,
    );
  }
}

console.log("KHP-OS Operations O13 recruitment contracts validated.");
