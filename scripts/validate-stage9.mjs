import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expectContains(path, needles) {
  const content = read(path);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${path} is missing required Stage 9 contract: ${needle}`);
    }
  }
}

const migration =
  "supabase/migrations/20260814213427_stage9_benchmarking_portfolio_intelligence.sql";

expectContains(migration, [
  "khpos_platform_admins",
  "khpos_private.assessment_system_scores",
  "khpos_get_school_benchmark_server",
  "khpos_get_portfolio_intelligence_server",
  "v_peer_count >= 5",
  "v_peer_count < 5",
  "percentile_cont(0.25)",
  "percentile_cont(0.50)",
  "percentile_cont(0.75)",
  "namedPeersExposed',false",
  "rankingDisabled',true",
  "publicRankingEnabled',false",
  "learnerDataIncluded',false",
  "revoke all on function public.khpos_get_school_benchmark_server(uuid,uuid) from public,anon,authenticated",
  "grant execute on function public.khpos_get_school_benchmark_server(uuid,uuid) to service_role",
  "grant execute on function public.khpos_get_portfolio_intelligence_server(uuid) to service_role",
]);

expectContains("src/lib/khpos/benchmarking.ts", [
  "KHPOS_BENCHMARK_MINIMUM_PEERS = 5",
  "above_peer_band",
  "within_peer_band",
  "below_peer_band",
  "publicRankingEnabled: false",
  "getKhposBenchmarkWorkspace",
  "getKhposPortfolioIntelligence",
]);

expectContains("src/app/api/khpos/benchmarking/[id]/route.ts", [
  "bearerTokenFromRequest",
  "verifyKhposAccessToken",
  "getKhposBenchmarkWorkspace",
]);

expectContains("src/app/api/khpos/portfolio/route.ts", [
  "bearerTokenFromRequest",
  "verifyKhposAccessToken",
  "getKhposPortfolioIntelligence",
]);

expectContains("src/components/khpos/BenchmarkingWorkspace.tsx", [
  "Context without competition.",
  "No league tables.",
  "minimumPeers",
  "Only fresh KSHC reassessment can change Verified Institutional Improvement",
]);

expectContains("src/components/khpos/PortfolioIntelligenceWorkspace.tsx", [
  "Named internal oversight",
  "School membership alone never grants cross-institution access.",
  "Portfolio intelligence is stewardship, not surveillance.",
  "Public ranking remains disabled.",
]);

expectContains("src/app/khpos/[organisationId]/page.tsx", [
  "/benchmarking",
  "Benchmark Intelligence",
]);

expectContains("scripts/test-core.mjs", ["scripts/validate-stage9.mjs"]);

console.log("Stage 9 Benchmarking & Portfolio Intelligence structural checks passed.");
