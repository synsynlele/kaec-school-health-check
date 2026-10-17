import Link from "next/link";
import { getToolGuide, toolFieldPreview } from "@/lib/khpos/ops/tool-guides";
import {
  relatedToolProcesses,
  processDocumentHref,
} from "@/lib/khpos/ops/library-navigation";
import type {
  KhposOpsProcess,
  KhposOpsToolTemplate,
} from "@/lib/khpos/ops/library";
export function ToolUsageGuide({
  tool,
  organisationId,
  processes = [],
}: {
  tool: KhposOpsToolTemplate;
  organisationId: string;
  processes?: KhposOpsProcess[];
}) {
  const guide = getToolGuide(tool.toolType),
    fields = toolFieldPreview(tool.schemaDefinition);
  const related = relatedToolProcesses(tool, processes);
  const opensProcesses = guide.destination === "/library?tab=processes";
  return (
    <div className="space-y-5">
      <section>
        <h4 className="font-bold text-slate-900">When to use it</h4>
        <p className="mt-2 text-sm leading-6 text-slate-700">{guide.when}</p>
      </section>
      <section>
        <h4 className="font-bold text-slate-900">What to do</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      {fields.length > 0 && (
        <section>
          <h4 className="font-bold text-slate-900">What the form asks for</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This is a preview. Complete and submit the actual form in the linked
            work area.
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {fields.map((f, i) => (
              <div key={i} className="min-w-0 rounded-xl bg-slate-50 p-3">
                <dt className="text-sm font-bold text-slate-800">{f.label}</dt>
                <dd className="mt-1 break-words text-sm text-slate-600">
                  {f.answer}
                  {f.required === true
                    ? " · Required"
                    : f.required === false
                      ? " · Optional"
                      : ""}
                  {f.options.length > 0 ? ` · ${f.options.join(", ")}` : ""}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {fields.length === 0 && !guide.automatic && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          The fields and available actions are shown in the relevant work area.
          This page explains the tool; it does not create a new record.
        </p>
      )}
      {related.length > 0 && (
        <section className="space-y-3">
          <h4 className="font-bold text-slate-900">
            {related.length === 1
              ? "Process using this tool"
              : "Processes using this tool"}
          </h4>
          <p className="text-sm text-slate-600">
            Choose a process to open its current document and operating
            instructions.
          </p>
          <div className="space-y-2">
            {related.map((process) => (
              <Link
                key={process.id}
                href={processDocumentHref(organisationId, process.id)}
                className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm font-bold text-brand-900"
              >
                <span>
                  {process.code} · {process.title}
                </span>
                <span className="text-xs font-normal">
                  {process.activeVersion
                    ? "Published document"
                    : "Document awaiting publication"}{" "}
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {opensProcesses && related.length === 0 && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
          No process-to-tool connection is recorded for this tool in the
          Library. Browse the school’s processes and check the instructions with
          your school leader; this guide cannot identify a specific related
          process yet.
        </p>
      )}
      {(!opensProcesses || related.length === 0) && (
        <Link
          href={`/khpos/${organisationId}${guide.destination}`}
          className="inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white"
        >
          {opensProcesses ? "Browse processes" : guide.label} →
        </Link>
      )}
      <p className="text-xs leading-5 text-slate-500">
        Available forms and actions depend on your role and the school’s
        approved setup.
      </p>
    </div>
  );
}
