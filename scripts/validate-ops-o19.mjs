import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error("Operations O19 contract failed: " + context + " is missing " + expected);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/young-ceo"', "school workspace navigation");
requireText(nav, 'label: "Young CEO Hub"', "school workspace navigation");
requireText(nav, 'suffix: "/leadership-financial"', "O18 navigation continuity");
requireText(nav, 'suffix: "/potential-development"', "O16 navigation continuity");

const page = read("src/app/khpos/[organisationId]/young-ceo/page.tsx");
requireText(page, "YoungCeoWorkspace", "O19 route");
requireText(page, "UUID_RE", "O19 route validation");

const api = read("src/app/api/khpos/ops/young-ceo/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsYoungCeo",
  "createKhposOpsYoungCeoCycle",
  "actOnKhposOpsYoungCeoCycle",
  "createKhposOpsYoungCeoSession",
  "actOnKhposOpsYoungCeoSession",
  "createKhposOpsYoungCeoVenture",
  "updateKhposOpsYoungCeoVentureCanvas",
  "actOnKhposOpsYoungCeoMember",
  "actOnKhposOpsYoungCeoMilestone",
  "actOnKhposOpsYoungCeoVenture",
  "addKhposOpsYoungCeoMemberEvidence",
  "actOnKhposOpsYoungCeoMemberEvidence",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O19 Young CEO API");
}

const service = read("src/lib/khpos/ops/young-ceo.ts");
for (const expected of [
  "khpos_ops_get_young_ceo_server",
  "khpos_ops_create_young_ceo_cycle_server",
  "khpos_ops_young_ceo_cycle_action_server",
  "khpos_ops_create_young_ceo_session_server",
  "khpos_ops_young_ceo_session_action_server",
  "khpos_ops_create_young_ceo_venture_server",
  "khpos_ops_update_young_ceo_venture_canvas_server",
  "khpos_ops_young_ceo_member_action_server",
  "khpos_ops_young_ceo_milestone_action_server",
  "khpos_ops_young_ceo_venture_action_server",
  "khpos_ops_add_young_ceo_member_evidence_server",
  "khpos_ops_young_ceo_member_evidence_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O19 Young CEO service");
}

const workspace = read("src/components/khpos/ops/YoungCeoWorkspace.tsx");
for (const expected of [
  "Operations · O19",
  "Young CEO Hub",
  "Problem → customer → solution → value → costing → pricing → pitch",
  "Commercial boundary",
  "workspace.commercialBoundary",
  "Team success does not become automatic evidence for every learner",
  "Verify → O16",
  "Milestone-gated value creation",
]) {
  requireText(workspace, expected, "O19 workspace");
}

if (workspace.includes(String.fromCharCode(92, 96))) {
  throw new Error(
    "Operations O19 contract failed: YoungCeoWorkspace contains escaped template-literal backticks.",
  );
}

const migration = read(
  "supabase/migrations/20260924215500_khpos_ops_o19_young_ceo.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_young_ceo_cycles",
  "create table if not exists public.khpos_ops_young_ceo_sessions",
  "create table if not exists public.khpos_ops_young_ceo_ventures",
  "create table if not exists public.khpos_ops_young_ceo_members",
  "create table if not exists public.khpos_ops_young_ceo_milestones",
  "create table if not exists public.khpos_ops_young_ceo_member_evidence",
  "create table if not exists public.khpos_ops_young_ceo_events",
  "khpos_ops_get_young_ceo_server",
  "khpos_ops_create_young_ceo_cycle_server",
  "khpos_ops_young_ceo_cycle_action_server",
  "khpos_ops_create_young_ceo_session_server",
  "khpos_ops_young_ceo_session_action_server",
  "khpos_ops_create_young_ceo_venture_server",
  "khpos_ops_update_young_ceo_venture_canvas_server",
  "khpos_ops_young_ceo_member_action_server",
  "khpos_ops_young_ceo_milestone_action_server",
  "khpos_ops_young_ceo_venture_action_server",
  "khpos_ops_add_young_ceo_member_evidence_server",
  "khpos_ops_young_ceo_member_evidence_action_server",
  "resolve planned/missed young ceo hub session obligations before cycle close-out",
  "complete or withdraw every active young ceo venture before cycle close-out",
  "milestone evidence submitter cannot verify their own evidence",
  "real-money young ceo selling requires a finance/admin record reference before the selling stage",
  "external selling requires the applicable school/safeguarding/parent-consent approval reference",
  "all ten young ceo venture milestones must be independently verified before completion",
  "young ceo evidence recorder cannot verify their own evidence",
  "'value_creation','school'",
  "young_ceo_value_evidence_linked",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O19 migration");
}

const seed = read("supabase/seeds/khpos_ops_o19_young_ceo.sql").toLowerCase();
for (const expected of [
  "hpd-p04",
  "hpd-007",
  "young ceo means value creator, not child cash-chaser",
  "simulation is a valid learning route",
  "a successful team result is not automatic evidence for every member",
  "profit, revenue, popularity or pitch charisma cannot become a single young ceo ranking",
  "real-money activity must remain age-appropriate, approved, safeguarded",
  "payment collection, refunds, custody and accounting remain in finance/admin/approved transaction systems",
  "individual value-creation evidence requires an active venture member",
  "venture completion does not auto-create evidence for team members",
  "private pipupath journals",
  "external young ceo challenge participants/events use the events & special programmes architecture",
  "ops_o19_young_ceo_bootstrapped",
]) {
  requireText(seed, expected, "KNS O19 policy/process seed");
}

for (const path of [
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
  "supabase/migrations/20260924213818_khpos_ops_o18_leadership_financial.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_young_ceo_ventures")) {
    throw new Error(
      "Operations O19 contract failed: historical migration " +
        path +
        " must remain independent from O19.",
    );
  }
}

console.log("KHP-OS Operations O19 Young CEO Hub contracts validated.");
