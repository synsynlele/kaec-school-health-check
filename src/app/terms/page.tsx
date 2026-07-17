import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Card } from "@/components/ui/card";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of the KAEC School Health Check platform.",
};

const SECTIONS = [
  {
    title: "The service",
    body: [
      "KAEC School Health Check is a free, AI-powered self-assessment for schools. You answer a structured questionnaire; the platform generates an indicative health report with scores, analysis and a suggested improvement plan.",
      "The service is provided as-is, free of charge, without accounts or subscriptions.",
    ],
  },
  {
    title: "What the report is — and is not",
    body: [
      "Your report is a decision-support tool built from the answers you provide. It is not an inspection, an audit, accreditation, or professional advice in the legal, financial or regulatory sense. Scores reflect your own ratings analysed against a standard framework — honest inputs produce useful outputs; flattering inputs produce flattering fiction.",
      "Decisions about your school remain yours. KAEC accepts no liability for outcomes arising from how you choose to use or interpret a report.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "You agree to provide truthful information, to use the service for lawful purposes, and not to attempt to disrupt, scrape at abusive volume, or reverse-engineer the platform. We may rate-limit or block usage that degrades the service for others.",
      "Report links are unlisted but accessible to anyone holding them — share them only with people you trust with your school's results.",
    ],
  },
  {
    title: "Intellectual property",
    body: [
      "The assessment framework, question bank, report structures and branding remain the property of KAEC. Your school may freely use, print and share its own reports and PDFs internally and with its stakeholders.",
    ],
  },
  {
    title: "Availability & changes",
    body: [
      "We aim for high availability but do not guarantee uninterrupted service. We may improve, change or retire features over time. Material changes to these terms will be noted on this page with an updated date.",
    ],
  },
  {
    title: "Contact",
    body: [
      `Questions about these terms? Email ${SITE.email}.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="pt-[68px]">
        <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-1.5 text-xs font-semibold text-brand-800 shadow-soft">
              <ScrollText className="size-3.5" /> Fair and readable
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Terms of Service</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">
              Free tool, honest outputs, shared responsibility. Here is exactly where everyone stands.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="space-y-5">
            {SECTIONS.map((s, i) => (
              <Card key={s.title} className="p-7 sm:p-8">
                <h2 className="flex items-baseline gap-3 text-lg font-bold text-slate-900">
                  <span className="text-sm font-black text-brand-600">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="mt-3 space-y-3">
                  {s.body.map((p, j) => (
                    <p key={j} className="text-sm leading-relaxed text-slate-600">{p}</p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-slate-400">
            Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · {SITE.name}
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
