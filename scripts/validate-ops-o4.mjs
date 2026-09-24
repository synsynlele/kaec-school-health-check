import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(`Operations O4 contract failed: ${context} is missing ${expected}`);
  }
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
requireText(nav, 'suffix: "/issues"', "school workspace navigation");
requireText(nav, 'label: "Issues & Escalations"', "school workspace navigation");

const page = read("src/app/khpos/[organisationId]/issues/page.tsx");
requireText(page, "IssuesWorkspace", "Issues route");
requireText(page, "UUID_RE", "Issues route validation");

const api = read("src/app/api/khpos/ops/issues/[id]/route.ts");
for (const expected of [
  "verifyKhposAccessToken",
  "getKhposOpsIssues",
  "createKhposOpsIssue",
  "actOnKhposOpsIssue",
  '"Cache-Control": "private, no-store"',
]) {
  requireText(api, expected, "O4 Issues API");
}

const service = read("src/lib/khpos/ops/issues.ts");
for (const expected of [
  "khpos_ops_get_issues_server",
  "khpos_ops_create_issue_server",
  "khpos_ops_issue_action_server",
  "SUPABASE_SERVICE_ROLE_KEY",
  '"claim"',
  '"verify"',
  '"escalate"',
]) {
  requireText(service, expected, "O4 issue service");
}

const workspace = read("src/components/khpos/ops/IssuesWorkspace.tsx");
for (const expected of [
  "Operations · O4",
  "Issues & Escalations",
  "A deviation does not disappear into WhatsApp or memory.",
  "Report issue",
  "Case history",
  "Do not place confidential safeguarding disclosure details in the standard issue queue.",
]) {
  requireText(workspace, expected, "O4 issue workspace");
}

const migration = read(
  "supabase/migrations/20260924130000_khpos_ops_o4_issue_engine.sql",
).toLowerCase();

for (const expected of [
  "create table if not exists public.khpos_ops_issues",
  "create table if not exists public.khpos_ops_issue_events",
  "create table if not exists public.khpos_ops_issue_escalations",
  "khpos_private.ops_ensure_work_issue",
  "khpos_ops_create_issue_server",
  "khpos_ops_get_issues_server",
  "khpos_ops_issue_action_server",
  "issue_type in ('manual','work_blocker','checklist_exception','system_exception')",
  "status in ('open','assigned','in_action','awaiting','resolved','verified','closed')",
  "severity in ('p1','p2','p3','p4')",
  "sensitivity='standard'",
  "the issue owner cannot verify their own resolution",
  "p1 critical issue requires immediate leadership visibility",
  "work_blocker",
  "checklist_exception",
  "from public,anon,authenticated",
  "to service_role",
]) {
  requireText(migration, expected, "O4 migration");
}

const seed = read("supabase/seeds/khpos_ops_o4_issues.sql");
for (const expected of [
  "GOV-003",
  "Escalation Management",
  "P1 critical issues receive immediate leadership visibility",
  "Escalation transfers visibility and authority support, not automatic ownership",
  "ops_o4_issue_engine_bootstrapped",
]) {
  requireText(seed, expected, "KNS O4 escalation seed");
}

const o3Migration = read(
  "supabase/migrations/20260924125010_khpos_ops_o3_work_execution.sql",
);
if (
  o3Migration.includes("khpos_ops_issues") ||
  o3Migration.includes("khpos_ops_issue_events")
) {
  throw new Error(
    "Operations O4 contract failed: O3 migration must remain historically unchanged and independent from O4 issue tables.",
  );
}

console.log("KHP-OS Operations O4 issue-engine contracts validated.");
