import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const base = "src/components/khpos/ops/";
const common = read(base + "RecordListControls.tsx");

assert.ok(common.includes('type="search"'), "Search must use mobile-friendly search input");
assert.ok(common.includes('aria-label="Clear record search"'), "Search must be clearable");
assert.ok(common.includes('aria-live="polite"'), "Search count must be accessible");
assert.ok(common.includes('return {') && common.includes('visibleItems'), "Hook must expose visible records");
assert.ok(common.includes("records.filter((record)"), "Search must filter authorised records already received");
assert.ok(common.includes("[...filtered].sort(comparison)"), "Sorting must not mutate source queue records");
assert.ok(common.includes('window.addEventListener("hashchange"'), "Deep links must clear stale search");
assert.ok(common.includes("Number.isFinite(first)"), "Date sort must handle missing dates");

const recordPages = [
  ["IssuesWorkspace", "issueQueue", "issueList"],
  ["DecisionsWorkspace", "decisionQueue", "decisionList"],
  ["PeopleWorkspace", "staffQueue", "staffList"],
  ["ParentPartnershipWorkspace", "caseQueue", "caseList"],
  ["AssetsMaintenanceWorkspace", "assetQueue", "assetList"],
  ["MyWorkWorkspace", null, "workList"],
];

for (const [page, queue, list] of recordPages) {
  const s = read(base + page + ".tsx");
  assert.ok(s.includes("useRecordListControls("), page + " needs record search and sorting");
  assert.ok(s.includes("<RecordListControls controls={" + list + "}"), page + " needs visible controls");
  assert.ok(s.includes(list + ".visibleItems"), page + " must render filtered results");
  if (queue) {
    assert.ok(s.includes("useRecordQueue("), page + " must retain active/history grouping");
    assert.ok(s.includes("useRecordListControls(\n    " + queue + ".visibleItems"), page + " must filter the selected queue only");
  }
}
for (const page of ["InstitutionalLibrary", "OperationalRecordsWorkspace"]) {
  const s = read(base + page + ".tsx");
  assert.ok(s.includes("<RecordSortSelect"), page + " must expose sorting");
  assert.ok(s.includes('type="search"'), page + " must preserve existing search");
  assert.ok(s.includes(".sort("), page + " must sort visible results");
}
console.log("Record search and sorting coverage: 8 register and queue pages verified.");
