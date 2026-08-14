import type { Metadata } from "next";
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

  return <EvidenceVerificationWorkspace organisationId={organisationId} />;
}
