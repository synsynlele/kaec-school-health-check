"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { captureAttendanceLocation, type CampusLocation } from "@/lib/khpos/attendance-location";

export function CampusLocationPanel({ school, hq = false, onLoaded }: { school: string; hq?: boolean; onLoaded?: (campuses: CampusLocation[]) => void }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [campuses, setCampuses] = useState<CampusLocation[]>([]), [selected, setSelected] = useState("");
  const [latitude, setLatitude] = useState(""), [longitude, setLongitude] = useState(""), [radius, setRadius] = useState("200");
  const [reason, setReason] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
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
  }
  const campus = campuses.find(c => c.id === selected);
  return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
    <summary className="cursor-pointer font-black">Campus attendance locations</summary>
    <p className="mt-3 text-sm leading-6">An authorised Custodian, campus Guardian or HQ supervisor sets each campus pin once. Use your current position only while physically at that campus, or enter its known coordinates. A 200 m starting boundary can be adjusted to suit the site. Pin changes affect future check-ins; saved evidence keeps its original boundary.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    <ul className="my-3 space-y-1 text-sm">{campuses.map(c => <li key={c.id}><strong>{c.name}:</strong> {c.location ? `${c.location.latitude}, ${c.location.longitude} · ${c.location.radius} m boundary` : "Location not configured"}</li>)}</ul>
    {campuses.some(c => c.canManage) && <form className="grid gap-3 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); if (!campus?.canManage) return; setBusy(true); setError(""); setNotice("");
      try { const rows = await request({ campusId: selected, latitude: Number(latitude), longitude: Number(longitude), radius: Number(radius), updatedAt: campus.location?.updatedAt ?? null, reason }); setCampuses(rows); onLoaded?.(rows); setNotice("Campus location saved."); }
      catch (e) { setError(e instanceof Error ? e.message : "Location could not save."); } finally { setBusy(false); }
    }}>
      <label className="text-sm font-bold">Campus<select className="mt-1 w-full rounded-lg border p-3 text-base" value={selected} onChange={e => choose(e.target.value)}><option value="">Select campus</option>{campuses.filter(c => c.canManage).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {campus?.canManage && <>
        <button type="button" disabled={busy} className="rounded-lg border p-3 text-sm font-bold" onClick={async () => {
          setBusy(true); setError(""); const v = await captureAttendanceLocation();
          if (v.status === "captured" && v.accuracy != null && v.accuracy <= 100) { setLatitude(String(v.latitude)); setLongitude(String(v.longitude)); setNotice(`Pin filled from this device (accuracy ±${Math.round(v.accuracy)} m). Check it and save.`); }
          else setError("Could not get an accurate campus pin. Enable location and try outdoors, or enter known coordinates."); setBusy(false);
        }}>Use my current position for the pin</button>
        <label className="text-sm font-bold">Latitude<input required type="number" step="any" min={-90} max={90} className="mt-1 w-full rounded-lg border p-3 text-base" value={latitude} onChange={e => setLatitude(e.target.value)} /></label>
        <label className="text-sm font-bold">Longitude<input required type="number" step="any" min={-180} max={180} className="mt-1 w-full rounded-lg border p-3 text-base" value={longitude} onChange={e => setLongitude(e.target.value)} /></label>
        <label className="text-sm font-bold">Allowed distance (metres)<input required type="number" min={50} max={1000} className="mt-1 w-full rounded-lg border p-3 text-base" value={radius} onChange={e => setRadius(e.target.value)} /></label>
        <label className="text-sm font-bold">Reason for this pin or boundary<input required minLength={5} maxLength={500} className="mt-1 w-full rounded-lg border p-3 text-base" value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy} className="rounded-lg bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-40">Save campus location</button>
      </>}
    </form>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
  </details>;
}
