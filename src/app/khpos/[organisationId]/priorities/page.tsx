import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { PriorityInterventionWorkspace } from "@/components/khpos/PriorityInterventionWorkspace";

export const metadata: Metadata = {
  title: "Transformation Agenda | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposPrioritiesPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <PriorityInterventionWorkspace organisationId={organisationId} />;
}
