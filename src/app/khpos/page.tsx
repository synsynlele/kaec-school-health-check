import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, CalendarDays, ClipboardCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "KHP-OS | Run your school",
  description: "Manage attendance, teaching, exams and follow-up in one school workspace with KHP-OS by KAEC-NG.",
};

const todayExamples = [
  { icon: Building2, title: "School attendance" },
  { icon: CalendarDays, title: "Tests and exams" },
  { icon: ClipboardCheck, title: "Work that needs attention" },
];

export default function KhposAccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-5 text-white sm:py-9">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-4">
          <Image src="/khpos-icon-192.png" alt="KHP-OS logo" width={88} height={88} priority className="size-[72px] rounded-2xl sm:size-[88px]" />
          <p className="font-bold text-mint-300">KHP-OS <span className="block text-sm font-medium text-slate-300">by KAEC-NG</span></p>
        </div>
        <section aria-labelledby="welcome-heading" className="mt-5 max-w-2xl">
          <h1 id="welcome-heading" className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Run your school with KHP-OS
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Manage attendance, teaching, exams, and follow-up in one place.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/account" className="group flex min-h-36 flex-col items-start gap-2 rounded-2xl bg-gradient-to-br from-mint-200 to-mint-400 p-4 text-slate-950 shadow-lg transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:p-5">
              <Building2 aria-hidden="true" className="size-8 rounded-lg bg-white/60 p-1.5" />
              <span className="text-lg font-black">Sign in to your school</span>
              <span className="text-sm">Open your school workspace.</span>
              <ArrowRight aria-hidden="true" className="ml-auto size-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/assessment" className="group flex min-h-36 flex-col items-start gap-2 rounded-2xl border border-sky-300/40 bg-gradient-to-br from-sky-950 to-slate-900 p-4 shadow-lg transition hover:border-sky-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:p-5">
              <BookOpenCheck aria-hidden="true" className="size-8 rounded-lg bg-sky-300/15 p-1.5 text-sky-200" />
              <span className="text-lg font-black">Start the free School Health Check</span>
              <span className="text-sm text-sky-100">Find out where your school can improve.</span>
              <ArrowRight aria-hidden="true" className="ml-auto size-5 text-sky-200 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>

        <div className="mt-3 grid max-w-2xl grid-cols-2 gap-2">
          <section className="min-w-0 rounded-xl border border-white/15 px-3 py-2.5">
            <h2 className="text-sm font-bold">An example school day</h2>
            <ul className="mt-1 space-y-1 text-xs leading-4 text-slate-300">
              {todayExamples.map(({ icon: Icon, title }) => (
                <li key={title} className="flex items-start gap-1.5">
                  <Icon aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-mint-300" />
                  {title}
                </li>
              ))}
            </ul>
          </section>
          <section className="min-w-0 rounded-xl border border-white/15 px-3 py-2.5">
            <h2 className="text-sm font-bold">Getting your school started</h2>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-4 text-slate-300">
              <li>Take the free health check.</li>
              <li>Apply for a school partnership.</li>
              <li>Get access through your school after approval.</li>
            </ol>
          </section>
        </div>
        <p className="mt-2 max-w-2xl text-xs text-slate-400">Account access and KHP-OS access are intentionally different.</p>

        <details className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-slate-300">
          <summary className="cursor-pointer font-bold text-white">KAEC HQ and platform administration</summary>
          <p className="mt-3 leading-6">For appointed KAEC team members and authorised platform administrators.</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/khpos/hq" className="text-mint-300 underline">Enter KAEC HQ</Link>
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
