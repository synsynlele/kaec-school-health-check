import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DecisionsWorkspace } from "@/components/khpos/ops/DecisionsWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Decisions & Approvals · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsDecisionsPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <DecisionsWorkspace organisationId={organisationId} />;
}
