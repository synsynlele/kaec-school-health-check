import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BenchmarkingWorkspace } from "@/components/khpos/BenchmarkingWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Benchmark Intelligence | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposBenchmarkingPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <BenchmarkingWorkspace organisationId={organisationId} />;
}
