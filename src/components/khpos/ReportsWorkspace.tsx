"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { KHPOS_ACTIVITY_CHANGED } from "@/lib/khpos/ops/action-events";
import type {
  ReportField,
  ReportType,
  SchoolReport,
  ReportsWorkspace as Workspace,
} from "@/lib/khpos/reports";

const field =
  "mt-1 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-40";
const primary =
  button
    .replace("border-slate-300", "border-brand-700")
    .replace("bg-white", "bg-brand-700") + " text-white";
const dateOnly = (v: string) =>
  new Date(v + "T12:00:00Z").toLocaleDateString("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  });
const time = (v: string) =>
  new Date(v).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const standardFields: ReportField[] = [
  {
    key: "summary",
    label: "What happened / work completed",
    type: "textarea",
    required: true,
  },
  {
    key: "results",
    label: "Results and evidence",
    type: "textarea",
    required: true,
  },
  {
    key: "challenges",
    label: "Challenges or exceptions (write None if none)",
    type: "textarea",
    required: true,
  },
  {
    key: "nextActions",
    label: "Next actions, owner and target date",
    type: "textarea",
    required: true,
  },
  {
    key: "support",
    label: "Decision or support needed",
    type: "textarea",
    required: false,
  },
  {
    key: "evidenceLink",
    label: "Supporting document link",
    type: "url",
    required: false,
  },
];
const frequencies = [
  ["one_off", "One-off / repeatable log"],
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["termly", "Termly"],
  ["yearly", "Yearly"],
  ["custom_days", "Every N days"],
] as const;

export function ReportsWorkspace({
  organisationId,
  compact = false,
}: {
  organisationId: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [tab, setTab] = useState("reports");
  const [detail, setDetail] = useState<Workspace | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [editor, setEditor] = useState<ReportType | null | false>(false);
  const deepLinkHandled = useRef(false);
  const endpoint = `/api/khpos/reports?school=${organisationId}`;
  const request = useCallback(
    async (input?: Record<string, unknown>, params = "") => {
      const client = createBrowserSupabaseClient(),
        session = (await client?.auth.getSession())?.data.session;
      if (!session) throw new Error("Sign in to use School Reports.");
      const res = await fetch(endpoint + params, {
        method: input ? "POST" : "GET",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        ...(input ? { body: JSON.stringify(input) } : {}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Reports could not load.");
      return body as { workspace: Workspace; id?: string };
    },
    [endpoint],
  );
  const params = compact
    ? "&summary=1"
    : `&q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&offset=${offset}&type=${typeFilter}&from=${from}&to=${to}`;
  const load = useCallback(async () => {
    try {
      setData((await request(undefined, params)).workspace);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Reports could not load.",
      );
    }
  }, [request, params]);
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      void request(undefined, params)
        .then((body) => {
          if (live) {
            setData(body.workspace);
            setError("");
            if (!deepLinkHandled.current) {
              deepLinkHandled.current = true;
              const id = new URLSearchParams(window.location.search).get(
                "report",
              );
              if (id) setSelected(id);
            }
          }
        })
        .catch((cause) => {
          if (live) setError(cause.message);
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [request, params]);
  useEffect(() => {
    const focus = () => void load();
    window.addEventListener("focus", focus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 180000);
    return () => {
      window.removeEventListener("focus", focus);
      window.clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    void request(undefined, `&report=${selected}`)
      .then((body) => {
        if (live) setDetail(body.workspace);
      })
      .catch((cause) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, [selected, request]);
  useEffect(() => {
    if (selected && detail)
      document
        .getElementById("report-detail")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, detail]);
  useEffect(() => {
    if (editor !== false)
      document
        .getElementById("report-type-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editor]);
  async function act(input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await request(input, params);
      setData(body.workspace);
      if (input.mode === "create" && body.id) {
        setSelected(body.id);
        setTab("reports");
      } else if (
        selected &&
        !["type_save", "type_status"].includes(String(input.mode))
      )
        setDetail((await request(undefined, `&report=${selected}`)).workspace);
      if (input.mode === "type_save") setEditor(false);
      setNotice(
        input.mode === "save"
          ? "Draft saved."
          : input.mode === "submit"
            ? "Report submitted to its designated reviewer."
            : "Saved. The reporting history has been retained.",
      );
      window.dispatchEvent(
        new CustomEvent(KHPOS_ACTIVITY_CHANGED, { detail: { organisationId } }),
      );
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Report action failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const summary = data?.summary;
  if (compact)
    return (
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">My reports & reviews</h2>
          <Link className={button} href={`/khpos/${organisationId}/reports`}>
            Open Reports
          </Link>
        </div>
        {error ? (
          <p className="text-sm text-amber-900">
            Reports could not load. Open Reports to retry.
          </p>
        ) : !summary ? (
          <p className="text-sm">Loading reporting actions…</p>
        ) : (
          <p className="text-sm text-slate-700">
            {summary.open} to complete · {summary.overdue} overdue ·{" "}
            {summary.review} awaiting your review
          </p>
        )}
      </section>
    );
  const chosen = detail?.items[0];
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16 sm:p-6">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-brand-700">
          School operations
        </p>
        <h1 className="text-3xl font-black text-slate-950">Reports</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Daily, weekly, monthly, termly and one-off reporting in one place.
          Complete the reports assigned to your position, then send them to
          their designated reviewer.
        </p>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          Use Safeguarding and People workflows for confidential case details.
          Report content here is visible only to its current owner and
          designated reviewer. Templates and reporting totals can be managed by
          authorised school leaders.
        </p>
        <Link
          href={`/khpos/${organisationId}/records`}
          className="inline-flex min-h-11 items-center text-sm font-bold text-brand-800 underline"
        >
          View existing process reports, checklists & evidence
        </Link>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900"
        >
          {error}
          <button
            className="ml-3 min-h-11 underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["To complete", summary?.open],
          ["Overdue", summary?.overdue],
          ["To review", summary?.review],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-bold text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-black">{value ?? "—"}</p>
          </div>
        ))}
      </div>
      <nav aria-label="Report views" className="flex flex-wrap gap-2">
        {[
          ["reports", "Reports & history"],
          ["log", "Log a report"],
          ["types", "Report types & schedules"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            className={tab === key ? primary : button}
            onClick={() => {
              setTab(key);
              setEditor(false);
              setSelected(null);
              setDetail(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "reports" && (
        <>
          <form
            className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="text-sm font-bold">
              Search report title or submitter
              <input
                className={field}
                type="search"
                maxLength={160}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <label className="text-sm font-bold">
              Status
              <select
                className={field}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                }}
              >
                {[
                  ["", "All"],
                  ["draft", "Draft"],
                  ["submitted", "Submitted"],
                  ["returned", "Returned for correction"],
                  ["accepted", "Accepted"],
                  ["overdue", "Overdue"],
                  ["review", "Awaiting my review"],
                  ["withdrawn", "Withdrawn"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Report type
              <select
                className={field}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All types</option>
                {data?.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold">
                Period from
                <input
                  type="date"
                  className={field}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setOffset(0);
                  }}
                />
              </label>
              <label className="text-sm font-bold">
                Period to
                <input
                  type="date"
                  className={field}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setOffset(0);
                  }}
                />
              </label>
            </div>
          </form>
          {selected && (
            <section
              id="report-detail"
              className="scroll-mt-36 rounded-2xl border-2 border-brand-200 bg-white p-4 sm:p-6"
            >
              <div className="mb-4 flex justify-end">
                <button
                  className={button}
                  onClick={() => {
                    setSelected(null);
                    setDetail(null);
                  }}
                >
                  Close report
                </button>
              </div>
              {chosen && chosen.id === selected ? (
                <ReportEditor
                  key={`${chosen.id}:${chosen.lock_version}`}
                  report={chosen}
                  history={detail?.history ?? []}
                  busy={busy}
                  onAction={act}
                />
              ) : (
                <p className="text-sm">
                  {detail
                    ? "This report is unavailable to your current role or school. Refresh the list or contact your school administrator."
                    : "Loading report…"}
                </p>
              )}
            </section>
          )}
          {!data ? (
            <p>Loading reports…</p>
          ) : data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">
              No reports match this view. A school leader can configure
              reporting under Report types & schedules. One-off reports are
              available under Log a report when a matching type is active.
            </div>
          ) : (
            <div className="space-y-3">
              {data.items.map((n) => (
                <article
                  key={n.id}
                  className={`rounded-2xl border bg-white p-4 ${n.overdue ? "border-amber-300" : "border-slate-200"}`}
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <h2 className="font-bold">{n.title}</h2>
                    <span className="text-xs font-bold uppercase">
                      {n.status}
                      {n.overdue ? " · Overdue" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {n.ownerName}
                    {n.campusName ? ` · ${n.campusName}` : ""}
                    <br />
                    {dateOnly(n.period_start)} – {dateOnly(n.period_end)} · Due{" "}
                    {time(n.due_at)}
                    <br />
                    Reviewer: {n.reviewerTitle}
                  </p>
                  <button
                    type="button"
                    className={button + " mt-3"}
                    onClick={() => {
                      setDetail(null);
                      setSelected(n.id);
                    }}
                  >
                    {n.canEdit && ["draft", "returned"].includes(n.status)
                      ? "Complete report"
                      : n.canReview && n.status === "submitted"
                        ? "Review report"
                        : "Open report & history"}
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>{data?.total ?? 0} matching reports · 50 per page</span>
            <button
              className={button}
              disabled={offset === 0 || busy}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </button>
            <button
              className={button}
              disabled={busy || offset + 50 >= (data?.total ?? 0)}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </button>
          </div>
        </>
      )}
      {tab === "log" && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Log a one-off report</h2>
          <p className="text-sm text-slate-600">
            Choose a report type available to your position. Recurring reports
            are generated automatically in Reports & history.
          </p>
          {data?.types
            .filter(
              (t) =>
                t.status === "active" &&
                t.cadence === "one_off" &&
                t.assignments.length > 0,
            )
            .map((t) => (
              <form
                key={t.id}
                className="space-y-3 rounded-2xl border bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    mode: "create",
                    typeId: t.id,
                    assignmentId: f.get("assignment"),
                    periodStart: f.get("start"),
                    periodEnd: f.get("end"),
                  });
                }}
              >
                <h3 className="font-bold">{t.title}</h3>
                <p className="whitespace-pre-wrap text-sm text-slate-600">
                  {t.instructions}
                </p>
                <label className="block text-sm font-bold">
                  Submitting as
                  <select name="assignment" className={field}>
                    {t.assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Period / event start
                    <input
                      name="start"
                      type="date"
                      required
                      defaultValue={today()}
                      className={field}
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Period / event end
                    <input
                      name="end"
                      type="date"
                      required
                      defaultValue={today()}
                      className={field}
                    />
                  </label>
                </div>
                <button disabled={busy} className={primary}>
                  Create draft
                </button>
              </form>
            ))}
          {data &&
            !data.types.some(
              (t) =>
                t.status === "active" &&
                t.cadence === "one_off" &&
                t.assignments.length > 0,
            ) && (
              <p className="rounded-xl bg-slate-50 p-4 text-sm">
                No one-off report type is assigned to your current position. Ask
                your school leader to create the appropriate type and reviewer.
              </p>
            )}
        </section>
      )}
      {tab === "types" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Report types & schedules</h2>
            {!!data?.scopes.length && (
              <button className={primary} onClick={() => setEditor(null)}>
                Create report type
              </button>
            )}
          </div>
          <p className="text-sm text-slate-600">
            Define the form once and reuse it. Changes apply to future reports;
            existing reports retain their original form, deadline and reviewer.
            Pausing stops new requests, while existing reports remain
            actionable.
          </p>
          {editor !== false && data && (
            <TypeEditor
              key={editor?.id || "new"}
              type={editor}
              workspace={data}
              busy={busy}
              onSave={act}
              onCancel={() => setEditor(false)}
            />
          )}
          {data?.types.map((t) => (
            <TypeCard
              key={`${t.id}:${t.version}`}
              type={t}
              roles={data.roles}
              busy={busy}
              onEdit={() => setEditor(t)}
              onAction={act}
            />
          ))}
          {data?.types.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm">
              No reporting types yet. Start with the reports your school
              actually needs; avoid asking staff to repeat information already
              logged elsewhere.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function AnswerField({
  field: f,
  value,
  onChange,
  disabled,
}: {
  field: ReportField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  const string =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  return (
    <label className="block text-sm font-bold">
      {f.label}
      {f.required ? " *" : ""}
      {f.type === "textarea" ? (
        <textarea
          rows={4}
          maxLength={12000}
          disabled={disabled}
          className={field}
          value={string}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : f.type === "boolean" ? (
        <select
          disabled={disabled}
          className={field}
          value={value === true ? "yes" : value === false ? "no" : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : e.target.value === "yes")
          }
        >
          <option value="">Select…</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      ) : f.type === "select" ? (
        <select
          disabled={disabled}
          className={field}
          value={string}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          disabled={disabled}
          className={field}
          type={
            f.type === "url"
              ? "url"
              : f.type === "number"
                ? "number"
                : f.type === "date"
                  ? "date"
                  : "text"
          }
          step={f.type === "number" ? "any" : undefined}
          maxLength={12000}
          value={string}
          onChange={(e) =>
            onChange(
              f.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
function ReportEditor({
  report: n,
  history,
  busy,
  onAction,
}: {
  report: SchoolReport;
  history: Workspace["history"];
  busy: boolean;
  onAction: (input: Record<string, unknown>) => Promise<boolean>;
}) {
  const [payload, setPayload] = useState(n.payload),
    [note, setNote] = useState(""),
    [confirmation, setConfirmation] = useState<"withdraw" | "return" | null>(
      null,
    );
  const editable = n.canEdit && ["draft", "returned"].includes(n.status);
  const act = (mode: string) =>
    onAction({ mode, id: n.id, lockVersion: n.lock_version, payload, note });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{n.title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {n.ownerName} · {n.status} · Submission {n.revision} · Form version{" "}
          {n.type_version}
          <br />
          {dateOnly(n.period_start)} – {dateOnly(n.period_end)} · Due{" "}
          {time(n.due_at)} (Lagos)
          <br />
          Reviewer: {n.reviewerTitle}
          {n.submitted_at && (
            <>
              <br />
              Submitted {time(n.submitted_at)}
            </>
          )}
        </p>
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6">
        {n.instructions ||
          "Complete the fields below with the reporting period’s facts, results and next steps."}
      </p>
      {!n.reviewerAvailable && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">
          No eligible reviewer currently covers this report. Ask your school
          leader to assign the designated reviewer role to someone covering your
          campus and section. Your draft or submission is retained.
        </p>
      )}
      {n.review_note && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm">
          <strong>Reviewer / withdrawal note:</strong> {n.review_note}
        </p>
      )}
      {n.fields.map((f) => (
        <AnswerField
          key={f.key}
          field={f}
          value={payload[f.key]}
          disabled={busy || !editable}
          onChange={(v) => setPayload((p) => ({ ...p, [f.key]: v }))}
        />
      ))}
      {editable && (
        <div className="flex flex-wrap gap-3">
          <button
            className={button}
            disabled={busy}
            onClick={() => void act("save")}
          >
            Save draft
          </button>
          <button
            className={primary}
            disabled={busy}
            onClick={() => void act("submit")}
          >
            Submit to reviewer
          </button>
        </div>
      )}
      {n.canReview && ["submitted", "accepted"].includes(n.status) && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-bold">Review this report</h3>
          <label className="block text-sm font-bold">
            Review / correction note
            <textarea
              rows={3}
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={field}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            {n.status === "submitted" && (
              <button
                disabled={busy}
                className={primary}
                onClick={() => void act("accept")}
              >
                Accept report
              </button>
            )}
            <button
              className={button}
              disabled={busy}
              onClick={() => setConfirmation("return")}
            >
              Return for correction
            </button>
          </div>
        </div>
      )}
      {(n.canReview || (n.canEdit && n.occurrence_key.startsWith("log:"))) &&
        ["draft", "returned", "submitted"].includes(n.status) && (
          <button
            className={button}
            disabled={busy}
            onClick={() => setConfirmation("withdraw")}
          >
            Withdraw report
          </button>
        )}
      {confirmation && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold">
            {confirmation === "withdraw"
              ? "Withdraw this report?"
              : "Return this report for correction?"}
          </h3>
          <p className="text-sm">
            History is retained.{" "}
            {confirmation === "withdraw"
              ? "This will close the report and stop its outstanding reminders."
              : "The owner will be able to edit and resubmit it."}
          </p>
          <label className="block text-sm font-bold">
            Reason (required)
            <textarea
              minLength={5}
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={field}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              className={primary}
              disabled={busy || note.trim().length < 5}
              onClick={() => void act(confirmation)}
            >
              Confirm {confirmation === "withdraw" ? "withdrawal" : "return"}
            </button>
            <button className={button} onClick={() => setConfirmation(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <details className="rounded-xl bg-slate-50 p-3">
        <summary className="min-h-11 cursor-pointer font-bold">
          Submission & review history ({history.length})
        </summary>
        <div className="space-y-3">
          {history.map((h) => (
            <article
              key={h.id}
              className="rounded-xl border bg-white p-3 text-sm"
            >
              <p className="font-bold">
                {h.action} · Submission {h.revision} · {time(h.at)}
              </p>
              {h.note && <p className="mt-2 whitespace-pre-wrap">{h.note}</p>}
              {h.payload && Object.keys(h.payload).length > 0 && (
                <details>
                  <summary className="min-h-11 cursor-pointer">
                    Recorded answers
                  </summary>
                  {Object.entries(h.payload).map(([k, v]) => (
                    <p key={k} className="mt-2 whitespace-pre-wrap break-words">
                      <strong>
                        {n.fields.find((f) => f.key === k)?.label || k}:
                      </strong>{" "}
                      {typeof v === "boolean"
                        ? v
                          ? "Yes"
                          : "No"
                        : String(v ?? "")}
                    </p>
                  ))}
                </details>
              )}
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function TypeCard({
  type: t,
  roles,
  busy,
  onEdit,
  onAction,
}: {
  type: ReportType;
  roles: Workspace["roles"];
  busy: boolean;
  onEdit: () => void;
  onAction: (input: Record<string, unknown>) => Promise<boolean>;
}) {
  const [change, setChange] = useState(false),
    [status, setStatus] = useState(t.status),
    [note, setNote] = useState("");
  return (
    <article className="space-y-3 rounded-2xl border bg-white p-4">
      <h3 className="font-bold">
        {t.title}{" "}
        <span className="text-xs font-normal uppercase">
          · {t.status} · Version {t.version}
        </span>
      </h3>
      <p className="text-sm text-slate-600">
        {t.scopeLabel} · {frequencies.find(([k]) => k === t.cadence)?.[1]}
        {t.cadence === "custom_days" ? ` (${t.interval_days})` : ""} · Owner:{" "}
        {roles.find((r) => r.id === t.owner_role_id)?.title} · Reviewer:{" "}
        {roles.find((r) => r.id === t.reviewer_role_id)?.title}
        <br />
        Starts {dateOnly(t.start_date)}
        {t.end_date ? ` · Ends ${dateOnly(t.end_date)}` : ""} · Due {t.due_days}{" "}
        day(s) after period end at {t.due_time.slice(0, 5)} Lagos
      </p>
      {t.stats && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm">
          Reporting totals: {t.stats.open} open · {t.stats.overdue} overdue ·{" "}
          {t.stats.submitted} awaiting review · {t.stats.accepted} accepted ·{" "}
          {t.stats.withdrawn} withdrawn
        </p>
      )}
      {t.canManage && (
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={busy} onClick={onEdit}>
            Edit form & future deadlines
          </button>
          <button
            className={button}
            disabled={busy}
            onClick={() => setChange(!change)}
          >
            Pause / archive / resume
          </button>
        </div>
      )}
      {change && (
        <form
          className="space-y-3 rounded-xl bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void onAction({
              mode: "type_status",
              id: t.id,
              version: t.version,
              status,
              note,
            });
          }}
        >
          <label className="block text-sm font-bold">
            Status
            <select
              className={field}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as ReportType["status"])
              }
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="block text-sm font-bold">
            Reason
            <textarea
              required
              minLength={5}
              maxLength={3000}
              className={field}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button disabled={busy} className={primary}>
            Save status
          </button>
        </form>
      )}
    </article>
  );
}

function TypeEditor({
  type: t,
  workspace,
  busy,
  onSave,
  onCancel,
}: {
  type: ReportType | null;
  workspace: Workspace;
  busy: boolean;
  onSave: (input: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<ReportField[]>(
      t?.fields ?? standardFields.map((f) => ({ ...f })),
    ),
    [cadence, setCadence] = useState(t?.cadence ?? "weekly");
  const scopeIndex = t
    ? workspace.scopes.findIndex(
        (s) => s.campusId === t.campus_id && s.unitId === t.unit_id,
      )
    : 0;
  const [scope, setScope] = useState(Math.max(0, scopeIndex));
  function update(index: number, value: Partial<ReportField>) {
    setFields((old) =>
      old.map((f, i) => (i === index ? { ...f, ...value } : f)),
    );
  }
  return (
    <form
      id="report-type-editor"
      className="scroll-mt-36 space-y-5 rounded-2xl border-2 border-brand-200 bg-white p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          s = workspace.scopes[scope];
        if (!s) return;
        void onSave({
          mode: "type_save",
          id: t?.id,
          version: t?.version,
          title: f.get("title"),
          instructions: f.get("instructions"),
          campusId: s.campusId,
          unitId: s.unitId,
          ownerRoleId: t?.owner_role_id ?? f.get("owner"),
          reviewerRoleId: t?.reviewer_role_id ?? f.get("reviewer"),
          cadence,
          intervalDays: Number(f.get("interval") || t?.interval_days || 14),
          startDate: f.get("start"),
          endDate: f.get("end"),
          dueDays: Number(f.get("dueDays")),
          dueTime: f.get("dueTime"),
          fields,
          note: f.get("note"),
        });
      }}
    >
      <h3 className="text-xl font-bold">
        {t ? "Edit report type" : "Create report type"}
      </h3>
      <p className="text-sm text-slate-600">
        Choose a scope, submitter role and reviewer role. Each matching active
        position gets its own report. Reviewers must have an active assignment
        covering the submitter’s campus and section; nobody can review their own
        report.
      </p>
      <label className="block text-sm font-bold">
        Report name
        <input
          name="title"
          required
          minLength={3}
          maxLength={160}
          defaultValue={t?.title ?? ""}
          className={field}
          placeholder="e.g. Weekly sectional progress report"
        />
      </label>
      <label className="block text-sm font-bold">
        Instructions
        <textarea
          name="instructions"
          maxLength={6000}
          rows={3}
          defaultValue={t?.instructions ?? ""}
          className={field}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          School / campus / section
          <select
            disabled={!!t}
            className={field}
            value={scope}
            onChange={(e) => setScope(Number(e.target.value))}
          >
            {workspace.scopes.map((s, i) => (
              <option key={i} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Frequency
          <select
            disabled={!!t}
            className={field}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          >
            {frequencies.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Submitter role
          <select
            name="owner"
            required
            defaultValue={t?.owner_role_id ?? ""}
            className={field}
            disabled={!!t}
          >
            <option value="" disabled>
              Select role
            </option>
            {workspace.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Reviewer role
          <select
            name="reviewer"
            required
            defaultValue={t?.reviewer_role_id ?? ""}
            className={field}
            disabled={!!t}
          >
            <option value="" disabled>
              Select role
            </option>
            {workspace.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Start date
          <input
            name="start"
            type="date"
            required
            readOnly={!!t}
            defaultValue={t?.start_date ?? today()}
            className={field}
          />
        </label>
        <label className="block text-sm font-bold">
          End date (optional)
          <input
            name="end"
            type="date"
            defaultValue={t?.end_date ?? ""}
            className={field}
          />
        </label>
        {cadence === "custom_days" && (
          <label className="block text-sm font-bold">
            Repeat every N days
            <input
              name="interval"
              type="number"
              min={1}
              max={365}
              readOnly={!!t}
              required
              defaultValue={t?.interval_days ?? 14}
              className={field}
            />
          </label>
        )}
        <label className="block text-sm font-bold">
          Deadline: days after period end
          <input
            name="dueDays"
            type="number"
            min={0}
            max={90}
            required
            defaultValue={t?.due_days ?? 1}
            className={field}
          />
        </label>
        <label className="block text-sm font-bold">
          Deadline time (Lagos)
          <input
            name="dueTime"
            type="time"
            required
            defaultValue={t?.due_time.slice(0, 5) ?? "17:00"}
            className={field}
          />
        </label>
      </div>
      <p className="rounded-xl bg-slate-50 p-3 text-sm">
        Daily includes weekends; weekly periods run for 7 days from the start
        date. Monthly, quarterly and yearly reports close at the calendar
        boundary. Termly reports use active or closed terms in Academic
        Delivery; define the school’s term dates first. For irregular dates, use
        a one-off report.
      </p>
      <div className="space-y-3">
        <h4 className="font-bold">Report fields</h4>
        <p className="text-sm text-slate-600">
          Use up to 30 fields: short answers, narrative, numbers, dates, Yes/No,
          choices and evidence links. This saves links to documents, rather than
          uploading files.
        </p>
        {fields.map((f, i) => (
          <fieldset
            key={i}
            className="space-y-3 rounded-xl border bg-slate-50 p-3"
          >
            <legend className="px-1 text-sm font-bold">Field {i + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Label
                <input
                  required
                  maxLength={160}
                  className={field}
                  value={f.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
              </label>
              <label className="text-sm font-bold">
                Answer type
                <select
                  className={field}
                  value={f.type}
                  onChange={(e) =>
                    update(i, {
                      type: e.target.value as ReportField["type"],
                      ...(e.target.value === "select"
                        ? {
                            options: f.options?.length
                              ? f.options
                              : ["Option 1", "Option 2"],
                          }
                        : {}),
                    })
                  }
                >
                  {[
                    ["textarea", "Long answer"],
                    ["text", "Short answer"],
                    ["number", "Number"],
                    ["date", "Date"],
                    ["boolean", "Yes / No"],
                    ["select", "Choice"],
                    ["url", "HTTPS document link"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {f.type === "select" && (
              <label className="block text-sm font-bold">
                Choices (one per line)
                <textarea
                  className={field}
                  value={(f.options ?? []).join("\n")}
                  onChange={(e) =>
                    update(i, { options: e.target.value.split("\n") })
                  }
                />
              </label>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />
                Required
              </label>
              <button
                type="button"
                disabled={fields.length <= 1}
                className={button}
                onClick={() =>
                  setFields((old) => old.filter((_, x) => x !== i))
                }
              >
                Remove field
              </button>
            </div>
          </fieldset>
        ))}
        <button
          className={button}
          type="button"
          disabled={fields.length >= 30}
          onClick={() =>
            setFields((old) => [
              ...old,
              {
                key: `field_${crypto.randomUUID().replaceAll("-", "")}`,
                label: "",
                type: "textarea",
                required: false,
              },
            ])
          }
        >
          Add field
        </button>
      </div>
      {t && (
        <label className="block text-sm font-bold">
          Why change this form? (required)
          <textarea
            name="note"
            required
            minLength={5}
            maxLength={3000}
            className={field}
          />
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <button className={primary} disabled={busy || !workspace.scopes.length}>
          Save report type
        </button>
        <button className={button} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
