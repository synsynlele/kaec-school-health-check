import { spawnSync } from "node:child_process";

for (const script of [
  "scripts/validate-khpos-foundation.mjs",
  "scripts/validate-stage1b.mjs",
  "scripts/validate-stage1c.mjs",
  "scripts/validate-stage2.mjs",
  "scripts/validate-stage3.mjs",
  "scripts/validate-stage4.mjs",
  "scripts/validate-stage5.mjs",
  "scripts/validate-stage6.mjs",
  "scripts/validate-stage7.mjs",
  "scripts/validate-stage8.mjs",
  "scripts/validate-stage9.mjs",
  "scripts/validate-stage10.mjs",
  "scripts/validate-partner-access.mjs",
  "scripts/validate-kshc-ai.mjs",
  "scripts/validate-report-integrity.mjs",
  "scripts/validate-ops-o1.mjs",
  "scripts/validate-ops-o2.mjs",
  "scripts/validate-ops-o3.mjs",
  "scripts/validate-ops-o4.mjs",
  "scripts/validate-ops-o5.mjs",
  "scripts/validate-ops-o6.mjs",
  "scripts/validate-ops-o7.mjs",
  "scripts/validate-ops-o8.mjs",
  "scripts/validate-ops-o9.mjs",
  "scripts/validate-ops-o10.mjs",
  "scripts/validate-ops-o11.mjs",
  "scripts/validate-ops-o12.mjs",
  "scripts/validate-ops-o13.mjs",
  "scripts/validate-ops-o14.mjs",
  "scripts/validate-ops-o15.mjs",
  "scripts/validate-ops-o16.mjs",
  "scripts/test-scoring.mjs",
]) {
  const run = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
