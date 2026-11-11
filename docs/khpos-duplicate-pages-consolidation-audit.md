# KHP-OS — Duplicate Page & Inner Screen Consolidation Audit

**Date:** 11 November 2026  
**Repository:** synsynlele/kaec-school-health-check  
**Scope:** All 71 Next.js KHP-OS route pages plus their imported components, page-family navigation, and process/approval boundaries. Full source inventory is also produced by `scripts/audit-khpos-ui.mjs`.

## Decision

**Reduce navigation choices, not capability or historical data.** The app previously exposed 55 distinct school workspaces (not counting the school-home alias). We consolidate 15 secondary destinations under six school hubs, leaving **40 school user-facing destinations**. KAEC HQ combines meetings and discussions (6 → **5** visible corporate destinations). The platform-admin four routes and the five other/network URLs remain distinct because of permissions and context.

**The number of compatible route URLs remains 71.** Old school URLs now redirect to the relevant tab. This intentionally preserves school bookmarks, links in existing records, notifications and meeting invitations. It is not an accidental duplicate screen.

## Consolidated work areas

| Existing separate journeys | One main entrance | In-page sections |
|---|---|---|
| Announcements, Meetings, Ideas | **Updates** (`/announcements`) | Announcements / Private meetings / Discussions |
| Reports, Records | **Reports & Forms** (`/reports`) | Reports / Forms & checklists |
| School calendar, Events & Programmes | **Calendar** (`/calendar`) | Calendar / Events & programmes |
| Parent Partnership, Parent Journeys | **Families & Admissions** (`/parents`) | Current families / Enquiries & admissions |
| Priorities, Implementation, Evidence, Reviews, Improvement, Playbooks | **School Improvement** (`/priorities`) | Priorities / Action plan / Evidence / Review / Check improvement / Guides |
| Performance, Campus summary, Benchmarking, KSI signals, PipuPath signals, Leadership brief | **School Results** (`/performance`) | Overview / Campus status / Comparisons / Learning / Development / Meeting brief |
| KAEC HQ Meetings, HQ Discussions | **HQ Collaboration** (`/hq/meetings`) | Private meetings / Ideas & discussions |

Each hub mounts **only the selected module**, so opening Updates does not launch a meeting call or fetch an unrelated record in the background. Original API boundaries and human approvals remain unchanged.

## Deliberately not merged

- **Safeguarding and Student Culture:** confidential child protection reports must remain under the protected safeguarding pathway; no safeguarding evidence is copied into behaviour records.
- **Staff attendance, temporary outings and visitors:** all are discoverable under School day & gate, but staff permission/leave approvals, school attendance evidence and guest-device data use different audit and privacy controls.
- **Operational approvals vs School Improvement reviews:** approving a staff request or issue is not the same authority as validating the transformation improvement cycle.
- **School staffing, hiring, performance, accountability, career transitions and roles:** related inside Staff & roles, but separate HR decisions, data and reviewer responsibilities must not be collapsed into one all-powerful form.
- **Teaching plans, tests/exams and learner support:** associated through Teaching & planning; distinct academic deadlines, invigilation and student safeguards remain.
- **KSI learning intelligence and PipuPath development intelligence:** share a results entrance, but privacy thresholds, source attribution, data ingestion and evidence meaning remain separate.
- **KAEC HQ, school and platform administration:** similar school/campus listings intentionally have different authorisation scopes. Never merge their access rights merely because the cards look alike.
- **Visitor kiosk vs logged-in Gate & Visitors:** the guest self-entry screen must remain isolated from privileged gate approval and school data.

## Backward compatibility and release gates

- Preserve every old route by validating the school ID, carrying safe query parameters and redirecting to a fixed internal canonical route and view. Meeting invitation `?meeting=UUID` survives.
- Daily five-button nav remains **Today / School day / Reports / Updates / More**. More retains six task-oriented category groups.
- No migrations, payment services, new AI calls or changes to live records are needed for this consolidation.
- CI verifies school route audits, legacy link safety, section rendering, safeguarding separation, forms, reports, meetings, KSI/PipuPath governance, types and production build.
- **Not certified:** signed-in role-by-role mobile/desktop visual acceptance. A source audit is not a screenshot, so official final visual approval remains pending human/device verification.

## Full route-by-route disposition

