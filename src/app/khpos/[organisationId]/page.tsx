import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Today · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function KhposWorkspacePage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  if (!UUID_RE.test(organisationId)) notFound();

  // Existing school-home bookmarks now open Today. Never render a second dashboard.
  redirect(`/khpos/${organisationId}/work`);
}
