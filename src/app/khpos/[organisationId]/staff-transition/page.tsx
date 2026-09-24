import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffTransitionWorkspace } from "@/components/khpos/ops/StaffTransitionWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Progression, Succession & Exit · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsStaffTransitionPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <StaffTransitionWorkspace organisationId={organisationId} />;
}
