import Link from "next/link";
import { BarChart3, Mail, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/site/ContactForm";
import { Reveal } from "@/components/site/Reveal";
import { SITE } from "@/lib/site";

const VALUES = [
  {
    icon: Target,
    title: "Potential before labels",
    text: "We start with what people and institutions can become, then build the systems that help that potential emerge.",
  },
  {
    icon: BarChart3,
    title: "Systems before symptoms",
    text: "We diagnose root institutional patterns and build repeatable operating systems rather than treating isolated problems.",
  },
  {
    icon: TrendingUp,
    title: "Verified improvement",
    text: "Progress must be visible in evidence and fresh reassessment — not assumed because activities were completed.",
  },
];

export function CompanyAbout() {
  return (
    <section id="about" className="scroll-mt-24 bg-slate-50 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">About KAEC-NG</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              A Human Potential Development Company building systems for people and institutions to thrive
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              KAEC-NG builds systems that help people and institutions <strong>Discover, Develop and Deploy Potential</strong>.
              We are not a traditional consulting firm. We create practical frameworks, intelligence systems and operating
              platforms that turn potential into measurable capability, contribution and improvement.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              In schools, the journey begins with the free <strong>KAEC School Health Check (KSHC)</strong>, which reveals
              institutional strengths and gaps. Schools that want to move beyond diagnosis can activate <strong>KHP-OS</strong>
              — the institutional transformation operating system that carries priorities through intervention,
              implementation, evidence, review and fresh reassessment.
            </p>
            <p className="mt-4 text-sm font-semibold leading-6 text-brand-800">
              Our goal is not to make institutions dependent on KAEC-NG. It is to help them build the capability to keep
              improving themselves and develop more people who can contribute meaningfully to the world.
            </p>
          </Reveal>
          <div className="space-y-4">
            {VALUES.map((value, index) => (
              <Reveal key={value.title} delay={index * 0.08}>
                <Card className="flex items-start gap-4 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50">
                    <value.icon className="size-5.5 text-brand-700" />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{value.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{value.text}</p>
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

export function CompanyContact() {
  return (
    <section id="contact" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Work with KAEC-NG</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Move from diagnosis to institutional transformation
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-500">
              Start with the free School Health Check. If your school is ready to act on what it discovers, KHP-OS provides
              the operating system for priorities, intervention, implementation, evidence, review and verified improvement.
              You can also contact KAEC-NG about institutional partnerships, capability development and platform deployment.
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
                New to KAEC-NG?{" "}
                <Link href="/assessment" className="font-bold text-brand-700 hover:underline">
                  Begin with the free KSHC
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
