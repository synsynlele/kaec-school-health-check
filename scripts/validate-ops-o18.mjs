import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O18 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/leadership-financial"', "workspace navigation");
requireText(nav, 'label: "Leadership & Finance"', "workspace navigation");
requireText(nav, 'suffix: "/skills-development"', "O17 navigation continuity");
requireText(nav, 'suffix: "/potential-development"', "O16 navigation continuity");

const page = read("src/app/khpos/[organisationId]/leadership-financial/page.tsx");
requireText(page, "LeadershipFinancialWorkspace", "O18 route");
requireText(page, "UUID_RE", "O18 route validation");

const api = read("src/app/api/khpos/ops/leadership-financial/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsLeadershipFinancial",
  "createKhposOpsLeadershipOpportunity",
  "actOnKhposOpsLeadershipOpportunity",
  "createKhposOpsFinancialActivity",
  "actOnKhposOpsFinancialActivity",
  "addKhposOpsCapabilityEvidence",
  "actOnKhposOpsCapabilityEvidence",
  '"Cache-Control": "private, no-store"',
  '"recover"',
  '"waive_recovery"',
]) {
  requireText(api, expected, "O18 API");
}

const service = read("src/lib/khpos/ops/leadership-financial.ts");
for (const expected of [
  "khpos_ops_get_leadership_financial_server",
  "khpos_ops_create_leadership_opportunity_server",
  "khpos_ops_leadership_opportunity_action_server",
  "khpos_ops_create_financial_activity_server",
  "khpos_ops_financial_activity_action_server",
  "khpos_ops_add_capability_evidence_server",
  "khpos_ops_capability_evidence_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O18 service");
}

const workspace = read("src/components/khpos/ops/LeadershipFinancialWorkspace.tsx");
for (const expected of [
  "Operations · O18",
  "Leadership & Financial Capability",
  "Participation is not leadership",
  "Attendance is not financial capability",
  "PipuPath privacy stays intact",
  "Independent verification required",
  "Close the recovery obligation",
  "Record recovery",
  "Waive with reason",
  "Linked to O16 Potential Development",
]) {
  requireText(workspace, expected, "O18 workspace");
}

for (const [path, source] of [
  ["src/components/khpos/ops/LeadershipFinancialWorkspace.tsx", workspace],
  ["src/lib/khpos/ops/leadership-financial.ts", service],
  ["src/app/api/khpos/ops/leadership-financial/[id]/route.ts", api],
]) {
  if ((source.match(/\\`/g) || []).length > 0 || (source.match(/\\\$\{/g) || []).length > 0) {
    throw new Error(
      `Operations O18 contract failed: escaped template-literal generation artefacts remain in ${path}.`,
    );
  }
}

const migration = read(
  "supabase/migrations/20260924213818_khpos_ops_o18_leadership_financial.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_leadership_opportunities",
  "create table if not exists public.khpos_ops_financial_capability_activities",
  "create table if not exists public.khpos_ops_hpd_capability_evidence",
  "create table if not exists public.khpos_ops_hpd_capability_events",
  "khpos_ops_get_leadership_financial_server",
  "khpos_ops_create_leadership_opportunity_server",
  "khpos_ops_leadership_opportunity_action_server",
  "khpos_ops_create_financial_activity_server",
  "khpos_ops_financial_activity_action_server",
  "khpos_ops_add_capability_evidence_server",
  "khpos_ops_capability_evidence_action_server",
  "the evidence recorder cannot verify their own capability evidence",
  "attendance",
  "khpos_ops_create_issue_server",
  "human_potential_development",
  "recovery_status='recovered'",
  "only human potential coordinating authority can waive a financial capability recovery obligation",
  "khpos://capability/evidence/",
  "executiveaggregateonly",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O18 migration");
}

const seed = read(
  "supabase/seeds/khpos_ops_o18_leadership_financial.sql",
).toLowerCase();

for (const expected of [
  "hpd-p01",
  "hpd-005",
  "hpd-006",
  "leadership is demonstrated",
  "do not create a numeric leadership score",
  "attendance alone never proves financial capability",
  "different authorised coordinating leader independently verifies",
  "builders council seat selection/recall in the student culture system",
  "missed required delivery",
  "o4 issue",
  "private pipupath",
  "ops_o18_leadership_financial_bootstrapped",
  "seededleadershipopportunities',0",
  "seededfinancialactivities',0",
  "seededcapabilityevidence',0",
]) {
  requireText(seed, expected, "O18 process-control seed");
}

for (const path of [
  "supabase/migrations/20260924194015_khpos_ops_o16_potential_discovery.sql",
  "supabase/migrations/20260924211424_khpos_ops_o17_skills_pathways.sql",
]) {
  const historical = read(path);
  if (historical.includes("khpos_ops_hpd_capability_evidence")) {
    throw new Error(
      `Operations O18 contract failed: historical migration ${path} must remain independent from O18.`,
    );
  }
}

console.log("KHP-OS Operations O18 leadership-financial contracts validated.");
