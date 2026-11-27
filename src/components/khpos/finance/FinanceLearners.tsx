"use client";

import { useCallback, useState } from "react";
import { Expand, Field, FinanceForm, Grid, LoadingState, Pager, card, financeFetch, options, primary, secondary, selectClass, str, useFinanceData,
  type FinanceCall, type Option, type Row, type Write } from "./FinanceControls";
import { allPages, csv, excel } from "./FinanceExports";

const fields: Option[] = [
  ["admission","Admission number"], ["name","Learner name"], ["class","Class"], ["arm","Arm"],
  ["status","Enrolment status"], ["admittedOn","Admission date"], ["guardian","Parent or guardian"],
  ["contact","Guardian contact"], ["household","Household"], ["feeCategory","Fee category"], ["assistance","Financial assistance"],
];
const statuses: Option[] = [["active","Active"],["graduated","Graduated"],["transferred","Transferred"],["withdrawn","Withdrawn"]];

type Review = { result: string; message?: string };
export const financeFileRows = async (file: File): Promise<string[][]> => {
  if (file.size > 4_000_000) throw new Error("Choose a spreadsheet smaller than 4 MB.");
  if (/\.csv$/i.test(file.name)) {
    const { default: Papa } = await import("papaparse");
    return new Promise((resolve,reject) => Papa.parse<string[]>(file, {
      worker: Papa.WORKERS_SUPPORTED, skipEmptyLines: "greedy",
      complete: result => result.errors.length ? reject(new Error("Check the CSV for missing quotation marks and invalid rows.")) : resolve(result.data),
      error: reject,
    }));
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { Workbook } = await import("exceljs");
    const book = new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet || sheet.rowCount > 10001 || sheet.columnCount > 120) throw new Error("Use a first worksheet with up to 10,000 learners and 120 columns.");
    const rows: string[][] = [];
    sheet.eachRow(row => {
      const values = Array.from({ length: sheet.columnCount }, (_, i) => {
        const cell = row.getCell(i + 1);
        return cell.value instanceof Date ? cell.value.toISOString().slice(0,10) : cell.text;
      });
      if (values.some(value => value.trim())) rows.push(values);
    });
    return rows;
  }
  throw new Error("Choose an Excel .xlsx or CSV file.");
};

