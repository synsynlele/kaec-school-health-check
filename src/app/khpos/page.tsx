import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Building2, CalendarDays, ClipboardCheck, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "KHP-OS | Run your school",
  description: "Manage attendance, teaching, exams and follow-up in one school workspace with KHP-OS by KAEC-NG.",
};

const todayExamples = [
  { icon: Building2, title: "School attendance", detail: "Record your arrival and departure." },
  { icon: CalendarDays, title: "Tests and exams", detail: "See your invigilation duty, check in and submit your report." },
  { icon: ClipboardCheck, title: "Work that needs attention", detail: "Open an assigned action and record what was done." },
];

export default function KhposAccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-white/5 px-4 py-2 text-xs font-bold text-mint-300">
          <ShieldCheck aria-hidden="true" className="size-4" /> KHP-OS by KAEC-NG
        </div>
        <div className="mt-7 grid items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <section aria-labelledby="welcome-heading">
            <h1 id="welcome-heading" className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Run your school with KHP-OS
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              See who’s on duty, what needs attention, and what’s been completed. Manage attendance, teaching, exams, and follow-up in one place.
            </p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/account" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-mint-300 px-4 py-3 font-bold text-slate-950 hover:bg-mint-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Sign in to your school <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link href="/assessment" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <BookOpenCheck aria-hidden="true" className="size-4" /> Start the free School Health Check
              </Link>
            </div>
          </section>

          <section aria-labelledby="today-preview" className="rounded-3xl border border-white/15 bg-white/5 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-mint-300">Example school day</p>
            <h2 id="today-preview" className="mt-2 text-2xl font-black">What you can do in Today</h2>
            <ul className="mt-4 divide-y divide-white/15">
              {todayExamples.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3 py-3">
                  <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-mint-300" />
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6" aria-labelledby="getting-started">
          <h2 id="getting-started" className="text-xl font-black">Getting your school started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Complete the free School Health Check to see where your school can improve.</li>
            <li>Apply for a school partnership. KAEC-NG reviews and approves access to KHP-OS.</li>
            <li>Once approved, your school authorises your role so you can sign in and open its workspace.</li>
          </ol>
        </section>

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
