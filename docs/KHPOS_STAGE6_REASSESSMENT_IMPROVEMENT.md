# KHP-OS Stage 6 — Reassessment & Improvement Intelligence

Stage 6 closes the first full institutional transformation loop by separating **implementation completion** from **verified institutional improvement**.

## Operating loop

`KSHC baseline → Priority → Intervention → Implementation → Evidence → Review → Reassessment → Improvement intelligence → Next state`

## Human / system boundary

KHP-OS creates and links the reassessment automatically. The school does not re-enter identity or organisation details and does not perform manual comparison work.

The human contribution is fresh institutional truth: the same 55 KSHC indicators are answered again. Everything after those responses is system-generated.

## Reassessment lineage

Every reassessment stores:
- the original KSHC baseline assessment;
- the immediately previous completed assessment;
- sequence number;
- framework/scoring versions;
- initiating authorised user;
- immutable comparison outputs.

The original baseline is never overwritten.

## Automatic comparison

When a linked reassessment reaches `completed`, PostgreSQL automatically calculates:
- 55 indicator changes;
- 11 KSHC area changes;
- all seven KHP-OS system changes;
- overall change from baseline;
- overall change from previous assessment;
- improved/stable/regressed indicator counts;
- priority-specific outcomes.

Seven-system scoring uses the frozen v1.0 indicator ontology with primary mappings weighted 1.0 and secondary mappings weighted 0.5. This ensures Value Creation & Application participates in system intelligence even though no KSHC v1 indicator uses it as its primary system.

## Verified improvement rule v1.0

Overall institutional improvement is not inferred from activity or implementation evidence.

`verified_improvement = delta_from_baseline >= 5 AND improved_indicator_count > regressed_indicator_count`

Classification:
- `strong_improvement`: baseline gain >= 10 and improving indicators materially outweigh regressions;
- `improved`: verified improvement rule passes;
- `regressed`: overall loss >= 5 or more indicators regress than improve;
- `stable`: minimal overall movement with balanced indicator movement;
- `mixed`: everything between those conditions.

Exact raw deltas remain visible regardless of classification.

## Priority resolution

For each active/approved/under-review priority, KHP-OS compares the reassessment score with the score on the assessment that created the priority.

- `resolved`: new score is 4–5 **and** higher than the source score;
- `improving`: score increased but has not reached resolution threshold;
- `unchanged`: no score movement;
- `regressed`: score declined.

Lifecycle effects:
- resolved → priority becomes `resolved` and intervention remains/completes;
- improving/unchanged after a completed intervention → priority remains active, intervention automatically returns to active and Stage 3 generates the next implementation cycle;
- regressed → priority moves to `under_review` and the intervention is escalated.

A completed intervention therefore cannot resolve its own diagnosis.

## Reassessment user flow

The Improvement Intelligence workspace calls the service-only reassessment RPC. Once authorised:
1. KHP-OS creates/resumes the organisation-linked reassessment;
2. the browser writes the returned UUID into the existing `kaec_assessment_id` autosave key;
3. the existing `/assessment` experience opens directly at the 55 indicators, skipping the school-details form;
4. the normal KSHC scoring/report engine runs unchanged;
5. the Stage 6 database trigger calculates improvement intelligence automatically;
6. the report action bar returns the user to KHP-OS Improvement Intelligence.

KSHC remains one diagnostic engine. Stage 6 does not duplicate scoring or questionnaire logic.

## Security

- reassessment mutation is server-mediated;
- `khpos_start_reassessment_server` is executable only by `service_role`;
- the RPC independently checks active organisation membership and requires `executive` or `transformation_lead` role;
- Stage 6 intelligence tables have RLS enabled and direct `anon` / `authenticated` privileges revoked;
- reads are mediated through the authenticated KHP-OS server API.

## Database verification

Migration: `20260814191826_stage6_reassessment_improvement_intelligence`

Rollback-only integration testing proved:
- 55 indicator comparisons are produced;
- 11 area comparisons are produced;
- 7 system comparisons are produced;
- a source indicator improving 2 → 4 resolves its priority;
- a source indicator improving 2 → 3 remains active;
- the unresolved but improving intervention automatically starts its next implementation plan;
- strong overall improvement is classified as verified improvement;
- all synthetic rows are rolled back.

Stage 6 completes the first measurable loop required by the KHP-OS North Star: **Verified Institutional Improvement**.
