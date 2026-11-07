/** A meeting leaves the current list at its end time or immediately on closure. */
export function isCurrentMeeting(meeting: { status: string; ends_at: string }, nowMs = Date.now()) {
  return (meeting.status === "scheduled" || meeting.status === "live") && Date.parse(meeting.ends_at) > nowMs;
}
