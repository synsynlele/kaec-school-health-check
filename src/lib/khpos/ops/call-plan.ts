/** The host starts each timer when joining Meet. It is an estimate, not Google's call clock. */
export function callProgress(startedAt: string | null, activePart: number, count: number, nowMs: number) {
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const elapsedSeconds = Number.isFinite(started) ? Math.max(0, Math.floor((nowMs - started) / 1000)) : 0;
  return {
    elapsedSeconds,
    remainingSeconds: Math.max(0, 3600 - elapsedSeconds),
    warn: activePart > 0 && Number.isFinite(started) && elapsedSeconds >= 3300,
    hasNext: activePart < count,
    nextPart: activePart + 1,
  };
}
export function meetingEnd(startsAt: string, hours: number) {
  return new Date(Date.parse(startsAt) + hours * 3600000).toISOString();
}
export const MEET_JOIN_URL = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
