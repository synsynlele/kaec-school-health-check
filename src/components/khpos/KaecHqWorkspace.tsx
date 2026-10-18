"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BookOpen, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleAlert,
  ClipboardCheck, FolderKanban, Landmark, LayoutDashboard, Loader2, LockKeyhole,
  Plus, RefreshCw, ShieldCheck, Users, Wallet, LogOut, type LucideIcon,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { HqDataModule, HqModule, HqRecord, HqSnapshot } from "@/lib/khpos/hq";

const areas: { id: HqModule; label: string; subtitle: string; icon: LucideIcon }[] = [
  { id: "command", label: "Command Centre", subtitle: "Decisions, risks and deadlines", icon: LayoutDashboard },
  { id: "governance", label: "Governance & Playbooks", subtitle: "Company constitution and controlled ways of working", icon: BookOpen },
  { id: "people", label: "People & Roles", subtitle: "Accountability, appointments and succession", icon: Users },
  { id: "work", label: "Work & Execution", subtitle: "Assigned work, reports and approvals", icon: ClipboardCheck },
  { id: "partnerships", label: "Partnerships", subtitle: "School agreements and KAEC supervision", icon: BriefcaseBusiness },
  { id: "products", label: "Products & Projects", subtitle: "Product delivery and release decisions", icon: FolderKanban },
  { id: "finance", label: "Finance", subtitle: "Budgets, obligations and approval evidence", icon: Wallet },
];
const types: Record<HqDataModule, string[]> = {
  governance: ["constitution", "policy", "playbook", "authority", "decision"],
  people: ["appointment", "responsibility", "handover", "leave", "succession"],
  work: ["task", "recurring_obligation", "report", "approval", "meeting_action"],
  partnerships: ["prospect", "agreement", "onboarding", "supervision", "renewal"],
  products: ["roadmap", "milestone", "release", "incident", "project"],
  finance: ["budget", "invoice", "expense", "income", "obligation"],
};
const roleNames: Record<string, string> = {
  vision_custodian: "Vision Custodian",
  system_steward: "System Steward",
  alliance_catalyst: "Alliance Catalyst",
  product_architect: "Product Architect",
  movement_curator: "Movement Curator",
  finance_steward: "Finance Steward",
  team_member: "Team Member",
};
type FormFields = {
  title: string; description: string; record_type: string; status: string;
  priority: string; owner_user_id: string; backup_user_id: string;
  due_on: string; cadence: string; amount: string; currency: string; evidence_note: string;
};
const clsInput = "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-600";
const clsLabel = "block space-y-1.5 text-xs font-bold text-slate-600";
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
function isDataModule(value: HqModule): value is HqDataModule { return value !== "command"; }
function newForm(module: HqDataModule, viewer: string): FormFields {
  return { title: "", description: "", record_type: types[module][0], status: "draft",
    priority: "normal", owner_user_id: viewer, backup_user_id: "", due_on: "",
    cadence: "once", amount: "", currency: "NGN", evidence_note: "" };
}
function recordForm(record: HqRecord): FormFields {
  return { title: record.title, description: record.description, record_type: record.record_type,
    status: record.status, priority: record.priority, owner_user_id: record.owner_user_id ?? "",
    backup_user_id: record.backup_user_id ?? "", due_on: record.due_on ?? "",
    cadence: record.cadence, amount: record.amount?.toString() ?? "", currency: record.currency, evidence_note: record.evidence_note ?? "" };
}
function dateOnly(value: string | null) { return value ? value.slice(0, 10) : "No date"; }
const templates: Record<string, string> = {
  report: "Reporting period:\nProgress achieved:\nEvidence and outcomes:\nRisks or blockers:\nDecisions required:\nNext actions and owner:",
  supervision: "Partner school and visit date:\nKHP-OS usage and adoption:\nLeadership observations:\nAgreed corrective actions:\nResponsible person and next check-in:",
  onboarding: "School and agreement reference:\nCurrent activation stage:\nAssigned KAEC lead:\nOpen requirements:\nNext meeting or handover:",
  release: "Product and version:\nChange summary:\nTesting and evidence:\nKnown issues and rollback:\nIndependent approval required:",
  budget: "Period and cost centre:\nPurpose and allocation:\nSupporting breakdown:\nApproval authority:\nDecision reference:",
  decision: "Issue or opportunity:\nOptions considered:\nDecision and rationale:\nAccountable owner:\nReview date:",
};
function canCompleteRoutine(record: HqRecord, userId: string) {
  return record.module === "work" && ["task", "meeting_action", "recurring_obligation"].includes(record.record_type)
    && ["low","normal"].includes(record.priority) && record.owner_user_id === userId;
}
type ActionMode = "submit" | "complete" | "approve" | "return";
function RoleStatus({ status }: { status: HqRecord["status"] }) {
  const colors: Record<HqRecord["status"], string> = {
    draft: "bg-slate-100 text-slate-700", active: "bg-blue-50 text-blue-800",
    in_review: "bg-amber-50 text-amber-900", completed: "bg-emerald-50 text-emerald-800",
    cancelled: "bg-slate-100 text-slate-500",
  };
  return <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + colors[status]}>{pretty(status)}</span>;
}

