export default function PageLoading() {
  return <main className="grid min-h-[70vh] place-items-center bg-slate-50 p-6" aria-busy="true">
    <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-soft">
      <span aria-hidden="true" className="mx-auto mb-4 block size-8 animate-spin rounded-full border-4 border-brand-600 border-r-transparent" />
      <p className="font-bold text-slate-900">Opening page…</p>
      <p className="mt-2 text-sm text-slate-600">Your workspace will appear here.</p>
    </div>
  </main>;
}
