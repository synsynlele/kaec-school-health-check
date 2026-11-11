import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { PriorityInterventionWorkspace } from "@/components/khpos/PriorityInterventionWorkspace";
import { ImplementationWorkspace } from "@/components/khpos/ImplementationWorkspace";
import { EvidenceVerificationWorkspace } from "@/components/khpos/EvidenceVerificationWorkspace";
import { ReviewDecisionWorkspace } from "@/components/khpos/ReviewDecisionWorkspace";
import { ImprovementIntelligenceWorkspace } from "@/components/khpos/ImprovementIntelligenceWorkspace";
import { PlaybooksWorkspace } from "@/components/khpos/PlaybooksWorkspace";

export const metadata: Metadata = {
  title: "School improvement · KHP-OS",
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
  const selected = ["plan", "evidence", "reviews", "improvement", "guides"].includes(requested) ? requested : "";
  return (
    <>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/priorities"}
        title="School improvement"
        selected={selected}
        tabs={[{"view":"","label":"Priorities"},{"view":"plan","label":"Action plan"},{"view":"evidence","label":"Evidence & proof"},{"view":"reviews","label":"Review progress"},{"view":"improvement","label":"Check improvement"},{"view":"guides","label":"Step-by-step guides"}]}
      />
      <div id="khpos-section-content" tabIndex={-1}>
        {selected === "plan" ? (<ImplementationWorkspace organisationId={organisationId} />) : (selected === "evidence" ? (<EvidenceVerificationWorkspace organisationId={organisationId} />) : (selected === "reviews" ? (<ReviewDecisionWorkspace organisationId={organisationId} />) : (selected === "improvement" ? (<ImprovementIntelligenceWorkspace organisationId={organisationId} />) : (selected === "guides" ? (<PlaybooksWorkspace organisationId={organisationId} />) : (<PriorityInterventionWorkspace organisationId={organisationId} />)))))}
      </div>
    </>
  );
}
