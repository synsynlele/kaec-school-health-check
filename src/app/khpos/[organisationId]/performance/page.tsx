import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PerformanceWorkspace } from "@/components/khpos/ops/PerformanceWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "School results · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsPerformancePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <PerformanceWorkspace organisationId={organisationId} />;
}
