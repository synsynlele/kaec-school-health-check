import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffJoinWorkspace } from "@/components/khpos/ops/StaffJoinWorkspace";

export const metadata: Metadata = { title: "Join your school · KHP-OS", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  return <StaffJoinWorkspace token={token} />;
}
