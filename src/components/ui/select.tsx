import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-[15px] text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-all hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:valid)]:text-slate-400",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
