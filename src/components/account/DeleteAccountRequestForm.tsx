"use client";

import { useState, type FormEvent } from "react";

export function DeleteAccountRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, schoolName, requestType: "general",
          message: "[KHP-OS ACCOUNT & PERSONAL DATA DELETION REQUEST]\n" +
            "Please verify my account ownership and explain any school/legal records that cannot be deleted. " +
            "Requested email: " + email.trim() +
            (reason.trim() ? "\nAdditional context: " + reason.trim() : ""),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; id?: string; error?: string };
      if (!response.ok || !result.ok || !result.id) {
        throw new Error(result.error ?? "Your request was not received. Please try again.");
      }
      setReceipt(result.id);
      setName(""); setEmail(""); setSchoolName(""); setReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) return (
    <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <h2 className="text-xl font-bold">Deletion request received</h2>
      <p className="mt-2 text-sm leading-6">Keep this reference: <strong className="break-all">{receipt}</strong>. KAEC-NG must verify your identity before taking action. This request does not immediately delete your account or school records.</p>
      <button type="button" onClick={() => setReceipt("")} className="mt-4 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold">Submit another request</button>
    </div>
  );

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-sm leading-6 text-slate-600">You can send this request without signing in or reinstalling the app. Use the email associated with your KSHC/KHP-OS account. Do not enter passwords, child-protection narratives or learner health information here.</p>
      <label className="block text-sm font-semibold text-slate-800">Your name
        <input required minLength={2} maxLength={140} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <label className="block text-sm font-semibold text-slate-800">Account email
        <input required type="email" maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <label className="block text-sm font-semibold text-slate-800">School (optional)
        <input maxLength={140} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <label className="block text-sm font-semibold text-slate-800">Additional context (optional)
        <textarea maxLength={600} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" />
      </label>
      <p className="text-xs leading-5 text-slate-600">KAEC-NG will verify account ownership and review account/personal-data deletion. Institutional audit, employment, learner-safety or legal records may require separate retention and a school-authorised process. We will explain any limits in our response.</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? "Submitting request…" : "Request account and data deletion"}</button>
    </form>
  );
}
