# KHP-OS Stage 10 — Platform Governance & Production Readiness

## Purpose

Stage 10 closes the KHP-OS Schools development roadmap by hardening platform-level administration without turning platform administrators into school executives.

## Governance model

Platform roles are explicit and independent of organisation memberships:

- `super_admin` — portfolio oversight plus MFA-gated platform-access governance.
- `portfolio_admin` — cross-institution portfolio monitoring.
- `support_reviewer` — cross-institution support/review monitoring.

A platform role never grants authority to approve a school's priorities, interventions, review decisions or reassessments.

## Admin Console

Canonical entry: `/khpos/admin`.

The console provides:

- active institution and baseline/reassessment coverage;
- Verified Institutional Improvement count;
- priority, review, evidence and reassessment operating queues;
- KSI/PipuPath integration attention;
- named private Portfolio Intelligence;
- platform-admin roster and MFA readiness;
- platform governance audit history.

The named portfolio remains private. Public school rankings remain disabled.

## Authentication and MFA

Normal admin monitoring requires:

1. a server-verified Supabase Auth session; and
2. an active row in `khpos_platform_admins`.

Platform access changes additionally require:

1. active `super_admin` authority in PostgreSQL; and
2. an AAL2 MFA-backed session enforced by the application API.

The Admin Console supports TOTP enrollment and verification through Supabase Auth MFA.

## Bootstrap Super Admin

The existing Google-authenticated KAEC-NG account `synsynlele@gmail.com` was operationally activated as the first `super_admin` after its existing Auth identity was verified. This is operational access data, not a hardcoded application bypass.

The bootstrap is recorded in `khpos_platform_audit_events`.

## Platform access invariants

- Non-admin identities cannot load the Admin Console.
- Suspended platform administrators lose access immediately.
- A governance reason of at least 12 characters is required for access changes.
- A Super Admin cannot suspend their own active session.
- KHP-OS must retain at least one active Super Admin.
- Platform governance events are written to a dedicated append-oriented audit trail.

## Security hardening

All `/khpos/*` and `/api/khpos/*` routes receive:

- `Cache-Control: private, no-store`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`

Stage 10 does not add a brittle Content Security Policy without nonce support because doing so could break Next.js runtime/hydration.

The Stage 10 tables remain RLS-enabled and direct browser privileges are revoked. Platform RPCs are service-role-only.

## Production operating boundary

KHP-OS remains an institutional transformation system, not an ERP/SIS. Platform Administration monitors the transformation portfolio; it does not introduce fees, payroll, attendance, timetabling, generic messaging, learner surveillance or teacher ranking.

## Release verification

Before Stage 10 is considered passed:

- Stage 0–10 structural/scoring regression suite must pass.
- React lint must pass.
- strict TypeScript must pass.
- production build must pass.
- database governance rollback assertions must pass.
- security/performance advisors must be reviewed.
- the exact Stage 10 Vercel preview must be successful.
- protected Admin Console/API routes must be reachable on the matching preview.
- runtime error logs must show no Stage 10 regression.

No Stage 10 PR is merged without explicit approval.
