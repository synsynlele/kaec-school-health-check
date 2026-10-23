import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SchoolWorkspaceNav, SchoolAreaNavigation } from "@/components/khpos/SchoolWorkspaceNav";
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
    <div className="khpos-school-shell min-h-screen bg-slate-50">
      <SchoolWorkspaceNav organisationId={organisationId} />
      <div id="school-page" tabIndex={-1} className="min-w-0 xl:pl-72"><SchoolAreaNavigation organisationId={organisationId} />{children}</div>
    </div>
  );
}
