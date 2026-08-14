import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260814184820_stage5_review_decision_automation.sql", import.meta.url),
  "utf8",
);
const review = readFileSync(
  new URL("../src/lib/khpos/review.ts", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../src/app/api/khpos/reviews/[id]/route.ts", import.meta.url),
  "utf8",
);
const ui = readFileSync(
  new URL("../src/components/khpos/ReviewDecisionWorkspace.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/app/khpos/[organisationId]/reviews/page.tsx", import.meta.url),
  "utf8",
);
const evidencePage = readFileSync(
  new URL("../src/app/khpos/[organisationId]/evidence/page.tsx", import.meta.url),
  "utf8",
);

assert.match(migration, /create table if not exists public\.khpos_transformation_reviews/);
assert.match(migration, /'paused'/);
assert.match(migration, /cycle_mode/);
assert.match(migration, /khpos_private\.prepare_review_snapshot/);
assert.match(migration, /khpos_prepare_reviews_server/);
assert.match(migration, /khpos_apply_review_decision_server/);
assert.match(migration, /v_role not in \('executive','transformation_lead'\)/);
assert.match(migration, /overriding the KHP-OS recommendation/);
assert.match(migration, /evidence_coverage_percent <> 100/);
assert.match(migration, /reassessment_required/);
assert.match(migration, /set status='active', updated_at=now\(\)\s+where id=v_intervention\.priority_id/);
assert.match(migration, /cycle_mode=case when p_decision='adjust' then 'adjusted' else 'continued' end/);
assert.match(migration, /generate_implementation_plan\(v_intervention\.id\)/);
assert.match(migration, /service_role/);

assert.match(review, /openai\.responses\.create/);
assert.match(review, /The system recommendation is already fixed by rules/);
assert.match(review, /Evidence of implementation is not the same as verified institutional improvement/);
assert.match(review, /khpos_prepare_reviews_server/);
assert.match(review, /khpos_apply_review_decision_server/);
assert.doesNotMatch(review, /recommended_decision:\s*narrative/i);

assert.match(route, /action\?: "decide"/);
assert.match(route, /verifyKhposAccessToken/);
assert.match(route, /applyKhposReviewDecision/);

assert.match(ui, /Approve the decision—not the review report/);
assert.match(ui, /Complete closes the implementation cycle only/);
assert.match(ui, /Executive or Transformation Lead/);
assert.match(ui, /recommended/);
assert.match(page, /ReviewDecisionWorkspace/);
assert.match(evidencePage, /\/reviews/);
assert.match(evidencePage, /Open Review & Decision/);

console.log(
  "KHP-OS Stage 5 structural validation passed: automatic review preparation, deterministic recommendations, governed human decisions and reassessment-safe completion are present.",
);
