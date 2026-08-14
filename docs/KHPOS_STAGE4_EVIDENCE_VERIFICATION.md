# KHP-OS Stage 4 — Evidence & Verification Automation

Stage 4 converts institutional evidence from a manual filing exercise into an automated transformation-intelligence workflow.

## Product rule

Humans execute the real-world intervention and provide reality. They do not manually classify evidence, update progress percentages or prepare review summaries.

KHP-OS automatically:

1. receives a private evidence file;
2. identifies which generated evidence requirement(s) it apparently supports;
3. scores match confidence and sufficiency;
4. flags ambiguity and missing proof;
5. updates evidence requirement state;
6. advances linked actions and milestones when evidence thresholds are met;
7. recalculates coverage;
8. prepares midpoint and outcome reviews.

## Evidence is not authentication

An `accepted` evidence state means the submission is sufficiently relevant and complete for transformation-progress purposes under the current KHP-OS rules. It does **not** mean KHP-OS has proven that a document, photograph or record is unquestionably authentic.

Ambiguous evidence is marked `needs_clarification`. Irrelevant evidence is rejected. Activity alone is not treated as effectiveness.

## Storage architecture

- Bucket: `khpos-evidence`
- Private bucket
- 8 MB maximum file size
- PDF, JPG, PNG, WebP and plain text
- Upload files directly from the authenticated browser to Supabase with a short-lived signed upload token
- File bytes do not pass through the KHP-OS Vercel request body
- Temporary signed viewing URLs are generated server-side

## Assessment architecture

When OpenAI evidence analysis is configured, KHP-OS sends the private evidence file with the exact intervention context, linked KSHC indicator, generated actions, milestones and evidence-requirement IDs. The model returns a validated structured contract.

Database acceptance remains deterministic:

- match confidence >= 70
- sufficiency >= 80

If the evidence-analysis model is unavailable or fails, the conservative fallback may suggest a possible match from the filename/note, but it is deliberately capped below acceptance thresholds. It therefore cannot fabricate progress.

## Human interaction

The Stage 4 user experience asks for only:

- the evidence file;
- optional short context.

There is no requirement/category selector. KHP-OS performs the classification.

## Boundary

Stage 4 prepares reviews but does not make the final institutional review decision. Continue / Adjust / Escalate / Complete / Pause / Stop remains the next operating layer and preserves human authority over material decisions.
