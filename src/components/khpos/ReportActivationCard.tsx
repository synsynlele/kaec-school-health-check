import Link from "next/link";
import { ArrowRight, CheckCircle2, Orbit } from "lucide-react";

export function ReportActivationCard({ assessmentId }: { assessmentId: string }) {
  return (
    <section className="no-print">
      <div className="relative overflow-hidden rounded-[32px] bg-slate-950 px-7 py-10 text-white shadow-lift sm:px-10 sm:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-24 size-72 rounded-full bg-brand-600/30 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 size-72 rounded-full bg-mint-400/15 blur-3xl" />
        </div>
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-mint-300">
              <Orbit className="size-4" /> Continue into KHP-OS
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
              Do not let this report become another document in a folder.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Activate a secure institutional workspace and turn this diagnosis into priorities, interventions, implementation, evidence, review and measurable improvement.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-400" /> Preserve this baseline</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-400" /> Build institutional history</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-mint-400" /> Google sign-in first</span>
            </div>
          </div>
          <Link
            href={`/activate/${assessmentId}`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-mint-400 px-7 py-3.5 text-sm font-extrabold text-slate-950 transition hover:-translate-y-0.5 hover:bg-mint-300"
          >
            Activate KHP-OS <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
