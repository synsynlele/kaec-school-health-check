import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      `KHP-OS effectiveness contract failed: ${context} is missing ${expected}`,
    );
  }
}

const performance = read("src/lib/khpos/ops/performance.ts");
for (const expected of [
  "derivedPerformance",
  "executionCoverage",
  "workCompletionReliability",
  "verificationFirstPass",
  "decisionActionClosure",
  "khpos_ops_work_records",
]) {
  requireText(performance, expected, "evidence-derived performance");
}

const calendar = read("src/lib/khpos/ops/calendar.ts");
for (const expected of [
  "khpos_ops_work_items",
  "khpos_ops_recurring_rules",
  "khpos_ops_events",
  "khpos_ops_policy_versions",
  "getKhposOpsDecisions",
  "institutionView",
]) {
  requireText(calendar, expected, "institutional calendar");
}

const briefing = read("src/lib/khpos/ops/briefing.ts");
for (const expected of [
  "getKhposAttention",
  "getKhposCalendar",
  "getKhposOpsPerformance",
  "meetingQuestions",
  "recordsSubmitted",
]) {
  requireText(briefing, expected, "leadership brief");
}

const notifications = read("src/lib/khpos/notifications.ts");
for (const expected of [
  "getKhposAttention",
  'level: "urgent" | "action" | "watch"',
  "verification",
  "pushEligibleAlerts",
]) {
  requireText(notifications, expected, "exception notifications");
}

const decisionMigration = read(
  "supabase/migrations/20261005133548_khpos_effectiveness_wave2_outcome_closure.sql",
);
for (const expected of [
  "outcome_status",
  "ops_require_decision_outcome_before_close",
  "khpos_ops_close_decision_outcome_server",
  "implementation work must be independently verified",
  "outcome_verified",
]) {
  requireText(decisionMigration, expected, "decision outcome closure");
}

const verificationMigration = read(
  "supabase/migrations/20261005133539_khpos_effectiveness_wave2_decision_verification.sql",
);
for (const expected of [
  "verification_required := true",
  "evidence_required := true",
  "source_decision_id",
]) {
  requireText(verificationMigration, expected, "decision verification gate");
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
for (const expected of [
  'suffix: "/leadership-brief"',
  'suffix: "/calendar"',
  'label: "Leadership Brief"',
  'label: "Institutional Calendar"',
]) {
  requireText(nav, expected, "workspace navigation");
}

console.log(
  "KHP-OS effectiveness Wave 2 validated: derived performance, verified decision outcomes, institutional calendar, leadership brief and exception notifications are present.",
);
