import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, expected, context) {
  if (!source.includes(expected)) {
    throw new Error(
      `KHP-OS Wave 3 contract failed: ${context} is missing ${expected}`,
    );
  }
}

const ask = read("src/lib/khpos/ops/ask.ts");
for (const expected of [
  'getKhposOpsLibrary',
  'getKhposOpsMyWork',
  'getKhposOpsIssues',
  'getKhposOpsDecisions',
  'getKhposAttention',
  'gpt-6-luna',
  'DAILY_LIMIT = 30',
  'ops_ask_khpos',
  'Answer only from the supplied KHP-OS governed context',
]) {
  requireText(ask, expected, "Ask KHP-OS grounding and cost control");
}

const integrity = read("src/lib/khpos/ops/integrity.ts");
for (const expected of [
  'Approved processes without explicit execution mapping',
  'Active recurring work has no active role holder',
  'Verification has been waiting for more than 48 hours',
  'Approved decisions requiring action have no implementation work',
  'Pattern intelligence',
]) {
  requireText(integrity, expected, "System Integrity");
}

const onboarding = read("src/lib/khpos/ops/onboarding.ts");
for (const expected of [
  'reportsTo',
  'requiredPolicies',
  'khpos_ops_process_roles',
  'Use Today as your daily starting point',
  'Run the safe practice workflow',
]) {
  requireText(onboarding, expected, "role-derived onboarding");
}

const processDocument = read("src/components/khpos/ops/ProcessDocument.tsx");
for (const expected of [
  'Connected operating system',
  'currentWorkCount',
  'controlledRecordCount',
  'Required tools / records',
  '/execution-control',
]) {
  requireText(processDocument, expected, "Institutional Library 2.0 process connections");
}

const libraryMigration = read(
  "supabase/migrations/20261005150000_khpos_effectiveness_wave3_library_connections.sql",
);
for (const expected of [
  'khpos_ops_get_process_connections_server',
  'khpos_ops_process_execution_profiles',
  'khpos_ops_process_tool_requirements',
  'khpos_ops_work_records',
  'to service_role',
]) {
  requireText(libraryMigration, expected, "Library connection database contract");
}

const nav = read("src/components/khpos/SchoolWorkspaceNav.tsx");
for (const expected of [
  'label: "Ask KHP-OS"',
  'label: "System Integrity"',
  'label: "My Operating Guide"',
]) {
  requireText(nav, expected, "workspace navigation");
}

console.log(
  "KHP-OS effectiveness Wave 3 validated: governed Ask, integrity intelligence, role onboarding and connected process library are present.",
);
