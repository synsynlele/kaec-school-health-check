import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-brand-700 shadow-[0_4px_12px_rgb(15_79_216/0.35)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M3.5 12h3l2-6 3.5 10 2.5-6h6"
            stroke="white"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-mint-500" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-extrabold tracking-tight text-slate-900">KAEC</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            School Health Check
          </span>
        </span>
      )}
    </span>
  );
}
