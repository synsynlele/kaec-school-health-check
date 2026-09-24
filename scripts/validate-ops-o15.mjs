import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(\`Operations O15 contract failed: \${context} is missing \${expected}\`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/academic-assurance"', "workspace navigation");
requireText(nav, 'label: "Assessment & Exams"', "workspace navigation");
requireText(nav, 'suffix: "/academic-delivery"', "O12 navigation continuity");
requireText(nav, 'suffix: "/learner-progress"', "O14 navigation continuity");

const page = read("src/app/khpos/[organisationId]/academic-assurance/page.tsx");
requireText(page, "AcademicAssuranceWorkspace", "O15 route");
requireText(page, "UUID_RE", "O15 route validation");

const api = read("src/app/api/khpos/ops/academic-assurance/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsAcademicAssurance",
  "createKhposOpsAssessmentCycle",
  "createKhposOpsAssessmentPackage",
  "updateKhposOpsAssessmentPackage",
  "createKhposOpsReadinessItem",
  "reportKhposOpsIntegrityCase",
  "recordKhposOpsIntegrityRepresentation",
  "decideKhposOpsIntegrityCase",
  "requestKhposOpsResultCorrection",
  "createKhposOpsAcademicCloseout",
  "updateKhposOpsAcademicCloseout",
  '"Cache-Control": "private, no-store"',
]) requireText(api, expected, "O15 API");

const service = read("src/lib/khpos/ops/academic-assurance.ts");
for (const expected of [
  "khpos_ops_get_academic_assurance_server",
  "khpos_ops_create_assessment_cycle_server",
  "khpos_ops_assessment_cycle_action_server",
  "khpos_ops_create_assessment_package_server",
  "khpos_ops_update_assessment_package_server",
  "khpos_ops_assessment_package_action_server",
  "khpos_ops_create_exam_readiness_item_server",
  "khpos_ops_exam_readiness_action_server",
  "khpos_ops_report_integrity_case_server",
  "khpos_ops_record_integrity_representation_server",
  "khpos_ops_add_integrity_evidence_server",
  "khpos_ops_decide_integrity_case_server",
  "khpos_ops_request_result_correction_server",
  "khpos_ops_result_correction_action_server",
  "khpos_ops_create_academic_closeout_server",
  "khpos_ops_update_academic_closeout_server",
  "khpos_ops_academic_closeout_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) requireText(service, expected, "O15 service");

const workspace = read("src/components/khpos/ops/AcademicAssuranceWorkspace.tsx");
for (const expected of [
  "Operations · O15",
  "Assessment, Examination & Academic Assurance",
  "Technology boundary",
  "Executive summary only",
  "Allegation ≠ finding",
  "No silent edit",
  "Close the term only after assessment",
]) requireText(workspace, expected, "O15 workspace");

const migration = read(
  "supabase/migrations/20260924190000_khpos_ops_o15_academic_assurance.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_assessment_cycles",
  "create table if not exists public.khpos_ops_assessment_packages",
  "create table if not exists public.khpos_ops_exam_readiness_items",
  "create table if not exists public.khpos_ops_academic_integrity_cases",
  "create table if not exists public.khpos_ops_result_corrections",
  "create table if not exists public.khpos_ops_academic_closeouts",
  "khpos_ops_get_academic_assurance_server",
  "assessment cycle cannot be marked ready without at least one mandatory readiness control",
  "resolve every created assessment package through approval or withdrawal before marking the cycle ready",
  "the package submitter cannot approve or moderate their own assessment package",
  "the readiness owner cannot verify their own completion",
  "record the learner/staff representation before deciding the academic-integrity case",
  "critical academic-integrity cases require school guardian decision authority",
  "the integrity-case reporter cannot decide their own reported case",
  "substantiated high/critical staff integrity cases require a separate people/o10 or external-process reference",
  "the correction requester cannot approve or reject their own request",
  "result-correction verification must be independent of the requester, approver and implementer",
  "academic term close-out requires at least one governed assessment cycle for the term",
  "academic close-out requires independent school guardian approval",
  "open p2 academic debt requires an institutional issue/escalation reference before close-out",
  "open academic debt/learner support requires an explicit carry-over reference before close-out",
  "from public,anon,authenticated",
  "to service_role",
]) requireText(migration, expected, "O15 migration");

const seed = read("supabase/seeds/khpos_ops_o15_academic_assurance.sql").toLowerCase();
for (const expected of [
  "acd-p02",
  "acd-012",
  "acd-013",
  "acd-014",
  "acd-015",
  "the person who submits an assessment package cannot moderate/approve that same package",
  "an integrity allegation is not a finding",
  "a result correction is never a silent edit",
  "khp-os never becomes the mark book, cbt engine or result database",
  "no duplicate scorebook",
  "no assessment self-approval",
  "no silent result correction",
  "independent correction verification",
  "ops_o15_academic_assurance_bootstrapped",
  "seededassessmentcycles',0",
  "seededintegritycases',0",
  "seededresultcorrections',0",
]) requireText(seed, expected, "O15 control seed");

for (const path of [
  "supabase/migrations/20260924172154_khpos_ops_o12_academic_delivery.sql",
  "supabase/migrations/20260924183524_khpos_ops_o14_learner_progress.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_assessment_cycles")) {
    throw new Error(
      \`Operations O15 contract failed: historical migration \${path} must remain independent from O15.\`,
    );
  }
}

console.log("KHP-OS Operations O15 academic-assurance contracts validated.");
