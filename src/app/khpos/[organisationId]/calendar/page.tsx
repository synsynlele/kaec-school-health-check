import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { InstitutionalCalendarWorkspace } from "@/components/khpos/ops/InstitutionalCalendarWorkspace";
import { ExtendedWorkspace } from "@/components/khpos/ops/ExtendedWorkspace";

export const metadata: Metadata = {
  title: "Calendar & events · KHP-OS",
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
  const selected = ["events"].includes(requested) ? requested : "";
  const paper = typeof query.paper === "string" && UUID_RE.test(query.paper) ? query.paper : undefined;
  const day = typeof query.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.day)
    && Number.isFinite(Date.parse(query.day)) && new Date(query.day).toISOString().slice(0, 10) === query.day ? query.day : undefined;
  return (
    <>
      <div id="khpos-section-content" tabIndex={-1}>
        {selected === "events" ? (<ExtendedWorkspace organisationId={organisationId} type="events" />) : (<InstitutionalCalendarWorkspace key={[query.plan, paper, day].join(":")} organisationId={organisationId} initialExamPlan={query.plan === "exams"} examPaper={paper} examDay={day} />)}
      </div>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/calendar"}
        title="Calendar & events"
        selected={selected}
        tabs={[{"view":"","label":"Calendar"},{"view":"events","label":"Events & programmes"}]}
      />
    </>
  );
}
