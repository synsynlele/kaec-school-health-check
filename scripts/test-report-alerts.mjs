import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function moduleFrom(path, require, env = {}) {
  const mod = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    "process",
    ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(require, mod, mod.exports, { env });
  return mod.exports;
}
const items = [
  {
    id: "overdue",
    status: "draft",
    canEdit: true,
    overdue: true,
    lock_version: 1,
    due_at: "2026-10-15T16:00:00Z",
  },
  {
    id: "soon",
    status: "draft",
    canEdit: true,
    overdue: false,
    lock_version: 2,
    due_at: "2026-10-16T16:00:00Z",
  },
  {
    id: "returned",
    status: "returned",
    canEdit: true,
    overdue: false,
    lock_version: 3,
    due_at: "2026-11-16T16:00:00Z",
  },
  {
    id: "not-owner",
    status: "draft",
    canEdit: false,
    overdue: true,
    lock_version: 1,
    due_at: "2026-10-15T16:00:00Z",
  },
  {
    id: "review",
    status: "submitted",
    canReview: true,
    lock_version: 4,
    due_at: "2026-11-16T16:00:00Z",
    submitted_at: "2026-10-16T10:00:00Z",
  },
  {
    id: "accepted",
    status: "accepted",
    canEdit: true,
    overdue: false,
    lock_version: 5,
    due_at: "2026-10-15T16:00:00Z",
  },
];
const calls = [];
const service = moduleFrom(
  "src/lib/khpos/reports.ts",
  () => ({
    createClient: () => ({
      rpc: async (name, args) => {
        calls.push(name);
        assert.equal(name, "khpos_report_attention_server");
        assert.equal(args.p_actor, "actor");
        assert.equal(args.p_school, "school");
        return { data: { items }, error: null };
      },
    }),
  }),
  {
    NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture",
  },
);
const alerts = await service.getReportAlerts("school", "actor");
assert.deepEqual(calls, ["khpos_report_attention_server"]);
assert.deepEqual(
  alerts.map((a) => a.id),
  [
    "report:overdue:draft:v1",
    "report:soon:draft:v2",
    "report:returned:returned:v3",
    "report:review:submitted:v4",
  ],
);
assert.equal(
  alerts[3].dueAt,
  "2026-10-16T10:00:00Z",
  "review reminders use submission time, not future deadline",
);
assert.ok(
  alerts.every(
    (a) => !a.detail.includes("Teaching") && !a.title.includes("confidential"),
  ),
);
const notifications = moduleFrom("src/lib/khpos/notifications.ts", () => ({}));
assert.deepEqual(
  notifications
    .pushEligibleAlerts(alerts, Date.parse("2026-10-16T11:00:00Z"))
    .map((a) => a.id),
  [
    "report:overdue:draft:v1",
    "report:soon:draft:v2",
    "report:returned:returned:v3",
    "report:review:submitted:v4",
  ],
);
console.log(
  "Report alerts: due-soon, overdue, returned and review routing; generic push content; completed and non-owner suppression passed.",
);
