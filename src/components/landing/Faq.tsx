"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";

const FAQS = [
  {
    q: "Is the School Health Check really free?",
    a: "Yes — the assessment, the full AI report, the PDF download and the AI Coach are completely free, with no account required. KAEC-NG offers optional paid Human Potential Development and institutional transformation support afterwards — including KHP-OS deployment, capability development and implementation support — but nothing in KSHC is locked behind payment.",
  },
  {
    q: "How long does the assessment take?",
    a: "About ten minutes for most school leaders — 55 rated indicators across 11 areas. Every answer autosaves instantly, so you can stop at any point and resume on any device where you left off, even if your connection drops.",
  },
  {
    q: "Who in the school should answer it?",
    a: "Ideally the proprietor, head of school or principal — whoever knows the daily reality most honestly. Some owners complete it together with their leadership team over one sitting, which makes the follow-up conversations even better.",
  },
  {
    q: "Is our information private?",
    a: "Yes. Your answers and report are used only to generate your diagnosis and (if you provide it) to email you the report. We never sell data. Anonymous, aggregated statistics — such as average scores by region — may be computed, but nothing identifiable is ever shared.",
  },
  {
    q: "How accurate is an AI diagnosis?",
    a: "The AI does not guess — it analyses the honest ratings you give against KAEC-NG's school-improvement framework, the same institutional diagnostic structure behind KHP-OS. The more candid your answers, the sharper the report. Many leaders describe it as 'uncomfortably accurate.'",
  },
  {
    q: "What if our school scores badly?",
    a: "Then the tool has already paid off — you now know exactly where to invest. Every report includes quick wins for this week and a sequenced 30/60/90-day plan sized for real school budgets. If you want to continue beyond diagnosis, KHP-OS gives your institution a structured path from priority to verified improvement, with the KAEC-NG team available when human support is useful.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 bg-slate-50 py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything school owners ask before their first Health Check."
        />
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.04}>
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-white transition-colors",
                    isOpen ? "border-brand-200 shadow-soft" : "border-slate-200",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[15px] font-bold text-slate-900">{f.q}</span>
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 text-slate-400 transition-transform duration-300",
                        isOpen && "rotate-180 text-brand-600",
                      )}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-6 pb-6 text-sm leading-relaxed text-slate-500">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
