"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeCheck,
  CircleAlert,
  FileWarning,
  Gavel,
  History,
  Loader2,
  MessageSquareWarning,
  Plus,
  Scale,
  ShieldAlert,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  KhposOpsAccountabilityCase,
  KhposOpsAccountabilityOutcome,
  KhposOpsCorrectiveAction,
  KhposOpsStaffAccountabilityWorkspace,
} from "@/lib/khpos/ops/accountability";

function readable(value: string | null | undefined) {
  return (value ?? "—").replaceAll("_", " ");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (["closed", "verified"].includes(status))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["external_review_required", "awaiting_response"].includes(status))
    return "border-amber-200 bg-amber-50 text-amber-900";
  if (["decision_recorded", "resolved"].includes(status))
    return "border-brand-200 bg-brand-50 text-brand-800";
  if (["cancelled", "withdrawn", "referred_formal"].includes(status))
    return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function outcomesFor(review: KhposOpsAccountabilityCase) {
  if (review.caseType === "corrective") {
    return [
      ["no_action", "No action"],
      ["expectation_reset", "Expectation reset"],
      ["documented_reminder", "Documented reminder"],
      ["conduct_commitment", "Conduct commitment"],
    ] as const;
  }
  if (review.caseType === "formal_discipline") {
    return [
      ["no_action", "No action"],
      ["corrective_action", "Corrective action"],
      ["written_warning", "Written warning"],
      ["final_warning", "Final warning"],
      ["other_proportionate_action", "Other proportionate action"],
      ["refer_separation_review", "Refer separation review"],
    ] as const;
  }
  return [
    ["grievance_upheld", "Upheld"],
    ["grievance_partially_upheld", "Partially upheld"],
    ["grievance_not_upheld", "Not upheld"],
    ["grievance_resolved_by_agreement", "Resolved by agreement"],
    ["grievance_referred_other_process", "Referred to another process"],
  ] as const;
}

