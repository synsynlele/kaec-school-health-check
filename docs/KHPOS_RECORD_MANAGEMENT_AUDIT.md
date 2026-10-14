# KHP-OS — Creator control and record lifecycle audit
**Inspection date:** 14 October 2026  
**Scope:** KHP-OS operational page/source review (UI and existing workflow actions). This is a **gap register**, not evidence of user-acceptance testing or an authorisation to delete institutional records. Do not mark a missing feature as implemented until its API/RPC, permissions, audit and regression tests exist.

## Design decision
A blanket **Edit/Delete every created item** control is unsafe for a school operating system. Implement consistent *creator control* according to state, with server-side checks:
1. **Unsubmitted draft:** The author or authorised replacement may edit title, dates, responsible staff and content. An unused, unlinked draft may be discarded (soft delete) with confirmation and recovery.
2. **Submitted / pending verification:** The original author may request correction or withdrawal with a reason; the reviewer returns/reopens where permitted. Preserve submitted versions, original author, timestamp and a revision ledger.
3. **Approved / in execution:** Changes affecting duties, deadline, scope, budget or safety require amendment and role approval; do not silently overwrite the approved source.
4. **Completed / verified / closed:** Read-only history; corrections are an append-only, linked, attributed addendum subject to independent review.
5. **Sensitive / statutory / safeguarding / grievance / recruitment clearance / attendance / financial records:** Do not hard-delete through the standard UI. Use role-checked correction, redaction or restricted retention/erasure workflow where legally appropriate. Staff and students must not be able to destroy evidence.
6. All mutations: enforce school/campus scope, record owner vs reviewer separation, CSRF/auth/session validation, input schema, optimistic locking or revision version, actor, reason, timestamp and audit event. Never rely on hiding a button as authorisation.

## Source-level inventory (30 operational surfaces)
The **existing action** column identifies a source-inspected workflow path, not necessarily a generic edit function. **Required** means a specific creator-management control remains to be implemented or independently verified.

