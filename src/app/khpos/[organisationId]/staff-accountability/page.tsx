import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffAccountabilityWorkspace } from "@/components/khpos/ops/StaffAccountabilityWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Recognition & Accountability · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsStaffAccountabilityPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <StaffAccountabilityWorkspace organisationId={organisationId} />;
}
