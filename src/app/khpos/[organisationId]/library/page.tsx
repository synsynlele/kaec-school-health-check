import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstitutionalLibrary } from "@/components/khpos/ops/InstitutionalLibrary";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Institutional Library · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsLibraryPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <InstitutionalLibrary organisationId={organisationId} />;
}
