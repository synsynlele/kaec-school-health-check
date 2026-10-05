import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstitutionalCalendarWorkspace } from "@/components/khpos/ops/InstitutionalCalendarWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Institutional Calendar · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function InstitutionalCalendarPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <InstitutionalCalendarWorkspace organisationId={organisationId} />;
}
