# Prompt report delivery

Active report schedules generate available periods when created/activated and on reporting/notification reads. Paused schedules and future reporting periods remain unavailable until activation/their start date; no change silently activates a schedule.

Previously, report attention suppressed an assigned draft until the deadline was within one day. Today displayed only totals and both report and bell screens polled every three minutes. Background push checked every 30 minutes during notification hours.

Available owned drafts now enter attention immediately, along with returned work and authorised submitted reviews. Today includes up to five direct actions with report title, reporting dates, deadline and Complete/Correct/Review link. Current periods precede older outstanding drafts. Summaries still count all outstanding work. The compact API returns only task metadata, never report answers or event history.

Visible report screens and the active notification bell refresh every 30 seconds; focus/resume and same-school activity refresh promptly. Hidden tabs do not poll. Independent notification sources load concurrently instead of serially. Request sequencing rejects stale list responses across writes. Editing or saving another teacher's report remains prohibited.

School report actions are push-eligible when available, rather than only near deadline. Push content remains generic and existing per-device delivery de-duplication applies. The existing authenticated push job is reused every five minutes, 06:00–17:55 Africa/Lagos, Monday–Saturday. Existing quiet hours and subscription requirements remain. Device receipt and sound depend on permission, connectivity and phone settings; server scheduling is not a guarantee of physical receipt.

Verification: full reporting SQL fixture runs both privacy and delivery migrations; a report due seven days later is immediately returned to its owner and is hidden from peers/reviewers while in draft. The fixture verifies the scheduler preserves job ID and authenticated command. Actual compact component tests verify direct tasks, 30-second visible polling, resume/activity refresh and school isolation. Alert tests verify returned work is push-eligible before its deadline and completed/non-owner rows produce no alerts.
