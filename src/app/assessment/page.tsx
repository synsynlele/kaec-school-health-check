import type { Metadata } from "next";
import { AssessmentFlow } from "@/components/assessment/AssessmentFlow";

export const metadata: Metadata = {
  title: "Start Your Free School Health Assessment",
  description:
    "Answer 55 structured indicators across 11 areas of your school. Autosaves as you go — and your AI health report is generated the moment you finish.",
  robots: { index: false, follow: false },
};

export default function AssessmentPage() {
  return <AssessmentFlow />;
}
