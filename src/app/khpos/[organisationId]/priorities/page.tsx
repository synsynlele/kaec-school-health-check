import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { PriorityInterventionWorkspace } from "@/components/khpos/PriorityInterventionWorkspace";

export const metadata: Metadata = {
  title: "Transformation Agenda | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposPrioritiesPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return (
    <>
      <PriorityInterventionWorkspace organisationId={organisationId} />
      <Link
        href={`/khpos/${organisationId}/implementation`}
        className="fixed bottom-5 right-5 z-50 rounded-full border border-white/10 bg-slate-950 px-5 py-3 text-sm font-extrabold text-white shadow-xl transition hover:bg-slate-800"
      >
        Open implementation plan →
      </Link>
    </>
  );
}
