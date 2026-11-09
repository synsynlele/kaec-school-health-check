# KHP-OS — product simplification and design-quality register
**Date:** 9 November 2026  
**Status:** First source-level cleanup on a development branch; not a production release or end-to-end user-acceptance sign-off.  
**Scope:** KHP-OS school routes, navigation shell, school overview, Today, operational workflow boundaries, previous simplicity and record-management audits.

## Product rule

KHP-OS exists to help a school **plan work, assign responsibility, carry it out, record evidence, resolve exceptions and review outcomes**. A capability earns a visible position only if it reduces a real school operating burden, satisfies safeguarding/governance, or has a school-approved programme owner. Do not optimise for feature count.

A teacher should find attendance and assigned lessons first. A sectional promoter should see timetables, exceptions and review duties. A School Guardian should see unresolved school operations. A School Custodian should see important exceptions and performance. HQ should see only permitted multi-school oversight. Navigation visibility alone is **not** access control.

## Source-backed findings

1. The repository exposes **55 registered school workspace links** in the navigation configuration; 53 core routes were consolidated into 22 visible main-menu entrances by the October simplicity pass, and two later additions are present. The number of available routes remains high for a new user.
2. School overview mixed daily attention with a prominent transformation journey and displayed a second header/sign-out control inside the shared shell.
3. Today embedded full reporting and announcements components even though each has a dedicated page. This repeated entire interfaces and loaded independent workspaces inside the user's daily queue.
4. Today displayed the same error through a shared action-feedback component and a second red banner.
5. The mobile school header displayed Account and Entrance even though the More drawer already held those links. Large work areas also generated wrapping desktop navigation pills.
6. School-health transformation, programme tracking and HQ portfolio functions have legitimate separate ownership in parts of the product, but **that does not justify showing them as everyday tasks for every user**.
7. The October usability and record-management audits explicitly document missing independent mobile acceptance and warn against deleting approved, sensitive or historical records.

These are source-level observations. Actual screen contrast, performance and accessibility require browser/device tests.

## Immediate change set: implemented on this branch

- School overview uses the shared application chrome; the duplicate local header and sign-out were removed.
- The overview starts with clear links to daily work, teaching, reports and school updates.
- Detailed school health, improvement cycle, activation and diagnostic content is under an opt-in expandable panel. Records and school-health report access are preserved.
- Today brings attendance before secondary timetable panels, uses more compact KPI cards and no longer embeds the full Reports or Announcements workspaces.
- Today provides direct links to existing Reports and Announcements pages; all underlying workflows, permissions and saved URLs remain.
- Duplicate Today error banner removed in favour of shared action feedback.
- Mobile account/entrance duplicates removed from the top bar, retained in the More drawer.
- Work areas with more than four pages use one readable selection control instead of many wrapping tabs.
- Static navigation-contract checks added to prevent the removed duplicates returning.

**No schema migration, API-route deletion, record deletion or permission change.** Do not describe these commits as a full app-wide visual certification.

## Keep as core, but avoid parallel data entry

| Core school job | User's natural entrance | Source of truth |
| --- | --- | --- |
| Arrive, deliver lessons, finish class | Today → Attendance & lessons | School attendance and class/lesson presence |
| Set, check and recover teaching | Teaching & learning | Timetable and academic delivery records |
| Request/approve/resolve actions | Today → Approvals / Issues | Governed work items, decisions and issue lifecycle |
| Report activity and review responses | Reports & forms | Scoped report templates and auditable submissions |
| Announce/meet/decide | Meetings & updates | Explicit audience, meeting, decision and follow-up records |
| Manage people and staffing | Staff & roles | Positions, appointment, leave, coverage, performance and accountability records |
| Protect students | Safeguarding | Restricted safeguarding cases; never mix into general dashboards |
| Maintain school property and calendars | School management | Original asset, event, timetable and facility records |
| Review school operations | School results | Derived summaries linked to their evidence |
| Find instructions and policies | Ask KHP-OS / School library | Role-approved training and policy versions |

