import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvailabilityWorkspace } from "@/components/khpos/ops/AvailabilityWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Availability & Coverage · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsAvailabilityPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <AvailabilityWorkspace organisationId={organisationId} />;
}
