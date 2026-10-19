/** Per-screen gate: a stale read must never replace a completed attendance write. */
export function createAttendanceRefreshGate() {
  let version = 0, writing = false;
  return {
    startRead() { return writing ? null : ++version; },
    canApplyRead(read: number) { return !writing && read === version; },
    beginWrite() { if (writing) return false; writing = true; ++version; return true; },
    finishWrite() { writing = false; },
  };
}
