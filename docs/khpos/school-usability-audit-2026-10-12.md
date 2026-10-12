# KSHC / KHP-OS school usability and readiness audit

12 October 2026. Source baseline: `beb5a9d` (main). Scope: source architecture, complete school route inventory, live database role hierarchy and governance functions, aggregate operating records, production deployment metadata, and the current inspected onboarding playbook v2.

**Verdict: readiness not certified.** This is an evidence-backed source and database audit; authenticated live UI acceptance is incomplete. The cloud browser returned “Site Unavailable” on the owner-supplied domain, including one reload. Vercel reports a READY production deployment and Supabase reports ACTIVE_HEALTHY. Those signals do not prove usable school workflows or explain the browser failure. No live operational record, permission, policy, role assignment or deployment was changed during this audit.

## 1. Governing decision

Every school has its own **School Custodian**, accountable for its vision and institutional oversight, above its School Guardian. **Vision Custodian** belongs to KAEC-NG. Oluwatosin can hold both responsibilities in their respective contexts; his company role must not be required for another school to function. School membership and scoped assignments remain the source of authority.

School hierarchy: School Custodian → School Guardian → Academic/Skill Inspectors → Sectional Promoters → Teachers/Skills Facilitators, with the student council operating under its defined charter. Company administration is a separate context. Safeguarding case narratives remain limited to designated personnel; school oversight does not imply unrestricted case disclosure.

The title change requires a controlled role migration, including assignments, reporting lines, charters, approval rules, execution owners, onboarding requirements, integrations and historic references. Changing only visible text would hide the underlying problem.

## 2. Confirmed findings

| Priority | Finding and evidence | Required correction | Accountable owner | Acceptance evidence |
|---|---|---|---|---|
| Blocker | Live role table contains an active VISION_CUSTODIAN school seat; one Guardian reports to it. A separate school uses SCHOOL_CUSTODIAN correctly. | Make School Custodian the school-level leadership seat in both existing and newly admitted schools. Preserve assignments and history; separate company authority. | Platform maintainer, with school authority verified by School Custodian | Existing user retains intended school access; Guardian reports to School Custodian; partner school has no dependency on KAEC company seat. |
| Blocker | Live policy/process functions recognise both owner codes, but independent Guardian review of critical custodian-authored drafts is enabled only when the author holds VISION_CUSTODIAN. Frontend mirrors this asymmetry. | Apply the same independent review rule to School Custodian authors, and explain the actual reviewer. Keep self-review prohibited. | Platform maintainer | School Custodian draft → different Guardian reviews → approved/returned state; self-review and other-school review denied. |
| High | Navigation registers 49 destinations. All are offered by the same shared component without role-based filtering in that component. | Primary navigation around daily jobs; secondary modules grouped; later filter by verified capability and school-enabled programmes. | Product/platform maintainer | Teacher can find assigned work without traversing leadership setup; hidden routes still protected server-side. |
| High | Original mobile tabs: Home, Activate, Today, Issues, More. Decisions & Approvals is under More. Activation is repeated in desktop Daily and Leadership. | Promote Approvals; move Activation and system controls to Setup. | Product/platform maintainer | Four daily links match across desktop/mobile; every other destination remains reachable once. |
| High | Onboarding playbook explicitly reports Activation 404 during its earlier inspection. Current source and build include the school-scoped route. | Retest deployed school-scoped Activation, identify route/deployment mismatch if reproduced. | Platform maintainer | Signed-in correct-school route renders and authorised actions work. Source presence alone is insufficient. |
| High | Live aggregate: 20 work items, 3 work record requirements, 0 work records. | Verify staff can submit required reports/logs, save, recover and complete verification; investigate configuration/adoption before claiming records work. | School Guardian and platform maintainer | One controlled report/log saved and retrieved, returned, corrected, then verified by another authorised user. |
| High | Current acceptance document explicitly leaves closed-app push, mobile journeys, onboarding, multi-school upgrades and parts of meeting/decision closure outstanding. | Complete end-to-end acceptance before a general readiness statement. | QA owner and school pilot leads | Recorded pass/fail evidence for each critical journey. |
| Medium | People/Team, Parents/Parent Journey, Library/Records/Transformation Evidence, and several performance/intelligence views create overlapping destinations. Different data responsibilities exist. | Consolidate entry points after inspecting real use; retain distinct records and permission boundaries. | Product owner with module leads | One intuitive entry for each user job; existing records and links preserved. |
| Medium | “Stage 2” development wording remains on the priorities screen. | Remove development numbering from school-facing content. | Platform maintainer | Plain task label shown. |
| Medium | Mobile menu has initial focus and Escape dismissal, but source does not implement a focus trap or explicit focus restoration. | Add and browser-test keyboard focus containment/return. | UI maintainer | Tab/Shift-Tab remain in open drawer; closing returns focus to More. |

