import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YoungCeoWorkspace } from "@/components/khpos/ops/YoungCeoWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Young CEO Hub · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsYoungCeoPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <YoungCeoWorkspace organisationId={organisationId} />;
}
