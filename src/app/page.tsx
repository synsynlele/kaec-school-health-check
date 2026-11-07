import type { Metadata } from "next";
import { ProductLanding } from "@/components/landing/ProductLanding";

const description = "KHP-OS brings school attendance, timetables, policies, staff duties, meetings and follow-up into one school operations workspace. Start with a free School Health Check.";

export const metadata: Metadata = {
  title: { absolute: "KHP-OS | The school operations app" },
  description,
  openGraph: { title: "KHP-OS | Run your school. See what’s done.", description },
  twitter: { card: "summary_large_image", title: "KHP-OS | The school operations app", description },
};

export default function LandingPage() {
  return <ProductLanding />;
}