Live aggregate context: 2 organisation records, 7 active memberships, 8 active role assignments, 1 policy version in review and 0 process versions in review. These are system-wide totals; they do not establish that every organisation is an active school or that records are complete. No personal record content was retrieved for this report.

## 3. What to keep, simplify, defer or remove

**Keep** a capability when it supports an actual recurring school obligation, an important exception, required evidence or a defined builder programme. Each must have a trigger, role owner, inputs, steps, required approver, completion evidence, deadline and escalation. Do not delete a capability solely because a new pilot has few records.

**Remove now from the daily experience:** Activation as a permanent daily tab, its duplicate placement, and development stage wording. These are navigation/content removals, not destruction of school data.

**Consolidate next:** overlapping menu entries into a single task-focused starting point with internal tabs. Confirm real screen behaviour and permissions first.

**Defer or enable per school:** programme-specific modules and advanced comparisons where there is no configured programme or sufficient evidence. These modules are potentially useful; their necessity is school-dependent.

**No module or record is approved for permanent deletion by this audit.** A deletion decision needs a verified duplicate or obsolete responsibility, an inventory of dependencies/history, an archive/recovery plan, and regression evidence. Navigation can be simplified reversibly first.

### Complete school destination inventory

All suffixes below are relative to `/khpos/[organisationId]`. “Consolidate” and “Optional” are recommendations, not completed removals or proven duplication of backend logic.

