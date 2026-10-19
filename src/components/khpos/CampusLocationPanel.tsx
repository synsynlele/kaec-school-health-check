"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { captureAttendanceLocation, locationCaptureHelp, type CampusLocation } from "@/lib/khpos/attendance-location";

export function CampusLocationPanel({ school, hq = false, onLoaded }: { school: string; hq?: boolean; onLoaded?: (campuses: CampusLocation[]) => void }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [campuses, setCampuses] = useState<CampusLocation[]>([]), [selected, setSelected] = useState("");
  const [latitude, setLatitude] = useState(""), [longitude, setLongitude] = useState(""), [radius, setRadius] = useState("200");
  const [reason, setReason] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [coarseAccuracy, setCoarseAccuracy] = useState<number | null>(null), [pinReviewed, setPinReviewed] = useState(false);
  const endpoint = "/api/khpos/attendance-location?school=" + school + (hq ? "&context=hq" : "");
  const request = useCallback(async (input?: Record<string, unknown>) => {
    const { data } = await client!.auth.getSession();
    if (!data.session?.access_token) throw new Error("Sign in again to configure campus locations.");
    const res = await fetch(endpoint, { method: input ? "POST" : "GET", cache: "no-store", headers: {
      Authorization: "Bearer " + data.session.access_token, ...(input ? { "Content-Type": "application/json" } : {}),
    }, ...(input ? { body: JSON.stringify(input) } : {}) });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error(body.error ?? "Campus locations could not load.");
    return body.campuses as CampusLocation[];
  }, [client, endpoint]);
  useEffect(() => {
    if (!client) return;
    let active = true;
    void request().then(rows => { if (active) { setCampuses(rows); onLoaded?.(rows); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [client, request, onLoaded]);
  function choose(id: string) {
    const c = campuses.find(x => x.id === id); setSelected(id);
    setLatitude(c?.location?.latitude.toString() ?? ""); setLongitude(c?.location?.longitude.toString() ?? "");
    setRadius(c?.location?.radius.toString() ?? "200"); setReason(""); setNotice("");
    setCoarseAccuracy(null); setPinReviewed(false); setError("");
  }
  const campus = campuses.find(c => c.id === selected);
  const hasPin = latitude.trim() !== "" && longitude.trim() !== "" && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
  return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
    <summary className="cursor-pointer font-black">Campus attendance locations</summary>
    <p className="mt-3 text-sm leading-6">An authorised Custodian, campus Guardian or HQ supervisor sets each campus pin once. Use your current position only while physically at that campus, or enter its known coordinates. A 200 m starting boundary can be adjusted to suit the site. Pin changes affect future check-ins; saved evidence keeps its original boundary.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    <ul className="my-3 space-y-1 text-sm">{campuses.map(c => <li key={c.id}><strong>{c.name}:</strong> {c.location ? `${c.location.latitude}, ${c.location.longitude} · ${c.location.radius} m boundary` : "Location not configured"}</li>)}</ul>
    {campuses.some(c => c.canManage) && <form className="grid gap-3 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); if (!campus?.canManage || !hasPin || (coarseAccuracy !== null && !pinReviewed)) return; setBusy(true); setError(""); setNotice("");
      try { const rows = await request({ campusId: selected, latitude: Number(latitude), longitude: Number(longitude), radius: Number(radius), updatedAt: campus.location?.updatedAt ?? null, reason }); setCampuses(rows); onLoaded?.(rows); setNotice("Campus location saved."); }
      catch (e) { setError(e instanceof Error ? e.message : "Location could not save."); } finally { setBusy(false); }
    }}>
      <label className="text-sm font-bold">Campus<select disabled={busy} className="mt-1 w-full rounded-lg border p-3 text-base" value={selected} onChange={e => choose(e.target.value)}><option value="">Select campus</option>{campuses.filter(c => c.canManage).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {campus?.canManage && <>
        <button type="button" disabled={busy} className="rounded-lg border p-3 text-sm font-bold" onClick={async () => {
          setBusy(true); setError(""); setNotice("Finding the campus position. This can take up to 30 seconds…");
          const v = await captureAttendanceLocation({ timeoutMs: 30000 });
          if (v.status === "captured" && v.latitude != null && v.longitude != null && v.accuracy != null && Number.isFinite(v.latitude) && Number.isFinite(v.longitude) && Number.isFinite(v.accuracy) && v.accuracy >= 0) {
            setLatitude(String(v.latitude)); setLongitude(String(v.longitude)); setPinReviewed(false);
            setCoarseAccuracy(v.accuracy > 100 ? v.accuracy : null);
            setNotice(`Position received (accuracy ±${Math.round(v.accuracy)} m). Check the pin against the actual campus before saving.`);
          } else { setNotice(""); setError(locationCaptureHelp(v.status)); } setBusy(false);
        }}>Use my current position for the pin</button>
        {hasPin && <a target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-700 underline sm:col-span-2" href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(latitude + "," + longitude)}>Check this pin on a map before saving</a>}
        {coarseAccuracy !== null && <label className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950 sm:col-span-2"><strong>This reading is approximate (±{Math.round(coarseAccuracy)} m).</strong> It could place the pin away from school. Retry outdoors for a better reading or correct the coordinates from a map. Keep the attendance boundary appropriate to the campus.<span className="mt-2 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={pinReviewed} onChange={e => setPinReviewed(e.target.checked)} />I checked this pin against the actual campus and confirm it is suitable.</span></label>}
        <label className="text-sm font-bold">Latitude<input required type="number" step="any" min={-90} max={90} className="mt-1 w-full rounded-lg border p-3 text-base" value={latitude} onChange={e => { setLatitude(e.target.value); setCoarseAccuracy(null); setPinReviewed(false); }} /></label>
        <label className="text-sm font-bold">Longitude<input required type="number" step="any" min={-180} max={180} className="mt-1 w-full rounded-lg border p-3 text-base" value={longitude} onChange={e => { setLongitude(e.target.value); setCoarseAccuracy(null); setPinReviewed(false); }} /></label>
        <details className="text-sm leading-6 sm:col-span-2"><summary className="cursor-pointer font-bold">How to enter the campus pin manually</summary><p className="mt-2">Open your map app, find the school and press and hold its actual location to drop a pin. Copy the latitude and longitude (for example 6.550000, 3.250000) into the matching fields. Use your school&apos;s actual coordinates, not this example. Check the preview link, enter a reason and save.</p></details>
        <label className="text-sm font-bold">Allowed distance (metres)<input required type="number" min={50} max={1000} className="mt-1 w-full rounded-lg border p-3 text-base" value={radius} onChange={e => setRadius(e.target.value)} /></label>
        <label className="text-sm font-bold">Reason for this pin or boundary<input required minLength={5} maxLength={500} className="mt-1 w-full rounded-lg border p-3 text-base" value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy || !hasPin || (coarseAccuracy !== null && !pinReviewed)} className="rounded-lg bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-40">Save campus location</button>
      </>}
    </form>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
  </details>;
}
