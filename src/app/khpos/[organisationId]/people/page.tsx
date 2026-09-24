import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PeopleWorkspace } from "@/components/khpos/ops/PeopleWorkspace";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "People & Staff · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposOperationsPeoplePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return <PeopleWorkspace organisationId={organisationId} />;
}
