import type { Metadata } from "next";
import { redirectLegacySchoolWorkspace } from "@/lib/khpos/redirect-legacy-workspace";

export const metadata: Metadata = {
  title: "improvement · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organisationId } = await params;
  redirectLegacySchoolWorkspace(organisationId, "priorities", "improvement", await searchParams);
}
