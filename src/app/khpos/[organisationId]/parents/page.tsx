import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { ParentPartnershipWorkspace } from "@/components/khpos/ops/ParentPartnershipWorkspace";
import { ExtendedWorkspace } from "@/components/khpos/ops/ExtendedWorkspace";

export const metadata: Metadata = {
  title: "Families & admissions · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();
  const query = await searchParams;
  const requested = typeof query.view === "string" ? query.view : "";
  const selected = ["enquiries"].includes(requested) ? requested : "";
  return (
    <>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/parents"}
        title="Families & admissions"
        selected={selected}
        tabs={[{"view":"","label":"Current families"},{"view":"enquiries","label":"Enquiries & admissions"}]}
      />
      {selected === "enquiries" ? (<ExtendedWorkspace organisationId={organisationId} type="parent-journeys" />) : (<ParentPartnershipWorkspace organisationId={organisationId} />)}
    </>
  );
}
