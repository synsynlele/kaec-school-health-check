import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O21 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/worldready"', "school workspace navigation");
requireText(nav, 'label: "WorldReady"', "school workspace navigation");
requireText(nav, 'suffix: "/builder-projects"', "O20 navigation continuity");
requireText(nav, 'suffix: "/young-ceo"', "O19 navigation continuity");

const page = read("src/app/khpos/[organisationId]/worldready/page.tsx");
requireText(page, "WorldReadyWorkspace", "O21 route");
requireText(page, "UUID_RE", "O21 route validation");

const api = read("src/app/api/khpos/ops/worldready/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsWorldReady",
  "createKhposOpsWorldReadyRecord",
  "setKhposOpsWorldReadyPathway",
  "addKhposOpsWorldReadyEvidence",
  "actOnKhposOpsWorldReadyEvidence",
  "reviewKhposOpsWorldReadyDomain",
  "createKhposOpsWorldReadyAction",
  "actOnKhposOpsWorldReadyAction",
  "submitKhposOpsWorldReadyReview",
  "decideKhposOpsWorldReady",
  "actOnKhposOpsWorldReadyRecord",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O21 WorldReady API");
}

const service = read("src/lib/khpos/ops/worldready.ts");
for (const expected of [
  "khpos_ops_get_worldready_server",
  "khpos_ops_create_worldready_record_server",
  "khpos_ops_set_worldready_pathway_server",
  "khpos_ops_add_worldready_evidence_server",
  "khpos_ops_worldready_evidence_action_server",
  "khpos_ops_review_worldready_domain_server",
  "khpos_ops_create_worldready_action_server",
  "khpos_ops_worldready_action_server",
  "khpos_ops_submit_worldready_review_server",
  "khpos_ops_decide_worldready_server",
  "khpos_ops_worldready_record_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O21 WorldReady service");
}

const workspace = read("src/components/khpos/ops/WorldReadyWorkspace.tsx");
for (const expected of [
  "Operations · O21",
  "WorldReady Transition",
  "WorldReady is not an exam score",
  "Personal Project:",
  "Transition pathway",
  "Add evidence",
  "Review domain",
  "Create transition action",
  "Final readiness decision",
  "Ready with actions",
  "Not ready",
]) {
  requireText(workspace, expected, "O21 WorldReady workspace");
}

const migration = read(
  "supabase/migrations/20260925001500_khpos_ops_o21_worldready_transition.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_worldready_records",
  "create table if not exists public.khpos_ops_worldready_domains",
  "create table if not exists public.khpos_ops_worldready_evidence",
  "create table if not exists public.khpos_ops_worldready_actions",
  "create table if not exists public.khpos_ops_worldready_events",
  "khpos_ops_get_worldready_server",
  "khpos_ops_create_worldready_record_server",
  "khpos_ops_set_worldready_pathway_server",
  "khpos_ops_add_worldready_evidence_server",
  "khpos_ops_worldready_evidence_action_server",
  "khpos_ops_review_worldready_domain_server",
  "khpos_ops_create_worldready_action_server",
  "khpos_ops_worldready_action_server",
  "khpos_ops_submit_worldready_review_server",
  "khpos_ops_decide_worldready_server",
  "khpos_ops_worldready_record_action_server",
  "worldready transition is currently reserved to active ss3 learners",
  "the worldready evidence submitter cannot verify their own evidence",
  "a domain cannot be demonstrated without independently verified evidence",
  "the transition-action owner cannot verify their own completion",
  "ready requires all ten worldready domains to be demonstrated",
  "ready requires a completed ss3 personal project/capstone",
  "ready requires a verified learner-shared personal project portfolio reference",
  "every unresolved readiness domain needs an owned transition action",
  "pm.status in ('active','completed')",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O21 migration");
}

const seed = read("supabase/seeds/khpos_ops_o21_worldready_transition.sql").toLowerCase();
for (const expected of [
  "hpd-p05",
  "hpd-014",
  "worldready is a developmental transition profile, not a single score",
  "ready means all ten worldready domains are demonstrated",
  "ready with actions is a valid developmental outcome",
  "do not mark a learner ready because they passed waec/neco",
  "do not mark a learner ready without the completed ss3 personal project/capstone",
  "do not use worldready as an automatic gate for graduation, exam entry, school fees or external admission",
  "private pipupath content remains private unless the learner deliberately shares",
  "ops_o21_worldready_bootstrapped",
  "seededworldreadyrecords',0",
]) {
  requireText(seed, expected, "KNS O21 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
  "supabase/migrations/20260924211424_khpos_ops_o17_skills_pathways.sql",
  "supabase/migrations/20260924213818_khpos_ops_o18_leadership_financial.sql",
  "supabase/migrations/20260924221246_khpos_ops_o19_young_ceo.sql",
  "supabase/migrations/20260924225147_khpos_ops_o20_builder_projects.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_worldready_records")) {
    throw new Error(
      `Operations O21 contract failed: historical migration ${path} must remain independent from O21.`,
    );
  }
}

console.log("KHP-OS Operations O21 WorldReady contracts validated.");