export function KaecHqWorkspace() {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [snapshot, setSnapshot] = useState<HqSnapshot | null>(null);
  const [access, setAccess] = useState<"loading" | "signed_out" | "denied" | "ready">("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<HqModule>("command");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormFields | null>(null);
  const [editing, setEditing] = useState<HqRecord | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("team_member");
  const [memberAction, setMemberAction] = useState("grant");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactor, setMfaFactor] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [actionRecord, setActionRecord] = useState<HqRecord | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("submit");
  const [actionNote, setActionNote] = useState("");

  const load = useCallback(async () => {
    if (!client) { setError("KAEC sign-in is unavailable."); setAccess("denied"); return; }
    try {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setAccess("signed_out"); return; }
      const response = await fetch("/api/khpos/hq", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      const json = await response.json() as { ok?: boolean; snapshot?: HqSnapshot; error?: string };
      if (!response.ok || !json.ok || !json.snapshot) {
        setAccess(response.status === 401 ? "signed_out" : "denied");
        setError(json.error ?? "Corporate workspace could not be loaded.");
        return;
      }
      setSnapshot(json.snapshot);
      setAccess("ready");
      setError("");
    } catch {
      setAccess("denied");
      setError("The service could not be reached. Check your connection and try again.");
    }
  }, [client]);
  useEffect(() => {
    const id = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function act(action: string, values: Record<string, unknown> = {}) {
    if (!client) return false;
    setBusy(true); setError("");
    try {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setAccess("signed_out"); return false; }
      const res = await fetch("/api/khpos/hq", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await res.json() as { ok?: boolean; snapshot?: HqSnapshot; error?: string };
      if (!res.ok || !result.ok || !result.snapshot) {
        setError(result.error ?? "The operation was not saved.");
        return false;
      }
      setSnapshot(result.snapshot);
      setAccess("ready");
      return true;
    } catch {
      setError("The request failed. Please check your connection.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function setUpMfa() {
    if (!client) return;
    setBusy(true); setError("");
    const { data, error: authError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "KAEC HQ Corporate Access" });
    setBusy(false);
    if (authError) { setError(authError.message); return; }
    setMfaFactor(data.id); setMfaQr(data.totp.qr_code);
  }
  async function verifyMfa() {
    if (!client || !mfaCode.trim()) return;
    setBusy(true); setError("");
    let factorId = mfaFactor;
    if (!factorId) {
      const { data, error: factorsError } = await client.auth.mfa.listFactors();
      if (factorsError) { setBusy(false); setError(factorsError.message); return; }
      factorId = data.totp.find((factor) => factor.status === "verified")?.id ?? "";
    }
    if (!factorId) { setBusy(false); setError("Set up an authenticator first."); return; }
    const { error: authError } = await client.auth.mfa.challengeAndVerify({ factorId, code: mfaCode.trim() });
    setBusy(false);
    if (authError) { setError("The authenticator code could not be verified."); return; }
    await client.auth.refreshSession();
    setMfaQr(""); setMfaFactor(""); setMfaCode("");
    await load();
  }
  async function signOut() {
    if (!client) return;
    setBusy(true);
    const { error: signOutError } = await client.auth.signOut();
    setBusy(false);
    if (signOutError) { setError("Could not sign out. Please retry from Account."); return; }
    setSnapshot(null); setAccess("signed_out");
  }
  function startAction(record: HqRecord, mode: ActionMode) {
    setActionRecord(record); setActionMode(mode);
    setActionNote(mode === "submit" || mode === "complete" ? record.evidence_note ?? "" : "");
    setForm(null); setEditing(null); setError("");
  }
  async function confirmAction() {
    if (!actionRecord) return;
    const reviewMode = actionMode === "approve" || actionMode === "return";
    const success = await act(reviewMode ? "review" : actionMode, {
      id: actionRecord.id,
      ...(reviewMode ? { decision: actionMode === "approve" ? "approve" : "return", note: actionNote } : { evidence_note: actionNote }),
    });
    if (success) { setActionRecord(null); setActionNote(""); }
  }
  async function submitRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !isDataModule(tab)) return;
    const success = await act(editing ? "update" : "create", {
      record: { ...form, module: tab, id: editing?.id,
        owner_user_id: form.owner_user_id || null, backup_user_id: form.backup_user_id || null,
        due_on: form.due_on || null, amount: form.amount || null },
    });
    if (success) { setForm(null); setEditing(null); }
  }
  const memberLabel = useCallback((id: string | null) => {
    if (!id) return "Not assigned";
    return snapshot?.members.find((m) => m.user_id === id)?.display_name ?? "Former team member";
  }, [snapshot]);
  const area = areas.find((item) => item.id === tab) ?? areas[0];
  const visible = (snapshot?.records ?? []).filter((record) => {
    const inArea = tab === "command" || record.module === tab;
    const text = (record.title + " " + record.description + " " + record.record_type).toLowerCase();
    return inArea && text.includes(search.trim().toLowerCase());
  });
  const active = (snapshot?.records ?? []).filter((record) => record.status === "active" || record.status === "in_review");
  const overdue = active.filter((record) => record.due_on && record.due_on < new Date().toISOString().slice(0, 10));
  const waitingReview = active.filter((record) => record.status === "in_review");
  const critical = active.filter((record) => record.priority === "critical");
  const mine = active.filter((record) => record.owner_user_id === snapshot?.viewer.userId || record.backup_user_id === snapshot?.viewer.userId);
  const dueSoon = active.filter((record) => {
    if (!record.due_on) return false;
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
    return record.due_on >= today && record.due_on <= nextWeek;
  });
  const reviewable = waitingReview.filter((record) => {
    if (!snapshot || record.created_by === snapshot.viewer.userId || record.owner_user_id === snapshot.viewer.userId) return false;
    const role = snapshot.viewer.role;
    return role === "vision_custodian" || (role === "system_steward" && record.module !== "finance") ||
      (role === "finance_steward" && record.module === "finance");
  });

  if (access === "loading") return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="size-9 animate-spin text-emerald-300" aria-label="Loading KAEC HQ" /></main>;
  if (access === "signed_out") return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
    <section className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
      <LockKeyhole className="mx-auto size-10 text-emerald-300"/><h1 className="mt-4 text-3xl font-black">KAEC HQ sign-in</h1>
      <p className="mt-4 text-sm leading-7 text-slate-300">Sign in with your existing KAEC account. Corporate access is a separate appointment; school membership alone does not grant entry.</p>
      <Link href="/account" className="mt-6 inline-block rounded-xl bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950">Sign in securely</Link>
    </section>
  </main>;
  if (access === "denied" || !snapshot) return <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
    <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8">
      <ShieldCheck className="size-10 text-emerald-300"/><h1 className="mt-4 text-3xl font-black">Restricted corporate workspace</h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">{error}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">The Vision Custodian must be explicitly appointed before KAEC HQ opens. Initial activation requires the designated verified corporate account and MFA. KAEC HQ permissions are separate from platform administration.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => void act("bootstrap")} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40">Activate if designated</button>
        <button onClick={() => void load()} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold">Retry access</button>
        <Link href="/account" className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-bold">Account</Link>
      </div>
      <p className="mt-5 text-xs text-slate-400">If you have not completed MFA, verify it through your account's authenticator.</p>
      <Link href="/account" className="mt-2 inline-block text-sm font-bold text-emerald-300 underline">Account security</Link>
    </section>
  </main>;

  const privileged = snapshot.viewer.role === "vision_custodian";
  const canReview = snapshot.viewer.role === "vision_custodian" || snapshot.viewer.role === "system_steward" || snapshot.viewer.role === "finance_steward";
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3"><Landmark className="size-8 text-emerald-300" /><div>
            <p className="text-xs font-bold uppercase tracking-[0.19em] text-emerald-300">KAEC-NG Ltd · Private corporate workspace</p>
            <h1 className="text-2xl font-black">KAEC HQ</h1></div></div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span>{roleNames[snapshot.viewer.role] ?? snapshot.viewer.role}</span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">MFA: {snapshot.viewer.aal === "aal2" ? "Verified" : "Not verified"}</span>
            <button disabled={busy} onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-2 disabled:opacity-40"><RefreshCw className="size-3.5"/> Refresh</button>
            <Link href="/account" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-slate-950"><ArrowLeft className="size-3.5"/> Account</Link>
            <button disabled={busy} onClick={() => void signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-2 disabled:opacity-40"><LogOut className="size-3.5"/> Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="KAEC HQ areas" className="grid content-start grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {areas.filter((item) => snapshot.allowedModules.includes(item.id)).map((item) => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => { setTab(item.id); setForm(null); setEditing(null); setActionRecord(null); setSearch(""); }}
              aria-current={tab === item.id ? "page" : undefined}
              className={"flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-left text-xs font-bold transition " +
                (tab === item.id ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white hover:bg-slate-50")}>
              <Icon className="mt-0.5 size-4 shrink-0"/><span>{item.label}</span>
            </button>;
          })}
        </nav>
        <main className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Corporate operating system</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">{area.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{area.subtitle}</p></div>
            {isDataModule(tab) && <button disabled={busy} onClick={() => { setForm(newForm(tab, snapshot.viewer.userId)); setEditing(null); }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus className="size-4"/> New record</button>}
          </div>
          {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
          {snapshot.hasMore && <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-900">The latest 300 accessible records are shown. Older records require additional filtering and pagination.</p>}

          {snapshot.viewer.aal !== "aal2" && <section className="rounded-2xl border border-amber-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold"><LockKeyhole className="size-4"/> Strengthen your account security</h3>
            <p className="mt-1 text-xs leading-6 text-slate-600">MFA is required for financial changes, corporate appointments and high-risk reviews. You can still read your authorised work.</p>
            {mfaQr && <div className="mt-3 flex flex-wrap items-center gap-3"><img src={mfaQr} width={150} height={150} alt="Authenticator setup QR code"/><p className="max-w-xs text-xs text-slate-600">Scan with your authenticator app, then enter its current six-digit code.</p></div>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <button onClick={() => void setUpMfa()} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Set up authenticator</button>
              <label className="text-xs font-semibold">Authentication code<input className={clsInput + " mt-1 w-40"} inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maxLength={8}/></label>
              <button onClick={() => void verifyMfa()} disabled={busy || !mfaCode.trim()} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Verify MFA</button>
            </div>
          </section>}

          {tab === "command" && <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[["My live responsibilities", mine.length, ClipboardCheck], ["Overdue work", overdue.length, CalendarClock],
                ["Awaiting verification", waitingReview.length, CheckCircle2], ["Critical open issues", critical.length, CircleAlert]].map(([label, value, Icon]) => {
                  const Component = Icon as LucideIcon;
                  return <div key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <Component className="size-5 text-emerald-700"/><p className="mt-3 text-3xl font-black">{value as number}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{label as string}</p>
                  </div>;
                })}
            </div>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-black">Leadership attention</h3>
              <p className="mt-1 text-xs text-slate-600">Derived from authorised corporate work records. No simulated figures or school-level private data.</p>
              {Array.from(new Map([...overdue, ...waitingReview, ...critical].map((r) => [r.id, r])).values()).slice(0, 12).map((r) =>
                <button key={r.id} className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => {setTab(r.module);setSearch(r.title);}}>
                  <span><strong className="block">{r.title}</strong><span className="text-xs text-slate-600">{pretty(r.module)} · {memberLabel(r.owner_user_id)}</span></span>
                  <RoleStatus status={r.status}/>
                </button>)}
              {!overdue.length && !waitingReview.length && !critical.length && <p className="mt-4 text-sm text-slate-500">No current exceptions recorded. This does not guarantee all work is on track.</p>}
            </section>
          </>}

          {tab === "people" && <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-black">Corporate appointments</h3>
            <p className="mt-1 text-xs text-slate-600">A school position does not create a KAEC-NG corporate appointment.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {snapshot.members.map((member) => <div key={member.user_id} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold">{member.display_name}</p><p className="text-xs text-slate-600">{roleNames[member.role]} · {pretty(member.status)}</p>
                {privileged && <p className="mt-1 break-all text-xs text-slate-500">{member.email}</p>}
                {privileged && member.role !== "vision_custodian" && <button disabled={busy || snapshot.viewer.aal !== "aal2"} className="mt-2 text-xs font-bold text-emerald-800 underline disabled:opacity-40"
                  onClick={() => void act("member",{ action: member.status === "active" ? "suspend" : "reactivate", email: member.email, display_name: member.display_name, role: member.role })}>
                  {member.status === "active" ? "Suspend corporate access" : "Reactivate corporate access"}
                </button>}
              </div>)}
            </div>
            {privileged && <form className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              void act("member", { action: memberAction, email: memberEmail, display_name: memberName, role: memberRole }).then((done) => { if (done) {setMemberEmail("");setMemberName("");} });
            }}>
              <h4 className="sm:col-span-2 text-sm font-black">Manage a verified KAEC account</h4>
              <label className={clsLabel}>Appointment action<select className={clsInput} value={memberAction} onChange={(e) => setMemberAction(e.target.value)}>
                <option value="grant">Grant or change role</option><option value="suspend">Suspend access</option><option value="reactivate">Reactivate access</option>
              </select></label>
              <label className={clsLabel}>Email<input required type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className={clsInput}/></label>
              <label className={clsLabel}>Name<input required minLength={2} value={memberName} onChange={(e) => setMemberName(e.target.value)} className={clsInput}/></label>
              <label className={clsLabel}>Company role<select className={clsInput} value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                {Object.entries(roleNames).filter(([key]) => key !== "vision_custodian").map(([key,value]) => <option key={key} value={key}>{value}</option>)}
              </select></label>
              <button disabled={busy || snapshot.viewer.aal !== "aal2"} className="self-end rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Approve appointment</button>
              <p className="sm:col-span-2 text-xs text-slate-500">Requires Vision Custodian permission and verified MFA. Suspensions and succession approvals must remain governed actions.</p>
            </form>}
          </section>}

          {isDataModule(tab) && <>
            {tab === "partnerships" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Corporate partnership activities live here. Institutional access approvals remain in the existing <Link className="font-bold underline" href="/khpos/admin/partnerships">KHP-OS Partnership Registry</Link>, where separately authorised platform administrators manage them.
            </div>}
            {tab === "finance" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              This is a controlled budget and obligation register, not yet a banking, payment processing or accounting reconciliation system. Approval and money movement remain separate.
            </div>}
            {tab === "work" && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
              Recurrence intervals are recorded here. Automatic recurring task creation and reminder delivery will be enabled only after their execution and reliability checks pass.
            </div>}
            {form && <form onSubmit={(event) => void submitRecord(event)} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="text-lg font-black">{editing ? "Edit corporate record" : "New " + pretty(tab) + " record"}</h3>
                <button type="button" onClick={() => {setForm(null);setEditing(null);}} className="text-xs font-bold text-slate-500 underline">Close</button></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={clsLabel}>Title<input required minLength={4} maxLength={180} className={clsInput} value={form.title} onChange={(e) => setForm({...form,title:e.target.value})}/></label>
                <label className={clsLabel}>Record type<select className={clsInput} value={form.record_type} onChange={(e) => setForm({...form,record_type:e.target.value})}>{types[tab].map((t) => <option value={t} key={t}>{pretty(t)}</option>)}</select></label>
                <label className={clsLabel}>Status<select className={clsInput} value={form.status} onChange={(e) => setForm({...form,status:e.target.value})}>
                  {["draft","active","in_review","cancelled"].map((s) => <option value={s} key={s}>{pretty(s)}</option>)}</select></label>
                <label className={clsLabel}>Priority<select className={clsInput} value={form.priority} onChange={(e) => setForm({...form,priority:e.target.value})}>
                  {["low","normal","high","critical"].map((s) => <option value={s} key={s}>{pretty(s)}</option>)}</select></label>
                <label className={clsLabel}>Accountable owner<select className={clsInput} value={form.owner_user_id} onChange={(e) => setForm({...form,owner_user_id:e.target.value})}><option value="">Not assigned</option>
                  {snapshot.members.filter((m) => m.status === "active").map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name} — {roleNames[m.role]}</option>)}</select></label>
                <label className={clsLabel}>Backup person<select className={clsInput} value={form.backup_user_id} onChange={(e) => setForm({...form,backup_user_id:e.target.value})}><option value="">Not assigned</option>
                  {snapshot.members.filter((m) => m.status === "active" && m.user_id !== form.owner_user_id).map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}</select></label>
                <label className={clsLabel}>Due date<input type="date" className={clsInput} value={form.due_on} onChange={(e) => setForm({...form,due_on:e.target.value})}/></label>
                <label className={clsLabel}>Cadence<select className={clsInput} value={form.cadence} onChange={(e) => setForm({...form,cadence:e.target.value})}>{["once","daily","weekly","monthly","termly","quarterly","yearly"].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></label>
                {tab === "finance" && <>
                  <label className={clsLabel}>Amount<input className={clsInput} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})}/></label>
                  <label className={clsLabel}>Currency<select className={clsInput} value={form.currency} onChange={(e) => setForm({...form,currency:e.target.value})}>{["NGN","USD","GBP","EUR"].map((s) => <option key={s}>{s}</option>)}</select></label>
                </>}
                <label className={clsLabel + " sm:col-span-2"}>Description, procedure or supporting note<textarea rows={4} maxLength={5000} value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} className={clsInput}/></label>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button disabled={busy || (tab === "finance" && snapshot.viewer.aal !== "aal2")} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Save corporate record"}</button>
                <p className="text-xs text-slate-500">Changes preserve history. Reviewed records cannot be silently overwritten.</p>
              </div>
            </form>}
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-black">Corporate register</h3>
                <label className="text-xs font-semibold text-slate-600">Search records<input aria-label="Search corporate records" placeholder="Title, type or notes" value={search} onChange={(e) => setSearch(e.target.value)} className={clsInput + " mt-1 sm:w-64"}/></label>
              </div>
              <div className="mt-4 space-y-3">
                {visible.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-7 text-sm text-slate-600">No matching corporate records yet. Start with a real responsibility, agreement, process or decision.</div>}
                {visible.map((record) => <article key={record.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{pretty(record.record_type)} · {pretty(record.priority)} priority</p>
                      <h4 className="mt-1 text-base font-black">{record.title}</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{record.description}</p></div>
                    <RoleStatus status={record.status}/>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                    <span>Owner: <strong>{memberLabel(record.owner_user_id)}</strong></span><span>Backup: <strong>{memberLabel(record.backup_user_id)}</strong></span>
                    <span>Due: <strong>{dateOnly(record.due_on)}</strong></span>
                    {record.cadence !== "once" && <span>Cadence: <strong>{pretty(record.cadence)}</strong></span>}
                    {record.module === "finance" && record.amount !== null && <span>Amount: <strong>{record.currency} {Number(record.amount).toLocaleString()}</strong></span>}
                    <span>Updated: {new Date(record.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.status !== "completed" && record.status !== "cancelled" &&
                      <button disabled={busy} onClick={() => { setTab(record.module);setEditing(record);setForm(recordForm(record)); }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-40">Edit / submit</button>}
                    {canReview && record.status === "in_review" && record.owner_user_id !== snapshot.viewer.userId && record.created_by !== snapshot.viewer.userId &&
                      <><button disabled={busy} onClick={() => void act("review", { id: record.id, decision: "approve" })} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Verify completion</button>
                        <button disabled={busy} onClick={() => void act("review", { id: record.id, decision: "return" })} className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-40">Return to owner</button></>}
                  </div>
                </article>)}
              </div>
            </section>
          </>}
          <p className="text-xs leading-6 text-slate-500">KAEC HQ is separate from school KHP-OS. Your view is permission-limited. Operational work requires people and evidence; this platform does not replace formal legal or financial approvals.</p>
        </main>
      </div>
    </div>
  );
}
