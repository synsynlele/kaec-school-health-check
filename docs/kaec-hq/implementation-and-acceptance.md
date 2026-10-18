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

## Known limitations / next acceptance work

- Governance: document versioning, approval lineage and templated playbook execution beyond record descriptions.
- People: corporate role matrix, availability and takeover drills with independent sign-off.
- Execution: recurring scheduler, reminders, reporting templates, evidence attachments and escalations.
- Partnerships: sync existing KHP-OS Partnership Registry read-only via separately authorised platform scope; contract lifecycle management.
- Products: release gate integration with GitHub/Vercel and incident tracking.
- Finance: invoice generation, collection ledger, bank/accounting reconciliation and approval thresholds.
- Command: complete portfolio KPIs and exception drill-down beyond the latest authorised 300 records.
- Paginate/filter server-side for >300 records; avoid interpreting capped results as complete totals.

## Acceptance gates

**Safety:** school-only account denied; inactive HQ member denied; finance hidden from unrelated roles; non-MFA finance change denied; completed records immutable; owner may not self-approve; no school data leakage.

**Functionality:** create, edit, submit, review and return for each applicable module; named owner and separate backup for critical work; real audit events; no empty-placeholder claims.

**Continuity:** School Guardian and KAEC Alliance Catalyst both see only their respective authorised environments, and a designated backup can see and assume authorised work as agreed.

**Reliability:** mobile layout, sign-in recovery, token expiry, 2nd-user concurrent edits and production logs reviewed. The first version cannot be certified as fully autonomous company operations until the seven known-limitations areas above are covered.
