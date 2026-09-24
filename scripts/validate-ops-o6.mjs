import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O6 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/performance"', "school workspace navigation");
requireText(nav, 'label: "Performance & Scorecards"', "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/performance/page.tsx");
requireText(page, "PerformanceWorkspace", "performance route");
requireText(page, "UUID_RE", "performance route validation");

const api = read("src/app/api/khpos/ops/performance/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsPerformance",
  "createKhposOpsKpi",
  "recordKhposOpsKpiMeasurement",
  "configureKhposOpsKpiTarget",
  "retireKhposOpsKpi",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O6 performance API");
}

const service = read("src/lib/khpos/ops/performance.ts");
for (const expected of [
  "khpos_ops_get_performance_server",
  "khpos_ops_create_kpi_server",
  "khpos_ops_record_kpi_measurement_server",
  "khpos_ops_configure_kpi_target_server",
  "khpos_ops_retire_kpi_server",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  requireText(service, expected, "O6 performance service");
}

const workspace = read("src/components/khpos/ops/PerformanceWorkspace.tsx");
for (const expected of [
  "Operations · O6",
  "Performance & Scorecards",
  "Live operating pulse",
  "What is true right now",
  "Never average away a critical control",
  "New KPIs start in baseline mode.",
  "No governed KPIs yet.",
  "How O6 feeds leadership",
]) {
  requireText(workspace, expected, "O6 performance workspace");
}

const migration = read(
  "supabase/migrations/20260924135638_khpos_ops_o6_performance.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_kpis",
  "create table if not exists public.khpos_ops_kpi_versions",
  "create table if not exists public.khpos_ops_kpi_measurements",
  "ops_kpi_status",
  "ops_can_govern_performance",
  "khpos_ops_get_performance_server",
  "khpos_ops_create_kpi_server",
  "khpos_ops_record_kpi_measurement_server",
  "khpos_ops_configure_kpi_target_server",
  "khpos_ops_retire_kpi_server",
  "baseline_only",
  "higher_is_better",
  "lower_is_better",
  "binary_control",
  "an active kpi with no measurement is still unbaselined",
  "kpi governance requires an active school guardian or vision custodian role",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O6 migration");
}

const seed = read("supabase/seeds/khpos_ops_o6_performance.sql");
for (const expected of [
  "IPA-001",
  "IPA-002",
  "IPA-003",
  "IPA-004",
  "IPA-005",
  "baseline evidence",
  "Do not average critical failure away",
  "seededKpis',0",
  "ops_o6_performance_engine_bootstrapped",
]) {
  requireText(seed, expected, "KNS O6 performance seed");
}

for (const historical of [
  "supabase/migrations/20260924125010_khpos_ops_o3_work_execution.sql",
  "supabase/migrations/20260924130809_khpos_ops_o4_issue_engine.sql",
  "supabase/migrations/20260924133624_khpos_ops_o5_decisions.sql",
]) {
  const source = read(historical);
  if (
    source.includes("khpos_ops_kpi_versions") ||
    source.includes("khpos_ops_kpi_measurements")
  ) {
    throw new Error(
      `Operations O6 contract failed: ${historical} must remain historically unchanged and independent from O6 performance tables.`,
    );
  }
}

console.log("KHP-OS Operations O6 performance-scorecard contracts validated.");
