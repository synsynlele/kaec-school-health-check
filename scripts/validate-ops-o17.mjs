import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O17 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/skills-development"', "workspace navigation");
requireText(nav, 'label: "Skills Development"', "workspace navigation");
requireText(nav, 'suffix: "/potential-development"', "O16 navigation continuity");
requireText(nav, 'suffix: "/learner-progress"', "O14 navigation continuity");

const page = read("src/app/khpos/[organisationId]/skills-development/page.tsx");
requireText(page, "SkillsDevelopmentWorkspace", "O17 route");
requireText(page, "UUID_RE", "O17 route validation");

const api = read("src/app/api/khpos/ops/skills-development/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsSkillsWorkspace",
  "createKhposOpsSkillOffering",
  "actOnKhposOpsSkillOffering",
  "selectKhposOpsSkillPathway",
  "requestKhposOpsSkillChange",
  "decideKhposOpsSkillChange",
  "executeKhposOpsSkillChange",
  "createKhposOpsSkillSession",
  "actOnKhposOpsSkillSession",
  "addKhposOpsSkillCompetencyEvidence",
  "actOnKhposOpsSkillCompetencyEvidence",
  "createKhposOpsSkillWeeklyReview",
  "actOnKhposOpsSkillWeeklyReview",
  '"Cache-Control": "private, no-store"',
]) requireText(api, expected, "O17 API");

const service = read("src/lib/khpos/ops/skills-development.ts");
for (const expected of [
  "khpos_ops_get_skills_workspace_server",
  "khpos_ops_create_skill_offering_server",
  "khpos_ops_skill_offering_action_server",
  "khpos_ops_select_skill_pathway_server",
  "khpos_ops_request_skill_change_server",
  "khpos_ops_skill_change_decision_server",
  "khpos_ops_execute_skill_change_server",
  "khpos_ops_create_skill_session_server",
  "khpos_ops_skill_session_action_server",
  "khpos_ops_add_skill_competency_evidence_server",
  "khpos_ops_skill_competency_evidence_action_server",
  "khpos_ops_create_skill_weekly_review_server",
  "khpos_ops_skill_weekly_review_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) requireText(service, expected, "O17 service");

const workspace = read("src/components/khpos/ops/SkillsDevelopmentWorkspace.tsx");
for (const expected of [
  "Operations · O17",
  "Skills Development",
  "Competence is demonstrated, not assumed",
  "PipuPath privacy stays intact",
  "Attendance alone never advances a learner.",
  "Competency ladder",
  "Independent verification required from another authorised leader.",
  "Pathway change",
  "Evidence, not attendance",
]) requireText(workspace, expected, "O17 workspace");

for (const [path, source] of [
  ["src/components/khpos/ops/SkillsDevelopmentWorkspace.tsx", workspace],
  ["src/lib/khpos/ops/skills-development.ts", service],
  ["src/app/api/khpos/ops/skills-development/[id]/route.ts", api],
]) {
  if ((source.match(/\\`/g) || []).length > 0 || (source.match(/\\\$\{/g) || []).length > 0) {
    throw new Error(
      `Operations O17 contract failed: escaped template-literal generation artefacts remain in ${path}.`,
    );
  }
}

const migration = read(
  "supabase/drafts/khpos_ops_o17_skills_pathways.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_skill_pathways",
  "create table if not exists public.khpos_ops_skill_offerings",
  "create table if not exists public.khpos_ops_skill_selections",
  "create table if not exists public.khpos_ops_skill_change_requests",
  "create table if not exists public.khpos_ops_skill_sessions",
  "create table if not exists public.khpos_ops_skill_competency_evidence",
  "create table if not exists public.khpos_ops_skill_weekly_reviews",
  "create table if not exists public.khpos_ops_skill_events",
  "khpos_ops_get_skills_workspace_server",
  "khpos_ops_create_skill_offering_server",
  "khpos_ops_select_skill_pathway_server",
  "khpos_ops_request_skill_change_server",
  "khpos_ops_execute_skill_change_server",
  "khpos_ops_skill_session_action_server",
  "khpos_ops_add_skill_competency_evidence_server",
  "khpos_ops_skill_competency_evidence_action_server",
  "khpos_ops_create_skill_weekly_review_server",
  "khpos_ops_skill_weekly_review_action_server",
  "attendance alone never advances a learner on the competency ladder",
  "competency levels must be verified progressively without skipping the ladder",
  "the evidence recorder cannot verify their own competency evidence",
  "do not mark a practical session delivered while a safety concern is present",
  "khpos_ops_create_issue_server",
  "human_potential_development",
  "skills_application",
  "khpos://skills/competency/",
  "the weekly review preparer cannot approve their own review",
  "executiveaggregateonly",
  "isrecorder",
  "ispreparer",
  "from public,anon,authenticated",
  "to service_role",
]) requireText(migration, expected, "O17 draft migration");

const seed = read("supabase/seeds/khpos_ops_o17_skills_pathways.sql").toLowerCase();
for (const expected of [
  "hpd-p02",
  "hpd-003",
  "hpd-004",
  "attendance is exposure, not competence",
  "exposure → foundation → independent → applied → value creation",
  "learner choice matters",
  "never skip competency ladder levels during verification",
  "never copy private pipupath profile, mission or reflection content",
  "ops_o17_skills_pathways_bootstrapped",
  "seededpathways',6",
  "seededofferings',0",
  "seededselections',0",
  "seededcompetencyevidence',0",
  "'tailoring'",
  "'culinary'",
  "'football'",
  "'music'",
  "'computer'",
  "'hairdressing'",
]) requireText(seed, expected, "O17 process-control seed");

for (const path of [
  "supabase/migrations/20260924183524_khpos_ops_o14_learner_progress.sql",
  "supabase/migrations/20260924190921_khpos_ops_o15_academic_assurance.sql",
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_skill_offerings")) {
    throw new Error(
      `Operations O17 contract failed: historical migration ${path} must remain independent from O17.`,
    );
  }
}

console.log("KHP-OS Operations O17 skills-pathways contracts validated.");
