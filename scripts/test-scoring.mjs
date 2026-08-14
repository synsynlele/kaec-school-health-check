import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const outDir = resolve(".stage1-test-dist");
rmSync(outDir, { recursive: true, force: true });

const tsc = process.platform === "win32" ? "tsc.cmd" : "tsc";
const compile = spawnSync(
  tsc,
  [
    "--target", "ES2022",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir", outDir,
    "src/lib/questions.ts",
    "src/lib/scoring.ts",
  ],
  { stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status ?? 1);

const require = createRequire(import.meta.url);
const { QUESTIONS, CHAPTERS } = require(resolve(outDir, "questions.js"));
const { computeScores, ratingFor } = require(resolve(outDir, "scoring.js"));

assert.equal(QUESTIONS.length, 55);
assert.equal(CHAPTERS.length, 11);
for (const chapter of CHAPTERS) {
  assert.equal(
    QUESTIONS.filter((q) => q.chapter === chapter.key).length,
    5,
    `${chapter.key} must contain exactly five indicators`,
  );
}

const answersAt = (score) =>
  QUESTIONS.map((q) => ({ questionId: q.id, chapter: q.chapter, score, answer: String(score) }));

assert.equal(computeScores(answersAt(5)).overall, 100);
assert.equal(computeScores(answersAt(1)).overall, 20);
assert.equal(ratingFor(85).band, "thriving");
assert.equal(ratingFor(84).band, "healthy");
assert.equal(ratingFor(70).band, "healthy");
assert.equal(ratingFor(69).band, "developing");
assert.equal(ratingFor(55).band, "developing");
assert.equal(ratingFor(54).band, "at_risk");
assert.equal(ratingFor(40).band, "at_risk");
assert.equal(ratingFor(39).band, "critical");

const leadershipStrongTeachingWeak = QUESTIONS
  .filter((q) => q.chapter === "leadership" || q.chapter === "teaching")
  .map((q) => ({
    questionId: q.id,
    chapter: q.chapter,
    score: q.chapter === "leadership" ? 5 : 1,
    answer: "",
  }));
const mixed = computeScores(leadershipStrongTeachingWeak);
assert.equal(mixed.overall, 60, "overall score must preserve current equal chapter weighting");
assert.equal(mixed.priorityChapter, "teaching");
assert.equal(mixed.strengthChapter, "leadership");

const invalid = answersAt(5);
invalid[0] = { ...invalid[0], score: 99 };
assert.equal(
  computeScores(invalid).chapterScores.find((c) => c.chapter === "leadership").answeredCount,
  4,
  "out-of-range scores must be ignored by scoring",
);

rmSync(outDir, { recursive: true, force: true });
console.log("KSHC scoring regression tests passed.");
