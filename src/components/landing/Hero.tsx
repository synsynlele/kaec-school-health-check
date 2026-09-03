import Link from "next/link";
import { ArrowRight, Lock, RefreshCw, Smartphone } from "lucide-react";
import { KhposDistributionButton } from "@/components/pwa/KhposDistributionButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReportPreview } from "./ReportPreview";

const TRUST = [
  { icon: Lock, text: "No login, no password" },
  { icon: RefreshCw, text: "Autosaves — resume anytime" },
  { icon: Smartphone, text: "Works beautifully on any phone" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100/70 via-brand-50 to-mint-50 blur-3xl" />
        <div className="absolute right-[-120px] top-40 size-[380px] rounded-full bg-mint-100/50 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(15_79_216/0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_79_216/0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-32 sm:px-6 sm:pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div className="max-w-xl">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-4 py-1.5 text-xs font-semibold text-brand-800 shadow-soft backdrop-blur">
              <span className="size-1.5 rounded-full bg-mint-500" />
              Free AI diagnostic · 55 indicators · 10 minutes
            </span>
          </div>

          <h1
            className="mt-6 animate-fade-up text-[42px] font-extrabold leading-[1.06] tracking-tight text-slate-900 sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Know the{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-brand-700">health</span>
              <svg viewBox="0 0 120 12" className="absolute -bottom-1 left-0 z-0 w-full" aria-hidden>
                <path d="M3 9 C 30 3, 90 3, 117 8" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            of your school in minutes
          </h1>

          <p
            className="mt-6 animate-fade-up text-lg leading-relaxed text-slate-500"
            style={{ animationDelay: "160ms" }}
          >
            Find hidden weaknesses. Protect what already works. Walk away with a professional,
            AI-powered School Health Report and a practical 90-day improvement plan —{" "}
            <span className="font-semibold text-slate-700">completely free</span>.
          </p>

          <div
            className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row sm:flex-wrap"
            style={{ animationDelay: "240ms" }}
          >
            <Link href="/assessment" className={cn(buttonVariants({ size: "xl" }), "group")}>
              Start Free Assessment
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <KhposDistributionButton />
            <Link href="#how" className={cn(buttonVariants({ variant: "outline", size: "xl" }))}>
              See how it works
            </Link>
          </div>

          <ul
            className="mt-9 flex animate-fade-up flex-wrap gap-x-6 gap-y-2.5"
            style={{ animationDelay: "320ms" }}
          >
            {TRUST.map((t) => (
              <li key={t.text} className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
                <t.icon className="size-4 text-brand-600" />
                {t.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="animate-fade-up py-10" style={{ animationDelay: "200ms" }}>
          <ReportPreview />
        </div>
      </div>
    </section>
  );
}
