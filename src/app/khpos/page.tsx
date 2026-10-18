import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "KHP-OS | Schools & KAEC HQ Access",
  description: "KHP-OS by KAEC-NG helps approved schools manage responsibilities, daily action, evidence, wellbeing and improvement.",
};

export default function KhposAccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-white/5 px-4 py-2 text-xs font-bold text-mint-300">
          <ShieldCheck className="size-4" /> KHP-OS by KAEC-NG
        </div>
        <h1 className="mt-8 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Your school. Your network. One clear entrance.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
          Know what needs attention today, carry out your assigned responsibilities and keep completed work in its proper History.
        </p>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          <Link href="/account" className="group flex min-h-48 flex-col justify-between rounded-3xl bg-mint-300 p-6 text-slate-950 focus-visible:outline-4 focus-visible:outline-white">
            <Building2 className="size-9" />
            <span><strong className="block text-2xl font-black">Sign in to your school</strong><span className="mt-2 block text-sm leading-6">Open your approved school workspace or create a free KSHC account.</span></span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-black">Continue <ArrowRight className="size-4" /></span>
          </Link>
          <Link href="/assessment" className="group flex min-h-48 flex-col justify-between rounded-3xl border border-white/20 bg-white/5 p-6 text-white transition hover:bg-white/10">
            <BookOpenCheck className="size-9 text-brand-200" />
            <span><strong className="block text-2xl font-black">Run a School Health Check</strong><span className="mt-2 block text-sm leading-6 text-slate-300">Not yet a partner school? Begin with the free school diagnostic.</span></span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-black">Start KSHC <ArrowRight className="size-4" /></span>
          </Link>
          <Link href="/khpos/hq" className="group flex min-h-48 flex-col justify-between rounded-3xl border border-mint-300/40 bg-mint-300/10 p-6 text-white transition hover:bg-mint-300/20 focus-visible:outline-4 focus-visible:outline-white">
            <ShieldCheck className="size-9 text-mint-300" />
            <span><strong className="block text-2xl font-black">Enter KAEC HQ</strong><span className="mt-2 block text-sm leading-6 text-slate-300">For appointed KAEC team members: coordinate partner schools, visits, actions and reports.</span></span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-black">Open HQ <ArrowRight className="size-4" /></span>
          </Link>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">KAEC HQ requires a corporate appointment. School membership alone does not grant HQ access.</p>
        <p className="mt-7 max-w-2xl text-sm leading-6 text-slate-400">Account access and KHP-OS access are intentionally different. Creating a free account does not automatically give access to KHP-OS. KAEC-NG must first approve the school partnership, and your school must authorise your position.</p>

        <details className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          <summary className="cursor-pointer font-bold text-white">KAEC-NG platform administration</summary>
          <p className="mt-3 leading-6">These areas are restricted to authorised KAEC-NG platform administrators and may require additional verification.</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/khpos/admin" className="text-mint-300 underline">Admin Console</Link>
            <Link href="/khpos/admin/partnerships" className="text-mint-300 underline">Partnership Registry</Link>
            <Link href="/khpos/portfolio" className="text-mint-300 underline">Portfolio Intelligence</Link>
          </div>
        </details>
        <footer className="mt-10 flex flex-wrap gap-5 border-t border-white/10 pt-5 text-xs font-semibold text-slate-300">
          <Link href="/privacy" className="underline">Privacy</Link>
          <Link href="/terms" className="underline">Terms</Link>
          <Link href="/delete-account" className="underline">Account deletion</Link>
          <Link href="/contact" className="underline">Help</Link>
        </footer>
      </div>
    </main>
  );
}
