import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck,
  Clock3, FileCheck2, HeartPulse, ListTodo, MessageSquare, ShieldCheck,
  UsersRound, Workflow,
} from "lucide-react";
import { KhposDistributionButton } from "@/components/pwa/KhposDistributionButton";

const features = [
  { icon: Clock3, title: "Know who is present", text: "School arrival and departure, lesson check-in and check-out, and records leaders can review." },
  { icon: CalendarDays, title: "Plan the school week", text: "Recurring lessons, school breaks, weekly themes, staff duties, tests and exam invigilation." },
  { icon: Workflow, title: "Turn processes into daily work", text: "Put policies, responsibilities, forms and checklists where staff can find and use them." },
  { icon: ClipboardCheck, title: "Follow work through to completion", text: "Assign actions, set deadlines, collect reports and evidence, and see what still needs attention." },
  { icon: MessageSquare, title: "Keep the team connected", text: "Announcements, discussions, direct reporting and private audio or video meetings." },
  { icon: UsersRound, title: "Support staff and learners", text: "Manage leave and cover, staff support, learner development and the school’s care responsibilities." },
];

const faqs = [
  ["What is KHP-OS?", "KHP-OS is the school operations app by KAEC-NG. It brings everyday responsibilities, schedules, communication and follow-up into one school workspace."],
  ["How is KSHC different?", "The KAEC School Health Check (KSHC) is a free diagnostic. It helps a school identify strengths and gaps. KHP-OS is the workspace an approved school uses to organise its ongoing operations and improvement."],
  ["How does my school get access?", "Start with the School Health Check, then request a school partnership from your account or report. KAEC-NG reviews the request. Once approved, the school authorises staff roles and completes setup."],
  ["Can we use our own role names?", "Schools can display their own role titles while KHP-OS uses the associated permissions to decide what each person can view and do."],
  ["Can teachers use it on a phone?", "Yes. Staff can open KHP-OS in a browser or use the Android app. An internet connection is required for live records and calls."],
  ["Is the health check free?", "Yes. The School Health Check is free. KHP-OS school subscriptions are separate and school access requires approval."],
];

const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-700";

function Brand() {
  return <Link href="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="KHP-OS home">
    <Image src="/khpos-icon-192.png" alt="" width={44} height={44} priority className="rounded-xl" />
    <span><span className="block text-lg font-black tracking-tight text-slate-950">KHP-OS</span><span className="block text-[10px] font-semibold text-slate-500">School operations by KAEC-NG</span></span>
  </Link>;
}

