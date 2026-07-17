import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Analyzer } from "@/components/analyzing/Analyzer";
import { getAssessmentState } from "@/lib/storage";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Analysing your school…",
  robots: { index: false, follow: false },
};

export default async function AnalyzingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/assessment");

  /* If the report already exists, skip the theatre entirely. */
  try {
    const state = await getAssessmentState(id);
    if (!state) redirect("/assessment");
    if (state.hasReport) redirect(`/report/${id}`);
  } catch {
    /* DB hiccup — let the client-side analyzer drive; the analyze API re-checks. */
  }

  return <Analyzer assessmentId={id} />;
}
