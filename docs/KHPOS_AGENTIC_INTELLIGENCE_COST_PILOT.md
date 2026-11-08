# KHP-OS Agentic Intelligence — controlled pilot

## Why this is an integration, not a separate app

KSHC and KHP-OS share this repository and database. KSHC is the authoritative school-health diagnostic; KHP-OS owns operational execution, attention queues, verification and human decisions. The current platform already has deterministic attention rules, governance, improvement contracts, meeting agendas and authorised portfolio intelligence. Reuse them instead of commissioning an AI model to rediscover the same facts.

**No AI process is allowed to approve, discipline, reassign, alter a policy, change tuition, expose another school's private records, or mark health improvements verified.** The existing controlled workflows enforce decision rights.

## Four phases and acceptance gates

| Phase | Existing foundation | Pilot addition | Acceptance criterion |
|---|---|---|---|
| 1 — Observe | Attendance/work attention, derived performance, leadership brief | Unified role-authorised insights; deterministic evidence first | Leaders see current verified exceptions without extra LLM calls |
| 2 — Coordinate | Decisions, approvals, meeting agendas, task/evidence workflows | Read-only suggested meeting follow-ups in Ask; future approval-gated tool actions | No writes before human approval; audit and retries are idempotent |
| 3 — Improve | KSHC baseline, interventions, evidence and reassessment | Ask reuses authorised KSHC baseline/progress; intervention and review AI enter the school budget | AI cannot change diagnostic scores or declare improvement without reassessment |
| 4 — Network | HQ portfolio, peer thresholds, network pulse | Future authorised portfolio synthesis and capacity planning, reusing existing aggregated measures | No cross-tenant learner narrative or unapproved raw records in AI prompts |

**This branch delivers a first controlled pilot increment, not full autonomous agents or completed rollout of all four phases.** In particular, automated meeting transcription, autonomous work execution, full HQ portfolio synthesis and KSI data-sharing remain future work subject to permissions and evaluations. Do not advertise those as live.

## School-level paid-AI cost governor

A SQL transaction reserves estimated paid-AI cost before a provider call. A second transaction settles against reported prompt/completion tokens; the school-month allowance is shared across Ask, intervention contextualisation and review narrative generation. The default monthly cap is **US$0.30 per organisation** and can be set via `KHPOS_AI_MONTHLY_USD_CAP`. This is an internal pilot assumption, **not a subscription entitlement** or promise to a school.

By default the system recognises the project's existing `gpt-4.1-mini-2025-04-14` model pricing at US$0.40 / 1M input and US$1.60 / 1M output tokens. If the model changes, set `KHPOS_AI_INPUT_USD_PER_1M` and `KHPOS_AI_OUTPUT_USD_PER_1M` together. Invalid or missing model price information blocks paid AI rather than producing unmetered requests. `KHPOS_AI_DISABLED=1` disables paid KHP-OS intelligence entirely.

The token estimate intentionally over-reserves. Hard cost ceilings are approximate to the extent the model's final billed usage can exceed its reservation, e.g. unexpected provider overhead. The actual usage ledger records the difference; final provider invoices remain authoritative.

### KSHC costs alongside KHP-OS

The same migration adds the restricted `kaec_ai_usage_events` table. KSHC's report generation and coach record measured input and output tokens in this table, without school names, report content or learner data. These are **cost observations**, not school subscription deductions. KSHC remains free and no new charge is introduced by the telemetry code.

Provider prices may change. Provider invoices govern costs; estimates may be null when a model's current price has not been confirmed.

### Safe deployment order

1. Run the migration `20261108100500_khpos_ai_budget_governance.sql` in the matching KSHC/KHP-OS Supabase project, inspect permissions and schema. Never enable an anonymous read policy.
2. Verify RPC `khpos_ai_budget_reserve` and `khpos_ai_budget_settle` from server-only credentials. Confirm an authenticated client cannot call them.
3. Configure the correct model/prices and `KHPOS_AI_MONTHLY_USD_CAP` in Vercel server-side environment variables. Never publish provider keys.
4. Deploy to a protected preview environment; run migration/data isolation tests and the full existing CI suite.
5. Pilot with KAEC Nigerian Schools and one partner. Track AI USD per school, provider input/output token counts, fallback frequency, false-positive alerts, time to action, staff feedback and school-owner willingness to pay.
6. Roll out gradually only after costs and data access pass. If RPC fails or quota is exhausted, KHP-OS uses its existing governed non-AI answer/plan. KSHC scoring remains authoritative.

## Boundaries and known next tasks

- This initial school budget does **not** include KSHC's free diagnostic report or its coach spending. **Token-usage telemetry has now been added** to both KSHC AI paths, subject to applying this migration. A complete combined P&L still requires a unified reporting interface, provider-invoice reconciliation, and a separate platform-wide cap.
- Failed provider responses without usage may still incur billable tokens; reconcile against provider spend. Long-lived reserved requests (if a worker crashes before settlement) temporarily reduce the allowance until an audited recovery procedure is introduced.
- AI summaries should be generated on demand or when a meaningful event occurs; ordinary database alerts and recurring routines must not call a model.
- Limit cross-school intelligence to established HQ/portfolio authorisation. KSI integration should transfer only specifically consented, minimum-necessary learner aggregates.
- Before pricing changes, compute cost of KHP-OS + attributable KSHC AI, hosting, database and communications per subscribing school.
