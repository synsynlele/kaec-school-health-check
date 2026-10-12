/**
 * Tell the current school shell that a write has changed action-required state.
 * No identifiers or evidence are broadcast beyond the school ID.
 */
export const KHPOS_ACTIVITY_CHANGED = "khpos:activity-changed";

export function announceKhposActivityChanged(organisationId: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(KHPOS_ACTIVITY_CHANGED, { detail: { organisationId } }),
    );
  }
}
