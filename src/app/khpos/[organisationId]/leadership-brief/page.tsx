import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadershipBriefWorkspace } from "@/components/khpos/ops/LeadershipBriefWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Leadership Brief · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function LeadershipBriefPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <LeadershipBriefWorkspace organisationId={organisationId} />;
}
