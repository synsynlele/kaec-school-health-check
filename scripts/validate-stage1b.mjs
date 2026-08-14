import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationFiles = [
  "supabase/migrations/20260814163517_stage1b_lock_legacy_kshc_tables.sql",
  "supabase/migrations/20260814163606_stage1b_organisation_claim_foundation.sql",
  "supabase/migrations/20260814163708_stage1b_minimise_authenticated_api_surface.sql",
  "supabase/migrations/20260814163723_stage1b_remove_unused_public_helpers.sql",
  "supabase/migrations/20260814165802_stage1b_sync_assessment_completion_state.sql",
];
for (const file of migrationFiles) {
  assert.ok(existsSync(file), `${file} must be version-controlled`);
}

const hardening = readFileSync(migrationFiles[0], "utf8");
assert.match(hardening, /enable row level security/i);
assert.match(hardening, /revoke all privileges/i);

const foundation = readFileSync(migrationFiles[1], "utf8");
assert.match(foundation, /create table if not exists public\.organisations/i);
assert.match(foundation, /create table if not exists public\.organisation_memberships/i);
assert.match(foundation, /create table if not exists public\.khpos_audit_events/i);
assert.match(foundation, /create or replace function public\.claim_kshc_assessment/i);
assert.match(foundation, /signed-in email does not match/i);
assert.match(foundation, /assessment must have a completed report/i);
assert.match(foundation, /for update/i, "claim must lock the assessment row");

const minimised = readFileSync(migrationFiles[2], "utf8");
assert.match(minimised, /revoke all privileges on table public\.assessments from authenticated/i);
assert.match(minimised, /grant execute on function public\.claim_kshc_assessment/i);

const cleanup = readFileSync(migrationFiles[3], "utf8");
assert.match(cleanup, /drop function if exists public\.khpos_is_org_member/i);

const stateSync = readFileSync(migrationFiles[4], "utf8");
assert.match(stateSync, /trg_sync_kshc_assessment_status/i);
assert.match(stateSync, /new\.status := 'completed'/i);

const claimHelper = readFileSync("src/lib/khpos/claim.ts", "utf8");
assert.match(claimHelper, /claim_kshc_assessment/);
assert.match(claimHelper, /Authorization: `Bearer \$\{accessToken\}`/);

const claimRoute = readFileSync("src/app/api/khpos/claim/[id]/route.ts", "utf8");
assert.match(claimRoute, /authorization\.match/);
assert.match(claimRoute, /claimKshcAssessment/);

console.log("KHP-OS Stage 1B structural validation passed.");
