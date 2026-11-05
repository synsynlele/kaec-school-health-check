"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { KhposOpsPeopleWorkspace } from "@/lib/khpos/ops/people";
import type { ActivationSnapshot } from "@/lib/khpos/ops/activation";

const schemas = {
  Staff: ["name", "email"],
  Classes: ["campus", "class", "section"],
  Subjects: ["subject"],
} as const;
type Sheet = keyof typeof schemas;

function readCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const input = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n") + "\n";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[i + 1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (char === "," || char === "\n") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (char === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (closed) {
      if (char !== " " && char !== "\t") throw new Error("Unexpected text after a quoted CSV field.");
    } else if (char === '"' && !field) quoted = true;
    else if (char === '"') throw new Error("Unexpected quote in CSV field.");
    else field += char;
  }
  if (quoted) throw new Error("A quoted CSV field is missing its closing quote.");
  return rows;
}

export function SchoolSetupGuide({ school, activation }: { school: string; activation: ActivationSnapshot }) {
  const [sheet, setSheet] = useState<Sheet>("Staff");
  const [rows, setRows] = useState<{ values: string[]; issue: string }[]>([]);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<KhposOpsPeopleWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [campusId, setCampusId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [employmentType, setEmploymentType] = useState("employee");
  const [results, setResults] = useState<string[]>([]);
  const generation = useRef(0);
  const base = `/khpos/${school}`;
  const steps = [
    ["Confirm campuses", "/schools-campuses", activation.safeguarding.activeCampuses ? "Active campus found" : "Set up a campus"],
    ["Invite staff and assign roles", "/people", `${activation.people.assignedMembers} staff with roles`],
    ["Set up classes, subjects and term", "/academic-delivery", "Teaching plans"],
    ["Set up attendance and timetable", "/teaching-presence", "Attendance & lessons"],
    ["Try the first school day", "/work", "Open Today"],
  ];

  async function preview(file: File | undefined) {
    const request = ++generation.current;
    setRows([]);
    setResults([]);
    setPeople(null);
    setError("");
    if (!file) return;
    try {
      if (file.size > 256_000) throw new Error("Choose a CSV file under 256 KB.");
      const [header, ...data] = readCsv(await file.text());
      if (request !== generation.current) return;
      if (header?.map(cell => cell.toLowerCase()).join(",") !== schemas[sheet].join(",")) {
        throw new Error(`Expected columns in this order: ${schemas[sheet].join(", ")}.`);
      }
      if (!data.length || data.length > 500) throw new Error("Include between 1 and 500 rows.");
      const key = (values: string[]) => (sheet === "Staff" ? values[1] : values.join("\u0000"))?.toLowerCase();
      const counts = new Map<string | undefined, number>();
      for (const values of data) counts.set(key(values), (counts.get(key(values)) ?? 0) + 1);
      setRows(data.map(values => ({
        values,
        issue: values.length !== header.length || !values[0] || (sheet !== "Subjects" && !values[1])
          ? "Missing fields or wrong column count"
          : sheet === "Staff" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[1])
            ? "Check email address"
            : (counts.get(key(values)) ?? 0) > 1 ? "Duplicate in this file" : "",
      })));
    } catch (error) {
      if (request === generation.current) setError(error instanceof Error ? error.message : "Could not read the CSV.");
    }
  }

  async function request(path: string, input?: object) {
    const token = (await createBrowserSupabaseClient()?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("Sign in again to continue.");
    const response = await fetch(`/api/khpos/ops/${path}/${school}`, {
      method: input ? "POST" : "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: input ? JSON.stringify(input) : undefined,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not save this row.");
    return body;
  }

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const workspace = (await request("people")).people as KhposOpsPeopleWorkspace;
      setPeople(workspace);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load setup options.");
    } finally { setBusy(false); }
  }

  function campusFor(name: string) {
    const matches = people?.campuses.filter(c => [c.code, c.name].some(value => value.toLowerCase() === name.toLowerCase()));
    return matches?.length === 1 ? matches[0].id : null;
  }

  async function saveRows() {
    if (busy || !people || !rows.length || rows.length > 25 || rows.some(row => row.issue)) return;
    setBusy(true);
    setError("");
    setResults([]);
    const staff = new Set(people.items.filter(item => item.status !== "ended").map(item => item.accountEmail.toLowerCase()));
    for (const { values } of rows) {
      let result: string;
      try {
        if (sheet === "Staff") {
          if (staff.has(values[1].toLowerCase())) result = "Skipped · staff email already exists";
          else {
            await request("people", { mode: "create_staff", displayName: values[0], accountEmail: values[1],
              employmentType, roleId, campusId: campusId || null, startDate });
            result = "Staff appointment saved";
          }
        } else {
          const campus = sheet === "Classes" ? campusFor(values[0]) : null;
          if (sheet === "Classes" && !campus) throw new Error("Campus name or code is unknown or ambiguous.");
          await request("class-subjects", { campusId: campus, label: sheet === "Classes" ? values[1] : values[0], section: sheet === "Classes" ? values[2] : "" });
          result = "Saved or already on the list";
        }
      } catch (error) {
        result = error instanceof Error ? error.message : "Could not save this row.";
      }
      setResults(previous => [...previous, result]);
    }
    setBusy(false);
  }

  return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
    <h2 className="text-xl font-black">Get your school ready</h2>
    <ol className="divide-y divide-slate-200">
      {steps.map(([label, path, detail], index) => <li key={path} className="flex flex-wrap justify-between gap-2 py-3">
        <Link href={base + path} className="font-bold text-brand-700 underline">{index + 1}. {label}</Link>
        <span className="text-sm text-slate-600">{detail}</span>
      </li>)}
    </ol>
    <details>
      <summary className="font-bold">Preview a setup CSV</summary>
      <p className="my-2 text-sm text-slate-600">Check the file format and duplicates before entering records. Preview stays on this device. When ready, prepare an import of up to 25 rows and review the results.</p>
      <label className="block text-sm font-bold">List
        <select disabled={busy} value={sheet} onChange={event => {
          generation.current++;
          setSheet(event.target.value as Sheet);
          setRows([]);
          setPeople(null);
          setResults([]);
          setError("");
        }} className="ml-2 rounded-lg border p-2">
          {Object.keys(schemas).map(kind => <option key={kind}>{kind}</option>)}
        </select>
      </label>
      <p className="my-2 text-sm">CSV columns: <code>{schemas[sheet].join(",")}</code></p>
      <label className="block text-sm font-bold">Choose CSV file
        <input key={sheet} type="file" disabled={busy} accept=".csv,text/csv" className="block max-w-full py-2" onChange={event => void preview(event.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="text-sm text-rose-900">{error}</p>}
      {rows.length > 0 && <>
        <p role="status" className="my-2 text-sm">{rows.length} rows · {rows.filter(row => row.issue).length} need attention</p>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th scope="col">Entry</th><th scope="col">Details</th><th scope="col">Check</th></tr></thead>
            <tbody>{rows.map(({values, issue}, index) => <tr key={index} className="border-t">
              <td className="p-2">{index + 1}. {values[0]}</td><td className="p-2">{values.slice(1).join(" · ")}</td><td className="p-2">{issue || results[index] || (people && sheet === "Classes" && !campusFor(values[0]) ? "Check campus name or code" : "Format looks good")}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {rows.length <= 25 && rows.every(row => !row.issue) && !people && (
          <button type="button" disabled={busy} className="mt-3 rounded-xl border px-4 py-2 font-bold" onClick={() => void prepare()}>Prepare import</button>
        )}
        {rows.length > 25 && <p className="mt-2 text-sm">Split this file into groups of up to 25 rows to import.</p>}
        {people && sheet === "Staff" && people.canManagePeople && <fieldset disabled={busy} className="my-3 grid gap-3 sm:grid-cols-2">
          <label>Role for these staff<select className="block w-full rounded-lg border p-2" value={roleId} onChange={event => setRoleId(event.target.value)}>
            <option value="">Choose role</option>{people.roles.filter(role => role.code !== "SCHOOL_CUSTODIAN").map(role => <option key={role.id} value={role.id}>{role.title}</option>)}
          </select></label>
          <label>Campus<select className="block w-full rounded-lg border p-2" value={campusId} onChange={event => setCampusId(event.target.value)}>
            <option value="">School-wide, where allowed</option>{people.campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
          </select></label>
          <label>Employment type<select className="block w-full rounded-lg border p-2" value={employmentType} onChange={event => setEmploymentType(event.target.value)}>
            {["employee", "facilitator", "contractor", "volunteer", "intern", "temporary"].map(type => <option key={type}>{type}</option>)}
          </select></label>
          <label>Start date<input className="block w-full rounded-lg border p-2" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
        </fieldset>}
        {people && sheet === "Staff" && !people.canManagePeople && <p className="text-sm">An authorised school leader must save staff appointments.</p>}
        {people && (sheet !== "Staff" || people.canManagePeople) && <button type="button"
          disabled={busy || (sheet === "Staff" && (!roleId || !startDate)) || (sheet === "Classes" && rows.some(row => !campusFor(row.values[0])))}
          onClick={() => void saveRows()} className="mt-3 rounded-xl bg-brand-700 px-4 py-2 font-bold text-white disabled:opacity-50">
          Save {rows.length} rows
        </button>}
        {busy && <p role="status" className="mt-2 text-sm">{results.length ? `Processed ${results.length} of ${rows.length} rows…` : "Working…"}</p>}
      </>}
    </details>
  </section>;
}
