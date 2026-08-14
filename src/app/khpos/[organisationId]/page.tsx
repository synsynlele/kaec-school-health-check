import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity } from "lucide-react";
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
      <Link
        href={`/khpos/${organisationId}/improvement`}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-xl transition hover:bg-brand-900"
      >
        <Activity className="size-4 text-mint-300" />
        Reassess & Improve
      </Link>
    </>
  );
}