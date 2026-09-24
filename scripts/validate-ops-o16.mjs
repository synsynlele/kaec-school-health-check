import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O16 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/potential-development"', "workspace navigation");
requireText(nav, 'label: "Potential Development"', "workspace navigation");
requireText(nav, 'suffix: "/learner-progress"', "O14 navigation continuity");
requireText(nav, 'suffix: "/academic-assurance"', "O15 navigation continuity");
requireText(nav, 'suffix: "/human-potential-intelligence"', "Human Potential intelligence continuity");

const page = read("src/app/khpos/[organisationId]/potential-development/page.tsx");
requireText(page, "PotentialDevelopmentWorkspace", "O16 route");
requireText(page, "UUID_RE", "O16 route validation");

const api = read("src/app/api/khpos/ops/potential-development/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsPotentialDiscovery",
  "recordKhposOpsPotentialDiscovery",
  "createKhposOpsPotentialHypothesis",
  "actOnKhposOpsPotentialHypothesis",
  "addKhposOpsPotentialEvidence",
  "createKhposOpsPotentialExploration",
  "actOnKhposOpsPotentialExploration",
  "recordKhposOpsPotentialReflection",
  "createKhposOpsPotentialReview",
  "updateKhposOpsPotentialReview",
  "actOnKhposOpsPotentialReview",
  '"Cache-Control": "private, no-store"',
]) requireText(api, expected, "O16 API");

const service = read("src/lib/khpos/ops/potential-discovery.ts");
for (const expected of [
  "khpos_ops_get_potential_discovery_server",
  "khpos_ops_record_potential_discovery_server",
  "khpos_ops_create_potential_hypothesis_server",
  "khpos_ops_potential_hypothesis_action_server",
  "khpos_ops_add_potential_evidence_server",
  "khpos_ops_potential_evidence_action_server",
  "khpos_ops_create_potential_exploration_server",
  "khpos_ops_potential_exploration_action_server",
  "khpos_ops_record_potential_reflection_server",
  "khpos_ops_create_potential_review_server",
  "khpos_ops_update_potential_review_server",
  "khpos_ops_potential_review_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) requireText(service, expected, "O16 service");

const workspace = read("src/components/khpos/ops/PotentialDevelopmentWorkspace.tsx");
for (const expected of [
  "Operations · O16",
  "Potential Development",
  "Potential is a living hypothesis",
  "PipuPath privacy boundary",
  "Aggregate visibility only",
  "No learner anchors yet",
  "Discovery → test → evidence → reflection → review",
  "school-owned reflection",
]) requireText(workspace, expected, "O16 workspace");

if ((workspace.match(/\\`/g) || []).length > 0 || (workspace.match(/\\\$\{/g) || []).length > 0) {
  throw new Error("Operations O16 contract failed: escaped template-literal generation artefacts remain in TSX.");
}

const migration = read(
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_potential_discovery_records",
  "create table if not exists public.khpos_ops_potential_hypotheses",
  "create table if not exists public.khpos_ops_potential_evidence",
  "create table if not exists public.khpos_ops_potential_explorations",
  "create table if not exists public.khpos_ops_potential_reflections",
  "create table if not exists public.khpos_ops_potential_reviews",
  "create table if not exists public.khpos_ops_potential_events",
  "khpos_ops_get_potential_discovery_server",
  "potential remains a hypothesis until repeated evidence",
  "pipupath learner profiles, missions and private reflections are not copied into o16",
  "executiveaggregateonly",
  "potential review cannot submit without an active discovery record",
  "potential review cannot submit without at least one active potential hypothesis",
  "potential review cannot submit without term evidence",
  "potential review cannot submit without a school-owned reflection summary",
  "potential review preparer cannot approve their own review",
  "from public,anon,authenticated",
  "to service_role",
]) requireText(migration, expected, "O16 migration");

const seed = read("supabase/seeds/khpos_ops_o16_potential_discovery.sql").toLowerCase();
for (const expected of [
  "hpd-p01",
  "hpd-001",
  "hpd-002",
  "hpd-010",
  "hpd-012",
  "no permanent talent labels",
  "no numerical potential score",
  "no private pipupath content copied into o16",
  "participation is not mastery",
  "potential review requires discovery + hypothesis + evidence + reflection",
  "review preparer cannot self-approve",
  "ops_o16_potential_discovery_bootstrapped",
  "seededdiscoveryrecords',0",
  "seededhypotheses',0",
  "seededevidence',0",
  "seededexplorations',0",
  "seededreflections',0",
  "seededreviews',0",
]) requireText(seed, expected, "O16 process-control seed");

for (const path of [
  "supabase/migrations/20260924172154_khpos_ops_o12_academic_delivery.sql",
  "supabase/migrations/20260924183524_khpos_ops_o14_learner_progress.sql",
  "supabase/migrations/20260924190921_khpos_ops_o15_academic_assurance.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_potential_discovery_records")) {
    throw new Error(
      `Operations O16 contract failed: historical migration ${path} must remain independent from O16.`,
    );
  }
}

console.log("KHP-OS Operations O16 potential-discovery contracts validated.");
