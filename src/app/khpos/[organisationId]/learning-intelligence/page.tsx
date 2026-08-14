import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { LearningIntelligenceWorkspace } from "@/components/khpos/LearningIntelligenceWorkspace";

export const metadata: Metadata = {
  title: "KSI Learning Intelligence | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposLearningIntelligencePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <LearningIntelligenceWorkspace organisationId={organisationId} />;
}
