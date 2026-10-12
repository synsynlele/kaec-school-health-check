# School Custodian release batch

Prepared 12 October 2026. Builds on school usability audit / draft PR #70. Not deployed.

## Result

School leadership uses SCHOOL_CUSTODIAN / School Custodian. Vision Custodian remains a KAEC-NG responsibility in the separate company/platform context. Existing school role IDs, assignments, reporting references and workflow ownership are preserved. A company title or platform administrator seat does not create school membership.

Critical policies and processes authored by a School Custodian can be reviewed by a different School Guardian or School Custodian. Other leader-authored critical drafts require School Custodian review. The author cannot self-review, even when holding both titles. Non-critical review retains existing leadership permissions.

The migration explicitly normalises 40 school operating functions and creates successor charter versions for title corrections, preserving earlier charter content. Historic policies/processes remain unchanged approved records. Old standard snapshots can still resolve their former custodian code into the correct school role through a narrowly scoped compatibility mapper.

Activation and System Integrity now flag a missing independent governance reviewer. An active assignment without active school membership does not count toward activation leadership coverage. Three pure validator search paths are pinned; their validation rules and execute permissions are unchanged.

## Actual readiness finding

The live school using the existing School Custodian code has one account holding both Custodian and Guardian seats. It has no independent Guardian account. KAEC Nigerian Schools has separate accounts and supports the full workflow test. The first school still requires a real independent reviewer appointment; a software change cannot manufacture that governance independence.

## Verification completed

A single rollback-only transaction applied the migration twice, then checked:

- Existing role IDs/reporting references and appointments remained unchanged.
- Old charter content remained intact; title corrections retained history.
- Function ownership, execute ACLs, security mode and resolution configuration for the role functions remained unchanged.
- No operating function requires the company role; only legacy standard-source mapping retains the old input token.
- Custodian-created policy: save → submit → self-approval denied → other-school approval denied → Guardian return → author correction → resubmit → Guardian approval.
- Guardian-created critical policy: Custodian approval.
- Custodian-created process: save → submit → self-approval denied → other-school approval denied → Guardian approval.
- Guardian-created critical process: Custodian approval.
- School owner retains authorised Guardian-level oversight; Guardian does not inherit reserved owner authority.
- Existing event materialisation, deduplication, controlled evidence/checklists, privacy, ambiguous routing, assessment follow-up, due policy review and latest-KPI-state tests still pass.
- Pure validator hardening retains expected valid/invalid results.

All test fixtures and schema/data changes were rolled back. This is database acceptance of the tested paths, not signed-in browser acceptance or school readiness certification.

Unit tests also cover absent identities, inactive draft state, unsupported reviewer roles, deployment compatibility and the same-person/two-title independence failure. Navigation, source contracts, scoring, type checking, lint and production build are release checks.

Reproduce the SQL test with `node scripts/compose-khpos-school-custodian-test.mjs` and execute its output through authorised database tooling. The composer includes BEGIN, temporary preservation snapshots, both migration applications, assertions and ROLLBACK. Do not execute only the post-migration fixture without its preflight snapshots.

## Production application order

1. Verify final PR CI and exact head. Review role migration and the governance/UI batch together.
2. Deploy the compatible app code once. It accepts existing school-scoped legacy codes during migration; it never derives school access from company authority.
3. Apply the role migration transactionally to the existing KSHC/KHP-OS project. It stops if both role records collide in a school or any verified function baseline has drifted.
4. Verify canonical titles/codes, preserved role IDs and assignment counts, approvals, governance blockers and security advisors. Do not waive staffing gaps.
5. Complete signed-in mobile/desktop smoke tests and school pilot gates before marking readiness.

A production role collision must be resolved explicitly. This batch does not automatically merge roles, grant new memberships, expand safeguarding access or delete school records. Ordinary branches remain deployment-disabled to protect quota.

## Live verification limitation

Vercel authenticated HTTP fetch of the exact production /api/health returned 200 with ok=true. The cloud browser still shows Site Unavailable for the custom domain; authenticated screen/phone tests remain incomplete. Health is not proof of usable staff journeys.
