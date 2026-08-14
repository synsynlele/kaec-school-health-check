import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { EvidenceVerificationWorkspace } from "@/components/khpos/EvidenceVerificationWorkspace";

export const metadata: Metadata = {
  title: "Evidence & Verification | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposEvidencePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return (
    <>
      <Link
        href={`/khpos/${organisationId}/reviews`}
        className="fixed bottom-5 right-5 z-50 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-xl ring-1 ring-white/10 hover:bg-brand-950"
      >
        Open Review & Decision
      </Link>
      <EvidenceVerificationWorkspace organisationId={organisationId} />
    </>
  );
}
