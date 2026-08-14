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
  "scripts/test-scoring.mjs",
]) {
  const run = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
