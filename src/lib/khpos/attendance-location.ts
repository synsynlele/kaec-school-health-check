export type LocationCapture = {
  status: "captured" | "denied" | "unavailable" | "timeout" | "unsupported";
  latitude?: number; longitude?: number; accuracy?: number; capturedAt?: string;
  reason?: string;
};
export type AttendanceLocation = {
  status: string; receivedAt: string; capturedAt?: string;
  latitude?: number; longitude?: number; accuracy?: number;
  distance?: number; radius?: number; reason?: string;
  campus?: { latitude: number; longitude: number; radius: number; updatedAt: string };
};
export type CampusLocation = {
  id: string; name: string; canManage: boolean;
  location: null | { latitude: number; longitude: number; radius: number; updatedAt: string };
};
export const LOCATION_LABELS: Record<string, string> = {
  within_boundary: "Within campus boundary", outside_boundary: "Outside campus boundary — review",
  boundary_uncertain: "Near boundary — review accuracy", poor_accuracy: "Low location accuracy — review",
  campus_unset: "Campus boundary not configured", stale: "Location too old — review",
  denied: "Location permission declined", unavailable: "Location unavailable",
  timeout: "Location request timed out", unsupported: "Location unsupported",
  not_recorded: "No location evidence recorded",
};
export function needsLocationReview(location: AttendanceLocation | null | undefined) {
  return !!location && location.status !== "within_boundary";
}

/** One reading in direct response to an attendance tap. Never watches the user. */
export function captureAttendanceLocation({ timeoutMs = 12000 }: { timeoutMs?: number } = {}): Promise<LocationCapture> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.resolve({ status: "unsupported" });
  return new Promise(resolve => {
    let finished = false;
    const finish = (value: LocationCapture) => {
      if (finished) return;
      finished = true; clearTimeout(timer); resolve(value);
    };
    const timeout = Math.max(1000, Math.min(30000, timeoutMs));
    const timer = setTimeout(() => finish({ status: "timeout" }), timeout + 3000);
    try {
      navigator.geolocation.getCurrentPosition(p => finish({
        status: "captured", latitude: p.coords.latitude, longitude: p.coords.longitude,
        accuracy: p.coords.accuracy, capturedAt: new Date(p.timestamp).toISOString(),
      }), e => finish({ status: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 0, timeout });
    } catch { finish({ status: "unavailable" }); }
  });
}

export function locationCaptureHelp(status: LocationCapture["status"]) {
  switch (status) {
    case "denied": return "Location permission was blocked. Enable location for KHP-OS or Chrome in your phone settings and allow it for www.kshc.name.ng, then retry. You can also enter the campus coordinates manually.";
    case "timeout": return "The phone took too long to find its position. Turn on Location and precise location, move near a window or outdoors, then retry. You can also enter the campus coordinates manually.";
    case "unsupported": return "This browser cannot provide location. Open KHP-OS in an up-to-date browser or enter the campus coordinates manually.";
    default: return "The phone could not find its position. Check that Location is on and precise location is allowed, then retry outdoors or enter the campus coordinates manually.";
  }
}
