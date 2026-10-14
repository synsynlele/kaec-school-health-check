import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Card } from "@/components/ui/card";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy | KSHC & KHP-OS",
  description: "How KAEC-NG handles information in KAEC School Health Check and KHP-OS.",
};

const SECTIONS = [
  {
    title: "What the services do",
    body: [
      "KAEC School Health Check (KSHC) lets schools complete a diagnostic and receive a report. KHP-OS is an operating workspace for approved partner schools, their authorised leadership and staff. The two services share account infrastructure but have different access permissions.",
      "KHP-OS is intended for approved schools and authorised staff, not for children to register independent public accounts.",
    ],
  },
  {
    title: "Information we process",
    body: [
      "KSHC collects school identity, contact details, responses to health-check indicators, account identifiers and generated school reports. Contact and account-support requests include the information voluntarily provided.",
      "When a school activates KHP-OS, authorised users may enter staff identities and contact details, employment and performance records, learner identities and progress, parent communications, school operations, policy acknowledgements, incidents, safeguarding reports and related evidence. Some of these records are sensitive and can concern children. Do not enter more personal information than is needed for the defined school process.",
      "We also process technical information needed to sign users in, provide access, maintain security, troubleshoot problems and operate optional notifications. We do not ask users for payment-card details within KHP-OS.",
    ],
  },
  {
    title: "Why and how information is used",
    body: [
      "We process information to deliver school diagnostics, securely operate school workspaces, manage assigned responsibilities, maintain school records and evidence trails, coordinate interventions, improve reliability and respond to support requests.",
      "Each partner school is responsible for deciding which appropriate school records its authorised staff enter and for complying with applicable child-protection, employment and privacy requirements. KAEC-NG provides the operating platform and its agreed administration and support services.",
      "Where analytics or benchmarking is provided, school data must be aggregated or accessed according to the agreed permissions. We do not sell personal information to advertisers.",
    ],
  },
  {
    title: "AI features and service providers",
    body: [
      "Some enabled features can send the relevant context to an AI service provider to generate a diagnostic report or a requested response. Where OpenAI services are configured, the applicable processing is governed by the provider's service and privacy terms. Do not put confidential safeguarding narratives into an unrestricted AI prompt.",
      "Hosting, authentication, database, deployment and communication providers may process the information necessary to operate the service. Access is subject to configured security controls, service agreements and the partner school's permissions.",
    ],
  },
  {
    title: "School access and safeguarding protection",
    body: [
      "KHP-OS access requires a valid account, an approved school partnership and an authorised role in the relevant school. A staff member with positions in multiple functions receives only the permissions attached to their verified appointments.",
      "Safeguarding case details are restricted to formally designated safeguarding personnel. School leaders' general oversight does not automatically grant access to confidential child-protection case narratives. People with immediate child-safety concerns must follow their school's safeguarding and emergency processes, not rely on a digital form as an emergency alert.",
    ],
  },
  {
    title: "Retention, account deletion and individual choices",
    body: [
      "School operational records and audit trails may need to be kept while required for the school's lawful operations, child-safety duties, employment obligations, accountability, dispute management or applicable retention rules. Closing a task moves it into History; it does not erase its record.",
      "You can request deletion of a KSHC/KHP-OS account and associated personal data using the public request page, including if you have already uninstalled the Android app. We verify the identity and authority of the requester before action. Some school-governed or legally required records cannot be deleted solely because one member of staff requests account closure; we will explain any restrictions.",
      "Assessment drafts may also exist in local browser storage. Clearing browser/app site data removes that local copy but does not remove authorised school records stored on the server.",
    ],
  },
  {
    title: "Security and contacting us",
    body: [
      "We use authenticated sessions, role- and school-scoped access, encrypted connections, restricted server credentials and audit records. No internet service can guarantee absolute security. Report suspected unauthorised access promptly.",
      `Privacy questions or data requests can be directed to ${SITE.email}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="pt-[68px]">
        <section className="border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-1.5 text-xs font-semibold text-brand-800">
              <ShieldCheck className="size-3.5" /> KSHC & KHP-OS
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Privacy Policy</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">School information, learner welfare and staff records deserve clear rules and protected access. This notice describes both KAEC-NG school services.</p>
            <Link href="/delete-account" className="mt-5 inline-block rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-bold text-brand-700">Request account & data deletion</Link>
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="space-y-5">
            {SECTIONS.map((section, index) => (
              <Card key={section.title} className="p-6 sm:p-8">
                <h2 className="text-lg font-bold text-slate-950"><span className="mr-3 text-sm text-brand-700">{String(index+1).padStart(2,"0")}</span>{section.title}</h2>
                <div className="mt-3 space-y-3">{section.body.map((paragraph, j) => <p key={j} className="text-sm leading-7 text-slate-600">{paragraph}</p>)}</div>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-slate-500">Last updated: 14 October 2026 · {SITE.name}</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