| Route | Scope | Decision | Destination or reason |
|---|---|---|---|
| `[organisationId]/academic-assurance` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/academic-delivery` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/activation` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/announcements` | School | Primary hub | `/khpos/{school}/announcements` |
| `[organisationId]/ask` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/assets` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/availability` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/benchmarking` | School | Merged into hub | `/khpos/{school}/performance?view=compare` |
| `[organisationId]/builder-projects` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/builders-council` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/calendar` | School | Primary hub | `/khpos/{school}/calendar` |
| `[organisationId]/campus-readiness` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/decisions` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/events` | School | Merged into hub | `/khpos/{school}/calendar?view=events` |
| `[organisationId]/evidence` | School | Merged into hub | `/khpos/{school}/priorities?view=evidence` |
| `[organisationId]/execution-control` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/human-potential-intelligence` | School | Merged into hub | `/khpos/{school}/performance?view=development` |
| `[organisationId]/ideas` | School | Merged into hub | `/khpos/{school}/announcements?view=ideas` |
| `[organisationId]/implementation` | School | Merged into hub | `/khpos/{school}/priorities?view=plan` |
| `[organisationId]/improvement` | School | Merged into hub | `/khpos/{school}/priorities?view=improvement` |
| `[organisationId]/issues` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/leadership-brief` | School | Merged into hub | `/khpos/{school}/performance?view=brief` |
| `[organisationId]/leadership-financial` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/learner-progress` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/learning-intelligence` | School | Merged into hub | `/khpos/{school}/performance?view=learning` |
| `[organisationId]/library` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/meetings` | School | Merged into hub | `/khpos/{school}/announcements?view=meetings` |
| `[organisationId]/network-pulse` | School | Merged into hub | `/khpos/{school}/performance?view=campuses` |
| `[organisationId]/onboarding` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]` | School | Existing Today alias | `/khpos/{school}/work` |
| `[organisationId]/parent-journeys` | School | Merged into hub | `/khpos/{school}/parents?view=enquiries` |
| `[organisationId]/parents` | School | Primary hub | `/khpos/{school}/parents` |
| `[organisationId]/people` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/performance` | School | Primary hub | `/khpos/{school}/performance` |
| `[organisationId]/playbooks` | School | Merged into hub | `/khpos/{school}/priorities?view=guides` |
| `[organisationId]/potential-development` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/priorities` | School | Primary hub | `/khpos/{school}/priorities` |
| `[organisationId]/records` | School | Merged into hub | `/khpos/{school}/reports?view=forms` |
| `[organisationId]/recruitment` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/reports` | School | Primary hub | `/khpos/{school}/reports` |
| `[organisationId]/reviews` | School | Merged into hub | `/khpos/{school}/priorities?view=reviews` |
| `[organisationId]/safeguarding` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/schools-campuses` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/skills-development` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/staff-accountability` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/staff-performance` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/staff-transition` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/standard` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/student-culture` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/system-integrity` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/teaching-presence` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/team` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/visitors` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/work` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/worldready` | School | Keep separate | `Own workflow or security boundary` |
| `[organisationId]/young-ceo` | School | Keep separate | `Own workflow or security boundary` |
| `admin/announcements` | Platform admin | Keep separate | `Restricted platform-wide authority` |
| `admin` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `admin/partnerships` | Platform admin | Keep separate | `Restricted platform-wide authority` |
| `admin/schools-campuses` | Platform admin | Keep separate | `Restricted platform-wide authority` |
| `hq/ask` | KAEC HQ | Keep separate | `Corporate-only role and workflow` |
| `hq/ideas` | KAEC HQ | Merged into hub | `/khpos/hq/meetings?view=ideas` |
| `hq/meetings` | KAEC HQ | Primary hub | `/khpos/hq/meetings` |
| `hq` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `hq/reports` | KAEC HQ | Keep separate | `Corporate-only role and workflow` |
| `hq/schools` | KAEC HQ | Keep separate | `Corporate-only role and workflow` |
| `join/[token]` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `page.tsx` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `partnership/[organisationId]` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `portfolio` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |
| `visitor-kiosk` | Entrance / other | Keep separate | `Login, visitor kiosk, partnerships, network or invitation scope` |

**Counts:** Keep separate 47 · Primary hub 7 · Merged into hub 16 · Existing Today alias 1. This audit intentionally leaves legitimate distinct workflows separate.
