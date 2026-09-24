import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffPerformanceWorkspace } from "@/components/khpos/ops/StaffPerformanceWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Staff Performance & Development · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsStaffPerformancePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <StaffPerformanceWorkspace organisationId={organisationId} />;
}
