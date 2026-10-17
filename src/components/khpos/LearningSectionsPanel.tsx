"use client";
import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  LEARNING_STAGES,
  type LearningStage,
} from "@/lib/khpos/learning-stages";
import type {
  LearningSection,
  LearningSections,
} from "@/lib/khpos/learning-sections";
export const LEARNING_SECTIONS_CHANGED = "khpos:learning-sections-changed";
const field =
  "mt-1 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-base";
const button =
  "min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-40";
export function LearningSectionsPanel({
  organisationId,
}: {
  organisationId: string;
}) {
  const [data, setData] = useState<LearningSections | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<LearningSection | null | false>(false);
  const request = useCallback(
    async (input?: Record<string, unknown>) => {
      const session = (await createBrowserSupabaseClient()?.auth.getSession())
        ?.data.session;
      if (!session) throw new Error("Sign in to view school sections.");
      const res = await fetch(
        `/api/khpos/learning-sections?school=${organisationId}`,
        {
          method: input ? "POST" : "GET",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          ...(input ? { body: JSON.stringify(input) } : {}),
        },
      );
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error || "School sections could not load.");
      return body.workspace as LearningSections;
    },
    [organisationId],
  );
  useEffect(() => {
    let live = true;
    void request()
      .then((w) => {
        if (live) setData(w);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [request]);
  async function save(input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      setData(await request(input));
      setEditor(false);
      window.dispatchEvent(new CustomEvent(LEARNING_SECTIONS_CHANGED, {detail:{organisationId}}));
      setNotice(
        "Section saved. Existing staff and records keep their assignments; refresh other open pages to see the updated section list.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Section could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="learning-sections"
      className="scroll-mt-36 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">Learning sections</h2>
        {data?.campuses.some((c) => c.canManage) && (
          <button className={button} onClick={() => setEditor(null)}>
            Add section
          </button>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-600">
        Configure the sections your campus actually runs: preschool, lower
        primary, upper primary, secondary or your own names. Each section uses
        the existing staff, teaching, learner progress and reporting workflows.
        Adding a section does not create or activate a campus.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      )}
      {!data && !error && <p className="text-sm">Loading sections…</p>}
      {editor !== false && data && (
        <SectionEditor
          key={editor?.id || "new"}
          section={editor}
          campuses={data.campuses.filter((c) => c.canManage)}
          busy={busy}
          onSave={save}
          onCancel={() => setEditor(false)}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.items.map((s) => (
          <article
            key={s.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <h3 className="font-bold">{s.name}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {data.campuses.find((c) => c.id === s.campusId)?.name ??
                "Campus no longer active"}{" "}
              · {s.status}
              <br />
              {LEARNING_STAGES.find((v) => v.code === s.stage)?.label ??
                "School-defined"}
            </p>
            {s.canManage && (
              <button className={button + " mt-3"} onClick={() => setEditor(s)}>
                Edit / disable / restore
              </button>
            )}
          </article>
        ))}
      </div>
      {data?.items.length === 0 && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm">
          No learning sections configured. Your School Custodian or campus
          Guardian can add the sections this school offers.
        </p>
      )}
    </section>
  );
}
function SectionEditor({
  section: s,
  campuses,
  busy,
  onSave,
  onCancel,
}: {
  section: LearningSection | null;
  campuses: LearningSections["campuses"];
  busy: boolean;
  onSave: (input: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<LearningStage>(s?.stage ?? "preschool"),
    [name, setName] = useState(s?.name ?? "Preschool");
  return (
    <form
      className="space-y-3 rounded-xl border-2 border-brand-200 bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          id: s?.id,
          campusId: s?.campusId ?? f.get("campus"),
          name,
          stage,
          status: f.get("status"),
          updatedAt: s?.updatedAt,
          note: f.get("note"),
        });
      }}
    >
      <h3 className="font-bold">
        {s ? "Edit section" : "Add learning section"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Campus
          <select
            name="campus"
            disabled={!!s}
            required
            defaultValue={s?.campusId ?? campuses[0]?.id ?? ""}
            className={field}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Learning stage
          <select
            className={field}
            value={stage}
            onChange={(e) => {
              const code = e.target.value as LearningStage;
              setStage(code);
              if (!s)
                setName(
                  LEARNING_STAGES.find((v) => v.code === code)?.name ?? "",
                );
            }}
          >
            {LEARNING_STAGES.map((v) => (
              <option key={v.code} value={v.code}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          School’s section name
          <input
            required
            minLength={3}
            maxLength={100}
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Early Years, Lower Primary or Upper Primary"
          />
        </label>
        <label className="text-sm font-bold">
          Status
          <select
            name="status"
            defaultValue={
              s?.status === "active" ? "active" : s ? "inactive" : "active"
            }
            className={field}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      {s && (
        <label className="block text-sm font-bold">
          Reason for the change
          <textarea
            name="note"
            required
            minLength={5}
            maxLength={2000}
            className={field}
          />
        </label>
      )}
      <p className="text-xs leading-5 text-slate-600">
        Rename and restore preserve the section’s identity and history. Reassign
        active staff, positions and teaching streams before disabling it. A
        section cannot be moved to a different campus here.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || campuses.length === 0}
          className={button + " bg-brand-700 text-white"}
        >
          Save section
        </button>
        <button type="button" className={button} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
