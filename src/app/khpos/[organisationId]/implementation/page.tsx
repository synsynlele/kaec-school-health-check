import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { ImplementationWorkspace } from "@/components/khpos/ImplementationWorkspace";

export const metadata: Metadata = {
  title: "Implementation Automation | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposImplementationPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <ImplementationWorkspace organisationId={organisationId} />;
}
