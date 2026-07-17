import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-700 text-white",
        soft: "border-brand-100 bg-brand-50 text-brand-800",
        green: "border-mint-100 bg-mint-50 text-mint-700",
        amber: "border-amber-100 bg-amber-50 text-amber-700",
        red: "border-red-100 bg-red-50 text-red-700",
        outline: "border-slate-200 bg-white text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
