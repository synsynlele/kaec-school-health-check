"use client";

import { useId } from "react";

/** One accessible choice control for reports and controlled task forms. */
export function TapChoices({ label, options, value, onChange, multiple = false, disabled = false, required = false }: {
  label: string; options: readonly string[]; value: unknown; onChange: (value: string | string[]) => void;
  multiple?: boolean; disabled?: boolean; required?: boolean;
}) {
  const name = useId();
  const exclusive = ["None this period", "No work this period", "Not applicable"];
  const selected = Array.isArray(value) ? value : [];
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <legend className="text-sm font-bold">{label}{required ? " *" : ""}</legend>
    <p className="text-xs text-slate-600">{multiple ? "Choose all that apply." : "Choose one answer."}</p>
    <div className="flex flex-wrap gap-2">{options.map(option => <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base ${value === option || selected.includes(option) ? "border-brand-700 bg-brand-50 text-brand-900" : "border-slate-300 bg-white text-slate-900"} ${disabled ? "cursor-default opacity-75" : "hover:border-brand-500"}`}>
      <input type={multiple ? "checkbox" : "radio"} name={name} value={option} className="size-5 shrink-0 accent-blue-700"
        checked={multiple ? selected.includes(option) : value === option}
        onChange={() => onChange(multiple ? selected.includes(option) ? selected.filter(v => v !== option) : exclusive.includes(option) ? [option] : [...selected.filter(v => !exclusive.includes(String(v))), option] : option)} />
      <span className="break-words">{option}</span>
    </label>)}</div>
    {!required && !multiple && typeof value === "string" && value && !disabled && <button type="button" className="min-h-11 text-sm underline" onClick={() => onChange("")}>Clear answer</button>}
  </fieldset>;
}
