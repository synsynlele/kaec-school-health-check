import { LOCATION_LABELS, needsLocationReview, type AttendanceLocation } from "@/lib/khpos/attendance-location";

export function AttendanceLocationEvidence({ location, label }: { location?: AttendanceLocation | null; label: string }) {
  return <div className={"mt-2 rounded-lg p-2 text-xs leading-5 " + (needsLocationReview(location) ? "bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-700")}>
    <strong>{label}:</strong> {LOCATION_LABELS[location?.status ?? "not_recorded"] ?? "Location needs review"}
    {location?.accuracy != null && <span> · Accuracy ±{Math.round(location.accuracy)} m</span>}
    {location?.distance != null && <span> · {Math.round(location.distance)} m from campus pin · boundary {location.radius} m</span>}
    {location?.latitude != null && location.longitude != null && <p className="break-words">
      Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)} · <a className="font-bold underline" href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location.latitude + "," + location.longitude)} target="_blank" rel="noopener noreferrer">View location on map</a>
    </p>}
    {location?.reason && <p><strong>Explanation:</strong> {location.reason}</p>}
  </div>;
}
