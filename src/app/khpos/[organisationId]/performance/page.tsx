import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolSectionTabs } from "@/components/khpos/SchoolSectionTabs";
import { PerformanceWorkspace } from "@/components/khpos/ops/PerformanceWorkspace";
import { ExtendedWorkspace } from "@/components/khpos/ops/ExtendedWorkspace";
import { BenchmarkingWorkspace } from "@/components/khpos/BenchmarkingWorkspace";
import { LearningIntelligenceWorkspace } from "@/components/khpos/LearningIntelligenceWorkspace";
import { HumanPotentialIntelligenceWorkspace } from "@/components/khpos/HumanPotentialIntelligenceWorkspace";
import { LeadershipBriefWorkspace } from "@/components/khpos/ops/LeadershipBriefWorkspace";

export const metadata: Metadata = {
  title: "School results · KHP-OS",
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
  const selected = ["campuses", "compare", "learning", "development", "brief"].includes(requested) ? requested : "";
  return (
    <>
      <SchoolSectionTabs
        base={"/khpos/" + organisationId + "/performance"}
        title="School results"
        selected={selected}
        tabs={[{"view":"","label":"Overview"},{"view":"campuses","label":"Campus summary"},{"view":"compare","label":"Comparisons"},{"view":"learning","label":"Learning summary"},{"view":"development","label":"Development summary"},{"view":"brief","label":"Meeting brief"}]}
      />
      <div id="khpos-section-content" tabIndex={-1}>
        {selected === "campuses" ? (<ExtendedWorkspace organisationId={organisationId} type="network-pulse" />) : (selected === "compare" ? (<BenchmarkingWorkspace organisationId={organisationId} />) : (selected === "learning" ? (<LearningIntelligenceWorkspace organisationId={organisationId} />) : (selected === "development" ? (<HumanPotentialIntelligenceWorkspace organisationId={organisationId} />) : (selected === "brief" ? (<LeadershipBriefWorkspace organisationId={organisationId} />) : (<PerformanceWorkspace organisationId={organisationId} />)))))}
      </div>
    </>
  );
}
