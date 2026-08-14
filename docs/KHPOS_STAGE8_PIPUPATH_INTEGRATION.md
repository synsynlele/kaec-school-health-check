# KHP-OS Stage 8 — PipuPath Human Potential Intelligence

Stage 8 integrates PipuPath into KHP-OS without turning KHP-OS into a learner management system.

## Boundary

PipuPath remains the learner-facing Human Potential Development product. KHP-OS receives only governed school-cohort aggregates. It never receives learner identities, Human Potential Profile content, missions, reflections, contact details, network data, assessment responses or project content.

## Institutional attribution

PipuPath currently has no implicit school ownership model, so Stage 8 does not infer school membership from email domain, location or profile data. KHP-OS creates an explicit institutional cohort connection and PipuPath learners voluntarily join that cohort.

## Privacy threshold

The reporting minimum is five active consenting cohort members. Below five, PipuPath sends `reportingEligible=false` and every detailed count is zero. KHP-OS therefore cannot infer an exact small cohort size.

## Signals

KHP-OS presents four independent institutional signals rather than a composite score:

1. Potential discovery & direction
2. Capability practice
3. Value creation
4. Development continuity

The source metrics are distinct learner-participation counts, not raw activity volume, so a prolific individual cannot dominate the institutional pattern.

## Trust model

- Initial connection uses a random 15-minute pairing token stored only as a SHA-256 hash in KHP-OS.
- PipuPath binds one exact high-entropy cohort identifier to one KHP-OS organisation.
- Later refreshes use a new 15-minute one-time sync token; the token is cleared after successful ingestion.
- PipuPath does not receive KHP database credentials.
- KHP-OS does not receive PipuPath database credentials.
- No long-lived cross-service PipuPath connector secret is established.

## Human authority

PipuPath signals are contextual institutional intelligence only. They may strengthen interpretation and review, but they cannot close a KSHC priority, change a reassessment result or declare Verified Institutional Improvement. Fresh KSHC reassessment remains authoritative.

## Live database verification

The Stage 8 KHP migration was applied to the connected KHP Supabase project. A transaction-scoped lifecycle test proved:

- pending pairing and atomic activation;
- privacy-suppressed initial signal;
- wrong-cohort rejection;
- valid five-member aggregate ingestion;
- one-time sync-token consumption; and
- zero mutation of priority, reassessment or reassessment-outcome state.

The test transaction was rolled back completely.

## Companion PipuPath work

The learner-side implementation is PipuPath **Stage 13 — Institutional Cohort Bridge**. Its migration and application contract live in the separate `synsynlele/pipu-path` repository and must be validated against PipuPath's own Supabase project before production activation.
