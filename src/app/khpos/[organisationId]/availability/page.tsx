import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvailabilityWorkspace } from "@/components/khpos/ops/AvailabilityWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Leave & cover · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ request?: string }>;
}) {
  const [{ organisationId }, { request }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(organisationId)) notFound();

  const initialOuting = request === "outing";
  return <AvailabilityWorkspace key={initialOuting ? "outing" : "standard"} organisationId={organisationId} initialOuting={initialOuting} />;
}
