import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyOnboardingWorkspace } from "@/components/khpos/ops/MyOnboardingWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "My Onboarding · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function MyOnboardingPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  return <MyOnboardingWorkspace organisationId={organisationId} />;
}
