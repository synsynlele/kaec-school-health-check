import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PotentialDevelopmentWorkspace } from "@/components/khpos/ops/PotentialDevelopmentWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Potential Development · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposPotentialDevelopmentPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <PotentialDevelopmentWorkspace organisationId={organisationId} />;
}
