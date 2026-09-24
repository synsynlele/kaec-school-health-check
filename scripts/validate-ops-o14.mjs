import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O14 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/learner-progress"', "school workspace navigation");
requireText(nav, 'label: "Learner Progress"', "school workspace navigation");
requireText(nav, 'suffix: "/academic-delivery"', "O12 navigation continuity");

const page = read("src/app/khpos/[organisationId]/learner-progress/page.tsx");
requireText(page, "LearnerProgressWorkspace", "O14 route");
requireText(page, "UUID_RE", "O14 route validation");

const api = read("src/app/api/khpos/ops/learner-progress/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsLearnerProgress",
  "upsertKhposOpsLearnerAnchor",
  "recordKhposOpsLearnerBaseline",
  "createKhposOpsLearnerRiskSignal",
  "resolveKhposOpsLearnerRiskSignal",
  "createKhposOpsLearnerSupportCase",
  "recordKhposOpsLearnerDiagnosis",
  "createKhposOpsLearnerIntervention",
  "addKhposOpsLearnerInterventionActivity",
  "recordKhposOpsLearnerParentPartnership",
  "reassessKhposOpsLearnerSupportCase",
  "escalateKhposOpsLearnerSupportCase",
  "closeKhposOpsLearnerSupportCase",
  "createKhposOpsLearnerProgressionDecision",
  "confirmKhposOpsLearnerProgressionDecision",
  "upsertKhposOpsLearnerTermReview",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O14 learner-progress API");
}

const service = read("src/lib/khpos/ops/learner-progress.ts");
for (const expected of [
  "khpos_ops_get_learner_progress_server",
  "khpos_ops_upsert_learner_anchor_server",
  "khpos_ops_record_learner_baseline_server",
  "khpos_ops_create_learner_risk_signal_server",
  "khpos_ops_resolve_learner_risk_signal_server",
  "khpos_ops_create_learner_support_case_server",
  "khpos_ops_record_learner_diagnosis_server",
  "khpos_ops_create_learner_intervention_server",
  "khpos_ops_add_learner_intervention_activity_server",
  "khpos_ops_record_learner_parent_partnership_server",
  "khpos_ops_reassess_learner_support_case_server",
  "khpos_ops_escalate_learner_support_case_server",
  "khpos_ops_close_learner_support_case_server",
  "khpos_ops_create_learner_progression_decision_server",
  "khpos_ops_confirm_learner_progression_decision_server",
  "khpos_ops_upsert_learner_term_review_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O14 learner-progress service");
}

const workspace = read("src/components/khpos/ops/LearnerProgressWorkspace.tsx");
for (const expected of [
  "Operations · O14",
  "Learner Progress & Intervention",
  "No learner should quietly fall through the cracks",
  "Aggregate learner-risk visibility",
  "Store only the identity/context needed to run support work",
  "A signal is a reason to investigate—not a permanent label",
  "Diagnose → intervene → reassess → recover or redirect",
  "No single score, AI diagnosis, attendance signal or fee status",
  "A case closes only because the latest reassessment evidenced recovery",
]) {
  requireText(workspace, expected, "O14 workspace");
}

const migration = read(
  "supabase/migrations/20260924183000_khpos_ops_o14_learner_progress.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_learner_anchors",
  "campus_id uuid not null references public.khpos_ops_campuses",
  "create table if not exists public.khpos_ops_learner_baselines",
  "create table if not exists public.khpos_ops_learner_risk_signals",
  "create table if not exists public.khpos_ops_learner_support_cases",
  "create table if not exists public.khpos_ops_learner_diagnoses",
  "create table if not exists public.khpos_ops_learner_interventions",
  "create table if not exists public.khpos_ops_learner_intervention_activities",
  "create table if not exists public.khpos_ops_learner_parent_partnership",
  "create table if not exists public.khpos_ops_learner_reassessments",
  "create table if not exists public.khpos_ops_learner_progression_decisions",
  "create table if not exists public.khpos_ops_learner_term_reviews",
  "khpos_ops_get_learner_progress_server",
  "khpos_ops_upsert_learner_anchor_server",
  "khpos_ops_create_learner_risk_signal_server",
  "khpos_ops_create_learner_support_case_server",
  "khpos_ops_record_learner_diagnosis_server",
  "khpos_ops_create_learner_intervention_server",
  "record the learning-gap diagnosis before creating a structured intervention",
  "red or critical signals require a structured learner-support case rather than quick closure",
  "a learner-support case closes only after evidenced recovery or governed redirection",
  "high-impact progression decision requires the parent meeting/partnership reference",
  "retain/reteach, deferred or external-review progression decisions require school guardian confirmation",
  "coalesce(s.campus_id,a.campus_id) is not distinct from l.campus_id",
  "'executivesummaryonly'",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O14 migration");
}

const seed = read("supabase/seeds/khpos_ops_o14_learner_progress.sql").toLowerCase();
for (const expected of [
  "lpi-p02",
  "acd-010",
  "acd-011",
  "lpi-001",
  "lpi-012",
  "progression is a human educational decision supported by evidence, not an automatic score threshold",
  "financial/fee status is governed separately and is not an academic readiness criterion",
  "never let ksi/ai automatically make or confirm a learner-progression decision",
  "never overwrite the sis as the authoritative student/result/class record from khp-os",
  "diagnosis before structured intervention",
  "no automatic learner progression decision",
  "vision custodian sees aggregate patterns by default",
  "case closes only after recovery or governed redirection",
  "ops_o14_learner_progress_bootstrapped",
  "seededlearners',0",
  "seededsignals',0",
  "seededcases',0",
]) {
  requireText(seed, expected, "KNS O14 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924172154_khpos_ops_o12_academic_delivery.sql",
  "supabase/migrations/20260924175226_khpos_ops_o13_recruitment.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_learner_support_cases")) {
    throw new Error(
      `Operations O14 contract failed: historical migration ${path} must remain independent from O14.`,
    );
  }
}

console.log("KHP-OS Operations O14 learner-progress contracts validated.");