| Destination | Treatment | User job / reasoning |
|---|---|---|
| Overview (root) | Keep, leadership landing | School attention, exceptions and baseline report; staff should eventually enter Today. |
| /work | Keep, primary | Execute assigned processes, checklists and controlled records. |
| /issues | Keep, primary | Report and resolve blocks; escalate exceptions. |
| /decisions | Keep, primary | Find decisions and authorised approvals. |
| /priorities | Keep, consolidate improvement entry | Choose evidence-backed school improvement priorities. |
| /implementation | Keep, consolidate improvement entry | Carry out improvement plans. |
| /playbooks | Keep, contextual reference | Guidance tied to an active intervention; avoid a competing daily work queue. |
| /evidence | Keep, consolidate evidence entry | Transformation evidence retains its own verification model. |
| /reviews | Keep, consolidate improvement entry | Review evidence and improvement decisions. |
| /improvement | Keep, consolidate improvement entry | Reassessment and verified improvement. |
| /activation | Keep in Setup | Resolve admission/readiness configuration; retest earlier reported 404. |
| /execution-control | Keep in Setup | Configure triggers, role routing and execution controls; leaders only. |
| /leadership-brief | Keep, contextual leadership | Prepare meetings from authorised outstanding matters. |
| /calendar | Keep | Show obligations and deadlines, with direct action links. |
| /ask | Optional supporting tool | Governed reference help; must not become the only way to find work. |
| /onboarding | Keep in People | Role-specific joining, practice and demonstrated readiness. |
| /system-integrity | Keep in Setup | Data/configuration exceptions; do not burden ordinary teachers with system maintenance. |
| /standard | Keep in Setup | School adoption and updates to institutional standard. |
| /performance | Keep, consolidate leadership results | Evidence-derived institutional performance. |
| /people | Keep, consolidate People entry | Staff lifecycle records. |
| /recruitment | Keep, secondary People | Vacancy/appointment workflow; episodic rather than daily for all staff. |
| /availability | Keep, secondary People | Absence/leave/coverage exceptions, without duplicating external attendance system. |
| /staff-performance | Keep, secondary People | Individual coaching and reviews. |
| /staff-accountability | Keep, secondary People | Recognition and governed accountability; sensitive permissions retained. |
| /staff-transition | Keep, secondary People | Succession, progression and exit; review custodian authority dependencies. |
| /academic-delivery | Keep | Teaching execution and delivery assurance; avoid duplicating KSI lesson authoring. |
| /academic-assurance | Keep | Assessment/exam oversight; avoid recreating CBT. |
| /learner-progress | Keep | Learner follow-up and support evidence. |
| /potential-development | School-enabled programme | Potential discovery/development; central to KAEC philosophy where configured. |
| /skills-development | School-enabled programme | Skills pathways and evidence. |
| /leadership-financial | School-enabled programme | Learner leadership/financial literacy; title may be mistaken for school finance. |
| /young-ceo | School-enabled programme | Venture programme with appropriate real-money approval gates. |
| /builder-projects | School-enabled programme | Projects and defence evidence. |
| /worldready | School-enabled programme | Final-year readiness; show only where the relevant cohort/programme exists. |
| /builders-council | School-enabled programme | Student leadership charter and execution. |
| /student-culture | Keep, Care | Culture and behaviour workflows. |
| /safeguarding | Keep, essential | Concern reporting and designated case management; never remove as clutter. |
| /team | Keep, consolidate People entry | Role assignments/reporting lines are distinct from staff lifecycle records. |
| /library | Keep | Full policies/processes and controlled operating reference. |
| /parents | Keep, consolidate Parents entry | Parent cases and partnership matters. |
| /campus-readiness | Keep, secondary Operations | Operational readiness and safety checks; episodic governance. |
| /assets | Keep, secondary Operations | Faults, maintenance and action evidence. |
| /events | Keep, secondary Operations | Programme/event operational commitments. |
| /parent-journeys | Consolidate Parents entry | Verify distinct journey/case responsibilities before combining records. |
| /network-pulse | Defer/leadership-only | Demonstrate a useful multi-campus/school decision before broad prominence. |
| /records | Keep, consolidate evidence entry | Operational records/history, distinct from reference policy library. |
| /benchmarking | Defer until sufficient evidence | Peer privacy and comparable verified data are prerequisites. |
| /learning-intelligence | Optional integration | KSI signals; show honest connection and data state. |
| /human-potential-intelligence | Optional integration | PipuPath/programme signals; preserve privacy and avoid duplicate youth app. |

KSHC itself remains the diagnostic gateway. Reuse existing assessments and reports; a new questionnaire is unnecessary. Keep KAEC administration, partnership registry and portfolio intelligence outside the school staff menu.

## 4. First implementation batch prepared

- Daily navigation: School Overview, Today, Issues & Escalations, Decisions & Approvals; mobile labels Overview, Today, Issues, Approvals, More.
- Activation, Standard, Execution Control and System Integrity moved into Setup & system.
- More organised as School leadership, People & roles, Teaching & learning, Builder development, Care & parents, School operations, Setup & system.
- “Institutional Library” menu label becomes “Policies & Processes”; underlying library route and functionality retained.
- School workspace identity replaces transformation terminology in the shell.
- Priorities screen development-stage heading removed.
- Route lookup replaces positional operation-array references in secondary grouping.
- Navigation validation checks every registered destination exists, is reachable exactly once and preserves visible daily approvals.

