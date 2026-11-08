# KHP-OS end-to-end automation audit — 8 November 2026

**Scope and confidence.** Static review of the KHP-OS/KSHC repository on the agentic development branch, including the school workspace route inventory, reporting, announcements, HQ reporting, task execution, notifications, AI costs, assessments, staffing, meetings, school health, learning signals and network oversight. This is **not** a claim that every screen has passed a physical-device walkthrough or that observed staff behaviour has been independently measured. Existing CI checks cover many flows, but live workflow adoption must be piloted.

## Executive finding

KHP-OS already has a large governed workflow engine. The biggest opportunity is **not adding more forms or a second generic chatbot**. It is to convert structured information already in the app into (1) prioritised next actions, (2) polished human-reviewed communications, and (3) cross-module summaries without duplicate staff work. The default should be **zero paid AI tokens**, with explicitly requested, capped AI only when semantic rewriting or judgement adds material value.

### Inventory of what exists

- **Attendance & lessons:** staff and class presence, location evidence, due reminders, teaching delivery, missed-class/recovery records and escalation paths.
- **Reporting:** recurring report templates with selected staff, roles, campuses and sections; daily-to-yearly periods, termly/calendar schedules, history, draft/submission, independent review, return/correction, privacy and alerts.
- **Announcements:** draft, publish, scheduled delivery, expiry, targeted audiences, urgency, links, read/acknowledge tracking, revision and withdrawal.
- **HQ reporting:** appointed reporting lines, cadence, quick answer forms, explicit reviewer acceptance/return; periods advance on submission, while missed periods remain visible.
- **School operations:** roles, structured work, issues, evidence, governed decisions, due dates, process execution mappings, conditions/recurrences, performance scorecards and leadership brief.
- **Meetings:** private school/HQ meetings, invitations, activity lifecycle, attention-driven suggested agendas and decision follow-up links.
- **School improvement:** KSHC baseline, interventions, implementation evidence, independent review and reassessment; KSI integration provides school-level aggregated instructional quality signals.
- **HQ:** governed Pathfinder assignments, restricted portfolio view, standard adoption, exception monitoring and cross-school support prioritisation.
- **User guidance:** role-specific Training Academy and zero-token how-to answers in Ask KHP-OS on the development branch.

## Findings and recommended automation

| Area | Avoid duplication | Suggested improvement | Paid AI needed? | Priority |
|---|---|---|---|---|
| School report narratives | Existing governed fields and audiences | Generate professional editable narrative preview from the CURRENT user's authorised answers; add preview/copy | **No**; client-side composer now built on branch | P0 |
| Staff announcements and circulars | Existing permissioned publisher and scheduler | Generate formal/warm/concise message from subject, verified supplied points, action, date and sender; publisher remains responsible | **No**; client-side composer now built | P0 |
| HQ / Pathfinder reports | Existing assigned reporting lines and quick answers | Generate professional HQ narrative from reported work, constraints, next actions and evidence; do not assert independent verification | **No**; client-side composer now built | P0 |
| Repeated manual figures in reports | Attendance, lesson delivery, tasks, issues, targets, reviews | Prefill only authorised objective metrics with source/date and editable citations, never silently overwrite notes | No | P0 next |
| Leadership weekly/monthly review | Current leadership brief, reports, performance and KSHC | One-click audited synthesis of progress, missed commitments, KSHC follow-up and decisions; optional print/export | No for numbers/sections; 1 capped AI call optional for polish | P0 next |
| Missing report follow-ups | Existing due dates, reports, return/approval and push | Only notify relevant reporter/reviewer; group repeated notices; avoid excessive polling/push | No | P0 next |
| HQ reporting nudges | Existing lines and overdue tracking (UI currently says no outbound alerts) | In-app deadline digest / push opt-in from already scoped records; no WhatsApp/SMS by default | No | P1 |
| Meeting minutes | Meeting agenda, work items and decisions | Convert typed minutes into **editable, unsubmitted** action drafts, then let authorised leaders assign/approve | No for structured minutes; optional AI for free-form extraction | P1 |
| Academic timetables | Existing timetable, recurring delivery, staff availability | Detect conflicting schedules/uncovered classes; propose substitute and recovery plans | No | P1 |
| Exams & invigilation | Exam schedules, teacher availability and appointments | Prepare constraint-aware draft invigilation roster; require human confirmation | No | P1 |
| School personnel | Leave, coverage, staff development, recruitment | Prompt covering-staff suggestions, due approvals, onboarding role-specific checklists and missing evidence | No | P1 |
| KSHC + KSI | Existing school-health baselines and aggregate KSI signals | Attach linked corrective-action drafts, reconcile intervention progress against reassessment without inventing improvements | No for progress; optional restricted AI for narrative | P1 |
| Parent communication | Existing authorised parent-case and school workflows | Draft neutral update using approved non-sensitive facts; human checks recipient/privacy | No for templates; optional capped AI when needed | P2 |
| Assets, facilities & procurement | Existing asset logs, issues, standard escalation | Conditional maintenance inspections, fault follow-ups, expired records and stock-review prompts | No | P2 |
| School leadership finance | Existing leadership finance governance | Monthly variance summary, missing submission flags, approved spending requests | No; financial action approval mandatory | P2 |
| HQ network support | Existing restricted portfolio and Pathfinder reporting | Rank institutions for outreach; group standard installation, failed triggers, overdue items and verified school health | **No**; zero-token plan now on branch | P1 |
| Customer support | Existing Training Academy | Search exact role-accessible steps and routes; identify missing/outdated help pages via anonymous request category counts | No; new guide already on branch | P1 |