export function StaffAccountabilityWorkspace({
  organisationId,
}: {
  organisationId: string;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workspace, setWorkspace] =
    useState<KhposOpsStaffAccountabilityWorkspace | null>(null);
  const [error, setError] = useState(
    supabase ? "" : "KHP-OS sign-in is not configured.",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const [recognitionStaffId, setRecognitionStaffId] = useState("");
  const [recognitionCategory, setRecognitionCategory] = useState("initiative");
  const [recognitionTitle, setRecognitionTitle] = useState("");
  const [recognitionEvidence, setRecognitionEvidence] = useState("");
  const [recognitionReference, setRecognitionReference] = useState("");

  const [grievanceTarget, setGrievanceTarget] = useState("process");
  const [grievanceSubjectId, setGrievanceSubjectId] = useState("");
  const [grievanceTitle, setGrievanceTitle] = useState("");
  const [grievanceStatement, setGrievanceStatement] = useState("");
  const [grievanceResolution, setGrievanceResolution] = useState("");

  const [conductType, setConductType] = useState<
    "corrective" | "formal_discipline"
  >("corrective");
  const [conductSubjectId, setConductSubjectId] = useState("");
  const [conductTitle, setConductTitle] = useState("");
  const [conductStatement, setConductStatement] = useState("");
  const [conductStandard, setConductStandard] = useState("");
  const [conductClassification, setConductClassification] = useState("");
  const [conductResponseDue, setConductResponseDue] = useState("");
  const [conductHearingRequired, setConductHearingRequired] = useState(false);
  const [sourceCaseId, setSourceCaseId] = useState("");

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [types, setTypes] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});

  async function token() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Your session has ended. Sign in again to continue.");
        return;
      }

      const response = await fetch(
        `/api/khpos/ops/accountability/${organisationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        accountability?: KhposOpsStaffAccountabilityWorkspace;
        error?: string;
      };

      if (!active) return;
      if (!response.ok || !body.ok || !body.accountability) {
        setError(body.error ?? "Recognition & Accountability could not be loaded.");
        return;
      }

      const next = body.accountability;
      setWorkspace(next);
      const manageable = next.staffOptions.find((staff) => staff.canManage);
      setRecognitionStaffId((current) => current || manageable?.id || "");
      setConductSubjectId((current) => current || manageable?.id || "");
      setError("");
    });

    return () => {
      active = false;
    };
  }, [organisationId, supabase]);

  async function submit(payload: Record<string, unknown>, busyKey: string) {
    const accessToken = await token();
    if (!accessToken) {
      setError("Your session has ended. Sign in again to continue.");
      return false;
    }

    setBusyId(busyKey);
    setError("");

    const response = await fetch(
      `/api/khpos/ops/accountability/${organisationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const body = (await response.json()) as {
      ok?: boolean;
      accountability?: KhposOpsStaffAccountabilityWorkspace;
      error?: string;
    };

    setBusyId(null);
    if (!response.ok || !body.ok || !body.accountability) {
      setError(body.error ?? "Accountability operation could not be completed.");
      return false;
    }

    setWorkspace(body.accountability);
    return true;
  }

  const manageableStaff =
    workspace?.staffOptions.filter((staff) => staff.canManage) ?? [];
  const otherStaff =
    workspace?.staffOptions.filter((staff) => !staff.isSelf) ?? [];
  const referredCases =
    workspace?.cases.filter((item) => item.status === "referred_formal") ?? [];

  async function issueRecognition() {
    if (
      !recognitionStaffId ||
      !recognitionTitle.trim() ||
      !recognitionEvidence.trim()
    ) {
      setError("Choose staff and enter a recognition title plus specific evidence.");
      return;
    }

    const ok = await submit(
      {
        mode: "issue_recognition",
        staffId: recognitionStaffId,
        category: recognitionCategory,
        title: recognitionTitle.trim(),
        evidenceNote: recognitionEvidence.trim(),
        evidenceReference: recognitionReference.trim() || null,
      },
      "recognition",
    );

    if (ok) {
      setRecognitionTitle("");
      setRecognitionEvidence("");
      setRecognitionReference("");
    }
  }

  async function createGrievance() {
    if (
      !grievanceTitle.trim() ||
      !grievanceStatement.trim() ||
      !grievanceResolution.trim()
    ) {
      setError("Grievance title, facts and desired resolution are required.");
      return;
    }
    if (grievanceTarget === "staff_member" && !grievanceSubjectId) {
      setError("Choose the staff member this grievance concerns.");
      return;
    }

    const ok = await submit(
      {
        mode: "create_case",
        caseType: "grievance",
        grievanceTarget,
        subjectStaffId:
          grievanceTarget === "staff_member" ? grievanceSubjectId : null,
        title: grievanceTitle.trim(),
        statement: grievanceStatement.trim(),
        desiredResolution: grievanceResolution.trim(),
      },
      "grievance",
    );

    if (ok) {
      setGrievanceTitle("");
      setGrievanceStatement("");
      setGrievanceResolution("");
      setGrievanceSubjectId("");
    }
  }

  async function createConductCase() {
    if (
      !conductSubjectId ||
      !conductTitle.trim() ||
      !conductStatement.trim() ||
      !conductStandard.trim() ||
      !conductClassification.trim() ||
      !conductResponseDue
    ) {
      setError(
        "Subject, specific concern/allegation, standard, conduct-vs-capability reason and response deadline are required.",
      );
      return;
    }

    const ok = await submit(
      {
        mode: "create_case",
        caseType: conductType,
        subjectStaffId: conductSubjectId,
        sourceCaseId: sourceCaseId || null,
        title: conductTitle.trim(),
        statement: conductStatement.trim(),
        relevantStandard: conductStandard.trim(),
        classificationNote: conductClassification.trim(),
        responseDueAt: new Date(conductResponseDue).toISOString(),
        hearingRequired:
          conductType === "formal_discipline" ? conductHearingRequired : false,
      },
      "conduct-case",
    );

    if (ok) {
      setConductTitle("");
      setConductStatement("");
      setConductStandard("");
      setConductClassification("");
      setConductResponseDue("");
      setConductHearingRequired(false);
      setSourceCaseId("");
    }
  }

  async function simpleCaseAction(
    review: KhposOpsAccountabilityCase,
    action: string,
  ) {
    await submit(
      {
        mode: "case_action",
        caseId: review.id,
        action,
        note: notes[`case-${review.id}`]?.trim() || null,
      },
      `${action}-${review.id}`,
    );
  }

  if (!workspace && !error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-9 animate-spin text-mint-300" />
          <p className="mt-4 text-sm font-semibold text-slate-300">
            Loading recognition & accountability…
          </p>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
        <div className="max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <CircleAlert className="mx-auto size-9 text-amber-300" />
          <h1 className="mt-4 text-2xl font-black">
            Recognition & Accountability is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{error}</p>
          <Link
            href={`/khpos/${organisationId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950"
          >
            <ArrowLeft className="size-4" />
            Command Centre
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="bg-gradient-to-br from-slate-950 via-brand-950 to-brand-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="rounded-full border border-mint-300/30 bg-mint-300/10 px-3 py-1 text-xs font-bold text-mint-200">
              Operations · O10
            </span>
            <Link
              href={`/khpos/${organisationId}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-black"
            >
              <ArrowLeft className="size-4" />
              Command Centre
            </Link>
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">
            Recognition & Accountability
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-brand-100 sm:text-base">
            Reinforce what KNS wants repeated. Correct known conduct fairly.
            Give staff a real grievance route. Formal discipline uses specific
            notice, evidence, response opportunity and competent authority—not
            personality, rumours or automatic scoring.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Recognition", workspace.summary.recognitions],
              ["Active cases", workspace.summary.activeCases],
              ["Awaiting response", workspace.summary.awaitingResponse],
              ["Corrective", workspace.summary.correctiveActive],
              ["Formal", workspace.summary.formalActive],
              ["Grievances", workspace.summary.grievancesActive],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/10 p-4"
              >
                <p className="text-xs font-bold text-brand-100">{label}</p>
                <p className="mt-1 text-3xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <Award className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-black text-emerald-950">
                  Recognition is not a staff score
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                  It records a specific contribution worth repeating. It does
                  not cancel concerns elsewhere, and corrective history does
                  not erase genuine recognition.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <Scale className="mt-0.5 size-5 shrink-0 text-amber-800" />
              <div>
                <p className="text-sm font-black text-amber-950">
                  Capability gap ≠ misconduct
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900/80">
                  If the person does not yet know how to perform, use O9
                  coaching/development. O10 requires a known expectation plus
                  specific conduct/accountability evidence.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldAlert className="size-5 text-brand-700" />
          <p className="mt-3 text-sm font-black">Employment-action boundary</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {workspace.legalBoundary}
          </p>
        </section>

        {workspace.canManageAnyStaff && (
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[30px] border border-emerald-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Positive reinforcement
              </p>
              <h2 className="mt-2 text-xl font-black">Recognise contribution</h2>

              <div className="mt-5 space-y-3">
                <select
                  value={recognitionStaffId}
                  onChange={(event) => setRecognitionStaffId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose staff</option>
                  {manageableStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.displayName} · {staff.roleTitle}
                    </option>
                  ))}
                </select>
                <select
                  value={recognitionCategory}
                  onChange={(event) =>
                    setRecognitionCategory(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  {[
                    "excellence",
                    "collaboration",
                    "compassion",
                    "equity",
                    "initiative",
                    "service",
                    "improvement",
                    "reliability",
                    "leadership",
                    "other",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {readable(value)}
                    </option>
                  ))}
                </select>
                <input
                  value={recognitionTitle}
                  onChange={(event) => setRecognitionTitle(event.target.value)}
                  placeholder="What are you recognising?"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <textarea
                  value={recognitionEvidence}
                  onChange={(event) => setRecognitionEvidence(event.target.value)}
                  rows={3}
                  placeholder="Specific evidence—what happened and why should it be repeated?"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <input
                  value={recognitionReference}
                  onChange={(event) =>
                    setRecognitionReference(event.target.value)
                  }
                  placeholder="Evidence reference (optional)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={() => void issueRecognition()}
                disabled={busyId === "recognition"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busyId === "recognition" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Award className="size-3.5" />
                )}
                Record recognition
              </button>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Conduct/accountability
              </p>
              <h2 className="mt-2 text-xl font-black">
                Open corrective or formal case
              </h2>

              <div className="mt-5 space-y-3">
                <select
                  value={conductType}
                  onChange={(event) =>
                    setConductType(
                      event.target.value as
                        | "corrective"
                        | "formal_discipline",
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="corrective">Corrective accountability</option>
                  <option value="formal_discipline">Formal discipline</option>
                </select>
                <select
                  value={conductSubjectId}
                  onChange={(event) => setConductSubjectId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose subject staff</option>
                  {manageableStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.displayName} · {staff.roleTitle}
                    </option>
                  ))}
                </select>
                {conductType === "formal_discipline" &&
                  referredCases.length > 0 && (
                    <select
                      value={sourceCaseId}
                      onChange={(event) => setSourceCaseId(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    >
                      <option value="">No source case</option>
                      {referredCases.map((item) => (
                        <option key={item.id} value={item.id}>
                          From {item.reference} · {item.title}
                        </option>
                      ))}
                    </select>
                  )}
                <input
                  value={conductTitle}
                  onChange={(event) => setConductTitle(event.target.value)}
                  placeholder={
                    conductType === "formal_discipline"
                      ? "Specific allegation title"
                      : "Specific corrective concern"
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <textarea
                  value={conductStatement}
                  onChange={(event) => setConductStatement(event.target.value)}
                  rows={3}
                  placeholder="State the specific facts/allegation—not a label or conclusion."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <textarea
                  value={conductStandard}
                  onChange={(event) => setConductStandard(event.target.value)}
                  rows={2}
                  placeholder="Which policy, standard, commitment or known expectation applies?"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <textarea
                  value={conductClassification}
                  onChange={(event) =>
                    setConductClassification(event.target.value)
                  }
                  rows={2}
                  placeholder="Why is this conduct/accountability rather than a capability gap for O9?"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
                <label className="block text-xs font-black text-slate-600">
                  Response deadline
                  <input
                    type="datetime-local"
                    value={conductResponseDue}
                    onChange={(event) =>
                      setConductResponseDue(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal"
                  />
                </label>
                {conductType === "formal_discipline" && (
                  <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={conductHearingRequired}
                      onChange={(event) =>
                        setConductHearingRequired(event.target.checked)
                      }
                      className="mt-0.5 size-4"
                    />
                    A hearing/panel step is required by the applicable
                    contract/policy for this case.
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={() => void createConductCase()}
                disabled={busyId === "conduct-case"}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busyId === "conduct-case" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileWarning className="size-3.5" />
                )}
                Issue case & response opportunity
              </button>
            </div>
          </section>
        )}

        {workspace.actorStaffId && (
          <section className="rounded-[30px] border border-violet-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">
              Staff voice
            </p>
            <h2 className="mt-2 text-xl font-black">Raise a grievance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              State facts and the resolution you want. A grievance is a request
              for review—not a finding of wrongdoing.
            </p>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <select
                value={grievanceTarget}
                onChange={(event) => setGrievanceTarget(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="process">Process</option>
                <option value="decision">Decision</option>
                <option value="working_condition">Working condition</option>
                <option value="staff_member">Staff member</option>
                <option value="other">Other</option>
              </select>
              {grievanceTarget === "staff_member" && (
                <select
                  value={grievanceSubjectId}
                  onChange={(event) => setGrievanceSubjectId(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">Choose staff member</option>
                  {otherStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.displayName} · {staff.roleTitle}
                    </option>
                  ))}
                </select>
              )}
              <input
                value={grievanceTitle}
                onChange={(event) => setGrievanceTitle(event.target.value)}
                placeholder="Grievance title"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm lg:col-span-2"
              />
              <textarea
                value={grievanceStatement}
                onChange={(event) => setGrievanceStatement(event.target.value)}
                rows={3}
                placeholder="What happened? State facts, dates/context and what you believe needs review."
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <textarea
                value={grievanceResolution}
                onChange={(event) => setGrievanceResolution(event.target.value)}
                rows={3}
                placeholder="What resolution or change are you seeking?"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => void createGrievance()}
              disabled={busyId === "grievance"}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {busyId === "grievance" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <MessageSquareWarning className="size-3.5" />
              )}
              Submit grievance
            </button>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
                Recognition record
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Contribution worth repeating
              </h2>
            </div>
          </div>

          {workspace.recognitions.length === 0 ? (
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-7 text-center text-sm text-slate-500">
              No recognition records are visible yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {workspace.recognitions.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[26px] border border-emerald-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black capitalize text-emerald-800">
                      {readable(item.category)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {item.reference}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black">{item.title}</h3>
                  <p className="mt-1 text-sm font-bold text-brand-700">
                    {item.staffName} · {item.roleTitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.evidenceNote}
                  </p>
                  {item.evidenceReference && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Evidence: {item.evidenceReference}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-400">
                    {formatDateTime(item.issuedAt)}
                  </p>

                  {item.withdrawnAt && (
                    <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
                      Withdrawn {formatDateTime(item.withdrawnAt)} ·{" "}
                      {item.withdrawalReason}
                    </div>
                  )}

                  {item.canWithdraw && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs font-black text-slate-500">
                        Correct erroneous recognition record
                      </summary>
                      <div className="mt-3 flex gap-2">
                        <input
                          value={notes[`recognition-${item.id}`] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [`recognition-${item.id}`]: event.target.value,
                            }))
                          }
                          placeholder="Why is withdrawal necessary?"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          disabled={busyId === `withdraw-${item.id}`}
                          onClick={() =>
                            void submit(
                              {
                                mode: "withdraw_recognition",
                                recognitionId: item.id,
                                reason:
                                  notes[`recognition-${item.id}`]?.trim() ??
                                  "",
                              },
                              `withdraw-${item.id}`,
                            )
                          }
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-800"
                        >
                          Withdraw
                        </button>
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-700">
            Restricted cases
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Corrective, grievance & formal discipline
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Case visibility follows the actual parties and reporting authority.
            A grievance subject is not shown the case as a concluded allegation
            until a formal response is requested.
          </p>

          {workspace.cases.length === 0 ? (
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
              <UsersRound className="mx-auto size-9 text-brand-700" />
              <p className="mt-3 text-sm text-slate-500">
                No restricted accountability cases are visible.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {workspace.cases.map((review) => {
                const responseComplete = ["submitted", "no_response_recorded"].includes(
                  review.responseState,
                );
                const decisionReady =
                  review.canManage &&
                  review.evidence.length > 0 &&
                  (review.caseType === "grievance"
                    ? !review.subjectStaffId || responseComplete
                    : responseComplete) &&
                  (!review.hearingRequired || !!review.hearingCompletedAt) &&
                  review.status !== "external_review_required" &&
                  !["closed", "withdrawn", "cancelled", "referred_formal"].includes(
                    review.status,
                  );

                const selectedOutcome =
                  outcomes[review.id] ?? outcomesFor(review)[0][0];
                const requiresAuthorityReference = [
                  "other_proportionate_action",
                  "refer_separation_review",
                ].includes(selectedOutcome);

                return (
                  <article
                    key={review.id}
                    className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-white">
                            {review.reference}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold capitalize text-slate-600">
                            {readable(review.caseType)}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-black capitalize ${statusClass(
                              review.status,
                            )}`}
                          >
                            {readable(review.status)}
                          </span>
                        </div>

                        <h3 className="mt-3 text-xl font-black">{review.title}</h3>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">
                          {review.statement}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                          {review.reporterName && (
                            <span>Reporter: {review.reporterName}</span>
                          )}
                          {review.subjectName && (
                            <span>
                              Subject: {review.subjectName}
                              {review.subjectRoleTitle
                                ? ` · ${review.subjectRoleTitle}`
                                : ""}
                            </span>
                          )}
                          <span>Opened {formatDateTime(review.createdAt)}</span>
                        </div>
                      </div>

                      <div className="min-w-[220px] rounded-2xl bg-slate-50 p-4 text-xs">
                        <p className="font-black uppercase tracking-[0.12em] text-slate-500">
                          Process gates
                        </p>
                        <p className="mt-2 font-semibold">
                          Response: {readable(review.responseState)}
                        </p>
                        {review.responseDueAt && (
                          <p className="mt-1 text-slate-500">
                            Due {formatDateTime(review.responseDueAt)}
                          </p>
                        )}
                        {review.hearingRequired && (
                          <p className="mt-2 font-semibold">
                            Hearing:{" "}
                            {review.hearingCompletedAt ? "recorded" : "required"}
                          </p>
                        )}
                        <p className="mt-2 font-semibold">
                          Evidence: {review.evidence.length}
                        </p>
                      </div>
                    </div>

                    {review.relevantStandard && (
                      <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-700">
                          Relevant standard / expectation
                        </p>
                        <p className="mt-2 text-sm leading-6 text-brand-950">
                          {review.relevantStandard}
                        </p>
                      </div>
                    )}

                    {review.status === "external_review_required" && (
                      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex gap-3">
                          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-800" />
                          <div>
                            <p className="text-sm font-black text-amber-950">
                              Independent external governance required
                            </p>
                            <p className="mt-1 text-sm leading-6 text-amber-900/80">
                              The highest internal authority is a party to this
                              matter. KHP-OS will not allow internal self-decision.
                            </p>
                          </div>
                        </div>

                        {review.canRecordExternalReview && (
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            <select
                              value={selectedOutcome}
                              onChange={(event) =>
                                setOutcomes((current) => ({
                                  ...current,
                                  [review.id]: event.target.value,
                                }))
                              }
                              className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
                            >
                              {outcomesFor(review).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <input
                              value={references[`external-${review.id}`] ?? ""}
                              onChange={(event) =>
                                setReferences((current) => ({
                                  ...current,
                                  [`external-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              placeholder="Independent review reference"
                              className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm"
                            />
                            <textarea
                              value={notes[`external-${review.id}`] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [`external-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Record the independent reviewer’s supplied outcome—not your own decision."
                              className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm lg:col-span-2"
                            />
                            <button
                              type="button"
                              disabled={busyId === `external-${review.id}`}
                              onClick={() =>
                                void submit(
                                  {
                                    mode: "record_external_review",
                                    caseId: review.id,
                                    outcome: selectedOutcome,
                                    outcomeNote:
                                      notes[`external-${review.id}`]?.trim() ??
                                      "",
                                    externalReviewReference:
                                      references[
                                        `external-${review.id}`
                                      ]?.trim() ?? "",
                                  },
                                  `external-${review.id}`,
                                )
                              }
                              className="rounded-full bg-amber-900 px-4 py-2 text-xs font-black text-white"
                            >
                              Record external outcome
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {review.isSubject &&
                      review.responseState === "requested" && (
                        <details
                          open
                          className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4"
                        >
                          <summary className="cursor-pointer text-sm font-black text-violet-950">
                            Your response opportunity
                          </summary>
                          <p className="mt-2 text-xs leading-5 text-violet-800">
                            Respond to the specific concern/allegation before
                            institutional decision. You may add an evidence
                            reference.
                          </p>
                          <textarea
                            value={notes[`response-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [`response-${review.id}`]: event.target.value,
                              }))
                            }
                            rows={4}
                            className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm"
                            placeholder="Your response"
                          />
                          <input
                            value={references[`response-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setReferences((current) => ({
                                ...current,
                                [`response-${review.id}`]:
                                  event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm"
                            placeholder="Evidence reference (optional)"
                          />
                          <button
                            type="button"
                            disabled={busyId === `response-${review.id}`}
                            onClick={() =>
                              void submit(
                                {
                                  mode: "submit_response",
                                  caseId: review.id,
                                  responseText:
                                    notes[`response-${review.id}`]?.trim() ??
                                    "",
                                  evidenceReference:
                                    references[
                                      `response-${review.id}`
                                    ]?.trim() || null,
                                },
                                `response-${review.id}`,
                              )
                            }
                            className="mt-3 rounded-full bg-violet-700 px-4 py-2 text-xs font-black text-white"
                          >
                            Submit response
                          </button>
                        </details>
                      )}

                    {review.responses.length > 0 && (
                      <details className="mt-5 rounded-2xl border border-slate-200 p-4">
                        <summary className="cursor-pointer text-sm font-black">
                          Responses & records · {review.responses.length}
                        </summary>
                        <div className="mt-3 space-y-2">
                          {review.responses.map((response) => (
                            <div
                              key={response.id}
                              className="rounded-xl bg-slate-50 p-3 text-sm"
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                                {readable(response.responseType)}
                              </p>
                              <p className="mt-1 leading-6 text-slate-700">
                                {response.responseText}
                              </p>
                              {response.evidenceReference && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Evidence: {response.evidenceReference}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                      <summary className="cursor-pointer text-sm font-black">
                        Case evidence · {review.evidence.length}
                      </summary>

                      {review.evidence.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {review.evidence.map((evidence) => (
                            <div
                              key={evidence.id}
                              className="rounded-xl bg-slate-50 p-3 text-sm"
                            >
                              <p className="font-black">{evidence.title}</p>
                              <p className="mt-1 text-xs font-bold capitalize text-slate-500">
                                {readable(evidence.evidenceType)}
                              </p>
                              <p className="mt-2 leading-6 text-slate-600">
                                {evidence.note}
                              </p>
                              {evidence.evidenceReference && (
                                <p className="mt-1 text-xs text-slate-500">
                                  {evidence.evidenceReference}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 grid gap-2 lg:grid-cols-2">
                        <select
                          value={types[`evidence-${review.id}`] ?? "document"}
                          onChange={(event) =>
                            setTypes((current) => ({
                              ...current,
                              [`evidence-${review.id}`]: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        >
                          {[
                            "document",
                            "communication",
                            "observation",
                            "operational_record",
                            "witness_note",
                            "policy_or_standard",
                            "other",
                          ].map((value) => (
                            <option key={value} value={value}>
                              {readable(value)}
                            </option>
                          ))}
                        </select>
                        <input
                          value={titles[`evidence-${review.id}`] ?? ""}
                          onChange={(event) =>
                            setTitles((current) => ({
                              ...current,
                              [`evidence-${review.id}`]:
                                event.target.value,
                            }))
                          }
                          placeholder="Evidence title"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                        <textarea
                          value={notes[`evidence-${review.id}`] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [`evidence-${review.id}`]:
                                event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="What does this evidence establish?"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                        <input
                          value={references[`evidence-${review.id}`] ?? ""}
                          onChange={(event) =>
                            setReferences((current) => ({
                              ...current,
                              [`evidence-${review.id}`]:
                                event.target.value,
                            }))
                          }
                          placeholder="Evidence reference"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busyId === `evidence-${review.id}`}
                        onClick={() =>
                          void submit(
                            {
                              mode: "add_evidence",
                              caseId: review.id,
                              evidenceType:
                                types[`evidence-${review.id}`] ?? "document",
                              title:
                                titles[`evidence-${review.id}`]?.trim() ?? "",
                              note:
                                notes[`evidence-${review.id}`]?.trim() ?? "",
                              evidenceReference:
                                references[
                                  `evidence-${review.id}`
                                ]?.trim() || null,
                            },
                            `evidence-${review.id}`,
                          )
                        }
                        className="mt-3 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-black text-brand-800"
                      >
                        Add evidence
                      </button>
                    </details>

                    {review.canManage &&
                      review.caseType === "grievance" &&
                      review.status === "open" && (
                        <button
                          type="button"
                          onClick={() =>
                            void simpleCaseAction(
                              review,
                              "acknowledge_grievance",
                            )
                          }
                          className="mt-4 rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white"
                        >
                          Acknowledge & review grievance
                        </button>
                      )}

                    {review.canManage &&
                      review.subjectStaffId &&
                      review.caseType === "grievance" &&
                      review.status === "under_review" &&
                      review.responseState === "not_requested" && (
                        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs font-black">
                            Request subject response
                          </p>
                          <input
                            type="datetime-local"
                            value={dates[`response-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setDates((current) => ({
                                ...current,
                                [`response-${review.id}`]:
                                  event.target.value,
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "request_response",
                                  caseId: review.id,
                                  responseDueAt: new Date(
                                    dates[`response-${review.id}`] ?? "",
                                  ).toISOString(),
                                  note:
                                    notes[`case-${review.id}`]?.trim() || null,
                                },
                                `request-response-${review.id}`,
                              )
                            }
                            className="mt-2 rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
                          >
                            Issue response request
                          </button>
                        </div>
                      )}

                    {review.canManage &&
                      review.responseState === "requested" &&
                      review.responseDueAt &&
                      new Date(review.responseDueAt).getTime() < Date.now() && (
                        <button
                          type="button"
                          onClick={() =>
                            void submit(
                              {
                                mode: "record_no_response",
                                caseId: review.id,
                                note:
                                  notes[`case-${review.id}`]?.trim() ??
                                  "Response deadline passed; prior notice/reminder confirmed.",
                              },
                              `no-response-${review.id}`,
                            )
                          }
                          className="mt-4 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900"
                        >
                          Record no response after deadline
                        </button>
                      )}

                    {review.canManage &&
                      review.caseType === "formal_discipline" &&
                      review.hearingRequired &&
                      !review.hearingCompletedAt &&
                      responseComplete && (
                        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                          <summary className="cursor-pointer text-sm font-black">
                            Record required hearing / panel step
                          </summary>
                          <textarea
                            value={notes[`hearing-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [`hearing-${review.id}`]:
                                  event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="What was considered and what opportunity was given?"
                            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            value={references[`hearing-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setReferences((current) => ({
                                ...current,
                                [`hearing-${review.id}`]:
                                  event.target.value,
                              }))
                            }
                            placeholder="Hearing/panel evidence reference"
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "record_hearing",
                                  caseId: review.id,
                                  hearingRecord:
                                    notes[`hearing-${review.id}`]?.trim() ??
                                    "",
                                  evidenceReference:
                                    references[
                                      `hearing-${review.id}`
                                    ]?.trim() || null,
                                },
                                `hearing-${review.id}`,
                              )
                            }
                            className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                          >
                            Save hearing record
                          </button>
                        </details>
                      )}

                    {decisionReady && (
                      <details className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
                        <summary className="cursor-pointer text-sm font-black text-brand-950">
                          Record reasoned case decision
                        </summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <select
                            value={selectedOutcome}
                            onChange={(event) =>
                              setOutcomes((current) => ({
                                ...current,
                                [review.id]: event.target.value,
                              }))
                            }
                            className="rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm"
                          >
                            {outcomesFor(review).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {requiresAuthorityReference && (
                            <input
                              value={
                                references[`authority-${review.id}`] ?? ""
                              }
                              onChange={(event) =>
                                setReferences((current) => ({
                                  ...current,
                                  [`authority-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              placeholder="Contract/legal/authority review reference"
                              className="rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm"
                            />
                          )}
                          <textarea
                            value={notes[`decision-${review.id}`] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [`decision-${review.id}`]:
                                  event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Reasoned outcome based on the response and evidence"
                            className="rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm lg:col-span-2"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "decide_case",
                                  caseId: review.id,
                                  outcome: selectedOutcome,
                                  outcomeNote:
                                    notes[`decision-${review.id}`]?.trim() ??
                                    "",
                                  authorityReviewReference:
                                    references[
                                      `authority-${review.id}`
                                    ]?.trim() || null,
                                },
                                `decision-${review.id}`,
                              )
                            }
                            className="rounded-full bg-brand-700 px-4 py-2 text-xs font-black text-white"
                          >
                            Record decision
                          </button>
                        </div>
                      </details>
                    )}

                    {review.canManage &&
                      review.outcome &&
                      ["corrective", "formal_discipline"].includes(
                        review.caseType,
                      ) &&
                      ["expectation_reset", "documented_reminder", "conduct_commitment", "corrective_action"].includes(
                        review.outcome,
                      ) && (
                        <details className="mt-4 rounded-2xl border border-slate-200 p-4">
                          <summary className="cursor-pointer text-sm font-black">
                            Create corrective commitment
                          </summary>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <select
                              value={
                                types[`action-${review.id}`] ??
                                "conduct_commitment"
                              }
                              onChange={(event) =>
                                setTypes((current) => ({
                                  ...current,
                                  [`action-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                              {[
                                "expectation_reset",
                                "documented_reminder",
                                "conduct_commitment",
                                "monitoring_period",
                                "other",
                              ].map((value) => (
                                <option key={value} value={value}>
                                  {readable(value)}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={dates[`action-${review.id}`] ?? ""}
                              onChange={(event) =>
                                setDates((current) => ({
                                  ...current,
                                  [`action-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            />
                            <input
                              value={titles[`action-${review.id}`] ?? ""}
                              onChange={(event) =>
                                setTitles((current) => ({
                                  ...current,
                                  [`action-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              placeholder="Commitment title"
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm lg:col-span-2"
                            />
                            <textarea
                              value={notes[`action-${review.id}`] ?? ""}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [`action-${review.id}`]:
                                    event.target.value,
                                }))
                              }
                              rows={2}
                              placeholder="What change must be demonstrated?"
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm lg:col-span-2"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void submit(
                                {
                                  mode: "create_corrective_action",
                                  caseId: review.id,
                                  actionType:
                                    types[`action-${review.id}`] ??
                                    "conduct_commitment",
                                  title:
                                    titles[`action-${review.id}`]?.trim() ??
                                    "",
                                  expectedChange:
                                    notes[`action-${review.id}`]?.trim() ??
                                    "",
                                  dueDate:
                                    dates[`action-${review.id}`] ?? "",
                                },
                                `create-action-${review.id}`,
                              )
                            }
                            className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
                          >
                            Add corrective commitment
                          </button>
                        </details>
                      )}

                    {review.correctiveActions.length > 0 && (
                      <div className="mt-5 space-y-3">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Corrective commitments
                        </p>
                        {review.correctiveActions.map((action) => (
                          <CorrectiveActionCard
                            key={action.id}
                            action={action}
                            busyId={busyId}
                            note={notes[`ca-${action.id}`] ?? ""}
                            evidenceReference={
                              references[`ca-${action.id}`] ?? ""
                            }
                            setNote={(value) =>
                              setNotes((current) => ({
                                ...current,
                                [`ca-${action.id}`]: value,
                              }))
                            }
                            setEvidenceReference={(value) =>
                              setReferences((current) => ({
                                ...current,
                                [`ca-${action.id}`]: value,
                              }))
                            }
                            submit={submit}
                          />
                        ))}
                      </div>
                    )}

                    {review.outcome && (
                      <div className="mt-5 rounded-2xl border border-brand-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <Gavel className="mt-0.5 size-5 shrink-0 text-brand-700" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-700">
                              Outcome · {readable(review.outcome)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {review.outcomeNote}
                            </p>
                            {review.decisionSource && (
                              <p className="mt-2 text-xs font-semibold capitalize text-slate-500">
                                Decision source: {review.decisionSource}
                              </p>
                            )}
                            {review.authorityReviewReference && (
                              <p className="mt-1 text-xs text-slate-500">
                                Reference: {review.authorityReviewReference}
                              </p>
                            )}
                          </div>
                        </div>

                        {(review.isSubject || review.isReporter) &&
                          !review.outcomeAcknowledgedAt && (
                            <button
                              type="button"
                              onClick={() =>
                                void submit(
                                  {
                                    mode: "acknowledge_outcome",
                                    caseId: review.id,
                                    note:
                                      "Outcome received. Acknowledgement records receipt and does not necessarily mean agreement.",
                                  },
                                  `ack-${review.id}`,
                                )
                              }
                              className="mt-3 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-black text-brand-800"
                            >
                              Acknowledge receipt
                            </button>
                          )}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {review.canManage &&
                        review.caseType === "corrective" &&
                        review.outcome &&
                        !["resolved", "closed"].includes(review.status) && (
                          <button
                            type="button"
                            onClick={() =>
                              void simpleCaseAction(
                                review,
                                "resolve_corrective",
                              )
                            }
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                          >
                            Resolve corrective case
                          </button>
                        )}

                      {review.canManage &&
                        ["corrective", "grievance"].includes(review.caseType) &&
                        !["referred_formal", "closed", "withdrawn"].includes(
                          review.status,
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              void simpleCaseAction(review, "refer_formal")
                            }
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
                          >
                            Refer to separate formal case
                          </button>
                        )}

                      {review.isReporter &&
                        review.caseType === "grievance" &&
                        !["resolved", "closed", "withdrawn", "cancelled"].includes(
                          review.status,
                        ) && (
                          <button
                            type="button"
                            onClick={() =>
                              void simpleCaseAction(
                                review,
                                "withdraw_grievance",
                              )
                            }
                            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                          >
                            Withdraw grievance
                          </button>
                        )}

                      {(review.canManage || review.canRecordExternalReview) &&
                        ["resolved", "decision_recorded", "referred_formal"].includes(
                          review.status,
                        ) && (
                          <button
                            type="button"
                            onClick={() => void simpleCaseAction(review, "close")}
                            className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
                          >
                            Close administrative case
                          </button>
                        )}
                    </div>

                    <details className="mt-5 border-t border-slate-100 pt-4">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-slate-700">
                        <History className="size-4" />
                        Restricted case history
                      </summary>
                      <div className="mt-3 space-y-2">
                        {review.history.map((event, index) => (
                          <div
                            key={`${event.createdAt}-${index}`}
                            className="rounded-xl bg-slate-50 p-3 text-xs"
                          >
                            <p className="font-black capitalize">
                              {readable(event.eventType)}
                            </p>
                            {event.note && (
                              <p className="mt-1 leading-5 text-slate-600">
                                {event.note}
                              </p>
                            )}
                            <p className="mt-1 text-slate-400">
                              {formatDateTime(event.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CorrectiveActionCard({
  action,
  busyId,
  note,
  evidenceReference,
  setNote,
  setEvidenceReference,
  submit,
}: {
  action: KhposOpsCorrectiveAction;
  busyId: string | null;
  note: string;
  evidenceReference: string;
  setNote: (value: string) => void;
  setEvidenceReference: (value: string) => void;
  submit: (payload: Record<string, unknown>, busyKey: string) => Promise<boolean>;
}) {
  async function act(operation: string) {
    await submit(
      {
        mode: "corrective_action",
        actionId: action.id,
        action: operation,
        note: note.trim() || null,
        evidenceReference: evidenceReference.trim() || null,
      },
      `${operation}-${action.id}`,
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">{action.title}</p>
          <p className="mt-1 text-xs font-semibold capitalize text-slate-500">
            {readable(action.actionType)} · due {action.dueDate}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-black capitalize ${statusClass(
            action.status,
          )}`}
        >
          {readable(action.status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {action.expectedChange}
      </p>

      {action.completionNote && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <p>{action.completionNote}</p>
          {action.evidenceReference && (
            <p className="mt-1 font-semibold">
              Evidence: {action.evidenceReference}
            </p>
          )}
        </div>
      )}

      {(action.isOwner || action.canVerify) &&
        !["verified", "cancelled"].includes(action.status) && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Action / verification note"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              value={evidenceReference}
              onChange={(event) => setEvidenceReference(event.target.value)}
              placeholder="Evidence reference"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
          </div>
        )}

      <div className="mt-3 flex flex-wrap gap-2">
        {action.isOwner && action.status === "open" && (
          <button
            type="button"
            disabled={busyId === `start-${action.id}`}
            onClick={() => void act("start")}
            className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-black text-brand-800"
          >
            Start
          </button>
        )}
        {action.isOwner &&
          ["open", "in_progress"].includes(action.status) && (
            <button
              type="button"
              disabled={busyId === `submit_evidence-${action.id}`}
              onClick={() => void act("submit_evidence")}
              className="rounded-full bg-brand-700 px-3 py-1.5 text-[11px] font-black text-white"
            >
              Submit evidence
            </button>
          )}
        {action.canVerify && action.status === "evidence_submitted" && (
          <button
            type="button"
            disabled={busyId === `verify-${action.id}`}
            onClick={() => void act("verify")}
            className="rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black text-white"
          >
            Verify
          </button>
        )}
        {action.canVerify &&
          ["evidence_submitted", "verified"].includes(action.status) && (
            <button
              type="button"
              disabled={busyId === `reopen-${action.id}`}
              onClick={() => void act("reopen")}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-900"
            >
              Reopen
            </button>
          )}
        {action.canVerify &&
          !["verified", "cancelled"].includes(action.status) && (
            <button
              type="button"
              disabled={busyId === `cancel-${action.id}`}
              onClick={() => void act("cancel")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600"
            >
              Cancel
            </button>
          )}
      </div>
    </div>
  );
}
