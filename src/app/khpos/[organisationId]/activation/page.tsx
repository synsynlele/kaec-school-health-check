import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivationCentre } from "@/components/khpos/ops/ActivationCentre";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Activation Centre · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposActivationPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <ActivationCentre organisationId={organisationId} />;
}
