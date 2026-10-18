# KAEC HQ — Seven-area corporate operating centre

## Goal and boundaries

KAEC HQ operates KAEC-NG Ltd, not a school. It is a separate role-gated corporate workspace inside the existing Next.js project, reusing the verified Supabase account and service-layer patterns. School membership, School Custodian, KNS data and platform-support roles **never** imply corporate access.

The seven visible areas are:
1. Governance & Playbooks — constitutions, policies, procedures, decisions, approval authority
2. People & Roles — corporate appointments, responsibilities, absence, handover, succession
3. Work & Execution — daily work, recurring obligations, reports, approvals and meeting actions
4. Partnerships — prospects, agreements, school onboarding, supervision and renewals
5. Products & Projects — product roadmaps, projects, milestones, incidents and releases
6. Finance — budgets, invoices, obligations, income and expense approval evidence
7. Command Centre — live attention summaries derived only from authorised corporate records

The first implementation provides an accountable, auditable corporate record workflow across all areas. It is **not yet** a complete finance/accounting service, document editor, recurring-task scheduler, school portfolio sync, product-release automation or operational KPI service. Those capabilities require separately verified follow-through; they must not be represented as operational before acceptance.

## Security

- Data model uses independent kaec_hq_members / kaec_hq_records / kaec_hq_audit_events tables.
- RLS enabled; direct anon/authenticated Data API privileges revoked. Data access runs through a bearer-verified, role-checked server API with a private service role.
- Only explicitly appointed HQ members may enter. KHP-OS school roles cannot grant corporate access.
- Initial Vision Custodian provisioning is one-time and requires: verified signed-in account; AAL2 MFA; a server-configured KAEC_HQ_BOOTSTRAP_EMAIL matching the verified account; and an empty HQ membership register.
- Further member appointments require Vision Custodian and MFA. Additional Vision Custodian appointments are blocked pending board governance.
- Finance edits and critical approvals require MFA. Completion requires a different authorised verifier from the author and owner. No silent edit of completed work.
- Changes are audited in a database-triggered append-only event log. Never expose secrets or entire school records in corporate notes.

## Activation and release procedure

1. Review this PR and the additive SQL migration; run CI typecheck/lint/build.
2. Apply the reviewed migration to the existing KHP-OS Supabase project. It does not alter existing school records.
3. Verify tables, grants, RLS and audit trigger, and run Supabase security advisor.
4. KAEC_HQ_BOOTSTRAP_EMAIL is configured as a server-only encrypted Vercel variable for the designated Vision Custodian. Do not add it to NEXT_PUBLIC variables. Corporate appointment is independent of school access and the KHP-OS Platform Admin role.
5. In a staged environment verify signed-out, school-only, platform-only, HQ member and HQ founder role journeys.
6. The designated founder signs in and completes MFA; use "Activate if designated" once. Appoint other corporate members only after their email identity is verified.
7. Test records across all six data modules, the derived Command Centre, assignment and backup checks, independent completion review, member suspension, cross-role access denial, finance MFA, and audit append.
8. Only after acceptance, merge to production; inspect the Vercel READY production deployment. No new Android submission is normally needed for website-only work, but verify the wrapper's routing and Play policy declarations.


## Operational workflow release — October 18, 2026

**Record lifecycle:** Draft → Active → Submit for verification → Independently approved (Completed) or Returned (Active). Evidence notes (minimum 15 characters) and reviewer reasons (minimum 12 characters) are part of the record and its append-only database audit history. Submitted and completed records cannot be casually edited. Return-to-active is a deliberate reviewer action, not a status-dropdown shortcut.

**Owner-attested routine work:** An accountable owner can directly log completion, with written evidence, for non-critical Work tasks, meeting actions and recurring obligations only. These are visibly labelled owner-attested, not independently approved. Finance, governance, reports, partnerships, product releases and critical work continue to require a different authorised reviewer, with MFA for financial and critical decisions. A solo founder can record ordinary task completion without making false claims of independent review.

**Work recurrence:** When a valid daily/weekly/monthly/quarterly/yearly Work occurrence is completed, a database trigger atomically creates exactly one new occurrence, keeping its owner, backup, due cadence and original schedule anchor. Month-end dates remain anchored to the original schedule date. The source remains in History, while the new occurrence starts Active. Inactive owners or missing critical backup turn the new occurrence into Draft for reassignment. Termly cadence is recorded but the next term date **must be manually planned**. Rollover is **completion-triggered**, not a cron job; uncompleted overdue cycles are not silently advanced. No notifications are sent.

**Templates and command:** Optional outlines guide work reports, school supervision, partner onboarding, product release, budgets and decisions. The Command Centre highlights upcoming dates and reviewable items from the existing role-filtered, **300-record** viewport. Counts must not be described as network-wide totals until exact server-level aggregation exists.

**Security:** The new corporate fields are only accessed through the existing HQ server API; previous RLS, table grants, independent membership checks and audit triggers remain. No data is shared across schools and HQ. No bank movements, payments, contract-signing, GitHub deployments or permission escalation occurs as a side effect of marking work complete.

**Acceptance / rollout:** Run foundation tests plus scripts/test-kaec-hq-workflows.mjs, lint, TypeScript and production build. Apply the additive 20261018113000 migration before releasing its code. Verify read-only access for unauthorised accounts; create and return an evidenced report using two role-appropriate accounts; attest an ordinary task; independently approve a financial record only with MFA; confirm audit entries and one next cycle after an approved recurring task; confirm no duplicate on repeated review. Use an approved test fixture (not real invoices or partner decisions) and clean up via the proper corporate lifecycle. Do not treat fixture-only tests as a production multi-user acceptance.

## Known limitations / next acceptance work

- Governance: document versioning, approval lineage and templated playbook execution beyond record descriptions.
- People: corporate role matrix, availability and takeover drills with independent sign-off.
- Execution: clock-based reminders, configurable term dates, attachments, scheduled escalations and exact activity counters. Completion-triggered work recurrence and editable outlines are now implemented.
- Partnerships: sync existing KHP-OS Partnership Registry read-only via separately authorised platform scope; contract lifecycle management.
- Products: release gate integration with GitHub/Vercel and incident tracking.
- Finance: invoice generation, collection ledger, bank/accounting reconciliation and approval thresholds.
- Command: complete portfolio KPIs and exception drill-down beyond the latest authorised 300 records. Current counts explicitly reflect only visible records.
- Paginate/filter server-side for >300 records; avoid interpreting capped results as complete totals.

## Acceptance gates

**Safety:** school-only account denied; inactive HQ member denied; finance hidden from unrelated roles; non-MFA finance change denied; completed records immutable; owner may not self-approve; no school data leakage.

**Functionality:** create, edit, submit, review and return for each applicable module; named owner and separate backup for critical work; real audit events; no empty-placeholder claims.

**Continuity:** School Guardian and KAEC Alliance Catalyst both see only their respective authorised environments, and a designated backup can see and assume authorised work as agreed.

**Reliability:** mobile layout, sign-in recovery, token expiry, 2nd-user concurrent edits and production logs reviewed. The first version cannot be certified as fully autonomous company operations until the seven known-limitations areas above are covered.
