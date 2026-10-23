# KHP-OS simplicity audit and upgrade — 23 October 2026

## Decision rules

Keep a capability because it serves a distinct school need, even when usage is low. Combine entrances when users are doing related parts of one job. Remove repeated actions and internal development language. Preserve saved links, records, required approvals and confidentiality.

## Audit scope and result

Reviewed the school route inventory and the 147 TypeScript/TSX files under the KHP-OS page and component directories, including school operations, school improvement, network administration and KAEC HQ. Supporting tool instructions and shared display labels were also reviewed. This is a source/workflow audit; it is not a claim that every authenticated role was manually exercised on a physical phone.

The school menu now has **22 distinct entrances instead of 53**. All 53 original routes remain reachable, with nine contextual work areas grouping related pages. Search finds both main entrances and individual pages. The mobile area selector keeps long groups from becoming rows of small tabs; desktop uses wrapping links. Navigation stays within the current school, and choosing a page does not grant permission to its records.

## Consolidation

- Reports and task forms/checklists: one Reports & forms entrance, two clearly distinguished pages.
- Staff records, roles/sections, joining steps, hiring, leave, support, concerns and transitions: one Staff & roles area.
- Attendance/lessons, teaching plans, assessments and learner support: one Teaching & learning area.
- Potential, skills, leadership/money, Young CEO, projects and school-leaving preparation: one Learner development area.
- Current-parent follow-up and prospective-family enquiries/admissions: one Parents area.
- Priorities, action plans, evidence, reviews, reassessment and guides: one School improvement area.
- Performance measures, meeting brief, campus summary, private school comparisons and integration summaries: one School results area.
- Campus requests/directory and campus readiness: one Schools & campuses area.
- Activation, KAEC Standard, task setup and system checks: one School settings area.

Safeguarding remains separate. Staff conduct remains distinct from coaching. Private individual records are not merged into school-level summaries. Scheduled personal reports remain distinct from forms attached to a task; their separate ownership, audit history and review rules remain in force.

## Genuine duplication removed

Today no longer repeats work and verification cards already shown in its task/reviewer lists inside the attention summary. That summary now covers other issues and decisions. Occasional manual-start procedures remain available behind a single expandable control. Duplicate Reports/Forms cross-buttons were removed because both pages now share one contextual area.

## Plain English and form clarity

Hundreds of headings, actions, instructions and empty states were rewritten. Development codes such as Operations O7 and O16 were removed from product instructions. Examples: Institutional Control Library → School library; Execution Control → Task setup; Cadence → How often; Outcome contract → Expected result; People & Staff → Staff.

A shared display-label function makes stored workflow states readable without changing their database values. Ask KHP-OS now uses plain-language answer instructions and fallback messages; its school-results question still reaches the scoped results service. At least 281 formerly placeholder-only fields now retain visible labels, with conditional/shared inputs covered too. Week targets now explicitly label the week, scheme reference, learning target, start date and end date, and explain that lesson times belong in Attendance & lessons.

Desktop page headings and instructions were restored: the old global rule hid some entire page headers. Search labels, keyboard focus handling, an escape action, a skip link and larger menu-close controls improve navigation accessibility. Label colour inherits its context so dark admin panels remain readable.

## Data and authority boundaries

No database migration, data deletion, changed access grant, automatic approval or automatic campus activation is part of this release. Existing API routes, payload fields, stored statuses and server-side permission checks are preserved. Approved documents and staff-authored historical content are not rewritten by a display-copy change.

## Verification

Full regression suite, lint, TypeScript checks and production build. Added behavior checks for 53 routes through 22 entrances, grouped page search, current-page selection, mobile selector navigation, school-scoped links and readable status labels. Added a source accessibility guard against placeholder-only inputs. Existing privacy, onboarding, position lifecycle, reporting, attendance, safeguarding and HQ SQL tests remain part of the full suite. Legacy copy assertions were updated to the new visible wording while API, SQL and authorization contracts remain checked.

Browser visual inspection could not be completed: the cloud browser returned Site Unavailable, and the local browser binary download was unavailable. Component checks and production HTTP/runtime checks must not be represented as physical-device visual approval.

## Complete school route map

| Page | Work area | Main entrance |
| --- | --- | --- |
| School overview (overview) | Direct page | overview |
| Priorities (/priorities) | School improvement | /priorities |
| Action plan (/implementation) | School improvement | /priorities |
| Step-by-step guides (/playbooks) | School improvement | /priorities |
| Evidence & proof (/evidence) | School improvement | /priorities |
| Review progress (/reviews) | School improvement | /priorities |
| Check improvement (/improvement) | School improvement | /priorities |
| School setup (/activation) | School settings | /activation |
| Task setup (/execution-control) | School settings | /activation |
| Meeting brief (/leadership-brief) | School results | /performance |
| Calendar (/calendar) | Direct page | /calendar |
| Ask KHP-OS (/ask) | Direct page | /ask |
| My getting started (/onboarding) | Staff & roles | /people |
| System checks (/system-integrity) | School settings | /activation |
| KAEC Standard (/standard) | School settings | /activation |
| Reports (/reports) | Reports & forms | /reports |
| Announcements (/announcements) | Direct page | /announcements |
| Today (/work) | Direct page | /work |
| Issues & help (/issues) | Direct page | /issues |
| Approvals & decisions (/decisions) | Direct page | /decisions |
| School results (/performance) | School results | /performance |
| Staff (/people) | Staff & roles | /people |
| Hiring (/recruitment) | Staff & roles | /people |
| Leave & cover (/availability) | Staff & roles | /people |
| Staff support (/staff-performance) | Staff & roles | /people |
| Staff concerns & praise (/staff-accountability) | Staff & roles | /people |
| Staff changes & leaving (/staff-transition) | Staff & roles | /people |
| Teaching plans (/academic-delivery) | Teaching & learning | /teaching-presence |
| Attendance & lessons (/teaching-presence) | Teaching & learning | /teaching-presence |
| Assessments & exams (/academic-assurance) | Teaching & learning | /teaching-presence |
| Learner support (/learner-progress) | Teaching & learning | /teaching-presence |
| Learner development (/potential-development) | Learner development | /potential-development |
| Skills (/skills-development) | Learner development | /potential-development |
| Leadership & money (/leadership-financial) | Learner development | /potential-development |
| Young CEO Hub (/young-ceo) | Learner development | /potential-development |
| Builder Projects (/builder-projects) | Learner development | /potential-development |
| Life after school (/worldready) | Learner development | /potential-development |
| Builders Council (/builders-council) | Direct page | /builders-council |
| Behaviour & wellbeing (/student-culture) | Direct page | /student-culture |
| Safeguarding (/safeguarding) | Direct page | /safeguarding |
| Roles & sections (/team) | Staff & roles | /people |
| School library (/library) | Direct page | /library |
| Parents (/parents) | Parents | /parents |
| Schools & Campuses (/schools-campuses) | Schools & campuses | /schools-campuses |
| Campus checks (/campus-readiness) | Schools & campuses | /schools-campuses |
| Equipment & repairs (/assets) | Direct page | /assets |
| Events & Programmes (/events) | Direct page | /events |
| Enquiries & admissions (/parent-journeys) | Parents | /parents |
| Campus summary (/network-pulse) | School results | /performance |
| Forms & checklists (/records) | Reports & forms | /reports |
| School comparisons (/benchmarking) | School results | /performance |
| Learning summary (/learning-intelligence) | School results | /performance |
| Development summary (/human-potential-intelligence) | School results | /performance |