export function ProductLanding() {
  return <div className="bg-white text-slate-950">
    <a href="#main-content" className="sr-only fixed left-3 top-3 z-[100] rounded-xl bg-white p-3 font-bold focus:not-sr-only">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Brand />
        <nav aria-label="Product navigation" className="hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex">
          <a href="#features" className="hover:text-brand-700">Features</a>
          <a href="#how" className="hover:text-brand-700">How it works</a>
          <a href="#health-check" className="hover:text-brand-700">School Health Check</a>
          <a href="#pricing" className="hover:text-brand-700">Pricing</a>
          <a href="#faq" className="hover:text-brand-700">Questions</a>
        </nav>
        <Link href="/khpos" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Open app <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </header>

    <main id="main-content" tabIndex={-1}>
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-brand-50 via-white to-mint-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-800"><Workflow aria-hidden="true" className="size-3.5" /> The school operations app</p>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Run your school.<br /><span className="text-brand-700">See what’s done.</span></h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Bring your people, processes and daily work together. Know who is on duty, what needs attention, and which responsibilities have been completed.</p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/assessment" className={primary}>Start with a free health check <ArrowRight aria-hidden="true" className="size-4" /></Link>
              <Link href="/account" className={secondary}>Sign in to your school</Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Already invited by your school? Sign in using the email address on your invitation.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lift sm:p-6" aria-label="Illustrative KHP-OS school day">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Illustrative workspace</p><h2 className="mt-1 text-2xl font-black">Today</h2></div>
              <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-bold text-mint-700">Your next steps</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { icon: Clock3, title: "School attendance", detail: "Record your arrival", state: "Check in", color: "bg-brand-50 text-brand-700" },
                { icon: CalendarDays, title: "Your next lesson", detail: "Class, subject and scheduled time", state: "View lesson", color: "bg-mint-50 text-mint-700" },
                { icon: FileCheck2, title: "Exam invigilation", detail: "Attendance and end-of-exam report", state: "Open duty", color: "bg-amber-50 text-amber-800" },
                { icon: ListTodo, title: "Assigned follow-up", detail: "Owner, deadline and completion evidence", state: "Review work", color: "bg-violet-50 text-violet-700" },
              ].map(({ icon: Icon, title, detail, state, color }) => <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <span className={"rounded-xl p-2 " + color}><Icon aria-hidden="true" className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div>
                <span className={"shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold " + color}>{state}</span>
              </div>)}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">One place to start the day and follow the work through.</p>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Built around how schools work</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight">From the first arrival to the final follow-up.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 p-5">
              <Icon aria-hidden="true" className="size-7 text-brand-700" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="benefits" className="scroll-mt-24 bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-mint-300">Clear responsibility. Visible progress.</p><h2 className="mt-3 text-3xl font-black leading-tight">Give your team the next step.<br />Give leaders the full picture.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">A policy becomes useful when people can find it, understand their responsibility and record the work. KHP-OS connects those steps so leaders can review progress without chasing every person separately.</p></div>
          <ul className="grid content-center gap-4 text-sm">
            {["Staff see the responsibilities and records relevant to their role.", "Teachers know their lessons, duties and exam assignments.", "School leaders can review attendance, reports and unfinished actions.", "Each school manages its own calendar, role titles and campus work."].map(text => <li key={text} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4"><CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-mint-300" /><span className="leading-6">{text}</span></li>)}
          </ul>
        </div>
      </section>

      <section id="health-check" className="scroll-mt-24 bg-brand-50/60 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-6xl items-start gap-7 lg:grid-cols-2">
          <div><HeartPulse aria-hidden="true" className="size-8 text-brand-700" /><h2 className="mt-3 text-3xl font-black tracking-tight">KSHC helps you see the gaps.<br />KHP-OS helps you work on them.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Start with the free KAEC School Health Check. Answer questions about your school and receive a diagnostic report with improvement priorities. Approved schools then use KHP-OS to organise the people, processes and follow-up behind those priorities.</p><Link href="/assessment" className={primary + " mt-5"}>Take the free School Health Check <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
          <div className="grid gap-3">
            <article className="rounded-2xl border border-brand-200 bg-white p-5"><p className="text-xs font-bold text-brand-700">KSHC · FREE DIAGNOSTIC</p><h3 className="mt-2 text-xl font-bold">Understand your school</h3><p className="mt-2 text-sm leading-6 text-slate-600">Identify strengths, spot gaps and decide what deserves attention.</p></article>
            <article className="rounded-2xl border border-mint-200 bg-white p-5"><p className="text-xs font-bold text-mint-700">KHP-OS · SCHOOL WORKSPACE</p><h3 className="mt-2 text-xl font-bold">Organise the daily work</h3><p className="mt-2 text-sm leading-6 text-slate-600">Assign responsibility, coordinate schedules, record completion and review progress.</p></article>
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight">A clear path into your school workspace.</h2>
          <ol className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              ["01", "Check your school", "Complete the free health check and read your report."],
              ["02", "Request access", "Apply for a school partnership. KAEC-NG reviews and approves access."],
              ["03", "Bring in your team", "Set up the school, authorise staff roles, and begin with Today."],
            ].map(([number, title, text]) => <li key={number} className="rounded-2xl border border-slate-200 p-5"><span className="text-sm font-black text-brand-600">{number}</span><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></li>)}
          </ol>
          <p className="mt-4 text-sm text-slate-500">A free account gives access to the diagnostic. KHP-OS access requires school partnership approval and an authorised staff role.</p>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight">School subscriptions</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Ask about your free first month. Confirm school and campus coverage with KAEC-NG before activation.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Get started", "1 month free", "Explore KHP-OS with your school team."],
              ["Term plan", "₦30,000", "A subscription for one school term."],
              ["Session plan", "₦70,000", "A subscription for one academic session."],
            ].map(([label, price, text]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-500">{label}</p><h3 className="mt-3 text-3xl font-black">{price}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
          <Link href="/contact" className={secondary + " mt-5"}>Talk to KAEC-NG about your school <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight">Questions schools ask</h2>
          <div className="mt-6 divide-y divide-slate-200">{faqs.map(([question, answer]) => <details key={question} className="group py-4"><summary className="cursor-pointer py-1 font-bold">{question}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div>
        </div>
      </section>

      <section id="about" className="bg-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl"><h2 className="text-2xl font-black">Give your school a place to get things done.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Built by KAEC-NG to help schools connect responsibility, action and evidence.</p></div>
          <Link href="/khpos" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-mint-300 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-mint-200">Open KHP-OS <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>
    </main>
    <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row">
        <div><Brand /><p className="mt-3 text-xs text-slate-500">Human Potential Development · KAEC-NG</p><div className="mt-3"><KhposDistributionButton /></div></div>
        <nav aria-label="Support and legal" className="flex flex-wrap items-start gap-4 text-sm text-slate-600">
          <Link href="/contact" className="underline">Contact & help</Link><Link href="/privacy" className="underline">Privacy</Link><Link href="/terms" className="underline">Terms</Link><Link href="/delete-account" className="underline">Account deletion</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
