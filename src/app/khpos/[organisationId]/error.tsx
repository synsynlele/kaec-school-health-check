"use client";

import Link from "next/link";

export default function SchoolPageError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-black">This page could not open</h1>
      <p role="alert" className="text-sm leading-6 text-slate-600">Try again. If the problem continues, return to your account and reopen the school workspace.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">Try again</button>
        <Link href="/account" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-bold">Open my account</Link>
        <Link href="/khpos" className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-brand-700 underline">Main entrance</Link>
      </div>
    </section>
  </main>;
}
