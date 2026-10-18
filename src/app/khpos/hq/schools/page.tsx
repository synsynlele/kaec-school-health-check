import type { Metadata } from "next";
import { SchoolPathfinderDesk } from "@/components/khpos/SchoolPathfinderDesk";

export const metadata: Metadata = {
  title: "School Pathfinders | KAEC HQ",
  description: "KAEC-NG corporate supervision of contract-linked partner-school commitments.",
  robots: { index: false, follow: false },
};

export default function KaecSchoolDeskPage() {
  return <SchoolPathfinderDesk />;
}
