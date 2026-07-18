import Link from "next/link";
import { HeartPulse, Mail, MapPin } from "lucide-react";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

const LINKS = {
  Product: [
    { href: "/#how", label: "How it works" },
    { href: "/#receive", label: "What you receive" },
    { href: "/#faq", label: "FAQ" },
    { href: "/assessment", label: "Start assessment" },
  ],
  Company: [
    { href: "/#about", label: "About KAEC" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

export function Footer() {
  return (
    <footer className="no-print border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              {SITE.tagline} A free AI-powered diagnostic for school owners and leaders.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700">
              <HeartPulse className="size-3.5" /> Free for every school, forever
            </p>
          </div>

          {Object.entries(LINKS).map(([group, links]) => (
            <nav key={group} aria-label={group}>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{group}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-sm text-slate-600 transition-colors hover:text-brand-700">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Reach us</h4>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-brand-600" />
                <a href={`mailto:${SITE.email}`} className="transition-colors hover:text-brand-700">{SITE.email}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-600" />
                {SITE.location}
                {SITE.website}
              </li>
<li className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-600" />
                {SITE.website}
              </li>
<li className="flex items-center gap-2.5">
                <MapPin className="size-4 shrink-0 text-brand-600" />
                {SITE.phone}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} KAEC. All rights reserved.</p>
          <p>Know the health of your school in minutes.</p>
        </div>
      </div>
    </footer>
  );
}
