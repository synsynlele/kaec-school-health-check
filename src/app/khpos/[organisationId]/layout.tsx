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
      <SchoolWorkspaceNav organisationId={organisationId}>
        <div id="school-page" tabIndex={-1} className="min-w-0 xl:pl-72">
          <div id="school-route-content" tabIndex={-1}>{children}</div>
          <div className="pb-6"><SchoolAreaNavigation organisationId={organisationId} /></div>
        </div>
      </SchoolWorkspaceNav>
    </div>
  );
}
