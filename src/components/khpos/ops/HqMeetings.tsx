"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
export function HqMeetings() {
 const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
 const [error, setError] = useState("");
 const [search, setSearch] = useState("");
 useEffect(() => {
  const controller = new AbortController();
  async function load() {
   try {
    const auth = await createBrowserSupabaseClient()?.auth.getSession();
    const token = auth?.data.session?.access_token;
    if (!token) throw new Error("Sign in with your KAEC HQ account.");
    const response = await fetch("/api/khpos/hq/meetings", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    if (!controller.signal.aborted) setSchools(result.schools);
   } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not load schools."); }
  }
  void load(); return () => controller.abort();
 }, []);
 return <main className="mx-auto max-w-4xl space-y-5 p-5 text-slate-900"><Link href="/khpos/hq" className="text-blue-700">← KAEC HQ</Link><h1 className="text-3xl font-bold">Meetings</h1><p>Choose the school workspace for your meeting. You can invite school staff and KAEC HQ members. Only invited people can read the room or join its call.</p>
 <p className="text-sm text-slate-600">HQ-only meetings can also be hosted in a selected school workspace with only HQ colleagues invited. School staff receive no access unless invited. Actions in Today are currently assigned to school staff.</p>
 <label className="block">Find a school<input className="mt-2 w-full rounded-xl border bg-white p-3" type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}{!schools&&!error&&<p role="status">Loading schools…</p>}
 {schools?.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())).map(s=><Link className="block rounded-xl border bg-white p-4 text-blue-800" key={s.id} href={`/khpos/${s.id}/meetings`}>{s.name} →</Link>)}
 {schools?.length===0&&<p>No active licensed school workspaces are available.</p>}</main>;
}
