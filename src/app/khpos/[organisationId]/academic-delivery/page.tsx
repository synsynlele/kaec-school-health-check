import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademicDeliveryWorkspace } from "@/components/khpos/ops/AcademicDeliveryWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Academic Planning & Delivery · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsAcademicDeliveryPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <AcademicDeliveryWorkspace organisationId={organisationId} />;
}
