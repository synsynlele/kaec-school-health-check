import Link from "next/link";
import { getToolGuide, toolFieldPreview } from "@/lib/khpos/ops/tool-guides";
import type { KhposOpsToolTemplate } from "@/lib/khpos/ops/library";
export function ToolUsageGuide({
  tool,
  organisationId,
}: {
  tool: KhposOpsToolTemplate;
  organisationId: string;
}) {
  const guide = getToolGuide(tool.toolType),
    fields = toolFieldPreview(tool.schemaDefinition);
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
      <Link
        href={`/khpos/${organisationId}${guide.destination}`}
        className="inline-flex min-h-12 items-center rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white"
      >
        {guide.label} →
      </Link>
      <p className="text-xs leading-5 text-slate-500">
        Available forms and actions depend on your role and the school’s
        approved setup.
      </p>
    </div>
  );
}
