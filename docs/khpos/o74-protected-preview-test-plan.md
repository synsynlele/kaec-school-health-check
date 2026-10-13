> **Historical note (October 13, 2026):** The earlier protected-preview approach below was superseded by the owner's request for no paid testing environment. O74 is being released through the existing live KHP-OS installation, using one independent opt-in switch per school. No additional Supabase project, paid branch, or copied live records are required. All schools may adopt the feature separately. Only a School Custodian can enable it for their own school. Academic Delivery terms and streams must be configured before class check-ins or full HQLS observations can be used. Existing data remains untouched.

# Release #74 — Protected Preview Test Plan

**Status:** development branch only. Do not merge PR #74 or apply its migration to production before approval.

## Deployment isolation (mandatory)

- Create a separate Supabase preview **branch** of the existing `kaec-school-health-check` project only with explicit approval for its hourly cost.
- Confirm the branch copies schema, **not real school data or production sign-ins**. Create disposable test school/users/roles within the branch.
- Run `supabase/migrations/20261013090000_khpos_presence_class_hqls.sql` against the **branch only**. Do not alter the production database.
- In Vercel, scope the testing configuration **only** to the `feature/teacher-presence-hqls-observations` preview branch:
  - `NEXT_PUBLIC_SUPABASE_URL`: isolated Supabase branch project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the existing client publishable variable): corresponding branch key
  - `SUPABASE_SERVICE_ROLE_KEY`: corresponding branch server-only key; never expose as `NEXT_PUBLIC_*`
  - `KHPOS_TEACHING_PREVIEW_DB_REF`: the isolated branch's 20-character project ref
- Confirm the dedicated preview environment uses the isolated Supabase database for **all** modules, not just the #74 API. A preview connected to production is **not** a valid environment for testing.
- Confirm Vercel deployment protection / trusted tester access before distributing the URL.
- #74's new API routes **fail closed** on Vercel previews lacking the distinct branch ref; this is a defence in depth, not a substitute for correct configuration on existing APIs.
- Obtain explicit user approval before incurring paid branch costs, and delete the preview branch after testing to stop hourly costs.

## Seed disposable test data

Use synthetic records only:
1. One active partner school with a campus, an active term, and a role hierarchy.
2. Active staff and memberships: School Custodian, School Guardian, Academic Inspector, Sectional Promoter, Mathematics Teacher.
3. A dual-position staff user: Teacher + Sectional Promoter, with legitimate active role assignments.
4. One active approved Academic Delivery stream for Maths/JSS1 linked to the teacher.
5. A weekly Maths period scheduled for the preview test day and matching Africa/Lagos time.
6. Enable HQLS **only** on the test school's deliberate adoption setting.
7. A second separate synthetic school for cross-school permission tests.

## Test matrix

| Scenario | Actor | Expected |
|---|---|---|
| School check-in at own campus | Teacher | One timestamped presence record |
| Repeat school check-in | Teacher | Refused; no duplicate attendance |
| Check-in to different school's campus | Teacher | Refused |
| School check-out | Teacher | Timestamped closure if no class remains open |
| Add subject period | Guardian/Inspector | Allowed for authorised school scope |
| Overlap same teacher across periods or role assignments | Leader | Refused |
| Teaching check-in without school check-in | Teacher | Refused |
| Teaching check-in to someone else's class | Other teacher | Refused |
| Class check-in for scheduled Maths stream | Teacher | Started session |
| Class check-out with topic and outcome | Teacher | Completed session, preserved timestamps |
| School check-out while class open | Teacher | Refused |
| Forgotten check-out | Leader | Audited correction; class remains **unverified** |
| HQLS absent for school | Leader | Cannot create until enabled |
| Full HQLS observation | Independent Inspector | All 8 scored, evidence required |
| Quick learning walk | Inspector | Some domains observed; **no total fidelity score** |
| Automatic-failure condition | Inspector | Coaching assigned regardless of total score |
| Teacher rating conflict (Strong + automatic failure) | Inspector | Refused |
| Teacher acknowledges own observation | Teacher | Reflection captured |
| Teacher acknowledges another teacher's observation | Teacher | Refused |
| Teacher+Promoter user | Dual-position user | Single attendance, proper teaching/leadership permissions |
| Second school record | Any unauthorized account | Not visible; cannot mutate |
| Existing Today, Issues, Decisions, School Health Check | All roles | No change |
| Mobile session recovery / refresh | Teacher | No accidental duplicate writes |

## Explicit go/no-go

**Go:** GitHub CI green; preview deployment READY; preview host protection verified; branch database isolated; migrations and synthetic seeds verified; cross-school access denied; live operations unaffected.

**No go:** Preview uses production Supabase; paid branch not approved; no Vercel authorisation; any test fails; rubric scoring differs from original; leader can edit another school's classes or observations.

## Post-test

- Record outcomes without real students' data.
- Keep PR #74 draft until a separate production release decision.
- Delete the disposable Supabase branch once no longer needed; verify billing stops.