function LearnerImport({ call, term, onImported }: { call: FinanceCall; term: string; onImported: () => void }) {
  const [headers,setHeaders] = useState<string[]>([]);
  const [data,setData] = useState<string[][]>([]);
  const [map,setMap] = useState<Record<string,number>>({});
  const [review,setReview] = useState<Review[]>([]);
  const [overrides,setOverrides] = useState<Record<number,Record<string,string>>>({});
  const [offset,setOffset] = useState(0);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const [validated,setValidated] = useState(false);

  async function load(file: File) {
    setError(""); setNotice(""); setBusy(true); setReview([]); setValidated(false); setOverrides({}); setOffset(0); setData([]); setHeaders([]);
    try {
      const [head,...body] = await financeFileRows(file);
      if (!head?.length || !body.length || body.length > 10000) throw new Error("Include a header and between 1 and 10,000 learner rows.");
      setHeaders(head);
      setData(body);
      setMap(Object.fromEntries(fields.map(([key,label]) => [key,head.findIndex(cell =>
        [label,key].some(term => term.toLowerCase() === cell.trim().toLowerCase()))])));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The spreadsheet could not be read."); }
    finally { setBusy(false); }
  }

  const mapped = (row: string[], index: number): Record<string,string> => ({
    ...Object.fromEntries(fields.map(([key]) => [key,(row[map[key]] ?? "").trim()])),
    ...overrides[index], term,
  });

  async function process(commit: boolean) {
    setError(""); setNotice(""); setBusy(true);
    if (!commit) setValidated(false);
    const items = data.map(mapped);
    const duplicate = new Set<string>();
    const seen = new Set<string>();
    for (const row of items) {
      const key = row.admission.toLowerCase();
      if (key && seen.has(key)) duplicate.add(key);
      seen.add(key);
    }
    const results = commit ? [...review] : [];
    try {
      for (let start = 0; start < items.length; start += 50) {
        const batch = items.slice(start,start + 50).map((row,i) => ({ row, index: start + i })).filter(({row,index}) => {
          if (commit) return ["new","link existing"].includes(review[index]?.result);
          if (!duplicate.has(row.admission.toLowerCase())) return true;
          results[index] = { result:"error", message:"Admission number occurs more than once in this file." };
          return false;
        });
        if (batch.length) {
          const response = await call<Review[]>("register",commit ? "importLearners" : "previewLearners",{ rows: batch.map(item => item.row) });
          batch.forEach(({index}, i) => { results[index] = response[i]; });
        }
        setReview([...results]);
        setNotice((commit ? "Importing " : "Checking ") + Math.min(start + 50,items.length) + " of " + items.length);
      }
      const counts = results.reduce((count,row) => ({ ...count,[row.result]: (count[row.result] ?? 0) + 1 }),{} as Record<string,number>);
      setNotice(Object.entries(counts).map(([key,value]) => value + " " + (key === "error" ? "need correction" : key)).join(" · "));
      setValidated(!commit);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The spreadsheet operation stopped.");
    } finally {
      if (commit) onImported();
      setBusy(false);
    }
  }

  return <div className="space-y-4">
    <p className="text-sm text-slate-700">Choose one campus and academic term for the file. Use the class and arm names exactly as they appear in KHP-OS.</p>
    <div className="flex flex-wrap gap-2">
      <button className={secondary} onClick={() => csv("learner-import-template",[fields.map(([,label]) => label),
        ["KNS-001","Sample Learner","JSS 1","A","active","","","","","",""]])}>Download sample CSV</button>
      <label className="grid gap-1 text-sm font-semibold">Learner spreadsheet
        <input type="file" accept=".csv,.xlsx" disabled={busy || !term} className="text-sm" onChange={event => {
          const file = event.target.files?.[0];
          if (file) void load(file);
          event.target.value = "";
        }} />
      </label>
    </div>
    {data.length > 0 && <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key,label]) => <label key={key} className="grid gap-1 text-sm font-semibold">
        {label}<select className={selectClass} disabled={busy} value={map[key] ?? -1} onChange={event => {
          setMap({ ...map,[key]: Number(event.target.value) }); setReview([]); setValidated(false); setOverrides({});
        }}><option value={-1}>Leave blank</option>
          {headers.map((header,i) => <option key={i} value={i}>{header || "Column " + (i + 1)}</option>)}
        </select>
      </label>)}</div>
      <div className="flex flex-wrap gap-2">
        <button className={secondary} disabled={busy || !term} onClick={() => void process(false)}>Validate {data.length} rows</button>
        <button className={primary} disabled={busy || !validated || !review.some(row => ["new","link existing"].includes(row.result))}
          onClick={() => void process(true)}>Import valid learners</button>
      </div>
      <Grid rows={data.slice(offset,offset+50).map((row,i) => ({ ...mapped(row,i+offset),index:i+offset }))} columns={[
        ["Row",row => Number(row.index)+2], ["Learner",row => str(row.name)], ["Admission",row => str(row.admission)],
        ["Class",row => [row.class,row.arm].map(str).filter(Boolean).join(" · ")],
        ["Result",row => review[Number(row.index)]?.message || review[Number(row.index)]?.result || "Ready for validation"],
        ["Correct",row => <details><summary className="cursor-pointer py-2">Edit row</summary>
          {fields.map(([key,label]) => <label key={key} className="block min-w-36 text-xs">{label}
            <input className={selectClass} disabled={busy} value={str(row[key])} onChange={event => {
              const index = Number(row.index);
              setOverrides({ ...overrides,[index]: { ...overrides[index],[key]:event.target.value } });
              setValidated(false);
            }} />
          </label>)}
        </details>],
      ]} />
      <Pager offset={offset} setOffset={setOffset} more={data.length > offset + 50} />
    </>}
    {notice && <p role="status" className="text-sm text-slate-800">{notice}</p>}
    {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
  </div>;
}

