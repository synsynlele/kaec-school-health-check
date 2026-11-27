import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UUID_RE } from "@/lib/http";
import { SchoolFinanceWorkspace } from "@/components/khpos/finance/SchoolFinanceWorkspace";

export const metadata: Metadata = {
  title: "Fee Collection · KHP-OS",
  robots: { index: false, follow: false },
};

export default async function Page({ params, searchParams }: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ organisationId }, query] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(organisationId)) notFound();
  function id(key: string) {
    const value = query[key];
    return typeof value === "string" && UUID_RE.test(value) ? value : "";
  }
  return <SchoolFinanceWorkspace organisationId={organisationId} collection={{
    campus: id("campus"), period: id("period"), learner: id("learner"), invoice: id("invoice"),
  }} />;
}
