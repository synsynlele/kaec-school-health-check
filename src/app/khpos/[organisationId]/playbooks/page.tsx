import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { PlaybooksWorkspace } from "@/components/khpos/PlaybooksWorkspace";

export const metadata: Metadata = {
  title: "Implementation Playbooks | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposPlaybooksPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <PlaybooksWorkspace organisationId={organisationId} />;
}
