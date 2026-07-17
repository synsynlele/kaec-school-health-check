import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  Eye,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  ListChecks,
  Medal,
  MessageSquareHeart,
  Radar,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ActionsBar } from "@/components/report/ActionsBar";
import { CoachChat } from "@/components/report/CoachChat";
import { RadarChart } from "@/components/report/RadarChart";
import { ScoreGauge } from "@/components/report/ScoreGauge";
import { getAssessmentState, getReport } from "@/lib/storage";
import { ratingFor } from "@/lib/scoring";
import { formatDate, cn } from "@/lib/utils";
import { UUID_RE } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  let title = "School Health Report";
  try {
    const state = UUID_RE.test(id) ? await getAssessmentState(id) : null;
    if (state) title = `${state.school.schoolName} — School Health Report`;
  } catch {
    /* keep default title */
  }
  return { title, robots: { index: false, follow: false } };
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="avoid-break mb-7">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50">
          <Icon className="size-5 text-brand-700" />
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      </div>
      {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}

const PRIORITY_STYLE: Record<string, { badge: "red" | "amber" | "green"; label: string }> = {
  high: { badge: "red", label: "High priority" },
  medium: { badge: "amber", label: "Medium priority" },
  low: { badge: "green", label: "Lower priority" },
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const stored = await getReport(id);
  if (!stored) {
    const state = await getAssessmentState(id).catch(() => null);
    if (state) redirect(`/analyzing/${id}`);
    notFound();
  }

  const { report, school } = stored;
  const rating = ratingFor(report.overallScore);

  return (
    <>
      <Header />
      <main className="pt-[68px]">
        {/* ── Report banner ─────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/30 blur-3xl" />
            <div className="absolute -bottom-32 left-1/4 size-80 rounded-full bg-mint-500/20 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                <HeartPulse className="size-3.5" /> KAEC School Health Report
              </Badge>
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                <Sparkles className="size-3.5" /> AI-generated · {formatDate(report.generatedAt)}
              </Badge>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
              {school.schoolName}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-100">
              {[school.schoolType, school.schoolLevel, [school.state, school.country].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join("  ·  ")}
              {"  ·  "}
              {school.studentPopulation} students · {school.staffPopulation} staff
            </p>
            <div className="mt-8">
              <ActionsBar assessmentId={id} />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6 sm:py-16">
          {/* ── Score & executive summary ─────────────────────── */}
          <section className="print-clean avoid-break">
            <SectionHeading
              icon={Medal}
              title="Overall Health Score"
              description={rating.message}
            />
            <Card className="print-clean grid items-center gap-8 p-7 sm:p-10 md:grid-cols-[auto_1fr]">
              <div className="mx-auto">
                <ScoreGauge score={report.overallScore} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={rating.band === "thriving" || rating.band === "healthy" ? "green" : rating.band === "developing" ? "amber" : "red"}>
                    Health rating · {report.healthRating}
                  </Badge>
                  <Badge variant="amber">
                    <Target className="size-3.5" /> Priority area · {report.priorityArea}
                  </Badge>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">Executive summary</h3>
                <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
                  {report.executiveSummary}
                </p>
              </div>
            </Card>
          </section>

          {/* ── Department scores ─────────────────────────────── */}
          <section>
            <SectionHeading
              icon={Radar}
              title="Department Scores"
              description="All eleven areas of school health, benchmarked on KAEC's framework. Green bars are strengths to protect; anything amber or below deserves a named owner."
            />
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="print-clean avoid-break p-7 sm:p-9">
                <ul className="space-y-4">
                  {report.departmentScores.map((d) => {
                    const r = ratingFor(d.score);
                    return (
                      <li key={d.chapter}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700" title={d.summary}>
                            {d.title}
                          </span>
                          <span className={cn("text-sm font-extrabold tabular-nums", r.textClass)}>
                            {d.score}%
                          </span>
                        </div>
                        <Progress value={d.score} indicatorClassName={r.barClass} />
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card className="print-clean avoid-break grid place-items-center p-7 sm:p-9">
                <RadarChart
                  data={report.departmentScores.map((d) => ({
                    label: d.title
                      .replace(" & Child Protection", "")
                      .replace(" & Community Engagement", "")
                      .replace("Development & Wellbeing", "Development")
                      .replace(" & Digital Learning", "")
                      .replace(" & Compliance", "")
                      .replace(" & Facilities", "")
                      .replace(" & Values", "")
                      .replace(" & Vision", "")
                      .replace(" & Growth", ""),
                    value: d.score,
                  }))}
                />
                <p className="mt-2 text-center text-xs text-slate-400">
                  Balanced shapes are healthy schools — spikes tell you where to focus.
                </p>
              </Card>
            </div>
          </section>

          {/* ── Strengths & weaknesses ────────────────────────── */}
          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <SectionHeading icon={Star} title="Biggest Strengths" />
              <Card className="print-clean h-[calc(100%-84px)] p-7 sm:p-8">
                <ul className="space-y-5">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="avoid-break flex gap-3.5">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{s.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            <div>
              <SectionHeading icon={ShieldAlert} title="Biggest Weaknesses" />
              <Card className="print-clean h-[calc(100%-84px)] p-7 sm:p-8">
                <ul className="space-y-5">
                  {report.weaknesses.map((weak, i) => (
                    <li key={i} className="avoid-break flex gap-3.5">
                      <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-red-50">
                        <span className="size-2 rounded-full bg-red-500" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{weak.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{weak.detail}</p>
                        <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-red-600">
                          If ignored: {weak.impact}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </section>

          {/* ── Priority areas ────────────────────────────────── */}
          <section>
            <SectionHeading
              icon={Target}
              title="Priority Areas"
              description="Three areas where focused effort pays back fastest. Everything else in this plan flows from these."
            />
            <div className="grid gap-5 md:grid-cols-3">
              {report.priorityAreas.map((p, i) => (
                <Card key={i} className="print-clean avoid-break relative overflow-hidden p-7">
                  <span className="absolute -right-2 -top-3 text-7xl font-black text-slate-100">{i + 1}</span>
                  <div className="relative">
                    <Badge variant="amber" className="mb-3">Priority {i + 1}</Badge>
                    <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-500">{p.why}</p>
                    <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed">
                      <span className="font-bold text-brand-700">First step: </span>
                      <span className="text-slate-600">{p.firstStep}</span>
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* ── Area-by-area analysis ─────────────────────────── */}
          <section>
            <SectionHeading
              icon={Eye}
              title="Area-by-Area Analysis"
              description="The AI's read on each department of your school, written for leadership — not for a filing cabinet."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {report.chapterAnalyses.map((c) => {
                const r = ratingFor(c.score);
                return (
                  <Card key={c.chapter} className="print-clean avoid-break p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={cn("text-lg font-extrabold tabular-nums", r.textClass)}>{c.score}%</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: r.hex, background: `${r.hex}1a` }}
                        >
                          {c.rating}
                        </span>
                      </div>
                    </div>
                    <Progress value={c.score} indicatorClassName={r.barClass} className="mt-3 h-1.5" />
                    <p className="mt-3.5 text-sm leading-relaxed text-slate-600">{c.analysis}</p>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* ── Recommendations ───────────────────────────────── */}
          <section>
            <SectionHeading
              icon={ListChecks}
              title="AI Recommendations"
              description="Prioritised, effort-rated moves — sequenced so the cheapest, highest-leverage fixes come first."
            />
            <Card className="print-clean divide-y divide-slate-100 p-0">
              {report.recommendations.map((rec, i) => {
                const style = PRIORITY_STYLE[rec.priority] ?? PRIORITY_STYLE.medium;
                return (
                  <div key={i} className="avoid-break flex gap-4 p-6 sm:gap-5 sm:p-7">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-bold text-slate-900">{rec.title}</h3>
                        <Badge variant={style.badge}>{style.label}</Badge>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{rec.detail}</p>
                      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-slate-400">
                        <span><span className="font-bold text-slate-500">Impact:</span> {rec.impact}</span>
                        <span><span className="font-bold text-slate-500">Effort:</span> {rec.effort}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>

          {/* ── Quick wins ────────────────────────────────────── */}
          <section>
            <SectionHeading
              icon={Zap}
              title="Quick Wins"
              description="Start these this week. They cost almost nothing and each one makes the next fix easier."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {report.quickWins.map((qw, i) => (
                <Card key={i} className="print-clean avoid-break border-mint-100 bg-mint-50/50 p-6 sm:p-7">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-mint-600 text-white">
                      <Zap className="size-4" />
                    </span>
                    <h3 className="text-[15px] font-bold text-slate-900">{qw.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{qw.detail}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* ── 90-day plan ───────────────────────────────────── */}
          <section>
            <SectionHeading
              icon={CalendarCheck}
              title="Your 90-Day Improvement Plan"
              description="Three phases. Give every task an owner and a date, then review weekly — that discipline is the whole secret."
            />
            <div className="grid gap-5 lg:grid-cols-3">
              {(
                [
                  { title: "30 Day Plan", sub: "Stabilise & signal change", tasks: report.plan30, accent: "bg-brand-700" },
                  { title: "60 Day Plan", sub: "Install the systems", tasks: report.plan60, accent: "bg-brand-500" },
                  { title: "90 Day Plan", sub: "Embed & measure", tasks: report.plan90, accent: "bg-mint-600" },
                ] as const
              ).map((phase) => (
                <Card key={phase.title} className="print-clean avoid-break overflow-hidden p-0">
                  <div className={cn("px-6 py-5 text-white", phase.accent)}>
                    <h3 className="text-base font-extrabold">{phase.title}</h3>
                    <p className="text-xs font-medium text-white/75">{phase.sub}</p>
                  </div>
                  <ul className="space-y-4 p-6">
                    {phase.tasks.map((t, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold leading-snug text-slate-800">{t.task}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t.outcome}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>

          {/* ── Vision & closing ──────────────────────────────── */}
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="print-clean avoid-break p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50">
                  <TrendingUp className="size-5 text-brand-700" />
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Long-Term Vision</h2>
              </div>
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">
                {report.longTermVision}
              </p>
            </Card>
            <Card className="print-clean avoid-break border-mint-100 bg-gradient-to-br from-mint-50 to-white p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-mint-100">
                  <GraduationCap className="size-5 text-mint-700" />
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  A Word from KAEC
                </h2>
              </div>
              <p className="mt-4 whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-700">
                {report.closingMessage}
              </p>
            </Card>
          </section>

          {/* ── Contact CTA ───────────────────────────────────── */}
          <section className="no-print">
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 px-7 py-12 text-center text-white shadow-lift sm:px-12">
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute -left-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-20 -right-10 size-72 rounded-full bg-mint-400/20 blur-3xl" />
              </div>
              <div className="relative">
                <MessageSquareHeart className="mx-auto size-10 text-white/90" />
                <h2 className="mx-auto mt-4 max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Need help transforming your school?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-brand-100">
                  Your report is the diagnosis. KAEC's consultants can deliver the treatment —
                  implementation support, staff training and leadership coaching.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/contact?type=consultation"
                    className="rounded-full bg-white px-7 py-3 text-sm font-bold text-brand-800 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    Book Consultation
                  </Link>
                  <Link
                    href="/contact?type=training"
                    className="rounded-full border border-white/40 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur transition-all hover:bg-white/20"
                  >
                    Request Training
                  </Link>
                  <Link
                    href="/contact?type=talk"
                    className="rounded-full border border-white/40 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur transition-all hover:bg-white/20"
                  >
                    Talk to KAEC
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ── AI Coach ──────────────────────────────────────── */}
          <section className="no-print">
            <SectionHeading
              icon={Bot}
              title="Ask AI About Your Report"
              description="Your coach has read every section of this report. Challenge a score, unpack a recommendation, or ask where to begin."
            />
            <Card className="p-6 sm:p-8">
              <CoachChat assessmentId={id} />
            </Card>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
