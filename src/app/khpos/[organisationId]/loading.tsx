export default function SchoolPageLoading() {
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6" aria-busy="true">
    <p role="status" className="flex items-center gap-3 text-sm font-bold text-slate-700">
      <span aria-hidden="true" className="size-5 rounded-full border-2 border-brand-600 border-r-transparent motion-safe:animate-spin" />
      Opening your school page…
    </p>
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2"><div className="h-32 rounded-2xl border bg-white" /><div className="h-32 rounded-2xl border bg-white" /></div>
      <div className="h-48 rounded-2xl border bg-white" />
    </div>
  </main>;
}
