import Link from "next/link";
import { HeartPulse, Mail, MapPin, Phone } from "lucide-react";
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
    { href: "/#about", label: "About KAEC-NG" },
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
              {SITE.tagline} Built by {SITE.companyName}, a {SITE.companyCategory} helping people and institutions Discover, Develop and Deploy Potential.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint-50 px-3 py-1.5 text-xs font-semibold text-mint-700">
              <HeartPulse className="size-3.5" /> KSHC is free for every school
            </p>
          </div>

          {Object.entries(LINKS).map(([group, links]) => (
            <nav key={group} aria-label={group}>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{group}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-slate-600 transition-colors hover:text-brand-700">
                      {link.label}
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
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-600" />
                {SITE.location}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-brand-600" />
                {SITE.phone}
              </li>
              <li>
                <a href="https://www.kaecng.name.ng" className="font-semibold text-brand-700 transition-colors hover:underline">
                  {SITE.website}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} KAEC-NG. All rights reserved.</p>
          <p>Human Potential Development · Discover · Develop · Deploy</p>
        </div>
      </div>
    </footer>
  );
}
