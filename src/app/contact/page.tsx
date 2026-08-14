import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CalendarClock, HeartHandshake, Mail, MapPin, Sparkles } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/site/ContactForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact KAEC-NG",
  description:
    "Talk to KAEC-NG about institutional transformation, capability development, KHP-OS deployment, staff development or partnerships.",
};

const TYPES = ["consultation", "training", "talk", "general"] as const;
type RequestType = (typeof TYPES)[number];

const HEADINGS: Record<RequestType, { title: string; sub: string }> = {
  consultation: {
    title: "Discuss institutional transformation",
    sub: "Tell us about your school, what the evidence is showing and what you are trying to improve. A KAEC-NG team member will reply within one working day to identify the right next step.",
  },
  training: {
    title: "Request capability development",
    sub: "From classroom practice to leadership routines — tell us what your people need to become more capable, and we will identify the right development pathway.",
  },
  talk: {
    title: "Talk to KAEC-NG",
    sub: "Questions about your health report, KHP-OS, our Human Potential Development approach or where to start? Send a message — a human reads every one.",
  },
  general: {
    title: "Contact KAEC-NG",
    sub: "Institutional transformation, capability development, platform deployment, partnerships or press — this inbox reaches the KAEC-NG team.",
  },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.type === "string" ? sp.type : "general";
  const type: RequestType = (TYPES as readonly string[]).includes(raw) ? (raw as RequestType) : "general";
  const heading = HEADINGS[type];

  return (
    <>
      <Header />
      <main className="pt-[68px]">
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 left-1/2 h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-1.5 text-xs font-semibold text-brand-800 shadow-soft">
              <HeartHandshake className="size-3.5" /> We reply within one working day
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {heading.title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500">{heading.sub}</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <Card className="flex items-start gap-4 p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50">
                  <Mail className="size-5 text-brand-700" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Email us directly</h2>
                  <a href={`mailto:${SITE.email}`} className="mt-1 block text-sm font-medium text-brand-700 hover:underline">
                    {SITE.email}
                  </a>
                  <p className="mt-1 text-sm text-slate-500">Every message reaches the KAEC-NG team, not a bot.</p>
                </div>
              </Card>
              <Card className="flex items-start gap-4 p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50">
                  <MapPin className="size-5 text-brand-700" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Where we work</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Based in {SITE.location} — building Human Potential Development systems for institutions in Africa and beyond, on site and remotely.
                  </p>
                </div>
              </Card>
              <Card className="flex items-start gap-4 p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint-50">
                  <BookOpenCheck className="size-5 text-mint-700" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">Starting with diagnosis?</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    The transformation journey starts with knowing where your school really is.{" "}
                    <Link href="/assessment" className="font-semibold text-brand-700 hover:underline">
                      Run the free KSHC
                    </Link>{" "}
                    first — it takes about ten minutes.
                  </p>
                </div>
              </Card>
              <Card className="flex items-start gap-4 bg-brand-950 p-6 text-white">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10">
                  <CalendarClock className="size-5 text-white" />
                </span>
                <div>
                  <h2 className="font-bold">What happens next</h2>
                  <p className="mt-1 text-sm leading-relaxed text-brand-100">
                    We read your message, review your context and identify the most useful next step — whether that is KSHC, KHP-OS, capability development, a partnership conversation or simply more time to build internally.
                  </p>
                </div>
              </Card>
            </div>

            <Card className="h-fit p-7 sm:p-9">
              <div className="mb-6 flex items-center gap-2.5">
                <Sparkles className="size-5 text-brand-600" />
                <h2 className="text-xl font-bold text-slate-900">Send us a message</h2>
              </div>
              <ContactForm defaultType={type} />
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
