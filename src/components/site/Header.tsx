"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LogIn, Menu, UserPlus, X } from "lucide-react";
import { Logo } from "./Logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#benefits", label: "Benefits" },
  { href: "/#receive", label: "The report" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#about", label: "About KAEC" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "no-print fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-slate-200/70 bg-white/85 shadow-[0_2px_16px_rgb(15_23_42/0.05)] backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="KAEC School Health Check — home" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 lg:inline-flex"
          >
            <LogIn className="size-4" /> Sign in
          </Link>
          <Link
            href="/account"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden xl:inline-flex",
            )}
          >
            <UserPlus className="size-4" /> Create account
          </Link>
          <Link
            href="/assessment"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            Start Free Assessment
            <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-full text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-slate-200 bg-white/95 backdrop-blur-xl lg:hidden"
            aria-label="Mobile"
          >
            <div className="space-y-1 px-4 pb-5 pt-2">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-[15px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Sign in
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Create account
                </Link>
              </div>
              <div className="pt-1">
                <Link
                  href="/assessment"
                  onClick={() => setOpen(false)}
                  className={cn(buttonVariants({ size: "lg" }), "w-full")}
                >
                  Start Free Assessment <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
