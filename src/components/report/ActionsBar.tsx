"use client";

import { useState } from "react";
import { ArrowRight, Check, Download, Link2, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ActionsBar({ assessmentId }: { assessmentId: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2.5">
      <Link
        href={`/activate/${assessmentId}`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-mint-400 px-6 text-sm font-extrabold text-slate-950 shadow-[0_6px_16px_rgb(52_211_153/0.22)] transition-all hover:-translate-y-0.5 hover:bg-mint-300"
      >
        Activate KHP-OS <ArrowRight className="size-4" />
      </Link>
      <a
        href={`/api/report/${assessmentId}/pdf`}
        download
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-700 px-6 text-sm font-semibold text-white shadow-[0_6px_16px_rgb(15_79_216/0.28)] transition-all hover:bg-brand-800"
      >
        <Download className="size-4" /> Download PDF
      </a>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Print report
      </Button>
      <Button variant="ghost" onClick={copyLink}>
        {copied ? <Check className="size-4 text-mint-600" /> : <Link2 className="size-4" />}
        {copied ? "Link copied" : "Copy report link"}
      </Button>
    </div>
  );
}
