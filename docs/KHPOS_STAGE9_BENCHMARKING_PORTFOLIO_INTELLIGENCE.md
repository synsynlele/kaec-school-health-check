# KHP-OS Stage 9 — Benchmarking & Portfolio Intelligence

## Purpose

Stage 9 adds cross-institution intelligence without turning KHP-OS into a ranking platform.

The stage answers two different questions:

1. **For a school:** How does our current institutional position compare with a privacy-safe peer band?
2. **For KAEC-NG platform custodians:** Where across the institutional portfolio does transformation support need attention?

## School-facing benchmark contract

KHP-OS never exposes another school name, exact peer score, exact rank, minimum or maximum score.

A benchmark appears only when at least **five other institutions** qualify. Matching prefers:

1. same country + school level;
2. same country;
3. all eligible KHP-OS schools.

If none of those scopes contains five other institutions, peer statistics are withheld.

When eligible, schools receive only:

- their own latest completed KSHC overall score;
- peer 25th percentile;
- peer median;
- peer 75th percentile;
- a qualitative position: above / within / below the peer middle band;
- the same anonymised band across all seven KHP-OS systems;
- improvement benchmarking only when at least five peer institutions also have completed reassessments.

There is no public percentile rank and no league table.

## Benchmark source truth

Only the latest completed assessment for each active institution contributes. Peer assessments must use the same KSHC framework, framework version and scoring version as the target institution.

Seven-system scores are calculated from the frozen Stage 6 indicator-to-system mapping, using latest valid answers for the selected assessment.

Benchmark context is informational. It cannot mutate:

- priorities;
- interventions;
- review decisions;
- reassessment outcomes;
- Verified Institutional Improvement.

Fresh KSHC reassessment remains the only authority for verified improvement and priority resolution.

## KAEC-NG Portfolio Intelligence

Cross-institution named oversight is separated from school-facing benchmarking.

A user must exist in the server-owned `khpos_platform_admins` table with `status='active'`. Ordinary school membership never grants portfolio access.

The internal portfolio view may identify institutions because KAEC-NG needs to know where support is required. It shows:

- active institution count;
- baseline/reassessment coverage;
- verified-improvement count;
- active and critical priority counts;
- seven-system portfolio bands;
- current institutional overall score;
- latest improvement classification;
- priority burden;
- an attention state such as baseline required, regression, critical priorities, reassessment required, or monitor.

It excludes learner-level data, teacher rankings, raw evidence, uploaded files and private narrative content.

## Security

- `khpos_platform_admins` has RLS enabled.
- Browser roles have no table privileges.
- Benchmark and portfolio RPCs are service-role only.
- The school benchmark function independently verifies active organisation membership.
- The portfolio function independently verifies explicit platform-admin status.
- All privileged functions use a fixed empty search path.

Current Supabase guidance notes that database functions are executable by `PUBLIC` by default unless explicitly revoked; Stage 9 therefore revokes `PUBLIC`, `anon` and `authenticated` execution and grants only `service_role` to the two public RPCs.

## Live database verification

Migration:

`20260814213427_stage9_benchmarking_portfolio_intelligence.sql`

A rollback-only six-institution test proved:

- one target + five peers unlocks school benchmarking;
- exactly seven KHP-OS system benchmark rows are returned;
- five reassessed peers unlock improvement benchmarking;
- no named peer leaks into the school-facing JSON;
- explicit platform-admin access unlocks the named portfolio view;
- portfolio output declares learner data excluded and public ranking disabled;
- removing one peer drops the cohort to four and suppresses school benchmarking;
- all synthetic institutions and temporary platform-admin access roll back to zero.

Function privileges were independently checked:

- `anon`: no execute;
- `authenticated`: no execute;
- `service_role`: execute.

## Product boundary

Stage 9 is **peer context and portfolio stewardship**, not competition.

**KHP-OS Stage 9 = anonymised benchmark bands + privileged portfolio oversight, with no public ranking.**
