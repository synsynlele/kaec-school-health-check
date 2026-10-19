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
export function captureAttendanceLocation(): Promise<LocationCapture> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.resolve({ status: "unsupported" });
  return new Promise(resolve => {
    let finished = false;
    const finish = (value: LocationCapture) => {
      if (finished) return;
      finished = true; clearTimeout(timer); resolve(value);
    };
    const timer = setTimeout(() => finish({ status: "timeout" }), 15000);
    try {
      navigator.geolocation.getCurrentPosition(p => finish({
        status: "captured", latitude: p.coords.latitude, longitude: p.coords.longitude,
        accuracy: p.coords.accuracy, capturedAt: new Date(p.timestamp).toISOString(),
      }), e => finish({ status: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
    } catch { finish({ status: "unavailable" }); }
  });
}
