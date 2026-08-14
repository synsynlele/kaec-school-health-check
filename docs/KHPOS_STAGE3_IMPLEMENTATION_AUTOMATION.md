# KHP-OS Stage 3 — Implementation Automation

Stage 3 converts every human-approved transformation priority into a system-generated execution plan. It deliberately removes manual planning work from the digital workflow.

## Product rule

Humans approve institutional commitments and execute the real-world change. KHP-OS generates and coordinates the digital operating layer.

After an approved priority is mapped to its intervention, KHP-OS automatically creates:

- one versioned implementation plan;
- six sequenced implementation actions;
- four milestones;
- evidence requirements derived from intervention review criteria;
- a midpoint review;
- an outcome review;
- an immutable audit event recording plan generation.

No school user creates a task list, milestone schedule or review calendar manually in Stage 3.

## Lifecycle behaviour

`Priority approved` → `Intervention selected` → `Implementation plan generated automatically`.

If an intervention is abandoned because leadership archives a priority, the active implementation plan is marked `superseded`; unfinished actions and reviews are cancelled and unmet evidence requirements are superseded. Historical records remain intact.

If that intervention is later approved again, KHP-OS can generate the next plan version rather than overwriting history.

## Security

All Stage 3 tables are server-mediated:

- RLS is enabled;
- `anon` and `authenticated` table privileges are revoked;
- the browser receives implementation data only through the authenticated KHP-OS server API;
- there is no Stage 3 POST endpoint for manual plan creation or editing.

The database generator is held in the non-exposed `khpos_private` schema.

## Human / system boundary

### KHP-OS automatically

- creates the execution sequence;
- assigns inherited ownership from the approved intervention;
- calculates due dates from the approved duration;
- defines milestones;
- defines evidence requirements;
- schedules reviews;
- preserves version/history;
- records the generation event.

### Humans

- approve the transformation priority;
- execute the real-world actions;
- provide evidence when requested;
- exercise judgement at review/approval points.

Evidence submission, automated evidence-state progression and structured review decisions are the next operating layer.
