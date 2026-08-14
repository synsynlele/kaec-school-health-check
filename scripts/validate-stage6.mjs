import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260814191826_stage6_reassessment_improvement_intelligence.sql",
  "utf8",
);
const improvement = readFileSync("src/lib/khpos/improvement.ts", "utf8");
const route = readFileSync("src/app/api/khpos/improvement/[id]/route.ts", "utf8");
const workspace = readFileSync(
  "src/components/khpos/ImprovementIntelligenceWorkspace.tsx",
  "utf8",
);
const reportActions = readFileSync("src/components/report/ActionsBar.tsx", "utf8");

assert.match(migration, /assessment_kind text not null default 'baseline'/);
assert.match(migration, /assessment_kind='reassessment'/);
assert.match(migration, /khpos_start_reassessment_server/);
assert.match(migration, /khpos_private\.analyze_reassessment/);
assert.match(migration, /khpos_indicator_changes/);
assert.match(migration, /khpos_area_changes/);
assert.match(migration, /khpos_system_changes/);
assert.match(migration, /khpos_priority_reassessment_outcomes/);
assert.match(migration, /v_delta_baseline >= 5 and v_improved > v_regressed/);
assert.match(migration, /cur\.score >= 4 and cur\.score > src\.score then 'resolved'/);
assert.match(migration, /when 'regressed' then 'under_review'/);
assert.match(migration, /when oi\.status='completed' then 'active'/);
assert.match(migration, /grant execute on function public\.khpos_start_reassessment_server\(uuid,uuid\) to service_role/);
assert.doesNotMatch(migration, /grant execute on function public\.khpos_start_reassessment_server\(uuid,uuid\) to authenticated/);

const secondaryStart = migration.indexOf("with secondary(indicator_id,system_id) as (");
const secondaryEnd = migration.indexOf(")\ninsert into public.khpos_indicator_system_mappings", secondaryStart);
assert.ok(secondaryStart >= 0 && secondaryEnd > secondaryStart, "Secondary system mapping seed must exist.");
const secondarySection = migration.slice(secondaryStart, secondaryEnd);
const secondaryMappings = secondarySection.match(/\('[a-z0-9_]+','[a-z_]+'\)/g) ?? [];
assert.equal(secondaryMappings.length, 55, "Stage 6 must preserve all 55 secondary system mappings.");
assert.match(secondarySection, /'value_creation_application'/);
assert.match(migration, /'identity_direction'/);
assert.match(migration, /'intelligence_continuous_improvement'/);

assert.match(improvement, /getKhposWorkspaceSnapshot/);
assert.match(improvement, /khpos_start_reassessment_server/);
assert.match(improvement, /assessment_kind/);
assert.match(improvement, /khpos_indicator_changes/);
assert.match(improvement, /khpos_area_changes/);
assert.match(improvement, /khpos_system_changes/);
assert.match(improvement, /khpos_priority_reassessment_outcomes/);

assert.match(route, /bearerTokenFromRequest/);
assert.match(route, /verifyKhposAccessToken/);
assert.match(route, /start_reassessment/);

assert.match(workspace, /kaec_assessment_id/);
assert.match(workspace, /window\.location\.assign\("\/assessment"\)/);
assert.match(workspace, /55 KSHC indicators/);
assert.match(workspace, /Seven institutional systems/);
assert.match(workspace, /Implementation is not improvement/);
assert.doesNotMatch(workspace, /type="number"/);
assert.doesNotMatch(workspace, /manual score/i);

assert.match(reportActions, /khpos_return_to/);
assert.match(reportActions, /Return to Improvement Intelligence/);

console.log("KHP-OS Stage 6 reassessment & improvement validation passed.");