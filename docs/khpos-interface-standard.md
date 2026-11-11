# KHP-OS Institutional Interface Standard
**Version:** 2026-11-11 | **Scope:** all school, corporate HQ, administration, visitor, account and inner workspaces.

## Outcome
Any role should understand what to do, where to go next, and whether an action succeeded without asking the founder or a developer. Information architecture follows **user intent, not database tables**. A single shared system must support each additional school with no custom redesign.

## Non-negotiable operating rules
- Preserve the original bright KHP-OS logo and blue/mint brand; use semantic warning and danger colours only for actual meaning.
- Keep the fixed five-button school dock: Today · School day · Reports · Updates · More. Never insert a sixth tab.
- More has six task-oriented areas. School-day sign-in, temporary outing and visitors belong together, not in Teaching & Learning. No duplicated leave approval engine.
- Show one primary action per page or state. Put related but infrequent operations in progressively disclosed panels.
- Preserve school, campus, role, HQ and platform-admin authority boundaries. No UI change grants access; API approval and audit checks remain authoritative.
- Existing data, record versions, change history, visitor privacy, report audiences, human approvals and safeguarding remain untouched.

## Visual tokens
Use `khpos-platform-ui` for all KHP-OS routes, `khpos-hero` for school/management headings, `khpos-interface-card` for white content panels, `khpos-horizontal-nav` for overflowing tabs, and `khpos-interface-count` for numerical counts. Tokens live in `src/app/globals.css`; no new fonts, UI libraries or network-dependent assets are needed.

## Screen hierarchy
1. Clear contextual heading: institution, task, concise explanation.
2. Primary action or immediate status; don't bury it beneath decorative metrics.
3. Related quick actions only if distinct from the primary navigation.
4. Active records and decisions first; waiting and history retrievable, never silently deleted.
5. Progressive detail, notes, evidence, audit history and instructions.
6. Explicit empty, loading, save, error, permission-denied and retry states.

## Form and record patterns
- Prefer constrained choices (radio, checkbox, select) when valid, with a free-text explanation only when needed.
- Use an actual label for each field; preserve keyboard focus and obvious disabled states.
- Minimum 44px controls; 16px mobile form font, no accidental phone zoom or horizontal body overflow.
- Record queues use shared Active / Waiting / History controls, with search and sorting applied to the visible authorised list only.
- Action feedback distinguishes saving, saved and error; no disappearing records or false success before API confirmation.

## Devices and accessibility
Audit 320/360/390/430 CSS-px phones, tablet and desktop; dark and light system settings, 200% text zoom, touch, keyboard and screen reader. Navigation shows the selected destination even when tabs overflow horizontally. Respect bottom safe area and reduced motion. Keep tables inside their own scroll containers.

## Quality enforcement
Run `npm test`, route/source UI audit, `npm run lint`, `npm run typecheck` and `npm run build`. The source audit inventories **all** KHP-OS routes and reachable inner components. It deliberately reports manual visual states as **not tested**; automated tests never certify signed-in screenshot appearance.

## Required signed-in acceptance before declaring every pixel perfect
Perform the generated `artifacts/khpos-ui-manual-test-matrix.md` with representatives of teacher, multi-role staff, school guardian/custodian, HQ Pathfinder, leadership and platform administrator. Test full create/review/edit/archive/retrieve journeys, visitor kiosk permissions, mobile navigation, confidential records, and zero cross-school access. Annotate any deviations and do not label visually untested screens as approved.

This standard is a permanent product constraint for future features and school onboardings—not a one-time redesign checklist.
