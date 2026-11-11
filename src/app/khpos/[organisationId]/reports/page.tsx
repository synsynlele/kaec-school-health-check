import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { ReportsWorkspace } from "@/components/khpos/ReportsWorkspace";
import { OperationalRecordsWorkspace } from "@/components/khpos/ops/OperationalRecordsWorkspace";

export const metadata: Metadata = {
  title: "Reports & forms · KHP-OS",
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
  const selected = ["forms"].includes(requested) ? requested : "";
  return (
    <>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/reports"}
        title="Reports & forms"
        selected={selected}
        tabs={[{"view":"","label":"Reports"},{"view":"forms","label":"Forms & checklists"}]}
      />
      {selected === "forms" ? (<OperationalRecordsWorkspace organisationId={organisationId} />) : (<ReportsWorkspace key={organisationId} organisationId={organisationId} />)}
    </>
  );
}
