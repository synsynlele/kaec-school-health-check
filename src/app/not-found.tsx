import Link from "next/link";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-b from-brand-50/70 via-white to-white px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[380px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      </div>
      <div className="relative max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-10 text-[88px] font-black leading-none tracking-tighter text-brand-100">404</p>
        <span className="mx-auto -mt-14 grid size-14 place-items-center rounded-2xl bg-brand-700 shadow-lift">
          <Compass className="size-7 text-white" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900">
          This page took an unexpected school trip
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          The link may be old, mistyped, or the page may have moved. The Health Check — the thing most
          people come for — is right where it should be.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/assessment" className={cn(buttonVariants({ size: "lg" }))}>
            <ArrowLeft className="size-4" /> Start Free Assessment
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            <Home className="size-4" /> Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
