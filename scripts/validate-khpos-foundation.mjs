import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const foundation = JSON.parse(
  readFileSync(new URL("../src/lib/khpos/foundation.v1.json", import.meta.url), "utf8"),
);
const questionsSource = readFileSync(
  new URL("../src/lib/questions.ts", import.meta.url),
  "utf8",
);

assert.equal(foundation.foundationVersion, "1.0");
assert.equal(foundation.diagnosticFramework.id, "kshc");
assert.equal(foundation.diagnosticFramework.indicatorCount, 55);
assert.equal(foundation.diagnosticFramework.assessmentAreaCount, 11);
assert.equal(foundation.systems.length, 7);
assert.equal(foundation.scoreRouting.length, 5);
assert.equal(foundation.indicatorRegistry.length, 55);

const systemNames = new Set(foundation.systems.map((system) => system.name));
const indicatorIds = foundation.indicatorRegistry.map((entry) => entry.indicatorId);
assert.equal(new Set(indicatorIds).size, 55, "indicator IDs must be unique");

for (const entry of foundation.indicatorRegistry) {
  assert.ok(systemNames.has(entry.primarySystem), `${entry.indicatorId}: unknown primary system`);
  assert.ok(systemNames.has(entry.secondarySystem), `${entry.indicatorId}: unknown secondary system`);
  assert.ok(entry.interventionFamily.trim().length > 0, `${entry.indicatorId}: intervention family missing`);
}

const sourceIds = [...questionsSource.matchAll(/q\("([a-z_]+)",\s*(\d+),/g)].map(
  ([, chapter, number]) => `${chapter}_${number}`,
);
assert.equal(sourceIds.length, 55, "questions.ts must contain exactly 55 indicators");
assert.deepEqual(
  [...indicatorIds].sort(),
  [...sourceIds].sort(),
  "KHP-OS registry must map exactly the live KSHC indicator IDs",
);

const expectedPrimaryCounts = {
  "Identity & Direction": 1,
  "Learning & Mastery": 4,
  "Capability Development": 3,
  "Value Creation & Application": 0,
  "Human Development Ecosystem": 16,
  "Institutional Excellence": 24,
  "Intelligence & Continuous Improvement": 7,
};
const actualPrimaryCounts = Object.fromEntries(
  [...systemNames].map((name) => [name, 0]),
);
for (const entry of foundation.indicatorRegistry) {
  actualPrimaryCounts[entry.primarySystem] += 1;
}
assert.deepEqual(actualPrimaryCounts, expectedPrimaryCounts);

assert.deepEqual(
  foundation.scoreRouting.map(({ score, route }) => [score, route]),
  [
    [1, "STABILISE"],
    [2, "SYSTEMISE"],
    [3, "DEVELOP"],
    [4, "OPTIMISE"],
    [5, "SUSTAIN / INNOVATE"],
  ],
);

console.log("KHP-OS foundation validation passed: 55 indicators, 7 systems, 5 score routes.");
