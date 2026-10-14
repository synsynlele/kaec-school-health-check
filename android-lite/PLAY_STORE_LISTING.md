# KHP-OS — first Google Play listing copy (draft for operator review)

**App name:** KHP-OS — Schools (verify this fits Play's title character limit)
**Android package:** `ng.name.khpos.lite`
**Suggested category:** Education
**Operator / developer:** KAEC-NG
**Website:** https://www.kshc.name.ng/
**Privacy:** https://www.kshc.name.ng/privacy
**Account deletion:** https://www.kshc.name.ng/delete-account
**Support:** https://www.kshc.name.ng/contact

## Short description (under 80 characters)

Run school operations, manage responsibilities and track improvement.

## Full description (under 4,000 characters)

KHP-OS makes school responsibilities clear and keeps everyday operations accountable.

Developed by KAEC-NG, KHP-OS is an operating workspace for approved partner schools and their authorised school teams. It brings daily work, follow-up, evidence and improvement into one place.

With KHP-OS, school leaders and staff can:

- Open Today to see assigned work and tasks needing attention.
- Follow school issues and decisions through the right reporting and approval lines.
- Track daily school readiness, academic delivery, skills programmes and staff development.
- Record operational reports, checklists, evidence and verified outcomes.
- Coordinate parent concerns, facilities and maintenance follow-up.
- Keep active cases separate from completed work in History.
- Protect sensitive safeguarding cases through restricted, designated access.

Each school has its own protected workspace. Staff holding more than one authorised position can manage their responsibilities with one account.

An active KAEC-NG school partnership and an authorised staff account are required for school operations. New schools can begin with the KAEC School Health Check.

A network connection is required. KHP-OS does not replace direct safeguarding or emergency response.

KAEC-NG — Discover. Develop. Deploy Potential.

## First release notes (en-US)

<en-US>
Introducing KHP-OS for school teams: Today, role-based responsibilities, issues, decisions, operational records, verifications, and History for completed work. Improved navigation and school-scoped access for authorised users.
</en-US>

## Reviewer instructions — school-gated app

The app opens to `/khpos` where reviewers can sign in to an authorised school account, or view the free KSHC flow. The actual KHP-OS school workspace requires an approved KAEC-NG school partnership and an active staff appointment.

**Before submission, create a deliberately limited, non-production-data reviewer account and a test partner school** with example content and the permissions needed to explore the app. Enter its reviewer credentials or an alternate supported sign-in method in the Play Console App access declaration. Do not put credentials in this repository, release notes or listing text.

When validating the TWA, use the **Play App Signing certificate** (not merely the local upload certificate) to check Android Digital Asset Links for the package and domain.

## Data safety operator mapping — review before answering Play Console

Account and school records can include email, name, school association, staff/parent/learner information, user-created text, school activity records, photos/files if uploaded through enabled modules, attendance or performance evidence, and restricted safeguarding/welfare information. Diagnostic and AI features may process submitted information through configured service providers. Auth, hosting and operating platforms process technical/security information. Do not claim the app collects *no* personal/learner information.

**Do not guess Play Console checkboxes:** compare current production API payloads, SDK dependencies, data flows, actual disclosure policies, security practices and retention with every Play Data safety category. Confirm whether any health-related declaration applies to the welfare and first-aid features. The service is intended for school personnel, but school records can concern minors.

Review account deletion, privacy, Data safety, target SDK API 36, Play App Signing/assetlinks, content rating, app access, screenshots, graphic, contact and availability. Complete all declarations in the Console from verified product facts; no Play Console submission has been performed automatically.
