import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(
      "KHP-OS Performance Wave 6 contract failed: " +
        label +
        " is missing " +
        JSON.stringify(expected),
    );
  }
}

const migration = read(
  "supabase/migrations/20261005172000_khpos_performance_wave6_core_baseline.sql",
);

for (const expected of [
  "khpos_ops_adopt_core_scorecard_server",
  "khpos_ops_sync_core_scorecard_server",
  "KHP-CORE-EXEC-COVERAGE",
  "KHP-CORE-WORK-RELIABILITY",
  "KHP-CORE-ONTIME",
  "KHP-CORE-FIRST-PASS",
  "KHP-CORE-ISSUE-CLOSURE",
  "KHP-CORE-DECISION-CLOSURE",
  "'baseline_only'",
  "'operational_engine'",
  "'weekly'",
  "'{}'::jsonb",
  "ops_core_kpi_adopted",
  "ops_core_kpi_measurement_started",
]) {
  requireText(migration, expected, "core operating scorecard migration");
}

if (
  migration.includes("'higher_is_better'") ||
  migration.includes("'lower_is_better'") ||
  migration.includes("'binary_control'")
) {
  throw new Error(
    "KHP-OS Performance Wave 6 contract failed: core baseline adoption must not create target directions.",
  );
}

const service = read("src/lib/khpos/ops/performance.ts");
for (const expected of [
  "CORE_SCORECARD_CODES",
  "PROCESS_KPI_STARTER_TEMPLATES",
  "getStarterKpiSuggestions",
  "adoptKhposCoreScorecard",
  "adoptKhposStarterKpi",
  "syncCoreScorecard",
  'sourceType === "operational_engine"',
  "cannot be overwritten manually",
  "process-kpi:",
  "exact",
]) {
  requireText(service, expected, "Performance service");
}

for (const expected of [
  '"ACD-009"',
  '"LPI-001"',
  '"HPD-004"',
  '"PEO-006"',
  '"GOV-007"',
  '"IPA-008"',
  "sourceKpis.includes(template.sourceKpi)",
  "staffedRoleIds.has(profile.owner_role_id)",
]) {
  requireText(service, expected, "process KPI lineage controls");
}

const api = read("src/app/api/khpos/ops/performance/[id]/route.ts");
for (const expected of [
  '"adopt_core_scorecard"',
  '"adopt_starter_kpi"',
  "adoptKhposCoreScorecard",
  "adoptKhposStarterKpi",
]) {
  requireText(api, expected, "Performance API");
}

const ui = read("src/components/khpos/ops/PerformanceWorkspace.tsx");
for (const expected of [
  "Core Operating Baseline",
  "Adopt Core Baseline",
  "Suggested from approved processes",
  "Adopt KPI",
  "No invented targets",
  "System-measured",
  'kpi.sourceType !== "operational_engine"',
]) {
  requireText(ui, expected, "Performance experience");
}

console.log("KHP-OS Performance Wave 6 contract passed.");
