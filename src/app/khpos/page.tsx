import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Handshake, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "KHP-OS Secure Access",
  robots: { index: false, follow: false },
};

export default function KhposAccessPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 py-16 text-white">
      <div className="w-full max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-mint-300">
          <ShieldCheck className="size-4" /> KHP-OS | Secure Access
        </div>
        <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
          Account access and KHP-OS access are intentionally different.
        </h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
          Any school can use KSHC and create a free account. KHP-OS workspaces are available only to institutions with an active KAEC-NG partnership and authorised school membership.
        </p>
        <div className="mt-9 grid gap-5 lg:grid-cols-3">
          <Link href="/khpos/admin" className="group rounded-[28px] border border-mint-300/20 bg-white/5 p-6 transition hover:border-mint-300/50 hover:bg-white/10">
            <ShieldCheck className="size-8 text-mint-300" />
            <h2 className="mt-5 text-2xl font-black">KAEC-NG Admin Console</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Portfolio monitoring, governance, operational queues and platform security.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-mint-300">Continue to Admin Console <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/khpos/admin/partnerships" className="group rounded-[28px] border border-amber-300/20 bg-white/5 p-6 transition hover:border-amber-300/50 hover:bg-white/10">
            <Handshake className="size-8 text-amber-300" />
            <h2 className="mt-5 text-2xl font-black">Partnership Registry</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Approve, suspend, reactivate or end institutional KHP-OS access. MFA is required for changes.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-amber-300">Manage school partnerships <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/account" className="group rounded-[28px] border border-white/10 bg-white/5 p-6 transition hover:border-white/25 hover:bg-white/10">
            <Building2 className="size-8 text-white" />
            <h2 className="mt-5 text-2xl font-black">School account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">Sign in to KSHC, view partnership status, or start a free diagnostic. Active partners can open KHP-OS from their account.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">Go to school account <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </Link>
        </div>
      </div>
    </main>
  );
}