**Hard separation:** Confidential safeguarding, disciplinary, personnel and parent cases must not be merged into public-facing feeds or unscoped reports.

## Consolidate or reduce prominence in the next controlled batches

1. **School improvement:** Priorities, implementation, evidence, review, reassessment and guides should become one staged leadership flow. Retain existing stored revisions and links until a migration-safe route strategy is tested.
2. **Staff:** Staff / Roles / Joining / Hiring / Leave / Support / Accountability / Exits should share one staff home, with permission-specific actions rather than eight competing dashboard entrances.
3. **Meetings and follow-ups:** Keep meetings, notices, decisions and task ownership distinct internally, but show one clear path from meeting decision to assigned work.
4. **Reporting:** Do not ask staff to type attendance, class-delivery or task totals already verifiably stored. Provide reviewable, source-linked prefills, not automated edits to approved records.
5. **Programmes:** Young CEO Hub, WorldReady, Builder Projects, Builders Council, leadership/financial literacy, skill and potential-development pages should be **school-enabled optional programmes**. Do not surface them to every school by default; retain any active school's programme access and records.
6. **Advanced intelligence:** Benchmarking, cross-campus comparison and integration dashboards should be leadership-only and data-ready. Hide empty or disconnected modules until they produce an actual decision.
7. **KSI and PipuPath boundaries:** Do not reproduce lesson authoring, CBT or the youth game inside KHP-OS. Integrate authorised summaries and links where this saves staff effort.

**Removal candidates only after usage and dependency review:** obsolete duplicate action buttons, repeated overview summaries, empty AI-generated surfaces, duplicated manual forms, product-development language, second dashboards showing the same records. Never delete evidence because a screen looks busy.

## Design and quality bar

- One dominant action per screen; title, purpose and next step understandable in plain English.
- Most-used work available within **three navigation actions** from the role's entry point (pilot target).
- 44 CSS pixel minimum meaningful touch targets, visibly labelled inputs, visible focus states, keyboard-accessible dialogs.
- Text at least 16 CSS pixels for mobile input fields; avoid clipped tabs, horizontal overflow and overlapping tooltips/celebrations.
- Reliable loading and recovery: one shared loading language, no white flash, no full-screen loading cover for a small in-page refresh, explicit network failures and retry.
- Accessible contrast for text, status and inactive controls. Never rely on colour alone for status.
- Clear search, filters, pagination, active/archived separation, record timestamps and evidence-aware corrections.
- Approved/verified documents immutable without controlled amendment. No weakening of school, role, campus or sensitive-case permissions.
- Same tokens for spacing, typography, buttons, empty/error/success states, card density, dark backgrounds and mobile safe areas.

## Next release gates

**Gate A — automated:** GitHub checks (lint, TypeScript, tests, production build), no missing routes, no changed authorisation semantics, no redundant source-level embedded workspaces.

**Gate B — browser and device:** signed-in Teacher, Sectional Promoter, School Guardian, School Custodian and HQ flows at 360, 390, 430 pixels, tablet and desktop; verify clarity, contrast, truncation, back navigation, loading, form completion, opening/closing dialogs and notification behaviour.

**Gate C — five real school days:** each pilot school independently demonstrates school check-in, class check-in/out, timetable changes, reports, return/correction/review, leave/cover, announcements, meeting follow-up, permissions, and safeguarding routing. Record time-to-complete, help requests, duplicate-entry incidents and founder intervention count. Critical-data-loss and cross-school privacy incidents: target zero.

**Gate D — staged release:** produce before/after screenshots and a concise change log; release only when Gates A–C pass. Retain rollback ability, historical links and old records.

## What makes this scale 100×

Maintain a **single role-based task model** fed by the existing operational records, not an ever-expanding set of home screens. Make onboarding repeatable through School Guardians and trained implementation partners. Capture friction as reproducible defects → shared design fixes → automated regression checks, instead of founder-led support for each school.

**Current evidence limit:** this branch is an initial verified source change, not a claim that every page is beautiful or every user journey is simple. Full product-wide certification remains open until acceptance gates are met.
