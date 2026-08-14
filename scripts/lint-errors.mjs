import { spawnSync } from "node:child_process";

const eslintBin = process.platform === "win32"
  ? "node_modules/.bin/eslint.cmd"
  : "node_modules/.bin/eslint";

const run = spawnSync(eslintBin, [".", "--format", "json"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (run.error) {
  console.error(run.error);
  process.exit(1);
}

let results;
try {
  results = JSON.parse(run.stdout || "[]");
} catch {
  console.error(run.stdout || run.stderr || "ESLint failed without readable output.");
  process.exit(1);
}

const errors = results.flatMap((result) =>
  result.messages
    .filter((message) => message.severity === 2)
    .map((message) => ({ filePath: result.filePath, ...message })),
);

for (const result of results) {
  for (const message of result.messages.filter((item) => item.severity === 1)) {
    console.warn(`warning ${result.filePath}:${message.line ?? 0}:${message.column ?? 0} ${message.message} ${message.ruleId ?? ""}`);
  }
}

if (errors.length) {
  for (const error of errors) {
    console.error(`error ${error.filePath}:${error.line ?? 0}:${error.column ?? 0} ${error.message} ${error.ruleId ?? ""}`);
  }
  console.error(`ESLint found ${errors.length} error(s).`);
  process.exit(1);
}

console.log("ESLint found no errors.");
