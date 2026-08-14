import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260814182306_stage4_evidence_verification_automation.sql", import.meta.url),
  "utf8",
);
const evidence = readFileSync(
  new URL("../src/lib/khpos/evidence.ts", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../src/app/api/khpos/evidence/[id]/route.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../src/components/khpos/EvidenceVerificationWorkspace.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/app/khpos/[organisationId]/evidence/page.tsx", import.meta.url),
  "utf8",
);
const implementationPage = readFileSync(
  new URL("../src/app/khpos/[organisationId]/implementation/page.tsx", import.meta.url),
  "utf8",
);

for (const table of [
  "khpos_evidence_submissions",
  "khpos_evidence_assessments",
  "khpos_evidence_links",
  "khpos_review_preparations",
]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
}
assert.match(migration, /'khpos-evidence'/);
assert.match(migration, /8388608/);
assert.match(migration, /khpos_private\.refresh_evidence_progress/);
assert.match(migration, /khpos_record_evidence_assessment_server/);
assert.match(migration, /match_confidence >= 70/);
assert.match(migration, /sufficiency_score >= 80/);
assert.match(migration, /service_role/);

assert.match(evidence, /createSignedUploadUrl/);
assert.match(evidence, /openai\.responses\.create/);
assert.match(evidence, /input_image/);
assert.match(evidence, /input_file/);
assert.match(evidence, /conservativeFallback/);
assert.match(evidence, /confidence: Math\.min\(60/);
assert.match(evidence, /sufficiencyScore: Math\.min\(65/);
assert.match(evidence, /khpos_record_evidence_assessment_server/);
assert.match(evidence, /createSignedUrl\(submission\.storage_path, 300\)/);
assert.match(evidence, /Never claim the file is unquestionably authentic/);
assert.match(evidence, /Strong evidence should demonstrate implementation or an outcome/);

assert.match(route, /bearerTokenFromRequest/);
assert.match(route, /verifyKhposAccessToken/);
assert.match(route, /action\?: "prepare_upload" \| "assess"/);
assert.doesNotMatch(route, /request\.formData/);
assert.doesNotMatch(route, /arrayBuffer\(\)/);

assert.match(ui, /uploadToSignedUrl/);
assert.match(ui, /No category selection required/);
assert.match(ui, /maximum 8 MB/);
assert.match(ui, /System-assessed sufficiency is not a claim/);
assert.doesNotMatch(ui, /requirementId.*select/i);
assert.match(page, /EvidenceVerificationWorkspace/);
assert.match(implementationPage, /Evidence & Verification/);

console.log(
  "KHP-OS Stage 4 structural validation passed: private direct uploads, automated evidence matching, conservative sufficiency and review preparation are present.",
);
