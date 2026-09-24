import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      "Operations O20 contract failed: " + context + " is missing " + expected,
    );
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/builder-projects"', "school workspace navigation");
requireText(nav, 'label: "Builder Projects"', "school workspace navigation");
requireText(nav, 'suffix: "/young-ceo"', "O19 navigation continuity");
requireText(nav, 'suffix: "/potential-development"', "O16 navigation continuity");

const page = read("src/app/khpos/[organisationId]/builder-projects/page.tsx");
requireText(page, "BuilderProjectsWorkspace", "O20 route");
requireText(page, "UUID_RE", "O20 route validation");

const api = read("src/app/api/khpos/ops/builder-projects/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsBuilderProjects",
  "createKhposOpsProjectCycle",
  "actOnKhposOpsProjectCycle",
  "createKhposOpsBuilderProject",
  "updateKhposOpsBuilderProject",
  "actOnKhposOpsProjectMember",
  "actOnKhposOpsProjectMilestone",
  "actOnKhposOpsBuilderProject",
  "createKhposOpsProjectDefence",
  "actOnKhposOpsProjectDefence",
  "addKhposOpsProjectMemberEvidence",
  "actOnKhposOpsProjectMemberEvidence",
  "submitKhposOpsProjectPortfolioLink",
  "actOnKhposOpsProjectPortfolioLink",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O20 Builder Projects API");
}

const service = read("src/lib/khpos/ops/builder-projects.ts");
for (const expected of [
  "khpos_ops_get_builder_projects_server",
  "khpos_ops_create_project_cycle_server",
  "khpos_ops_project_cycle_action_server",
  "khpos_ops_create_builder_project_server",
  "khpos_ops_update_builder_project_server",
  "khpos_ops_project_member_action_server",
  "khpos_ops_project_milestone_action_server",
  "khpos_ops_builder_project_action_server",
  "khpos_ops_create_project_defence_server",
  "khpos_ops_project_defence_action_server",
  "khpos_ops_add_project_member_evidence_server",
  "khpos_ops_project_member_evidence_action_server",
  "khpos_ops_submit_project_portfolio_link_server",
  "khpos_ops_project_portfolio_link_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O20 Builder Projects service");
}

const workspace = read("src/components/khpos/ops/BuilderProjectsWorkspace.tsx");
for (const expected of [
  "Operations · O20",
  "Builder Projects & Defence",
  "Problem → Build → Test → Reflect → Defend",
  "Team completion never creates automatic learner evidence.",
  "PipuPath boundary",
  "workspace.pipupathBoundary",
  "Builder Defence standard",
  "workspace.defenceBoundary",
  "Seven evidence milestones",
  "Individual contribution evidence",
  "Verify → O16",
  "Learner deliberately shared this reference for school evidence.",
]) {
  requireText(workspace, expected, "O20 workspace");
}

if (workspace.includes(String.fromCharCode(92, 96))) {
  throw new Error(
    "Operations O20 contract failed: BuilderProjectsWorkspace contains escaped template-literal backticks.",
  );
}

const migration = read(
  "supabase/migrations/20260924223500_khpos_ops_o20_builder_projects.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_project_cycles",
  "create table if not exists public.khpos_ops_projects",
  "create table if not exists public.khpos_ops_project_members",
  "create table if not exists public.khpos_ops_project_milestones",
  "create table if not exists public.khpos_ops_project_member_evidence",
  "create table if not exists public.khpos_ops_project_defences",
  "create table if not exists public.khpos_ops_project_portfolio_links",
  "create table if not exists public.khpos_ops_project_events",
  "khpos_ops_get_builder_projects_server",
  "khpos_ops_create_project_cycle_server",
  "khpos_ops_project_cycle_action_server",
  "khpos_ops_create_builder_project_server",
  "khpos_ops_update_builder_project_server",
  "khpos_ops_project_member_action_server",
  "khpos_ops_project_milestone_action_server",
  "khpos_ops_builder_project_action_server",
  "khpos_ops_create_project_defence_server",
  "khpos_ops_project_defence_action_server",
  "khpos_ops_add_project_member_evidence_server",
  "khpos_ops_project_member_evidence_action_server",
  "khpos_ops_submit_project_portfolio_link_server",
  "khpos_ops_project_portfolio_link_action_server",
  "builder project team requires at least two active learners before activation",
  "builder project team requires a lead member for coordination",
  "personal project requires exactly one active learner owner before activation",
  "personal project may have only one active learner owner",
  "project milestone evidence submitter cannot verify their own evidence",
  "all seven project milestones must be independently verified before builder defence readiness",
  "project must be defence ready before a defence attempt is scheduled",
  "builder defence outcome cannot be recorded before the scheduled defence time",
  "project evidence recorder cannot verify their own individual evidence",
  "portfolio-link submitter cannot verify their own learner-shared reference",
  "record only a portfolio/project reference the learner deliberately shared for school evidence",
  "'project','school'",
  "'learner_shared_portfolio','learner_shared'",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O20 migration");
}

const seed = read(
  "supabase/seeds/khpos_ops_o20_builder_projects.sql",
).toLowerCase();

for (const expected of [
  "hpd-p03",
  "hpd-008",
  "hpd-009",
  "hpd-011",
  "hpd-013",
  "project completion itself creates no automatic individual evidence",
  "personal project requires exactly one learner owner",
  "builder defence is scheduled only after all milestones are independently verified",
  "revision-required defence returns the project to reflection and creates a recovery issue",
  "individual contribution evidence is separately recorded",
  "private pipupath journals",
  "builder summit/showcase event registration",
  "ops_o20_builder_projects_bootstrapped",
]) {
  requireText(seed, expected, "KNS O20 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
  "supabase/migrations/20260924221246_khpos_ops_o19_young_ceo.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_project_cycles")) {
    throw new Error(
      "Operations O20 contract failed: historical migration " +
        path +
        " must remain independent from O20.",
    );
  }
}

console.log(
  "KHP-OS Operations O20 Builder Projects and Defence contracts validated.",
);
