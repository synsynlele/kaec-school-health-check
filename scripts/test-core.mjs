import { spawnSync } from "node:child_process";

for (const script of [
  "scripts/validate-khpos-foundation.mjs",
  "scripts/validate-stage1b.mjs",
  "scripts/validate-stage1c.mjs",
  "scripts/test-scoring.mjs",
]) {
  const run = spawnSync(process.execPath, [script], { stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
