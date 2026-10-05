"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { KhposOpsWorkRecordRequirement } from "@/lib/khpos/ops/work";

type Field = {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select" | "boolean";
  required: boolean;
  options: string[];
};

function readable(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function fieldsFor(schema: Record<string, unknown>): Field[] {
  const raw = schema.fields;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item): Field[] => {
    if (typeof item === "string") {
      return [
        {
          key: item,
          label: readable(item),
          type: "text",
          required: false,
          options: [],
        },
      ];
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    const key = typeof value.key === "string" ? value.key : "";
    if (!key) return [];

    const rawType = typeof value.type === "string" ? value.type : "text";
    const type: Field["type"] = [
      "text",
      "textarea",
      "date",
      "number",
      "select",
      "boolean",
    ].includes(rawType)
      ? (rawType as Field["type"])
      : "text";

    return [
      {
        key,
        label:
          typeof value.label === "string" && value.label.trim()
            ? value.label
            : readable(key),
        type,
        required: value.required === true,
        options: Array.isArray(value.options)
          ? value.options.map(String).filter(Boolean)
          : [],
      },
    ];
  });
}

function statusClasses(status: string) {
  if (status === "verified") return "bg-emerald-50 text-emerald-800";
  if (status === "returned") return "bg-amber-50 text-amber-900";
  return "bg-brand-50 text-brand-800";
}

export function WorkRecordRequirementCard({
  requirement,
  enabled,
  busy,
  onSubmit,
}: {
  requirement: KhposOpsWorkRecordRequirement;
  enabled: boolean;
  busy: boolean;
  onSubmit: (
    payload: Record<string, unknown>,
    recordId?: string | null,
  ) => Promise<void>;
}) {
  const fields = useMemo(
    () => fieldsFor(requirement.schemaDefinition),
    [requirement.schemaDefinition],
  );
  const returned = requirement.records.find((record) => record.status === "returned");
  const acceptedCount = requirement.records.filter((record) =>
    ["submitted", "verified"].includes(record.status),
  ).length;
  const satisfied = acceptedCount >= requirement.minimumEntries;
  const canAddAnother =
    requirement.toolType === "operating_log" || !satisfied || Boolean(returned);
  const [values, setValues] = useState<Record<string, unknown>>(
    () => returned?.payload ?? {},
  );
  const [localError, setLocalError] = useState("");

  async function submit() {
    setLocalError("");
    const missing = fields.find((field) => {
      if (!field.required) return false;
      const value = values[field.key];
      return (
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && !value.trim())
      );
    });

    if (missing) {
      setLocalError(`${missing.label} is required.`);
      return;
    }

    if (!fields.length && !Object.keys(values).length) {
      setLocalError("This controlled tool has no fields to submit yet.");
      return;
    }

    await onSubmit(values, returned?.id ?? null);
    if (!returned) setValues({});
  }

  const Icon =
    requirement.toolType === "operating_log" ? ClipboardList : FileText;

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
            <Icon className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-slate-950">
                {requirement.label}
              </p>
              {requirement.required && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase text-red-700">
                  Required
                </span>
              )}
              {requirement.verificationRequired && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-800">
                  Verification
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {requirement.toolCode} · {requirement.toolName}
            </p>
          </div>
        </div>
        <div className="text-xs font-bold text-slate-500">
          {acceptedCount}/{requirement.minimumEntries} submitted
        </div>
      </div>

      {requirement.records.length > 0 && (
        <div className="mt-4 space-y-2">
          {requirement.records.map((record) => (
            <div
              key={record.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {record.status === "verified" ? (
                    <CheckCircle2 className="size-4 text-emerald-700" />
                  ) : record.status === "returned" ? (
                    <RotateCcw className="size-4 text-amber-700" />
                  ) : (
                    <FileText className="size-4 text-brand-700" />
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusClasses(
                      record.status,
                    )}`}
                  >
                    {record.status}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(record.submittedAt))}
                </span>
              </div>
              {record.reviewNote && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  Reviewer: {record.reviewNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {enabled && canAddAnother && (
        <div className="mt-5 border-t border-slate-200 pt-5">
          {returned && (
            <p className="mb-4 text-sm font-bold text-amber-900">
              Correct the returned record and resubmit it.
            </p>
          )}

          {fields.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {fields.map((field) => {
                const value = values[field.key];
                const shared =
                  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-brand-400";

                if (field.type === "textarea") {
                  return (
                    <label
                      key={field.key}
                      className="text-sm font-bold lg:col-span-2"
                    >
                      {field.label}
                      {field.required && <span className="text-red-600"> *</span>}
                      <textarea
                        rows={4}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className={shared}
                      />
                    </label>
                  );
                }

                if (field.type === "select") {
                  return (
                    <label key={field.key} className="text-sm font-bold">
                      {field.label}
                      {field.required && <span className="text-red-600"> *</span>}
                      <select
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        className={shared}
                      >
                        <option value="">Choose…</option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {readable(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === "boolean") {
                  return (
                    <label
                      key={field.key}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                    >
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.checked,
                          }))
                        }
                      />
                      {field.label}
                    </label>
                  );
                }

                return (
                  <label key={field.key} className="text-sm font-bold">
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                    <input
                      type={field.type === "number" ? "number" : field.type}
                      value={
                        typeof value === "string" || typeof value === "number"
                          ? String(value)
                          : ""
                      }
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.key]:
                            field.type === "number"
                              ? event.target.value === ""
                                ? ""
                                : Number(event.target.value)
                              : event.target.value,
                        }))
                      }
                      className={shared}
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              This tool is registered but its submission fields are not yet
              defined in the Institutional Library.
            </p>
          )}

          {localError && (
            <p className="mt-3 text-sm font-semibold text-red-700">{localError}</p>
          )}

          <button
            type="button"
            disabled={busy || !fields.length}
            onClick={() => void submit()}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {returned
              ? "Resubmit record"
              : requirement.toolType === "operating_log"
                ? "Submit log entry"
                : "Submit report"}
          </button>
        </div>
      )}

      {!enabled && !satisfied && (
        <p className="mt-4 text-xs font-semibold text-slate-500">
          Start this work before completing its controlled record.
        </p>
      )}
    </section>
  );
}
