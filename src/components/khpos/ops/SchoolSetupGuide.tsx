"use client";

import Link from "next/link";
import { useRef, useState } from "react";
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
      <p className="my-2 text-sm text-slate-600">Check the file format and duplicates before entering records. The file stays on this device and this preview saves no records.</p>
      <label className="block text-sm font-bold">List
        <select value={sheet} onChange={event => {
          generation.current++;
          setSheet(event.target.value as Sheet);
          setRows([]);
          setError("");
        }} className="ml-2 rounded-lg border p-2">
          {Object.keys(schemas).map(kind => <option key={kind}>{kind}</option>)}
        </select>
      </label>
      <p className="my-2 text-sm">CSV columns: <code>{schemas[sheet].join(",")}</code></p>
      <label className="block text-sm font-bold">Choose CSV file
        <input key={sheet} type="file" accept=".csv,text/csv" className="block max-w-full py-2" onChange={event => void preview(event.target.files?.[0])} />
      </label>
      {error && <p role="alert" className="text-sm text-rose-900">{error}</p>}
      {rows.length > 0 && <>
        <p role="status" className="my-2 text-sm">{rows.length} rows · {rows.filter(row => row.issue).length} need attention</p>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead><tr><th scope="col">Entry</th><th scope="col">Details</th><th scope="col">Check</th></tr></thead>
            <tbody>{rows.map(({values, issue}, index) => <tr key={index} className="border-t">
              <td className="p-2">{index + 1}. {values[0]}</td><td className="p-2">{values.slice(1).join(" · ")}</td><td className="p-2">{issue || "Format looks good"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </details>
  </section>;
}
