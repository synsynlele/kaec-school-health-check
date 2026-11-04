# Private meetings: pilot release

Status: Phase 1 is released through PR #115, with setup diagnostics in PR #116. Automatic Google link creation remains under signed-in pilot verification.

## User journey

Open **Meetings & updates → Private meetings** in a school workspace. An authorised school leader schedules a meeting, writes its agenda, selects existing school/HQ accounts and chooses one to six hours. For voice/video, prepare one distinct Google Meet link per hour, either automatically after Google consent or by pasting existing links. The host is included automatically. A copied room link is useful for HQ participants; it does not grant access to anyone else.

Invited participants discuss the agenda in the room. The host records decisions and assigns follow-ups with deadlines. Each follow-up creates one existing Today work item requiring completion evidence. Its actual task status is shown back in the meeting. Closing or cancelling makes the room read-only and preserves the record; it does not cancel previously agreed tasks.

## Included

- Private school-hosted meetings with explicit school/HQ invitations.
- Scheduled start/end times, agenda, text messages and Google Meet links.
- One to six hourly call parts, a shared host-controlled active part, estimated countdown and warning after 55 minutes.
- Duplicate/retried starts do not reset the timer; parts cannot be skipped.
- Optional Google Meet REST API link creation using the host’s short-lived Google token. Tokens are neither stored nor logged by the new server code. Partial successes remain available if a later link fails.
- The unsaved meeting draft is kept in browser session storage for up to 30 minutes through Google consent; it is restored only for the same signed-in KHP-OS user, then removed.
- One Realtime channel for the selected room watches messages and shared call progress; it is removed on navigation.
- A 30-second fallback refresh while visible; no background polling while hidden.
- Host-controlled decisions, follow-ups and meeting status.
- Existing in-app alert integration for school participants and existing Today task alerts.
- Database checks for current membership/partnership, invited-room access and active task-owner assignments.
- RLS on all new tables; authenticated clients can read only meeting/message rows authorised by current invitation and membership. Mutations use the existing authenticated API/service-role RPC pattern.
- Transactional task creation, caller-generated IDs for duplicate retry protection, and audit events without message bodies.
- Bounded queries: latest 100 rooms, messages, decisions and actions; up to 50 selected participants.

## Pilot limits

HQ members join by invitation to a school-hosted room. Standalone corporate HQ rooms, account-free external guest access, meeting edits/rescheduling, recurring meetings, full history pagination, recordings/transcripts and embedded calling are outside this release. Decisions/task statuses refresh through the fallback check; chat and shared call-part changes also update through Realtime. No new media server or paid calling dependency is added. Existing Supabase/Vercel limits and participants' data charges still apply. Device-push delivery has not been verified. KHP-OS cannot silently transfer participants between external Google Meet calls, start a conference without someone joining, or know Google’s actual call timer. Each person must leave the old call and tap the current joining button. Timers start explicitly when the host is ready to join, rather than from the scheduled start.

## Google setup

Automatic creation requires the Google Meet API enabled in the existing Supabase Google sign-in project, and the host consenting to `https://www.googleapis.com/auth/meetings.space.created`. Google classifies this as a sensitive scope; the OAuth app’s audience/testing/verification settings must permit the intended hosts. The existing Google/Supabase sign-in callback is reused. The new endpoint accepts a short-lived provider token in a header, validates KHP-OS leadership first and creates at most six meeting spaces per request using Google’s documented empty request body. New calls inherit the host’s Google Meet admission settings; KHP-OS does not override those settings or change existing calls. KHP-OS room invitations govern access to app records, while Google Meet controls admission to the external call. It stores no Google refresh token. An expired or unscoped Google token requires renewed consent. Manual prepared links remain available if automatic creation is unavailable. Live Google consent and actual API creation have not been verified in the owner’s project.

Reference: https://developers.google.com/workspace/meet/api/guides/authenticate-authorize

## Validation

`npm run test:meetings` executes the migration in PGlite and checks school isolation, explicit HQ access, invalid invitations, host-only outcomes, membership revocation, message deduplication, atomic Today actions, closure, audit events and authenticated message/meeting RLS. It also verifies hourly plan validation, distinct URLs, host-only sequential handoff, shared state, retained discussion and timer retry safety. `scripts/test-meeting-call-plan.mjs` checks warning boundaries and Google API requests using mocked responses, including expired permission, partial creation, timeout and invalid URLs. The existing suite, type checker, lint and production build are also run. Production column compatibility was inspected read-only. No authenticated production browser test has been performed.

## Release sequence

1. Push the approved branch to the existing repository and open a review PR. The owner approved GitHub publication on 4 November 2026.
2. Review and apply `supabase/migrations/20261104124230_private_meeting_rooms.sql` followed by `supabase/migrations/20261104130054_meeting_call_parts.sql` to the confirmed KHP-OS database using the production migration workflow. Verify the Realtime publication and database advisors.
3. Deploy once, preserving the Vercel quota. No additional environment variables are required beyond the existing Supabase settings.
4. Smoke-test with a school leader, an invited teacher, an invited HQ member and an unrelated account. Verify live text on two devices, unauthorised denial, Today assignment/evidence, alerts, closure and a two-part Google Meet handoff on Android, including a delayed first start, fallback refresh, same-part retry and uninterrupted text/decisions. Verify Google consent and link generation separately before claiming automatic creation is active.
5. Pilot with HQ and the two partner schools before expanding scope.

The host and assigned staff own follow-through. The founder need not approve or chase each ordinary meeting action.