**P0** = highest near-term adoption and subscription value, **P1** = operational scale, **P2** = later after reliability/safeguarding review.

## The three reporting systems must remain distinct

1. **School Reports** are school- and campus-scoped, with designated recipients and potentially protected answers. A school leader who manages a report template does not automatically gain access to every report's content. Never give another teacher those drafts.
2. **HQ Reports** are appointed corporate reporting lines, including school Pathfinder visits. Reviews remain between appointed reporter and reviewer; the Vision Custodian's explicit rights are separate.
3. **Announcements** are intended for distribution, but require publisher permission, correct school/role audience, accurate dates, explicit publishing action and, when configured, acknowledgement tracking. Never convert private report content into a broadcast without deliberate authorisation.

A single shared **draft composer** can improve all three experiences without unifying their privacy models or creating a new uncontrolled report store.

## What was added to this development branch

- `src/lib/khpos/writing-assistant.ts`: pure zero-token announcement, school-report and HQ-report formatters. All content comes from supplied/visible fields, no model/network requests.
- Announcement creation/editing now includes a small structured writer (tone, purpose, factual points, required action, exact date/contact/signature). Its draft fills an editable message; it cannot publish without the ordinary action.
- School report author/reviewer can generate a professional preview and explicitly copy it. The underlying saved fields, review history and access rights are unchanged.
- Corporate HQ reporter can generate and copy a professional narrative from their quick choices and work notes. Formal reporting continues through the existing explicit submission and reviewer process.
- New test: `scripts/test-khpos-writing-assistant.mjs` included in CI.

**Not yet implemented:** prepopulating report numbers from live operational evidence; saving the professional narrative as a governed document/version; PDF/Word export; scheduled digest delivery; optional AI rewrite. These need distinct access controls, UX checks and economic validation.

## Cost governance and scaling

**Tier 0, default:** deterministic reporting, announcements, nudges, rule-based alerts, HQ triage, user guidance and evidence summaries. Zero *model* tokens per use; still requires database, server requests, push infrastructure and support.

**Tier 1, optional:** a single user-triggered **Polish wording** call when facts are already entered and the draft fails the user's quality bar. Use the lowest-priced suitable supported model, cap input/output size, log actual usage, block repeats on unchanged content and enforce the shared per-school spend governor. Never auto-rewrite on page load, typing, scheduled notifications or polling. Avoid sending confidential safeguarding or identifiable learner narratives to the model without the separate approval/privacy controls.

**Tier 2, restricted:** leadership-only sophisticated planning or sensitive analytical narratives, subject to documented benefit, school permission and per-organisation quotas.

The current draft cap is **USD 0.30 per school per month** for supported paid KHP-OS AI routes. This is only a pilot guardrail, not a validated per-school cost or guarantee that combined platform costs will be this low. KSHC report and coach AI calls have separate telemetry but are not included in the KHP-OS cap. Model prices and availability must be rechecked before enabling a new paid polish endpoint; use observed token and provider-invoice costs. The legacy GPT-4.1 Mini model currently referenced in cost rules is listed as **deprecated** in the [OpenAI model reference](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Do not rely on it as a durable low-cost writing model without checking current supported replacements, quality, compatibility and pricing.

Do not charge a separate AI fee for default professional writing. A scalable product must be able to serve 100x more staff without paying 100x for generative rewrites of ordinary notices.

## Workflows not to automate autonomously

- Learner safeguarding, special-needs decisions, sensitive health or discipline outcomes.
- Publishing parent, public or multi-school announcements; changing their audiences.
- Teacher hiring, dismissal, sanctions, salary or financial approval.
- Altering KSHC diagnostic ratings or claiming outcomes without new reassessment evidence.
- Accessing other schools' personal records to enrich a school-specific narrative.
- Sending automated repeated WhatsApp/SMS at unmonitored cost.

## Pilot and acceptance metrics

Measure per school/week, with a KAEC staff owner **other than the founder**: (1) reporting minutes saved, (2) percentage of mandatory reports populated from existing evidence rather than duplicate entry, (3) professional draft usage and subsequent manual edits, (4) return-for-correction rates, (5) announcement publication errors/acknowledgement completion, (6) monthly AI token USD and non-AI hosting/push cost, (7) support questions answered entirely inside KHP-OS, (8) leader actions closed with independent verification, and (9) cross-school privacy incidents (target: zero).

The first product KPI is **report submission without external ChatGPT**, not number of AI calls. If the zero-token writer produces robotic or inadequate results, run a measured, per-school budgeted trial of a one-click AI polish, rather than making every notice generative by default.

## Verification and release

This is a source audit plus a development-branch implementation, not a substitute for an end-to-end device test. Execute full CI, check school/report/HQ authorisation scenarios, confirm copy and editing on Android, measure actual host charges, and keep the existing PR draft until all test gates pass. No production migration or deployment is authorised by the audit alone.
