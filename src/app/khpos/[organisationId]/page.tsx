import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommandCentre } from "@/components/khpos/CommandCentre";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "KHP-OS | Schools",
  robots: { index: false, follow: false },
};

export default async function KhposWorkspacePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <CommandCentre organisationId={organisationId} />;
}
