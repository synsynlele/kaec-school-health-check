import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HumanPotentialIntelligenceWorkspace } from "@/components/khpos/HumanPotentialIntelligenceWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "PipuPath Human Potential Intelligence | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposHumanPotentialIntelligencePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <HumanPotentialIntelligenceWorkspace organisationId={organisationId} />;
}
