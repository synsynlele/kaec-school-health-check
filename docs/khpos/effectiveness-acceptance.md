# KHPOS effectiveness programme acceptance

The 5 October 2026 agreement covers all twenty capabilities below. A shipped foundation is not completed acceptance. Statuses describe implementation evidence, not promised completion. Staff appointments, policy approval and local routing decisions remain institutional governance actions.

| # | Capability | Shipped foundation | Acceptance still required |
|---|---|---|---|
| 1 | Process to execution | Execution profiles; safe manual mapping and starts; reviewable recommendations from approved controls | Every approved process classified with staffed owner, controls, verifier and escalation |
| 2 | Today | Role work, attention, verification, available starts and exact-record attention links | Full daily journey for every role; returned work and completion categories |
| 3 | Triggers | Recurring, events, conditions; Coverage, recovery, learner support, asset faults, assessment results handoff and policy reviews | Protected safeguarding flow and institution-specific mappings; verify each school’s assessment/results process |
| 4 | Exceptions | Overdue work/issues/decisions, blocked work and trigger failures | Repeated lateness, returned reports, missing controls, attendance and academic patterns |
| 5 | Command Centre | Action-required leadership view and derived operating signals | Every agreed domain pulse linked to evidence, with honest insufficient-data states |
| 6 | Ask KHPOS | Authorised governed-source answers and fallback | Verify all six agreed question types against role-authorised real records |
| 7 | Operational intelligence | Evidence-to-process learning | Repeated narrative themes with source references and root-cause actions |
| 8 | Performance | Evidence-derived institutional operating performance | Individual staff review assembled from timeliness, verification, KPIs and development |
| 9 | Decision outcomes | Implementation work, evidence and independent outcome verification | Full approve-to-outcome journey across roles and returned outcomes |
| 10 | Meetings | Leadership brief with source-linked, prioritised agenda and requested outcomes | Saved meeting conclusions and complete meeting-to-decision-to-verified-outcome journey |
| 11 | Calendar | Work, decisions, events, policy reviews and recurring obligations | Assessments, inspections, staff reviews, academic milestones and compliance coverage |
| 12 | Notifications | Attention notifications and push infrastructure | Classification, deduplication, delivery retries and real closed-app delivery |
| 13 | Mobile/PWA | Responsive workspaces and PWA | All critical journeys at 360, 390 and 430 px, including uploads and idle recovery |
| 14 | Library | Process knowledge graph and linked operating controls | Verify all purpose-to-history links and authorised past records |
| 15 | Onboarding | Role charter, required policies/processes and safe practice | New staff join, practice, returned work and readiness without founder assistance |
| 16 | Data quality | System Integrity and assignment/governance/execution checks | Duplicate people, orphan records, impossible dates, report completeness and contradictions |
| 17 | Reliability | Portfolio observability, trigger failures and runtime error scans | Background jobs, push/API/database/auth failures, latency and alert delivery |
| 18 | School inheritance | Versioned standard, draft installation and governed adoption | Multi-school upgrade, local variation and outdated-version journeys |
| 19 | Benchmarking | Privacy-gated evidence-derived peer comparisons | Verify every agreed metric, minimum evidence and peer suppression |
| 20 | Improvement | Operational learning and process-review prompts | Variance-to-cause-to-intervention-to-verified-process-change journey |

## Wave 6 evidence

- Database source events: coverage required; academic debt opened; learner risk recorded; asset fault linked.
- Events carry scope and opaque source identifiers, without learner/staff narrative content.
- One event key per source record and execution profile prevents duplicate work from repeated updates.
- Only active members holding an active owner role can receive triggered work. Multiple matching assignments fail visibly.
- Triggered work receives its active checklist and existing controlled report/log requirements.
- A materialisation error records a failed trigger instead of rejecting the original operational record.
- `scripts/sql/test-khpos-event-wave6.sql` verifies all four source events, deduplication, controls, privacy and ambiguous routing in rollback.
- Leadership configures a governed process for each new event in Execution Control. Installing the engine does not make local ownership decisions.

## Next release priorities

1. Review and activate supported event/condition mappings with actual school owners; preserve local routing choices.
2. Complete repeated failure detection and evidence-assembled staff review/meeting flows.
3. Verify mobile, closed-app push, reliability alerts and multi-school journeys end to end.

## Quota-protected handoff batch

- Assessment cycles entering results pending create a configured results follow-up task; assessment or result approval remains governed.
- Active policy review dates feed the existing hourly condition scheduler. A stable key per version and review date prevents duplicate daily review tasks.
- Latest KPI state is selected before testing failure, so a past red measurement cannot override a newer healthy one.
- Meeting preparation uses only the requesting leader’s authorised queue, ranks urgency, links evidence, and exposes remaining items beyond its twelve-item agenda.
- Database rollback tests cover assessment transitions, controls, privacy, policy eligibility, deduplication and latest KPI state. Unit tests cover agenda priority, preserved sources, bounds and empty states.
- Ordinary feature branches remain deployment-disabled. Local checks precede one production merge for the batch.

## Today navigation and execution guidance

- Today attention links identify the exact work, verification, issue or decision record. After authorised data loads, the workspace scrolls to and focuses that rendered record. Fragment IDs never fetch or reveal additional records.
- Execution Control shows all approved processes by default, so configured processes remain available for review.
- Recommended mode, role and trigger come from active approved process versions, governed owner participation and active schedules. Unsupported triggers remain manual; ambiguous roles require leadership choice.
- Approved versions and owner participation are filtered to the school before API row limits, so additional schools cannot crowd out its recommendation inputs.
- A role counts as staffed only when an active assignment belongs to an active school member.
- Explicit approved elapsed intervals can be converted to minutes. Other suggested intervals are labelled proposals; conflicting numeric instructions require review. Immediate escalation instructions remain visible.
- Using a recommendation edits a draft only. Existing evidence, verification, due dates and KPI controls are retained. Saving an escalation interval alone does not create timed notifications.
- Unit tests verify sources, ambiguous/unappointed ownership, automatic source eligibility, controls, interval ambiguity, record links and authorised DOM focus. Typecheck, lint and the production build validate the integration. Live signed-in browser acceptance remains outstanding.
