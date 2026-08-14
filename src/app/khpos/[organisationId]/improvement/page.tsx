import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { ImprovementIntelligenceWorkspace } from "@/components/khpos/ImprovementIntelligenceWorkspace";

export const metadata: Metadata = {
  title: "Reassessment & Improvement | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposImprovementPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <ImprovementIntelligenceWorkspace organisationId={organisationId} />;
}