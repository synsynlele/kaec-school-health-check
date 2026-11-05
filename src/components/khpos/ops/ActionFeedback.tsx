export function ActionFeedback({ busy, error, notice, onDismiss }: {
  busy: boolean;
  error: string;
  notice: string;
  onDismiss: () => void;
}) {
  if (!busy && !error && !notice) return null;

  return (
    <aside className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-lg sm:inset-x-auto sm:bottom-6 sm:right-6">
      {busy ? (
        <p role="status" className="flex items-center gap-2 font-semibold text-slate-900">
          <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
          {notice || "Saving…"}
        </p>
      ) : (
        <>
          <p role={error ? "alert" : "status"} className={error ? "text-rose-900" : "text-emerald-900"}>
            {error || notice}
          </p>
          <button type="button" onClick={onDismiss} className="ml-auto shrink-0 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-900">
            OK
          </button>
        </>
      )}
    </aside>
  );
}
