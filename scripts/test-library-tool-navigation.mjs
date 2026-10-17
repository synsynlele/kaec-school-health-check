import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as React from "react";
import * as JSX from "react/jsx-runtime";
function load(path, require = () => ({})) {
  const m = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
  )(require, m, m.exports);
  return m.exports;
}
const nav = load("src/lib/khpos/ops/library-navigation.ts");
const org = "08f3a10a-94c5-4c2f-937c-9d28d8334d7b",
  one = "00000000-0000-4000-8000-000000000001",
  two = "00000000-0000-4000-8000-000000000002";
const process = (id, code, toolCodes) => ({
  id,
  code,
  title: code,
  operatingMap: {
    controlledRecords: toolCodes.map((toolCode) => ({ toolCode })),
  },
});
const rows = [
  process(two, "ACD-009", ["UTL-032", "UTL-032"]),
  process(one, "ACD-007", ["UTL-031"]),
  process("third", "HPD-004", ["UTL-032"]),
  { id: "no-map", code: "IPA-001" },
];
assert.deepEqual(
  nav.relatedToolProcesses({ code: "UTL-032" }, rows).map((p) => p.id),
  [two, "third"],
  "multiple related processes, no duplicate links",
);
assert.deepEqual(
  nav.relatedToolProcesses({ code: "UTL-031" }, rows).map((p) => p.id),
  [one],
);
assert.deepEqual(
  nav.relatedToolProcesses({ code: "UTL-015" }, rows),
  [],
  "no guessed association from names",
);
const url = new URL(
  nav.processDocumentHref(org, one),
  "https://fixture.invalid",
);
assert.equal(url.pathname, `/khpos/${org}/library`);
assert.equal(url.searchParams.get("tab"), "processes");
assert.equal(url.searchParams.get("process"), one);
// Exercise the actual async App Router page: same-path URL changes must produce distinct React keys.
const Library = () => null;
const page = load("src/app/khpos/[organisationId]/library/page.tsx", (name) => {
  if (name === "react/jsx-runtime") return JSX;
  if (name === "next/navigation")
    return {
      notFound: () => {
        throw new Error("Not found");
      },
    };
  if (name.includes("InstitutionalLibrary"))
    return { InstitutionalLibrary: Library };
  if (name.includes("library-navigation")) return nav;
  if (name === "@/lib/http") return { UUID_RE: /^[a-f0-9-]{36}$/i };
  throw new Error("Unexpected import " + name);
}).default;
const render = (search) =>
  page({
    params: Promise.resolve({ organisationId: org }),
    searchParams: Promise.resolve(search),
  });
const tools = await render({ tab: "tools", q: "risk" }),
  catalogue = await render({ tab: "processes" }),
  first = await render({ tab: "processes", process: one }),
  second = await render({ tab: "processes", process: two });
assert.equal(first.type, Library);
assert.equal(first.props.initialProcessId, one);
assert.equal(first.props.initialTab, "processes");
assert.equal(first.props.initialQuery, "");
assert.notEqual(tools.key, catalogue.key);
assert.notEqual(catalogue.key, first.key);
assert.notEqual(first.key, second.key);
assert.equal(
  (await render({ tab: "processes", process: "invalid" })).props
    .initialProcessId,
  "",
);
// Render the guide itself, verifying exact links and honest empty associations.
const guideModule = load("src/lib/khpos/ops/tool-guides.ts");
const Link = ({ children, ...props }) =>
  React.createElement("a", props, children);
const { ToolUsageGuide } = load(
  "src/components/khpos/ops/ToolUsageGuide.tsx",
  (name) =>
    name === "react/jsx-runtime"
      ? JSX
      : name === "next/link"
        ? { default: Link }
        : name.includes("library-navigation")
          ? nav
          : name.includes("tool-guides")
            ? guideModule
            : {},
);
const { renderToStaticMarkup } = await import("react-dom/server");
const tool = {
  code: "UTL-032",
  toolType: "operating_report",
  schemaDefinition: {},
};
const html = renderToStaticMarkup(
  React.createElement(ToolUsageGuide, {
    tool,
    organisationId: org,
    processes: rows,
  }),
);
assert.ok(html.includes("process=" + two));
assert.ok(html.includes("process=third"));
assert.ok(!html.includes("process=" + one));
const empty = renderToStaticMarkup(
  React.createElement(ToolUsageGuide, {
    tool: { ...tool, code: "UTL-015", toolType: "risk_assessment" },
    organisationId: org,
    processes: rows,
  }),
);
assert.ok(empty.includes("No process-to-tool connection"));
assert.ok(empty.includes("Browse processes"));
assert.ok(!empty.includes("Find the related process"));
console.log(
  "Library navigation: actual page remounts for same-path tab/search/process changes, exact authorised process associations, multi-process choices and honest unlinked fallback passed.",
);
