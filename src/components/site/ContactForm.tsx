"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ContactFormProps {
  defaultType?: "consultation" | "training" | "talk" | "general";
  heading?: string;
}

export function ContactForm({ defaultType = "general" }: ContactFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          schoolName: data.get("schoolName"),
          phone: data.get("phone"),
          requestType: data.get("requestType"),
          message: data.get("message"),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to send");
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-mint-100 bg-mint-50 p-10 text-center">
        <CheckCircle2 className="size-12 text-mint-600" />
        <h3 className="mt-4 text-xl font-bold text-slate-900">Message received</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
          Thank you — the KAEC team will reach out within one working day. Meanwhile, your free
          School Health Check is always available.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cf-name">Your name *</Label>
          <Input id="cf-name" name="name" required placeholder="e.g. Adaeze Okafor" autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-email">Email *</Label>
          <Input id="cf-email" name="email" type="email" required placeholder="you@school.com" autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-school">School name</Label>
          <Input id="cf-school" name="schoolName" placeholder="e.g. Bright Futures Academy" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-phone">Phone / WhatsApp</Label>
          <Input id="cf-phone" name="phone" type="tel" placeholder="+234 ..." autoComplete="tel" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-type">I want to</Label>
        <Select id="cf-type" name="requestType" defaultValue={defaultType}>
          <option value="consultation">Book a consultation</option>
          <option value="training">Request staff training</option>
          <option value="talk">Talk to KAEC about my school</option>
          <option value="general">Ask a general question</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-message">Message *</Label>
        <Textarea
          id="cf-message"
          name="message"
          required
          minLength={5}
          placeholder="Tell us briefly about your school and what you need help with…"
        />
      </div>
      {status === "error" && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={status === "sending"}>
        Send message <Send className="size-4" />
      </Button>
    </form>
  );
}
