"use client";
import { useMemo, useState } from "react";
import type { MeetingPerson } from "@/lib/khpos/ops/meetings";

export function MeetingInvitees({ people, userId, hq, selected, onChange, disabled }: {
 people: MeetingPerson[]; userId: string; hq: boolean; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
 const [group, setGroup] = useState(hq ? "hq" : "school");
 const [school, setSchool] = useState("");
 const [search, setSearch] = useState("");
 const schools = useMemo(() => {
  const values = new Map<string, string>();
  for (const person of people) for (const item of person.schools ?? []) values.set(item.id, item.name);
  return Array.from(values, ([id, name]) => ({ id, name })).sort((a,b)=>a.name.localeCompare(b.name));
 }, [people]);
 const candidates = people.filter(p=>p.id!==userId).filter(p=>group==="hq" ? p.isHq : hq ? !!school && p.schools?.some(s=>s.id===school) : !!p.schools?.length)
  .map(p=>({...p, name: group==="school" && school ? p.schools?.find(s=>s.id===school)?.personName || p.name : p.name}))
  .filter(p=>`${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
 const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(value=>value!==id) : [...new Set([...selected,id])]);
 return <fieldset disabled={disabled} className="space-y-3 rounded-xl border p-4">
  <legend className="font-semibold">Invite people</legend>
  <p className="text-sm text-slate-600">Only selected people can view this meeting or join its call.</p>
  <div className="flex flex-wrap gap-2" aria-label="Invitation groups">
   <button type="button" aria-pressed={group==="hq"} onClick={()=>{setGroup("hq");setSearch("");}} className={`rounded-xl border px-4 py-2 ${group==="hq"?"bg-blue-700 text-white":"bg-white text-slate-800"}`}>KAEC HQ colleagues</button>
   <button type="button" aria-pressed={group==="school"} onClick={()=>{setGroup("school");setSearch("");}} className={`rounded-xl border px-4 py-2 ${group==="school"?"bg-blue-700 text-white":"bg-white text-slate-800"}`}>{hq?"School leaders":"School staff"}</button>
  </div>
  {hq&&group==="school"&&<label className="block text-sm font-semibold">Choose a school first<select value={school} onChange={e=>{setSchool(e.target.value);setSearch("");}} className="mt-2 w-full rounded-xl border bg-white p-3 text-slate-900"><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {(group==="hq"||!hq||school)&&<>
   <label className="block text-sm font-semibold">Find by name or email<input type="search" value={search} onChange={e=>setSearch(e.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3 text-slate-900"/></label>
   <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border bg-white p-2">{candidates.map(p=><label key={p.id} className="flex items-start gap-3 rounded-lg p-2"><input type="checkbox" className="mt-1" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)}/><span className="min-w-0"><span className="block font-semibold text-slate-900">{p.name}</span><span className="block break-all text-sm text-slate-600">{p.email}</span></span></label>)}{!candidates.length&&<p className="p-2 text-sm text-slate-600">No matching people in this group.</p>}</div>
  </>}
  <details open={selected.length>0}><summary className="cursor-pointer text-sm font-semibold">Selected people ({selected.length})</summary><p className="mt-1 text-xs text-slate-600">Selections stay when you change groups or schools.</p><ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">{selected.map(id=>{const person=people.find(p=>p.id===id);return <li key={id} className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 p-3"><span className="min-w-0"><span className="block font-semibold">{person?.name || "Selected person"}</span><span className="block break-all text-sm text-slate-600">{person?.email}</span></span><button type="button" onClick={()=>toggle(id)} className="text-sm font-semibold text-blue-800" aria-label={`Remove ${person?.name||"person"}`}>Remove</button></li>;})}</ul></details>
 </fieldset>;
}
