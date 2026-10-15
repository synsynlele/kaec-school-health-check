# KHP-OS plain-language standard (staff-facing screens)

## Who this is for
All KHP-OS school users, including new teachers, staff with several positions, School Guardians, School Custodians and non-technical staff. Never assume readers know KAEC product codes or internal developer language.

## Rule 1 — Every page answers three questions
1. **What is this page for?** Use a familiar name and one short sentence.
2. **What do I need to do now?** Show an action with the person, date/time, and current status.
3. **What happens after I do it?** Explain where it goes next and who can act.

If the page is read-only for this user, say why and name the person who can take the next step.

## Rule 2 — Use clear labels on buttons
- Say **Record school arrival**, not `school_in`.
- Say **Start this class**, not `class_in`.
- Say **Finish class and record lesson**, not `class_out`.
- Say **Record school departure**, not `school_out`.
- Say **Send for approval**, not `Submit` without a destination.
- Say **Review and approve** when the reader is the approver.
- Say **Save changes** when editing an existing item; **Create** only for a new one.
- Say **Archive record** instead of **Delete** when no irreversible deletion occurs.

## Rule 3 — Explain statuses in human terms
| Technical state | User-facing meaning |
| --- | --- |
| draft | Not yet submitted |
| pending / in_review | Waiting for review |
| approved | Approved and ready to use |
| active | In use |
| awaiting_verification | Waiting for someone to check |
| blocked | Another step needs to be completed first |
| overdue | Past its due time |
| archived | Kept for records; not in daily use |
| removed | Hidden from everyday use; can be restored |

Status should always appear near the relevant item. If action is blocked, explain who must complete the prior step.

## Rule 4 — Make time and people specific
Display **school date** and **recorded time**, not only a vague status. Attendance uses Nigeria local time (WAT). Class and school times are different facts. The app must never treat school attendance as evidence that a class was taught.

Reminder schedules must reflect actual assigned timetables. Do not send a teacher alerts for another teacher's class. Stop displaying completed attendance as due, and stop sending reminders for it.

## Rule 5 — Write helpful errors
Use `What happened. Why. What to do next.`
Examples:
- "School check-in has not been recorded. Record your arrival before starting this class."
- "The class check-in window has closed. Tell your School Guardian so they can review the missed record."
- "The selected term already has teaching records. Create a new revision instead of changing the class identity."
- "You cannot approve this report because it is assigned to another position."

Do not show SQL errors, internal identifiers, stack traces, vague "Invalid operation", or product-stage labels.

## Rule 6 — Multi-position staff
Only show work relevant to the user's school and assignments. Display the **position responsible** and **person who approves** whenever relevant; let multi-role staff filter work by position without losing their other responsibilities.

## Rule 7 — Confirmation and feedback
Before an irreversible or high-impact action, say exactly what will change. After saving, show the success state with recorded time or the next approver. Never show "Completed" before the server confirms.

## Apply across KHP-OS
Use this as the copy review checklist for every future KHP-OS feature or revision. Check navigation labels, page introductions, field names, buttons, empty states, approval flows, errors, notifications and mobile layouts. The attendance-first Today release is the first implementation pass; other sections should be audited and updated in controlled batches, without changing user permissions implicitly.