| Area | Record families | Existing lifecycle or revision path seen in source | Required creator management |
|---|---|---|---|
| Today / My Work | Process-triggered work, checklists, evidence and reports | Complete, submit and independent verification/return | Amend own unsubmitted work and unsent drafts; post-submission correction with audit; no delete verified work |
| Issues | School issues, evidence, resolution | Escalate, resolve, verify and close | Edit own initial report only while unacted; reasoned amendment/withdrawal |
| Decisions & Approvals | Decision request, decision, implementation | Approve/reject/implement/outcome/closure | Draft edit / withdrawal before decision; approved decision amendment through authority |
| Institutional Library | Policy and process versions, tools | Separate PolicyGovernance and ProcessGovernance save/submit/return/approve actions | Draft version history, cancel unpublished proposal, explicit editor permissions; never delete approved policies |
| People & Staff | Appointments, onboarding, assignments | Lifecycle and end of appointment; multiple-position acceptance/review | Correct pending appointment, transfer/cancel where eligible; no erasure of former staff audit |
| Staff positions | Additional positions | Propose, acknowledge, readiness review, end | Edit proposed position until accepted, withdraw pending |
| Availability | Leave/absence, cover assignments | Cancel/decline/close lifecycle | Creator amendment request for dates/cover before approval |
| Recruitment | Workforce requests, vacancies, applications, clearance | Draft vacancy, stages, close/cancel/withdraw | Edit open draft requisition/vacancy, candidate information correction, no delete clearance evidence |
| Staff Performance | Appraisals, evidence, development actions | Review stages, cancellation, completion | Draft editing, staff rebuttal and authorised append-only correction |
| Staff Accountability | Recognition, grievances, conduct, corrective actions | Response, hearing, verify/reopen/cancel | Amend own draft; closed conduct/grievance history is protected |
| Staff Transition | Succession, promotion and exit cases | Accept/review/execute/withdraw/cancel/close | Correction requests before approval; immutable effective transition history |
| Learner Progress | Learner anchors, baselines, risks, cases, progression | Resolve/dismiss signals and case closure | Controlled correction of identity/data imports, editable support plans and audited changes |
| Academic Delivery | Streams, teacher assignments, plans and follow-up | Approve stream, update deployment, verify/reopen | Draft stream/plan edits with scheme validation; approved version controls |
| Academic Assurance | Exams, moderation, exam readiness and reconciliation | Plan, approve, administer, reconcile and close | Edit unapproved plan, verified correction only after exam starts |
| Teaching Presence / School Day | School attendance, subject periods, class sessions, HQLS observations | Check in/out, administrative reconciliation, disable future period | Edit **future unused** schedule; no deletion of actual check-ins or observations; correction reason + reviewer |
| Student Culture | Student concerns, recognition, assigned actions | Triage, verify, safeguarding referral | Reasoned correction of initial non-sensitive case before action; do not delete referrals |
| Safeguarding | Restricted reports, protective steps, case closure | Designate, report, triage, log step, close | No generic edit/delete; restricted factual addendum, redaction and retention controls |
| Parent Partnership | Parent concerns and communications | Acknowledge, communicate, respond, verify/close | Draft correction; post-delivery communication must be append-only |
| Parent Journeys | Enquiry, follow-up, progression and closure | Advance journey, complete/lost | Allow owner to correct pre-delivery follow-up and contact reference; version communications |
| Events & Programmes | Event charter, draft budget and safety plan | **Revise draft planning through existing plan action**, submit, return, cancel, review | Edit draft title/date/purpose with linked approvals, ensure revision audit |
| Institutional Calendar | Aggregated events, actions, deadlines | Read-only aggregation, links back to owned record | Edit at the original source, never in derived calendar |
| Assets & Maintenance | Assets, servicing, faults | Register, submit service, verify/return, retire asset | Edit unverified asset metadata; protect verified servicing and incident history |
| Campus Readiness | Findings and remediation | Record, resolve, verify, return | Correct draft finding, post-verification addenda only |
| Builder Projects | Group/individual projects, defence, evidence | Project stages and review | Edit project drafts and non-final assignments; protect defence evidence |
| Builders Council | Cycles, seats, nominations, validation | Create cycle/seat, nominate, validate, review | Edit draft cycle/seat before nomination; never secretly overwrite ballots |
| Skills Development | Tracks, learner skills, instructors | Stage-based pathway records | Edit draft plan; protect demonstrated competency evidence |
| Potential Development | Hypotheses, observation evidence and learner exploration | Multiple reflection/evidence flows | Amend hypothesis with dated evidence; never silently rewrite previous assessment |
| WorldReady | Learner pathways, readiness/capstones | Programme lifecycle | Edit draft plan; approved/verified outcomes require revisions |
| Young CEO | Ventures, milestones and reviewed evidence | Milestone and progression verification | Draft change and audited funding/progression amendments |
| Leadership Financial | Financial commitments and reporting | Approval and controls | Reversal/amendment entries only; never generic delete |
| Execution Control / Reviews / Leadership Brief | Derived execution status and institutional reporting | Commands and review actions link to source | Manage source records; no editing computed totals or snapshots |

## Safe implementation order
**Wave A — usability (PR #80):** Today/Calendar/queues search-sort, School Day separated dated attendance, regression checks. UI-only and no migrations.  
**Wave B — benign draft controls:** Events charters; optional on-demand work drafts; eligible availability/vacancy drafts; asset metadata; prospective class periods. Reuse one `record_version` and `record_action_audit` contract; apply server-side creator and scope permissions.  
**Wave C — submitted and approved amendments:** Decisions, issues, parent cases, learner supports, People/HR. Integrate reviewer and escalation gates; preserve old values.  
**Wave D — high-assurance domains:** Safeguarding, accountability, exam, verified attendance, finance, student council results. Restrict to append-only amendments, corrections, redaction and explicit lawful retention controls.  

## Acceptance tests for each record family
- Creating actor can find their record and see exactly which actions they can perform.
- Draft author can correct and save valid changes; other staff and other campuses cannot.
- Submitted/approved/closed versions cannot be silently rewritten or deleted.
- Deletion, where legitimately permitted, is reversible soft-deletion of a truly unused draft and preserves an audit event.
- Concurrent updates reject stale version numbers and show a useful explanation.
- Corrections display **who, what changed, why and when** using Africa/Lagos time.
- After action, Active/Waiting/History, Today, notifications, calendar, accountability and cross-link navigation stay consistent.
- Permission, safeguarding and test fixtures cover full lifecycle, including Android Lite/PWA session recovery.

**Status:** The source inventory is complete at a surface level. Individual field/action parity, database constraints, authorised user-acceptance and all server-side amendments **remain open**. No production data has been altered by this audit.
