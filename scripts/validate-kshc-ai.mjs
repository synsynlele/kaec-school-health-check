import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function expect(path, needles) {
  const source = read(path);
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${path} is missing KSHC AI contract: ${needle}`);
    }
  }
}

expect("src/lib/kaec-ai-model.ts", ["gpt-6-luna", "KAEC_AI_MODEL", 'reasoning_effort: "none"']);
for (const path of ["src/lib/kshc-ai-coach.ts", "src/lib/khpos/ops/assistant.ts", "src/lib/khpos/intervention-intelligence.ts", "src/lib/khpos/review.ts"]) {
  expect(path, ["KAEC_AI_MODEL", "...KAEC_AI_CHAT_OPTIONS"]);
}

expect("src/lib/kshc-ai-report.ts", [
  "OPENAI_API_KEY",
  "KAEC_AI_MODEL",
  "...KAEC_AI_CHAT_OPTIONS",
  "probeOpenAiConnection",
  "openai_success",
  "ai_not_configured",
  "ai_schema_failed",
  "ai_api_failed",
  "for (let attempt = 1; attempt <= 2; attempt += 1)",
  "Never invent industry statistics",
  "duplicate ${label} titles",
]);

expect("src/app/api/assessments/[id]/analyze/route.ts", [
  '@/lib/kshc-ai-report',
  "aiStatus",
  "aiModel",
]);

expect("src/app/api/health/route.ts", [
  "openAiConfigurationStatus",
  "probeOpenAiConnection",
  "generateReport",
  'url.searchParams.get("probe") === "1"',
  'url.searchParams.get("reportProbe") === "1"',
  'process.env.VERCEL_ENV !== "production"',
  'report.engine === "openai"',
  '"Cache-Control": "no-store"',
]);

expect("src/app/api/health/ai/route.ts", [
  "probeOpenAiConnection",
  'process.env.VERCEL_ENV === "production"',
  "Live AI probing is disabled",
]);

console.log("KSHC OpenAI observability, connectivity and report-pipeline contracts passed.");
