import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      `KHP-OS effectiveness Wave 3 contract failed: ${context} is missing ${expected}`,
    );
  }
}

const assistant = read("src/lib/khpos/ops/assistant.ts");
for (const expected of [
  "Ask KHP-OS",
  "getKhposOpsLibrary",
  "getKhposAttention",
  "getKhposOpsMyWork",
  "getKhposOpsDecisions",
  "getKhposOpsPerformance",
  "getKhposCalendar",
  "restricted safeguarding case material",
  "grounded_engine",
  "questionHash",
]) {
  requireText(assistant, expected, "grounded Ask KHP-OS");
}

const library = read("src/lib/khpos/ops/library.ts");
for (const expected of [
  "KhposOpsProcessOperatingMap",
  "execution",
  "controlledRecords",
  "currentWork",
  "awaitingVerification",
  "completedLast30Days",
  "recordsLast30Days",
]) {
  requireText(library, expected, "Institutional Library 2.0");
}

const processDocument = read("src/components/khpos/ops/ProcessDocument.tsx");
for (const expected of [
  "Operating map",
  "Execution control",
  "Participating roles",
  "Controlled reports & logs",
  "Records & Evidence",
]) {
  requireText(processDocument, expected, "process operating map");
}

const onboarding = read("src/lib/khpos/ops/onboarding.ts");
for (const expected of [
  "KHPOS_PRACTICE_STEPS",
  "getKhposMyOnboarding",
  "saveKhposPractice",
  "submitMyOnboardingItem",
  "requiredPolicies",
  "relevantProcesses",
]) {
  requireText(onboarding, expected, "My Onboarding");
}

const practiceMigration = read(
  "supabase/migrations/20261005140048_khpos_effectiveness_wave3_practice.sql",
);
for (const expected of [
  "khpos_ops_practice_runs",
  "KHPOS_CORE_V1",
  "find_process",
  "start_work",
  "complete_checklist",
  "attach_evidence",
  "handle_return",
  "system://khpos/practice/KHPOS_CORE_V1",
  "PEO-ONB-007",
  "ops_refresh_staff_readiness",
]) {
  requireText(practiceMigration, expected, "safe onboarding practice");
}
if (
  practiceMigration.includes("insert into public.khpos_ops_work_items") ||
  practiceMigration.includes("insert into public.khpos_ops_evidence")
) {
  throw new Error(
    "KHP-OS effectiveness Wave 3 contract failed: practice simulation must not create production work or evidence.",
  );
}

const integrity = read("src/lib/khpos/ops/integrity.ts");
for (const expected of [
  "System Integrity is restricted to whole-school institutional leadership",
  "assignment_without_membership",
  "active_staff_without_role",
  "p0_unmapped",
  "configured_owner_unassigned",
  "trigger_failures",
  "verification_stale",
  "policy_review_overdue",
  "outcome_stale",
  "duplicate_assignment",
]) {
  requireText(integrity, expected, "System Integrity");
}

const join = read("src/components/khpos/ops/StaffJoinWorkspace.tsx");
requireText(
  join,
  "result.organisationId}/onboarding",
  "staff join onboarding destination",
);

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
for (const expected of [
  'suffix: "/ask"',
  'label: "Ask KHP-OS"',
  'suffix: "/onboarding"',
  'label: "My Onboarding"',
  'suffix: "/system-integrity"',
  'label: "System Integrity"',
]) {
  requireText(nav, expected, "Wave 3 navigation");
}

console.log(
  "KHP-OS effectiveness Wave 3 validated: grounded Ask KHP-OS, Library 2.0, guided onboarding and System Integrity are present with controlled authority boundaries.",
);
