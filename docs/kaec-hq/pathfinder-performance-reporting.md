# KAEC HQ — School Pathfinder Performance and Corporate Reporting
Version 0.1 | Delivery guidance, not a pre-approved performance policy

## Meaning of accountability
Every licensed partner school is assigned a KAEC-NG School Pathfinder only after the actual supervision
agreement is checked by authorised leaders. Supervision should improve the school rather than generate
attendance reports for their own sake. Do not conflate visit duration, login events or volume of messages
with educational improvement or solved problems. Only verified evidence merits outcome credit.

## Supervision sequence
The Alliance Catalyst/Vision Custodian schedules a **virtual check** or **on-site visit** with a
specific school, representative, date/time, objective and expected output.
The assigned Pathfinder sees the activity in that school's schedule. A virtual session is completed with
a work summary, problems, solutions, evidence references and next action; it does not require artificial
check-in or check-out. An on-site visit requires voluntary **Check in on arrival**, then **Check out & report work**.
The server records these two event timestamps. Check-in is an accountable self-attestation, not GPS,
school-host confirmation or continuous tracking. Visit duration is not used as performance rank.
The supervisor can assess a completed session independently; the person who created/attended the
session cannot approve their own result. Late starts, unfinished visits or cancellations are visible
for humane follow-up, not automatic disciplinary findings.
Significant problems can also be logged under the school's agreed commitments and tracked to verified closure.

## Reporting hierarchy (proposal, must be staffed and accepted)
- School Custodian or Guardian → own school operating leadership through the existing KHP-OS process.
  For partner supervision, **only approved school summaries** reach the assigned School Pathfinder;
  restricted child/safeguarding records never become general HQ reports.
- KAEC School Pathfinder → Alliance Catalyst (interim Vision Custodian).
- Alliance Catalyst → System Steward or Vision Custodian.
- Product Architect / Movement Curator → System Steward (or Vision Custodian).
- System Steward → Vision Custodian.
- Finance Steward → Vision Custodian for corporate financial management summaries.
- Vision Custodian → shareholders/board for formally required reserved/annual reporting through actual
  governance authority, not a fabricated in-app board appointment. Routine corporate summaries can
  be sent to a separately appointed System Steward but must not be confused with board approvals.
All recipients and reporters must be real activated KAEC corporate members with different identities.

## Reporting Centre operations
A corporate supervisor configures a reporting line (name, expectations, named reporter, independently
appointed reviewer, school scope where relevant, cadence, **first due date**). Cadences are:
daily, weekly, monthly, quarterly, yearly. Do not assign every cadence to every person.
Typical roles:
- Daily: brief exception/work log only when operational intensity warrants it.
- Weekly: School Pathfinder supervised schools, interventions, challenges and upcoming obligations.
- Monthly: Alliance Catalyst school portfolio and product/finance workstream owner summaries.
- Quarterly: System Steward operating effectiveness, partner-school transformation and impact analysis.
- Yearly: Vision Custodian's corporate annual review/board submissions under legal arrangements.

The next reporting cycle is automatically created **on submission**, preserving calendar anchors
(January 31 → February 28 → March 31), with a unique period constraint to prevent duplicate reporting.
An overdue period remains overdue until submitted. New report due dates are visible in the dashboard,
even before a report is written. Submitted reports are pending review until accepted/returned with
a written reason by the actual recipient. A returned period is corrected **in place**, preserving
auditable history; the following cycle is not skipped. Changing cadence or recipient after real
submissions requires pausing the prior line and creating a new properly approved line.
No automatic SMS/WhatsApp or push notifications have been added. Report scheduling is a due queue;
it is not a cron job that sends external communications.

## Suggested first operating setup
1. Confirm actual School Health Check and supervision contracts for the two already-registered
   partner schools; set up KHP-OS scope and real school liaisons.
2. Appoint Alliance Catalyst, System Steward and School Pathfinders based on availability and
   actual delegated responsibilities, not fictional placeholders.
3. Create one weekly Pathfinder report per assigned school with the Alliance Catalyst as recipient.
4. Create one monthly Alliance-to-System-Steward portfolio report and one monthly
   System-Steward-to-Vision-Custodian operational review.
5. Schedule only real physical visits, default to remote checks, and review work evidence.
6. Add quarterly strategy and yearly corporate reports only with real recipients and authorised governance.

## Security and acceptance
Service-role-only tables with RLS and append-only audit records. All requests require validated bearer tokens
and active corporate appointments. A Pathfinder sees only their assigned partner school. There is no
automatic access to school-private KHP-OS records, no geolocation monitoring, no automatically generated
license terms, no real-world payments or legal approvals. Dashboard activity counters are capped to the
last loaded records and are not network-wide historical totals.
Integration tests cover database grants, atomic scheduling and monthly rollover, unique periods,
review/return cycle, session attendance state and audit history. Production validation requires actual
corporate member/recipient user acceptance after rollout.
