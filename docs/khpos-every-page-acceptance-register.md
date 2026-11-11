# KHP-OS — every-page completion and acceptance register

**Release audit date:** 11 November 2026  
**Source:** `synsynlele/kaec-school-health-check`  
**Scope:** 71 route pages, with imported inner workspaces and shared layouts.

## What is verified
- School, HQ and platform-admin routes inherit one branded visual system (K logo, blue/mint colours, responsive controls, focus and card styling).
- All listed routes are inventoried in the JSX/route source audit; navigation routes are checked by automated tests.
- Particular workflows have received direct refinements, including older parent, culture, assets, council and campus pages, visitor records, large academic/skills/leadership pages, and long section navigation.
- Permissions, record history, human approval controls and data are not intentionally altered by the UX pass.

## What is **not** verified
- A static source audit is **not** evidence that the page is visually perfect. In particular, all below role-specific browser/device sign-off cells remain **Pending** until tested.
- No connected signed-in KHP-OS browser profile is available for completing teacher, school leader, corporate HQ and administrator journeys in this audit.
- The 71 routes include screens with many inner sections, tabs, dialogs and conditional forms. A route build proves that its code compiles, not that every role-specific state has been seen.

## Per-screen acceptance ownership
The **School Guardian / an authorised teacher tester** checks school-day, teaching, welfare, records and school-management routes using a safe test school. **A KAEC HQ Pathfinder** checks HQ workspaces without exposing learner-level confidential records. **An authorised platform administrator** checks restricted admin routes. Each tester records device, role, test step, result and screenshot or redacted evidence in an acceptance record. The founder should sign off only exceptions and release decisions, not individually click every screen.

## 71-route register
| Route | Family | Code/route inspection | Signed-in visual QA | Authorised workflow QA |
|---|---|---|---|---|
| `/khpos/[organisationId]/academic-assurance` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/academic-delivery` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/activation` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/announcements` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/ask` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/assets` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/availability` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/benchmarking` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/builder-projects` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/builders-council` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/calendar` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/campus-readiness` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/decisions` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/events` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/evidence` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/execution-control` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/human-potential-intelligence` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/ideas` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/implementation` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/improvement` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/issues` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/leadership-brief` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/leadership-financial` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/learner-progress` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/learning-intelligence` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/library` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/meetings` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/network-pulse` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/onboarding` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/parent-journeys` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/parents` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/people` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/performance` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/playbooks` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/potential-development` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/priorities` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/records` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/recruitment` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/reports` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/reviews` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/safeguarding` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/schools-campuses` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/skills-development` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/staff-accountability` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/staff-performance` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/staff-transition` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/standard` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/student-culture` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/system-integrity` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/teaching-presence` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/team` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/visitors` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/work` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/worldready` | School | Source audited | Pending | Pending |
| `/khpos/[organisationId]/young-ceo` | School | Source audited | Pending | Pending |
| `/khpos/admin/announcements` | Administration | Source audited | Pending | Pending |
| `/khpos/admin` | Administration | Source audited | Pending | Pending |
| `/khpos/admin/partnerships` | Administration | Source audited | Pending | Pending |
| `/khpos/admin/schools-campuses` | Administration | Source audited | Pending | Pending |
| `/khpos/hq/ask` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/hq/ideas` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/hq/meetings` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/hq` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/hq/reports` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/hq/schools` | KAEC HQ | Source audited | Pending | Pending |
| `/khpos/join/[token]` | Entrance / network | Source audited | Pending | Pending |
| `/khpos` | Entrance / network | Source audited | Pending | Pending |
| `/khpos/partnership/[organisationId]` | Entrance / network | Source audited | Pending | Pending |
| `/khpos/portfolio` | Entrance / network | Source audited | Pending | Pending |
| `/khpos/visitor-kiosk` | Entrance / network | Source audited | Pending | Pending |

## Required completion criteria
1. Every visible page and its inner tabs, accordions, dialogs and forms are inspected at 320px and 390px phone widths, tablet and desktop.
2. Check heading clarity, first primary action, correct permissions, safe loading, meaningful errors, keyboard focus, sorting/filtering, long tables and feedback after save.
3. Use a teacher, multi-role staff member, Guardian/Custodian, Pathfinder and HQ/admin role as applicable.
4. Verify the same records and approvals still work, including history and denied-role boundaries; do not use real confidential learner records during QA.
5. Every problem receives a reproducible route, role, device, expected/actual behaviour, assigned owner and retest status.
6. A screen becomes *Accepted* only when the relevant authority verifies the complete flow. **Source audited** alone must never be presented as visual approval.

Automated evidence is uploaded with each CI run as `khpos-ui-route-audit`: `khpos-every-screen-source-review.json` and `khpos-every-screen-acceptance.md`.

**Current route count:** {"School":56,"KAEC HQ":6,"Administration":4,"Entrance / network":5}.
