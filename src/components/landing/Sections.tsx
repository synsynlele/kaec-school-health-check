import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  HeartHandshake,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import type { GlobalStats } from "@/lib/types";
import { CHAPTER_MAP } from "@/lib/questions";
import type { ChapterKey } from "@/lib/questions";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ContactForm } from "@/components/site/ContactForm";

/* ── Credibility strip ─────────────────────────────────────── */
export function StatsStrip({ stats }: { stats: GlobalStats }) {
  const items = [
    { value: "55", label: "health indicators analysed" },
    { value: "11", label: "school areas scored" },
    { value: "~10", label: "minutes, start to report" },
    stats.totalReports > 0
      ? { value: String(stats.totalReports), label: "school reports generated" }
      : { value: "100%", label: "free — report, PDF & coach" },
  ];
  return (
    <section className="border-y border-slate-100 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 0.06} className="text-center">
            <p className="text-3xl font-extrabold tracking-tight text-brand-700 sm:text-4xl">{it.value}</p>
            <p className="mt-1 text-[13px] font-medium text-slate-500">{it.label}</p>
            {stats.totalReports > 0 && i === 3 && stats.averageScore > 0 && (
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                average score {stats.averageScore}/100
              </p>
            )}
            {stats.totalReports > 0 && i === 3 && stats.mostCommonWeakness && (
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                most common gap: {CHAPTER_MAP[stats.mostCommonWeakness as ChapterKey]?.shortTitle ?? ""}
              </p>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── How it works ──────────────────────────────────────────── */
const STEPS = [
  {
    icon: ClipboardList,
    title: "Tell us about your school",
    text: "A two-minute profile — name, size, type, location. No account, no password, straight in.",
  },
  {
    icon: BrainCircuit,
    title: "Rate 55 health indicators",
    text: "Eleven areas, one honest question at a time. Every answer autosaves; drop off and resume exactly where you stopped.",
  },
  {
    icon: FileText,
    title: "Receive your AI health report",
    text: "Scores, analysis, prioritised recommendations and a 90-day plan — on screen, in your inbox, and as a beautiful PDF.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From honest answers to a professional diagnosis"
          description="Three steps. Ten minutes. The clearest picture of your school you have ever had."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.09}>
              <Card className="relative h-full p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift sm:p-8">
                <span className="absolute right-6 top-6 text-5xl font-black text-slate-100">{i + 1}</span>
                <span className="grid size-12 place-items-center rounded-2xl bg-brand-700 shadow-[0_6px_16px_rgb(15_79_216/0.3)]">
                  <s.icon className="size-6 text-white" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{s.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Benefits ──────────────────────────────────────────────── */
const BENEFITS = [
  {
    icon: Target,
    title: "Find hidden weaknesses",
    text: "The gaps you sense but cannot name — in leadership, finance, safety and beyond — surfaced and scored.",
  },
  {
    icon: BarChart3,
    title: "Evidence, not guesswork",
    text: "Eleven department scores turn vague worries into a clear, shared picture your whole team can act on.",
  },
  {
    icon: CalendarCheck,
    title: "A plan, not just a score",
    text: "Quick wins for this week, then a sequenced 30/60/90-day roadmap a real school can actually execute.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Your answers generate your report and nothing else. No accounts to leak; only anonymous statistics are kept.",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for real schools",
    text: "Mobile-first, fast on any connection, autosaves through network drops. Designed for busy proprietors.",
  },
  {
    icon: HeartHandshake,
    title: "Backed by KAEC",
    text: "The AI is trained on KAEC's school-improvement framework — and humans are one message away when you want help.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="scroll-mt-24 bg-slate-50 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why schools use it"
          title="The honest mirror every school needs"
          description="Most school health problems grow quietly for years. This is the fastest way to see them early — and fix them cheaply."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 0.08}>
              <Card className="h-full p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50">
                  <b.icon className="size-5.5 text-brand-700" />
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{b.text}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── What you'll receive ───────────────────────────────────── */
const DELIVERABLES = [
  "Overall health score & clear rating",
  "Scores across all 11 departments",
  "AI analysis of every area of your school",
  "Your biggest strengths — protected and named",
  "Your biggest weaknesses — with their real cost",
  "Prioritised, effort-rated recommendations",
  "Quick wins you can start this week",
  "A sequenced 30 / 60 / 90-day improvement plan",
  "A beautiful PDF for your board and your files",
  "An AI Coach that answers questions about your report",
];

export function Receive() {
  return (
    <section id="receive" className="scroll-mt-24 overflow-hidden py-24 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">What you'll receive</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            One report. Everything a serious school leader needs.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Not a vague score — a working document you can take into your next staff meeting.
            Formatted for screen, delivered by email, downloadable as a PDF.
          </p>
          <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {DELIVERABLES.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-sm text-slate-600">
                <CheckCircle2 className="mt-0.5 size-[18px] shrink-0 text-mint-600" />
                <span className="leading-snug">{d}</span>
              </li>
            ))}
          </ul>
          <Link href="/assessment" className={cn(buttonVariants({ size: "lg" }), "group mt-9")}>
            Get your free report
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <Reveal delay={0.12}>
          <Card className="relative overflow-hidden p-7 sm:p-9">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-brand-50" aria-hidden />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-mint-600 shadow-[0_6px_16px_rgb(5_150_105/0.3)]">
                  <CalendarCheck className="size-6 text-white" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">The 90-day plan</h3>
                  <p className="text-sm text-slate-500">Every report ends with a roadmap</p>
                </div>
              </div>
              <div className="mt-7 space-y-4">
                {[
                  { phase: "Days 1–30", title: "Stabilise", text: "Quick wins that build belief and momentum across your team." },
                  { phase: "Days 31–60", title: "Systemise", text: "Install the routines — dashboards, visit rhythms, collection cycles." },
                  { phase: "Days 61–90", title: "Embed & measure", text: "Verify the change, tell parents, and set up the next quarter." },
                ].map((p, i) => (
                  <div key={p.phase} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      {i < 2 && <span className="mt-1 w-px grow bg-slate-200" aria-hidden />}
                    </div>
                    <div className="pb-1">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{p.phase}</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">{p.title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <Download className="size-5 shrink-0 text-brand-600" />
                <p className="text-[13px] font-medium leading-snug text-slate-600">
                  Export the entire report as a branded PDF — ready for your board, your bank or your files.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

/* ── About KAEC ────────────────────────────────────────────── */
const VALUES = [
  { icon: BarChart3, title: "Evidence over opinion", text: "We would rather show you a hard number than a comfortable story." },
  { icon: TrendingUp, title: "Practical over perfect", text: "Recommendations sized for real budgets, real staff and real school days." },
  { icon: Users, title: "Schools first", text: "Every tool we build must make a school's daily life measurably better." },
];

export function About() {
  return (
    <section id="about" className="scroll-mt-24 bg-slate-50 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">About KAEC</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              A consultancy obsessed with one thing: healthier schools
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              {SITE.shortName} works with school owners, heads and boards to diagnose what is really
              happening inside their schools — then to fix it, systematically. This School Health
              Check distils that diagnostic framework into a tool any school can use in minutes,
              free of charge.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              When your report surfaces challenges you want help with, our consultants are here:
              implementation support, staff training, leadership coaching and full school-transformation
              programmes. The diagnosis is free. The decision to act is yours. Learn more about KAEC at www.kaecng.name.ng or call 08061190801.
            </p>
          </Reveal>
          <div className="space-y-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08}>
                <Card className="flex items-start gap-4 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50">
                    <v.icon className="size-5.5 text-brand-700" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{v.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{v.text}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Contact section ───────────────────────────────────────── */
export function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Contact</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Talk to KAEC
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500">
              Need help transforming your school? Book a consultation, request staff training,
              or simply tell us what your school is facing. We reply within one working day.
            </p>
            <div className="mt-8 space-y-4">
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-3.5 text-sm font-medium text-slate-700 transition-colors hover:text-brand-700">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50">
                  <Mail className="size-[18px] text-brand-700" />
                </span>
                {SITE.email}
              </a>
              <div className="flex items-center gap-3.5 text-sm font-medium text-slate-700">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50">
                  <Sparkles className="size-[18px] text-brand-700" />
                </span>
                Prefer evidence first?{" "}
                <Link href="/assessment" className="font-bold text-brand-700 hover:underline">
                  Run the free Health Check
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="p-7 sm:p-9">
              <ContactForm />
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
