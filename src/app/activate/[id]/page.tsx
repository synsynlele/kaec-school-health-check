import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/site/Header";
import { ActivationFlow } from "@/components/khpos/ActivationFlow";
import { UUID_RE } from "@/lib/http";

export const metadata: Metadata = {
  title: "Activate KHP-OS | Schools",
  robots: { index: false, follow: false },
};

export default async function ActivateKhposPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  return (
    <>
      <Header />
      <main className="bg-gradient-to-br from-slate-50 via-white to-brand-50 pt-[68px]">
        <ActivationFlow assessmentId={id} />
      </main>
    </>
  );
}
