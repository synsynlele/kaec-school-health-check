import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand-700 text-white shadow-[0_6px_16px_rgb(15_79_216/0.28)] hover:bg-brand-800 hover:shadow-[0_8px_20px_rgb(15_79_216/0.34)]",
        green:
          "bg-mint-600 text-white shadow-[0_6px_16px_rgb(5_150_105/0.28)] hover:bg-mint-700",
        secondary:
          "bg-brand-50 text-brand-800 hover:bg-brand-100 border border-brand-100",
        outline:
          "border border-slate-300 bg-white text-slate-800 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/50",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link: "text-brand-700 underline-offset-4 hover:underline shadow-none",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        default: "h-11 px-6",
        lg: "h-[52px] px-8 text-base",
        xl: "h-14 px-9 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