export function FinanceLearners({ call, write, refresh, busy, classes, terms, term, school, campus, campuses, onImported, onStatement }: {
  call: FinanceCall; write: Write; refresh: number; busy: boolean; classes: Row[]; terms: Row[]; term: string;
  school: string; campus: string; campuses: Option[]; onImported: () => void; onStatement?: (id: string) => void;
}) {
  const [filter,setFilter] = useState<Row>({});
  const [offset,setOffset] = useState(0);
  const [edit,setEdit] = useState<Row>({});
  const [destination,setDestination] = useState("");
  const [downloadError,setDownloadError] = useState("");
  const [exporting,setExporting] = useState(false);
  const data = useFinanceData<Row[]>(call,"register","learners",{ ...filter,offset },refresh);
  const destinationCall = useCallback<FinanceCall>((surface,action,input)=>financeFetch(school,destination,surface,action,input),[school,destination]);
  const alternate = useFinanceData<{ classes: Row[]; terms: Row[] }>(destinationCall,"register","catalog",{},0,Boolean(destination && destination!==campus));
  const editClasses = destination && destination!==campus ? alternate.data?.classes ?? [] : classes;
  const editTerms = destination && destination!==campus ? alternate.data?.terms ?? [] : terms;
  const classOptions: Option[] = editClasses.map(row => [str(row.id),[row.name,row.arm].map(str).filter(Boolean).join(" · ")]);
  const termOptions: Option[] = editTerms.map(row => [str(row.id),str(row.session) + " · " + str(row.name)]);
  const currentClass = editClasses.find(row => row.name===edit.class && str(row.arm)===str(edit.arm));

  async function exportLearners() {
    setDownloadError("");setExporting(true);
    try {
      const rows = await allPages(offset => call<Row[]>("register","learners",{ ...filter,offset }));
      await excel("learners",[{ title:"Learners",rows:[fields.map(([,label]) => label),...rows.map(row => fields.map(([key]) => str(row[key])))] }]);
    } catch (cause) { setDownloadError(cause instanceof Error ? cause.message : "Export could not be completed."); }
    finally { setExporting(false); }
  }

  return <section className={card}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Learner register</h2>
      <button className={secondary} disabled={exporting} onClick={() => void exportLearners()}>{exporting ? "Preparing export…" : "Export learner list"}</button>
    </div>
    {downloadError && <p role="alert" className="text-sm text-rose-800">{downloadError}</p>}
    {!classes.length && <p className="text-sm text-slate-700">Add your campus classes in Academic Delivery before registering learners.</p>}
    <Expand title={edit.id ? "Edit " + str(edit.name) : "Register a learner"}>
      <FinanceForm key={str(edit.id || term)+destination+editClasses.length} disabled={busy || !editClasses.length} submitLabel={edit.id ? "Save learner changes" : "Register learner"}
        onSubmit={async row => {
          const result = await write("register","saveLearner",{ ...row,id:edit.id,destinationCampus:destination });
          if (result) {setEdit({});setDestination("");}
        }}>
        <Field label="Learner name" name="name" value={str(edit.name)} />
        <Field label="Admission number" name="admission" value={str(edit.admission)} maxLength={120} />
        {edit.id && campuses.length>1 ? <label className="grid gap-1 text-sm font-semibold">Campus
          <select className={selectClass} value={destination || campus} disabled={busy} onChange={event=>setDestination(event.target.value)}>
            {campuses.map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select>
        </label> : null}
        <Field label="Class and arm" name="class" choices={classOptions} value={str(currentClass?.id)} />
        <Field label="Academic term" name="term" choices={termOptions} value={str(edit.term) || term} />
        <Field label="Enrolment status" name="status" choices={statuses} value={str(edit.status) || "active"} />
        <Field label="Admission date" name="admittedOn" type="date" required={false} value={str(edit.admittedOn)} />
        {fields.slice(6).map(([name,label]) => <Field key={name} label={label} name={name} value={str(edit[name])} required={false} />)}
        {!edit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmDistinct" value="true" /> Confirm separate learner if the name matches</label>}
      </FinanceForm>
      {edit.id ? <button className={secondary + " mt-3"} onClick={() => {setEdit({});setDestination("");}}>Cancel edit</button> : null}
    </Expand>
    <LoadingState {...alternate} />
    <Expand title="Import learners from Excel or CSV">
      <LearnerImport key={term} call={call} term={term} onImported={onImported} />
    </Expand>
    <FinanceForm disabled={false} submitLabel="Apply filters" onSubmit={row => { setFilter(row);setOffset(0); }}>
      <Field label="Search name or admission number" name="search" required={false} />
      <Field label="Filter by class" name="class" required={false} choices={Array.from(new Set(classes.map(row => str(row.name)))).map(name => [name,name])} />
      <Field label="Filter by session" name="session" required={false} choices={Array.from(new Set(terms.map(row => str(row.session)))).map(name => [name,name])} />
      <Field label="Filter by status" name="status" required={false} choices={statuses} />
      <Field label="Sort learners" name="sort" choices={[["name","Name"],["admission","Admission number"],["recent","Recently updated"]]} value="name" />
    </FinanceForm>
    <LoadingState {...data} />
    {data.data && <><Grid rows={data.data.slice(0,50)} columns={[
      ["Learner",row => <strong>{str(row.name)}</strong>],["Admission number",row => str(row.admission)],
      ["Class",row => [row.class,row.arm].map(str).filter(Boolean).join(" · ")],
      ["Status",row => str(row.status) || "Existing learner"],["Actions",row => <div className="flex flex-wrap gap-2">
        <button className={secondary} onClick={event => {
          setEdit(row);setDestination("");
          const section = event.currentTarget.closest("section");
          const details = section?.querySelector("details");
          if (details) { details.open = true; details.scrollIntoView({ block:"start" }); }
        }}>{row.status ? "Edit" : "Link"}</button>
        {onStatement && <button className={secondary} onClick={() => onStatement(str(row.id))}>Fee statement</button>}
      </div>],
    ]} /><Pager offset={offset} setOffset={setOffset} more={data.data.length>50} /></>}
  </section>;
}

export function classChoices(classes: Row[]): Option[] {
  return options(classes).map(([id,label]) => [id,label + (classes.find(row => row.id===id)?.arm ? " · " + str(classes.find(row => row.id===id)?.arm) : "")]);
}
