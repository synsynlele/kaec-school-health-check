import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  BrainCircuit,
  Gauge,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { CommandCentre } from "@/components/khpos/CommandCentre";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "KHP-OS | Schools",
  robots: { index: false, follow: false },
};

export default async function KhposWorkspacePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return (
    <>
      <CommandCentre organisationId={organisationId} />
      <nav className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] flex-col items-end gap-2">
        <Link
          href="/khpos/admin"
          className="inline-flex items-center gap-2 rounded-full border border-mint-300/30 bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-brand-950"
        >
          <ShieldCheck className="size-4 text-mint-300" />
          Admin Console
        </Link>
        <Link
          href={`/khpos/${organisationId}/benchmarking`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-brand-950 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-brand-900"
        >
          <Gauge className="size-4 text-mint-300" />
          Benchmark Intelligence
        </Link>
        <Link
          href={`/khpos/${organisationId}/human-potential-intelligence`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-brand-900 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-brand-800"
        >
          <BrainCircuit className="size-4 text-mint-300" />
          Human Potential Intelligence
        </Link>
        <Link
          href={`/khpos/${organisationId}/learning-intelligence`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-slate-800"
        >
          <GraduationCap className="size-4 text-mint-300" />
          Learning Intelligence
        </Link>
        <Link
          href={`/khpos/${organisationId}/improvement`}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-brand-900"
        >
          <Activity className="size-4 text-mint-300" />
          Reassess & Improve
        </Link>
      </nav>
    </>
  );
}
