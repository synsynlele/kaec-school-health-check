import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<"div"> {
  value: number; // 0–100
  indicatorClassName?: string;
}

function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out",
          indicatorClassName,
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export { Progress };
