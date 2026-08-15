import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SchoolWorkspaceNav } from "@/components/khpos/SchoolWorkspaceNav";
import { UUID_RE } from "@/lib/http";

export default async function KhposOrganisationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  return (
    <>
      <SchoolWorkspaceNav organisationId={organisationId} />
      {children}
    </>
  );
}
