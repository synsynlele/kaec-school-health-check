import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "KHP-OS Secure Access",
  robots: { index: false, follow: false },
};

export default function KhposAccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-16 text-white">
      <div className="w-full max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-mint-300">
          <ShieldCheck className="size-4" /> KHP-OS | Secure Access
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
          Institutional transformation has two different doors.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">
          School workspaces are activated from a completed KSHC report. KAEC-NG platform custodians use the private Admin Console for cross-institution oversight.
        </p>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <Link
            href="/khpos/admin"
            className="group rounded-[28px] border border-mint-300/20 bg-white/5 p-6 transition hover:border-mint-300/50 hover:bg-white/10"
          >
            <ShieldCheck className="size-8 text-mint-300" />
            <h2 className="mt-5 text-2xl font-black">KAEC-NG Admin Console</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Platform-authorised portfolio monitoring, governance, operational queues and platform security.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-mint-300">
              Continue to Admin Console <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            href="/"
            className="group rounded-[28px] border border-white/10 bg-white/5 p-6 transition hover:border-white/25 hover:bg-white/10"
          >
            <Building2 className="size-8 text-white" />
            <h2 className="mt-5 text-2xl font-black">School transformation</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Complete or open KSHC, then activate the institution from its verified diagnostic report.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">
              Go to KSHC <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
