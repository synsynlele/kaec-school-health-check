import type { Metadata } from "next";
import { PartnershipStatusWorkspace } from "@/components/khpos/PartnershipStatusWorkspace";

export const metadata: Metadata = {
  title: "Partnership Status | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function PartnershipStatusPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  return <PartnershipStatusWorkspace organisationId={organisationId} />;
}
