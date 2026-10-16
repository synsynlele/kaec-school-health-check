# School Reports

School navigation: **More → School operations → Reports**. The Today card shows personal open, overdue and review counts. Existing process-linked reports, checklists and evidence remain in Records & Evidence, with links between both areas.

## Set up reporting

1. An authorised school leader opens **Report types & schedules → Create report type**.
2. Select school/campus/section scope, submitter role, designated reviewer role and schedule.
3. Name the report, explain its purpose and choose the fields needed. Supported answers: short/long text, numbers, dates, Yes/No, choices and HTTPS document links. Up to 30 fields. Document uploads are not part of this release.
4. Choose the period start, optional end date, days allowed after period end and deadline time (Africa/Lagos).
5. Save. Each eligible active position receives its own recurring period request. No school report types are automatically seeded: school leadership decides what staff must report.

Schedules: daily (including weekends), weekly (seven days from the configured anchor), calendar monthly/quarterly/yearly, every N days, academic termly, or repeatable one-off logs. Termly uses active/closed school term dates from Academic Delivery; shared school terms can serve campus-specific reporting types. Existing school and campus term scopes are respected. Resuming a paused schedule skips paused periods and preserves its calendar/weekly anchor.

## Submit and review

- Staff open **Reports & history**, complete a request, save a draft and submit to the reviewer. One-off reports start under **Log a report**; repeated entries are allowed.
- Reviewers can accept or return a submission with correction notes. Accepted reports can be returned for a documented correction; direct edits to accepted/submitted answers are blocked.
- Every submission and review preserves its answers and history. Conflicting edits are rejected rather than silently overwriting newer work.
- Owners can withdraw one-off drafts/submissions with a reason. Recurring report requirements can only be waived by the designated reviewer; history remains.
- Filter by title/submitter, status, report type and reporting dates. Results paginate at 50; historical submissions remain stored.

## Permissions and configuration gaps

School Custodians manage schoolwide types; School Guardians manage their assigned campus; Sectional Promoters and Academic/Skill Inspectors manage their assigned section, according to the existing explicit scope helper. A title alone does not grant unscoped access.

Report content and revision answers are available only to the current owner and eligible designated reviewer covering the report's campus/section. Managing a type grants totals, not automatic access to its content. Cross-school access, peer browsing, self-review (even with multiple roles), inactive membership and moved/disabled position access are denied server-side. Report assignment snapshots preserve the original owner's user and scope.

If the reviewer role has no eligible active assignment, the report shows a configuration warning; the school must assign the reviewer. There is no automatic fallback to the founder. Sensitive safeguarding/personnel case details belong in their specialist protected workflows.

Form edits and deadline changes apply to future generated requests. Existing requests keep their saved form/version/deadline/reviewer. To change audience, reviewer or cadence, pause/archive the old type and create a replacement. Pausing/archiving stops generation, not completion/review of existing requests.

## Scheduling, privacy and delivery

Period generation is idempotent and runs when authorised Reports/Today/notification feeds are read, including the existing scheduled push pipeline. A lightweight counts/action feed avoids transferring report answers into Today or notification payloads. Due-soon, overdue, returned and review actions appear in the in-app feed. Device push uses the existing school delivery window and device permissions/subscriptions; it is not guaranteed immediate delivery. No report text is put into push previews.

Tables have RLS enabled with client privileges revoked; service-only RPCs enforce active membership, current positions and scope. Tests run the actual migration against an isolated PostgreSQL engine.

## Release checks

Run `npm run test:reporting-centre`, `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. Before merging, apply and verify the migration against the intended production schema through the authorised Supabase connection, then release the matching application commit. Do not deploy the navigation/API before the database migration is ready. Physical-device rendering and push require device testing.
