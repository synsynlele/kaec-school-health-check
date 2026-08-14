import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { ReviewDecisionWorkspace } from "@/components/khpos/ReviewDecisionWorkspace";

export const metadata: Metadata = {
  title: "Review & Decision | KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposReviewsPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <ReviewDecisionWorkspace organisationId={organisationId} />;
}
