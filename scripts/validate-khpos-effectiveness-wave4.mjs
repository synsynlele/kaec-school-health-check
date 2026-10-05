import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      "KHP-OS effectiveness Wave 4 contract failed: " +
        context +
        " is missing " +
        expected,
    );
  }
}

const inheritance = read(
  "supabase/migrations/20261005153000_khpos_effectiveness_wave4_standard_inheritance.sql",
);

for (const expected of [
  "khpos_standard_releases",
  "khpos_standard_installations",
  "KAEC-STD-1",
  "ops_build_standard_snapshot",
  "ops_standard_target_role",
  "VISION_CUSTODIAN",
  "SCHOOL_CUSTODIAN",
  "pending_adoption",
  "khpos.standard_adoption",
  "ops_localise_standard_policy_draft",
  "ops_localise_standard_process_draft",
  "locally customised policy",
  "locally customised process",
  "recurringRulesInstalledPaused",
  "'paused'",
  "ops_standard_installed",
  "ops_standard_adopted",
]) {
  requireText(inheritance, expected, "versioned KAEC Standard inheritance");
}

for (const expected of [
  "alter table public.khpos_standard_releases enable row level security",
  "alter table public.khpos_standard_installations enable row level security",
  "revoke all privileges on table public.khpos_standard_releases",
  "revoke all privileges on table public.khpos_standard_installations",
  "revoke all on function public.khpos_ops_install_standard_release_server",
  "revoke all on function public.khpos_ops_adopt_standard_release_server",
]) {
  requireText(inheritance, expected, "standard security boundary");
}

if (
  inheritance.includes(
    "update public.khpos_ops_policy_versions pv\n  set standard_release_id=v_release",
  ) ||
  inheritance.includes(
    "update public.khpos_ops_process_versions pv\n  set standard_release_id=v_release",
  )
) {
  throw new Error(
    "KHP-OS effectiveness Wave 4 contract failed: immutable reference-school active versions must not be retroactively rewritten for provenance.",
  );
}

const standardService = read("src/lib/khpos/ops/standard.ts");
for (const expected of [
  "getKhposStandardWorkspace",
  "adoptKhposStandard",
  "inheritedDrafts",
  "localOpenRevisions",
  "activate_operations",
  "VISION_CUSTODIAN",
  "SCHOOL_CUSTODIAN",
]) {
  requireText(standardService, expected, "KAEC Standard workspace service");
}

const standardUi = read(
  "src/components/khpos/ops/KaecStandardWorkspace.tsx",
);
for (const expected of [
  "Scale the operating standard, not founder memory.",
  "Adopt this KAEC Standard",
  "Safe activation boundary",
  "Standardisation does not erase school judgement.",
]) {
  requireText(standardUi, expected, "KAEC Standard leadership experience");
}

const improvement = read("src/lib/khpos/improvement.ts");
for (const expected of [
  "KhposOperationalLearningSignal",
  "operationalLearning",
  "returnedRecords",
  "completionReliability",
  "process redesign question",
  "windowDays: 90",
]) {
  requireText(improvement, expected, "evidence-to-process learning loop");
}

const improvementUi = read(
  "src/components/khpos/ImprovementIntelligenceWorkspace.tsx",
);
for (const expected of [
  "Operational learning loop · 90 days",
  "Which processes are teaching us that the system needs redesign?",
  "Review the controlled process",
]) {
  requireText(improvementUi, expected, "operational learning interface");
}

const operatingBenchmark = read(
  "supabase/migrations/20261005153500_khpos_effectiveness_wave4_operating_benchmark.sql",
);
for (const expected of [
  "khpos_get_school_operating_benchmark_server",
  "sameStandardRequired",
  "minimumPeers',5",
  "minimumObservationsPerMetric",
  "execution_coverage",
  "work_completion_reliability",
  "on_time_completion",
  "verification_first_pass",
  "issue_closure",
  "decision_action_closure",
  "namedPeersExposed',false",
  "rankingDisabled',true",
]) {
  requireText(operatingBenchmark, expected, "privacy-safe operating benchmark");
}

if (
  operatingBenchmark.includes("'peerName'") ||
  operatingBenchmark.includes("'peerOrganisationId'") ||
  operatingBenchmark.includes("'rank'")
) {
  throw new Error(
    "KHP-OS effectiveness Wave 4 contract failed: school-facing operating benchmark must never expose peer identity or exact rank.",
  );
}

const benchmarking = read("src/lib/khpos/benchmarking.ts");
for (const expected of [
  "KhposOperatingBenchmark",
  "OperatingBenchmarkMetric",
  "getPortfolioObservability",
  "standardStatus",
  "failedTriggers7d",
  "staleVerification",
  "p0Unmapped",
]) {
  requireText(benchmarking, expected, "benchmark and portfolio observability");
}

const benchmarkUi = read(
  "src/components/khpos/BenchmarkingWorkspace.tsx",
);
for (const expected of [
  "Operating benchmark · last",
  "How reliably does the operating system execute?",
  "No thin-cohort inference.",
]) {
  requireText(benchmarkUi, expected, "operating benchmark interface");
}

const portfolioUi = read(
  "src/components/khpos/PortfolioIntelligenceWorkspace.tsx",
);
for (const expected of [
  "Portfolio observability",
  "Is the operating network healthy enough to scale?",
  "Trigger failures · 7d",
  "P0 processes unmapped",
]) {
  requireText(portfolioUi, expected, "portfolio observability interface");
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/standard"', "KAEC Standard navigation");
requireText(nav, 'label: "KAEC Standard"', "KAEC Standard navigation");

console.log(
  "KHP-OS effectiveness Wave 4 validated: versioned standard inheritance, controlled local governance, evidence-to-process learning, privacy-safe operating benchmarks and portfolio observability are present.",
);
