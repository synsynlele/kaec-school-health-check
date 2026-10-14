import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { DeleteAccountRequestForm } from "@/components/account/DeleteAccountRequestForm";

export const metadata: Metadata = {
  title: "Request Account & Data Deletion | KHP-OS by KAEC-NG",
  description: "Request deletion of a KHP-OS / KAEC School Health Check account and associated personal data.",
};

export default function DeleteAccountPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-28 text-slate-950">
        <div className="mx-auto max-w-2xl">
          <Link href="/account" className="text-sm font-semibold text-brand-700">← Account</Link>
          <h1 className="mt-6 text-3xl font-black sm:text-4xl">Request account & data deletion</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">This is the public account-deletion request page for <strong>KHP-OS by KAEC-NG</strong> and KAEC School Health Check. It works even after you uninstall the Android app.</p>
          <div className="mt-7"><DeleteAccountRequestForm /></div>
          <p className="mt-6 text-sm text-slate-600">You can review our <Link href="/privacy" className="font-semibold text-brand-700 underline">Privacy Policy</Link> or contact the KAEC-NG team directly via the <Link href="/contact" className="font-semibold text-brand-700 underline">contact page</Link>.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