These changes are a reviewable source batch. They do not implement role filtering, school programme switches, module consolidation or the role/authority migration. They have not been deployed or visually accepted.

## 5. Release and readiness gates

| Gate | Procedure and expected evidence | Owner | Status |
|---|---|---|---|
| Role migration | Both existing schools and a newly admitted school use School Custodian; company context remains distinct; assignments/history preserved. | Platform maintainer | Blocked pending implementation and regression tests |
| Governance | Custodian author → independent Guardian review; Guardian author → Custodian review; no self-approval or other-school action. | Platform maintainer + school leaders | Confirmed defect; fix pending |
| Staff joining | Fresh staff identity joins correct school, receives correct scope, completes practice without founder assistance. | Guardian | Live acceptance pending |
| Daily execution | Start/resume → checklist → required report/log → evidence → submit → returned correction → independent verification → retrieval. | Assigned role + verifier | Live acceptance pending; zero controlled work records currently |
| Exceptions | Blocked/overdue item opens exact record, reaches configured accountable role and escalates according to approved controls. | Guardian | Live acceptance pending |
| School health report | Appropriate leaders can open existing full report; other-school access denied. | Custodian/Guardian | Live acceptance pending |
| Safeguarding | Staff can record configured concern; oversight shows permitted information; confidential narratives restricted to designated lead/deputy. | Designated safeguarding personnel | Live acceptance pending |
| Notifications | Assigned alert appears in-app and reaches a opted-in closed Android PWA; retries/deduplication checked. | Platform maintainer | Live acceptance pending |
| Mobile/recovery | Critical journeys at 360, 390 and 430 px; uploads, keyboard, drawer, back navigation and idle/session recovery. | QA owner | Live acceptance pending |
| Multi-school boundary | Separate users cannot read/write another school; global admin role does not substitute for school membership. | Platform maintainer | Regression and live acceptance pending |
| Reliability | Production health, background trigger delivery, auth recovery and failure visibility verified. | Platform maintainer | Hosting READY/database healthy is partial evidence only |
| Independent pilot | Each existing partner completes actual daily work without founder rescue; issues feed reusable configuration improvements. | Each School Guardian | Pending |

Suggested pilot acceptance target: five consecutive school days; every critical control has a staffed owner and escalation path; all required submissions verified; no unresolved critical access/data-loss/safeguarding defect. This is a proposed operational gate, not a claimed industry standard or legal certification.

Certification wording after successful gates: “Operationally accepted for the tested schools, roles, workflows and version.” Maintain explicit limitations for disabled programmes or untested integrations.

## 6. Scale without founder dependence

The leverage is governed, repeatable work plus verified evidence, not 49 menu destinations. For a network 100 times larger, use school-scoped standard installation, role-based task views, configured programme enablement and a Guardian-owned activation checklist. Custodians handle reserved decisions and exceptions; they should not personally route routine work.

Each pilot issue should become a tested configuration/template improvement, with version history and clear local variation. The resulting loop is school use → recorded friction → verified correction → standard update → easier adoption by the next school. Measure founder interventions, successful independent submissions, return/correction rates and time to find/complete work. Do not add more dashboards until the core loop works independently.

## 7. Evidence references and limits

- Source: SchoolWorkspaceNav.tsx; school route tree; governance components; work/records services; role migrations; docs/khpos/effectiveness-acceptance.md.
- Live: role/reporting aggregates, governance function definitions and record counts from project kaec-school-health-check, read-only.
- Hosting: project metadata reports READY production deployment; no release performed.
- Current document: KHP-OS_Inspected_Onboarding_Playbook_v2.docx, read directly. It explicitly marks navigation-only modules and unfinished acceptance, including Activation 404.
- Static tests validate source contracts; they do not certify real user behaviour, delivered push or regulatory compliance.
- No numeric product-quality rating is assigned from incomplete UI evidence. Direction is strong; readiness must be measured, not guessed.
