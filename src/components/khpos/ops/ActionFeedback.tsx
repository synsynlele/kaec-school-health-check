import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";

export function ActionFeedback({ busy, error, notice, onDismiss }: {
  busy: boolean;
  error: string;
  notice: string;
  onDismiss: () => void;
}) {
  if (!busy && !error && !notice) return null;

  const label = busy ? "Working on your request" : error ? "Action needs attention" : "Action completed";
  return (
    <aside aria-label={label} className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[70] mx-auto max-w-lg sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0">
      <div className="pointer-events-auto flex max-h-[min(50svh,20rem)] items-start gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-2xl ring-1 ring-slate-950/5">
        {busy ? (
          <LoaderCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 animate-spin text-brand-700 motion-reduce:animate-none" />
        ) : error ? (
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-700" />
        ) : (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-slate-950">{label}</p>
          <p role={error ? "alert" : "status"} className="mt-1 break-words leading-5 text-slate-700">
            {busy ? notice || "Saving…" : error || notice}
          </p>
        </div>
        {!busy && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-700">
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
    </aside>
  );
}
