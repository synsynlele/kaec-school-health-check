# KHP-OS Stage 7 — KSI Integration

Stage 7 connects KHP-OS to KAEC School Intelligence without rebuilding or merging the KSI product.

## Operating contract

`KSI learning loop → governed school-level aggregate → KHP-OS learning context → institutional interpretation/review`

KSI remains responsible for HQLS lessons, fidelity validation, assessment alignment, diagnosis and intervention continuity. KHP-OS receives only bounded aggregate signals.

## One-time human approval

1. An Executive or Transformation Lead starts KSI pairing in KHP-OS.
2. KHP-OS issues a 15-minute random pairing token and stores only its SHA-256 hash.
3. The token is placed in the URL fragment so it is not sent in the initial KSI HTTP request.
4. A signed-in KSI Owner/Admin chooses the exact school workspace and approves once.
5. KSI calculates a 90-day aggregate using that user's existing RLS permissions.
6. KHP-OS atomically binds the exact KSI workspace and stores the first signal snapshot.
7. KSI retains the returned connector token in a Secure/HttpOnly cookie and may refresh later.

## Signal domains

KHP-OS interprets four signal domains independently—there is deliberately no composite vanity score:

- HQLS fidelity;
- assessment alignment;
- diagnosis governance;
- intervention continuity.

Each domain is `insufficient`, `attention`, `developing` or `strong`. Minimum sample rules stop a tiny amount of activity from being presented as reliable institutional intelligence.

## Privacy boundary

The Stage 7 contract does not accept learner names, learner records, teacher rankings, raw lessons, assessment content, diagnosis prose, intervention notes or parent data. The receiver accepts only small validated JSON counters/rates and timestamps.

## Authority boundary

KSI context can inform interpretation and review. It cannot:

- approve or resolve a KHP-OS priority;
- write to reassessment state;
- set `verified_improvement`;
- replace a KSHC reassessment.

Fresh KSHC reassessment remains the only priority-resolution and verified-improvement authority.

## Database security

Stage 7 tables use RLS with no browser policies and revoke direct `anon`/`authenticated` privileges. Pairing, atomic first ingestion and later ingestion RPCs are executable only by `service_role`. Pairing and connector tokens are stored only as SHA-256 hashes.

Production migrations:

- `20260814194219_stage7_ksi_integration`
- `20260814194338_stage7_ksi_integration_crypto_fix`
- `20260814194428_stage7_ksi_atomic_pairing`

The rollback tests proved successful pairing/ingestion, mismatched-workspace rejection, malformed-first-signal atomic rollback, and zero mutation of priorities/reassessments.
