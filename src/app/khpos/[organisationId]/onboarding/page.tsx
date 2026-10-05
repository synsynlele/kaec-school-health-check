import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnboardingWorkspace } from "@/components/khpos/ops/OnboardingWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "My Operating Guide · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <OnboardingWorkspace organisationId={organisationId} />;
}
