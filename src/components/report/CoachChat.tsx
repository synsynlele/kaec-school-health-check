"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, CornerDownLeft, Lightbulb, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  "How do I improve leadership?",
  "How can we increase enrolment?",
  "How do we improve discipline?",
];

export function CoachChat({ assessmentId }: { assessmentId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello — I'm the KAEC AI Coach, and I have read your entire health report. Ask me anything: why an area scored the way it did, how to start a recommendation, or what to prioritise first.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput("");
    const history = messages.filter((m) => !m.pending).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", pending: true },
    ]);
    setStreaming(true);

    try {
      const res = await fetch(`/api/report/${assessmentId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "The coach could not answer right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: snapshot, pending: true };
          return next;
        });
      }
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: acc };
        return next;
      });
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content:
            err instanceof Error && err.message
              ? err.message
              : "Something interrupted my answer. Please ask again.",
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* message list */}
      <div
        ref={scrollRef}
        className="max-h-[440px] min-h-[280px] space-y-4 overflow-y-auto scroll-smooth rounded-2xl bg-slate-50/80 p-4 sm:p-5"
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                m.role === "assistant" ? "bg-brand-700 text-white" : "bg-slate-200 text-slate-600",
              )}
            >
              {m.role === "assistant" ? <Bot className="size-4" /> : <User className="size-4" />}
            </span>
            <div
              className={cn(
                "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "assistant"
                  ? "rounded-tl-sm bg-white text-slate-700 shadow-soft"
                  : "rounded-tr-sm bg-brand-700 text-white",
              )}
            >
              {m.content}
              {m.pending && <span className="ml-1 inline-block size-2 animate-pulse rounded-full bg-brand-400" />}
            </div>
          </div>
        ))}
      </div>

      {/* suggestions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={streaming}
            onClick={() => void send(s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
          >
            <Lightbulb className="size-3.5 text-amber-500" />
            {s}
          </button>
        ))}
      </div>

      {/* input */}
      <form onSubmit={onSubmit} className="mt-4 flex gap-2.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask about your report…"
          maxLength={600}
          aria-label="Ask the AI coach a question about your report"
          disabled={streaming}
          className="h-12"
        />
        <Button type="submit" disabled={streaming || !input.trim()} className="h-12 shrink-0 px-5">
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Ask</span>
          <CornerDownLeft className="size-3.5 opacity-60" />
        </Button>
      </form>
      <p className="mt-2 text-[11px] text-slate-400">
        The coach answers using only this school's report data. For deeper support, contact the KAEC team above.
      </p>
    </div>
  );
}
