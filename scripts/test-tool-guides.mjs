import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const mod = { exports: {} };
new Function(
  "module",
  "exports",
  ts.transpileModule(
    fs.readFileSync("src/lib/khpos/ops/tool-guides.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
)(mod, mod.exports);
const { getToolGuide, toolFieldPreview } = mod.exports;
const types = [
  ...fs
    .readFileSync("supabase/seeds/khpos_ops_o2_tools.sql", "utf8")
    .matchAll(/values\(v_org,'UTL-\d+','[^']*','([^']+)'/g),
]
  .map((m) => m[1])
  .concat(["operating_log", "operating_report"]);
assert.equal(types.length, 32);
for (const type of types) {
  const guide = getToolGuide(type);
  assert.notEqual(
    guide.when,
    getToolGuide("unrecognised_type").when,
    `${type} needs a specific usage guide`,
  );
  assert.ok(guide.steps.length >= 3);
  assert.ok(
    fs.existsSync(
      `src/app/khpos/[organisationId]${guide.destination.split("?")[0]}/page.tsx`,
    ),
    `real destination for ${type}`,
  );
}
assert.equal(getToolGuide("audit").automatic, true);
assert.ok(getToolGuide("case").steps.some((s) => s.includes("confidential")));
assert.ok(getToolGuide("meeting").steps[0].includes("must configure"));
assert.deepEqual(
  toolFieldPreview({
    formatVersion: 1,
    fields: [
      {
        key: "periodStart",
        label: "Period start",
        type: "date",
        required: true,
      },
      {
        key: "confirmed",
        label: "Confirmed",
        type: "boolean",
        required: false,
      },
      { key: "status", type: "select", options: ["Open", "Closed"] },
    ],
  }),
  [
    { label: "Period start", answer: "Date", required: true, options: [] },
    { label: "Confirmed", answer: "Yes or No", required: false, options: [] },
    {
      label: "status",
      answer: "Choose an option",
      required: null,
      options: ["Open", "Closed"],
    },
  ],
);
assert.deepEqual(
  toolFieldPreview({ fields: ["nextAction", "reporting_period"] }),
  [
    {
      label: "next Action",
      answer: "Written answer",
      required: null,
      options: [],
    },
    {
      label: "reporting period",
      answer: "Written answer",
      required: null,
      options: [],
    },
  ],
);
assert.deepEqual(
  toolFieldPreview({
    properties: {
      count: { title: "Count", type: "integer" },
      result: { type: "string", enum: ["Passed", "Returned"] },
    },
    required: ["count"],
  }),
  [
    { label: "Count", answer: "Whole number", required: true, options: [] },
    {
      label: "result",
      answer: "Choose an option",
      required: false,
      options: ["Passed", "Returned"],
    },
  ],
);
assert.deepEqual(
  toolFieldPreview({ formatVersion: 1, workflow: { metadata: "internal" } }),
  [],
);
assert.deepEqual(toolFieldPreview({ fields: [null, 17, {}, []] }), []);
console.log(
  "Tool guides: all 32 tools have specific guidance and real routes; typed field previews, empty/malformed schemas and sensitive-workflow boundaries passed.",
);
