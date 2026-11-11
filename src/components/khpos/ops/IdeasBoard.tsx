"use client";

import { LoadingScreen } from "@/components/navigation/LoadingScreen";

import { ActionFeedback } from "./ActionFeedback";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Reply = { id: string; body: string; author: string };
type Idea = Reply & { createdAt: string; private: boolean; replies: Reply[] };
type Board = { leaders: { id: string; name: string }[]; posts: Idea[] };

export function IdeasBoard({ scope }: { scope: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [privateView, setPrivateView] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const request = useCallback(async (payload?: object, signal?: AbortSignal) => {
    const auth = await createBrowserSupabaseClient()?.auth.getSession();
    const token = auth?.data.session?.access_token;
    if (!token) throw new Error("Sign in to open this board.");
    const response = await fetch(`/api/khpos/ops/ideas/${scope}`, {
      method: payload ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
      signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The board could not be loaded.");
    return data as Board;
  }, [scope]);

  useEffect(() => {
    const controller = new AbortController();
    request(undefined, controller.signal).then(setBoard).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [request]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !body.trim() || (privateView && !replyTo && !recipient)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setBoard(await request({ body, anonymous, recipient: privateView && !replyTo ? recipient : null, parent: replyTo }));
      setBody("");
      setReplyTo(null);
      setNotice(replyTo ? "Reply posted." : privateView ? "Private idea sent." : "Idea posted.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 text-slate-900 sm:px-6">
      <ActionFeedback busy={Boolean(busy)} error={error ?? ""} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />
    <header className="khpos-interface-card p-5 sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-700">School & HQ collaboration</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Ideas &amp; Discussions</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Share improvements with your team, or send a private suggestion to an authorised leader.</p>
    </header>
    {!board && !error && <LoadingScreen />}
    {board && <>
      <div className="flex flex-wrap items-center gap-2" aria-label="Discussion visibility">
        {["Team board", "Private to a leader"].map((label, index) => <button key={label}
          type="button" aria-pressed={privateView === Boolean(index)} disabled={busy}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-brand-500 aria-pressed:border-brand-700 aria-pressed:bg-brand-50 aria-pressed:text-brand-800"
          onClick={() => { if (privateView !== Boolean(index)) { setPrivateView(Boolean(index)); setReplyTo(null); setBody(""); } }}>{label}</button>)}
        <button type="button" disabled={busy} className="ml-auto text-sm underline" onClick={() => {
          setError("");
          void request().then(setBoard).catch(error => setError(error.message));
        }}>Refresh</button>
      </div>
      <form id="idea-composer" onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <fieldset disabled={busy} className="space-y-3">
          <legend className="font-semibold">{replyTo ? "Reply to discussion" : privateView ? "Send a private idea" : "Post an idea"}</legend>
          {privateView && !replyTo && <label className="block">Choose a leader
            <select required value={recipient} onChange={event => setRecipient(event.target.value)} className="block w-full rounded border p-2">
              <option value="">Select a leader</option>
              {board.leaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
            </select>
          </label>}
          {privateView && <p className="text-sm">Only you and the selected leader can see this discussion.</p>}
          <label className="block">Your {replyTo ? "reply" : "idea"}
            <textarea required maxLength={4000} rows={4} value={body} onChange={event => setBody(event.target.value)} className="block w-full rounded border p-2" />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} /> Hide my name</label>
          {anonymous && <p className="text-sm">Readers will see “Anonymous”. The system retains the account that submitted it.</p>}
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{busy ? "Saving…" : replyTo ? "Reply" : privateView ? "Send privately" : "Post idea"}</button>
          {replyTo && <button type="button" onClick={() => { setReplyTo(null); setBody(""); }} className="ml-3 text-sm underline">Cancel reply</button>}
        </fieldset>
      </form>
      {board.posts.filter(post => post.private === privateView).map(post => <article key={post.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="text-sm"><strong>{post.author}</strong> · {new Date(post.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })} WAT</header>
        <p className="whitespace-pre-wrap break-words">{post.body}</p>
        {post.replies.map(reply => <div key={reply.id} className="ml-3 border-l pl-3">
          <strong className="text-sm">{reply.author}</strong>
          <p className="whitespace-pre-wrap break-words">{reply.body}</p>
        </div>)}
        <button type="button" disabled={busy} onClick={() => {
          setReplyTo(post.id);
          setBody("");
          document.getElementById("idea-composer")?.scrollIntoView({ block: "center" });
        }} className="text-sm font-semibold text-blue-800">Reply</button>
      </article>)}
      {!board.posts.some(post => post.private === privateView) && <p className="text-sm">No discussions here yet.</p>}
    </>}
  </main>;
}
