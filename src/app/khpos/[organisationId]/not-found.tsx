import Link from "next/link";

export default function SchoolPageNotFound() {
  return <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
    <section className="space-y-4 rounded-2xl border bg-white p-6">
      <h1 className="text-2xl font-black">School page not found</h1>
      <p className="text-sm leading-6 text-slate-600">This link may be out of date. Use the school menu to find a page, or choose a school from your account.</p>
      <Link href="/account" className="inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">Open my account</Link>
    </section>
  </main>;
}
