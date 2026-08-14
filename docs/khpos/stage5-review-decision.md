# KHP-OS Stage 5 — Review & Decision Automation

Stage 5 turns prepared implementation evidence into an institutional decision without asking school leaders to write another review report.

## Operating flow

`Implementation record → Evidence readiness → Review snapshot → Plan vs Actual → Progress → Gaps → Lessons → Deterministic recommendation → Human decision → Next lifecycle state`

## What KHP-OS does automatically

- detects reviews that are due by date or ready because evidence coverage has reached the review threshold;
- snapshots action, milestone and evidence state;
- prepares Plan vs Actual, progress, evidence gaps and institutional lessons;
- generates one deterministic recommendation from governed rules;
- optionally uses AI to improve the narrative explanation without allowing AI to change the recommendation;
- applies the approved decision transactionally to the intervention, implementation plan, priority and next cycle;
- writes the decision and lifecycle change into the audit trail.

## Human authority

Only an Organisation Executive or Transformation Lead can approve a review decision. The six decisions are:

- Continue
- Adjust
- Escalate
- Complete
- Pause
- Stop

If a human overrides the KHP-OS recommendation, a short reason is mandatory. Pause and Stop also require a reason. This preserves human authority without allowing unexplained state changes.

## Epistemic boundary

Evidence of implementation is not the same as verified institutional improvement. A fully evidenced implementation cycle can be completed, but the linked KSHC weakness is not automatically resolved. `Complete` therefore sets the next step to `reassessment_required` and keeps the priority active until Stage 6 compares a new assessment with the baseline.

AI can improve wording for Plan vs Actual, Progress and Lessons. The database recommendation is rule-generated before AI runs, and AI is explicitly prohibited from changing it or inventing evidence, observations, causality or improvement.

## Decision effects

- Midpoint Continue: keep current cycle active.
- Midpoint Adjust: keep current cycle active with a corrective operating directive.
- Outcome Continue: supersede the reviewed plan and automatically generate the next plan version with `cycle_mode=continued`.
- Outcome Adjust: supersede the reviewed plan and automatically generate the next plan version with `cycle_mode=adjusted`.
- Escalate: close routine execution and return the priority to executive review.
- Pause: preserve the unresolved priority while pausing the implementation cycle.
- Stop: abandon the intervention and return the unresolved priority for re-prioritisation.
- Complete: close implementation and require reassessment; do not resolve the priority automatically.

## Security

The transformation review table is server-mediated. Direct `anon` and `authenticated` table access is revoked. Review-preparation and review-decision RPCs are executable only by `service_role`; the application authenticates the user and the database independently verifies organisation membership and decision authority.

## Verification

Migration `20260814184820_stage5_review_decision_automation` was applied to the connected Supabase project.

A rollback-only integration test proved:

1. a fully evidenced outcome review recommends Complete;
2. Complete closes the implementation plan/intervention while keeping the priority active and setting `reassessment_required`;
3. a 50% evidenced outcome review recommends Continue;
4. Pause without a required reason is rejected;
5. Outcome Continue supersedes plan version 1 and automatically generates plan version 2 with `cycle_mode=continued`;
6. all test data is rolled back.

No cron job or manual review-report workflow is required. Stage 6 is Reassessment & Improvement Intelligence.
