# KHP-OS Stage 1B — Organisation & Claim Foundation

Stage 1B converts KSHC from a one-off diagnostic data model into a safe front door for a persistent KHP-OS institution without adding login friction to the assessment itself.

## Production database findings

The connected `kaec-school-health-check` Supabase project contained live KSHC data and an older schema than the GitHub application expected. Before Stage 1B there were 8 school snapshots, 8 assessments, 334 answers and 5 completed reports. All exposed public tables had RLS disabled and broad `anon` / `authenticated` privileges.

## Applied production migrations

1. `20260814163517_stage1b_lock_legacy_kshc_tables`
   - enabled RLS on existing KSHC public tables;
   - removed direct `anon` and `authenticated` table access;
   - preserved service-role/server operation.
2. `20260814163606_stage1b_organisation_claim_foundation`
   - added canonical `organisations`, `organisation_memberships` and `khpos_audit_events`;
   - added organisation/version/status fields to assessments;
   - added report generation/version metadata;
   - backfilled existing completed reports;
   - added an atomic authenticated claim RPC.
3. `20260814163708_stage1b_minimise_authenticated_api_surface`
   - removed broad signed-in table access;
   - retained only the authenticated claim operation.
4. `20260814163723_stage1b_remove_unused_public_helpers`
   - removed temporary direct-client RLS helpers/policies so Stage 1B remains server-mediated.
5. `20260814165802_stage1b_sync_assessment_completion_state`
   - keeps the new canonical assessment status aligned with the legacy KSHC `completed_at` write;
   - avoids rewriting the working KSHC storage layer purely for state compatibility.

## Claim security rule

A completed KSHC assessment can be activated into KHP-OS only when:

- the caller is authenticated;
- a completed report exists;
- the authenticated email exactly matches the email used for the KSHC assessment.

The database locks the assessment row, creates or reuses the organisation, creates the executive membership, links the assessment, and records an audit event atomically.

## Product boundary

KSHC remains login-free. Authentication begins only when the school chooses to activate KHP-OS after receiving diagnostic value.

## Vercel quota policy

Do not deploy every commit. GitHub CI is the normal validation layer for tests, lint, typecheck and build. Create a Vercel deployment only at a validated stage checkpoint or when browser-level verification is required.
