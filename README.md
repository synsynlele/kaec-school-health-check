# KAEC School Health Check

**Know the Health of Your School in Minutes.**

A free, AI-powered diagnostic for school owners and leaders. A school answers 55
structured indicators across 11 areas; the AI analyses every response and
produces a professional School Health Report — scores, analysis, recommendations,
a 90-day improvement plan, a downloadable PDF and an AI coach that answers
questions about the report.

No accounts. No dashboards. No passwords. Extremely simple by design.

## Stack

- **Next.js 16** (App Router) · TypeScript · Tailwind CSS v4 · shadcn-style UI
- **Database:** PostgreSQL via `DATABASE_URL` (auto-provisions tables on first
  request) **or** Supabase REST when `NEXT_PUBLIC_SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` are set (apply `supabase/schema.sql`)
- **AI:** OpenAI (`gpt-4o-mini` by default) with a built-in deterministic
  report engine as guaranteed fallback — a complete report is generated even if
  the model is unreachable
- **PDF:** `pdf-lib` server-side branded PDF at `/api/report/[id]/pdf`
- **Email:** Resend when `RESEND_API_KEY` is set; otherwise safely queued in
  the `email_log` table

## Environment variables

```bash
# Required for database — one of these two setups:
DATABASE_URL=postgresql://user:pass@host:5432/db            # option A
# — or —
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co      # option B
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# AI report + coach (app works without it, using the built-in engine)
OPENAI_API_KEY=sk-...

# Optional
OPENAI_MODEL=gpt-4o-mini
RESEND_API_KEY=re_...
EMAIL_FROM="KAEC School Health <reports@yourdomain.com>"
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Run

```bash
npm install
npm run dev
```

Deploy to Vercel: push to GitHub, import the repo, set the environment
variables above, deploy. No other configuration is required — tables are
created automatically on first request in `DATABASE_URL` mode.

## Structure

- `src/app` — landing, assessment, analysing, report, contact, privacy, terms,
  404, sitemap/robots, API routes
- `src/lib/questions.ts` — the 55-indicator question bank (11 chapters)
- `src/lib/storage.ts` — zero-config data layer (Postgres / Supabase REST)
- `src/lib/ai.ts` — OpenAI report generation + streaming coach
- `src/lib/report-engine.ts` — deterministic fallback report generator
- `src/lib/pdf.ts` — branded multi-page PDF builder
- `src/components` — UI primitives (shadcn-style), landing, assessment, report
