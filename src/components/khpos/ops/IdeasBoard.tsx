"use client";

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
    try {
      setBoard(await request({ body, anonymous, recipient: privateView && !replyTo ? recipient : null, parent: replyTo }));
      setBody("");
      setReplyTo(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-3xl space-y-5 p-4 text-slate-900">
      <ActionFeedback busy={Boolean(busy)} error={error ?? ""} notice={""} onDismiss={() => { setError(""); }} />
    <h1 className="text-2xl font-bold">Ideas &amp; Discussions</h1>
    <p>Share ideas and discuss suggestions with your team.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {!board && !error && <p role="status">Loading discussions…</p>}
    {board && <>
      <div className="flex gap-2">
        {["Team board", "Private to a leader"].map((label, index) => <button key={label}
          type="button" aria-pressed={privateView === Boolean(index)} disabled={busy}
          className="rounded-lg border bg-white px-3 py-2 aria-pressed:bg-blue-100"
          onClick={() => { if (privateView !== Boolean(index)) { setPrivateView(Boolean(index)); setReplyTo(null); setBody(""); } }}>{label}</button>)}
        <button type="button" disabled={busy} className="ml-auto text-sm underline" onClick={() => {
          setError("");
          void request().then(setBoard).catch(error => setError(error.message));
        }}>Refresh</button>
      </div>
      <form id="idea-composer" onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4">
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
      {board.posts.filter(post => post.private === privateView).map(post => <article key={post.id} className="space-y-3 rounded-xl border bg-white p-4">
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
