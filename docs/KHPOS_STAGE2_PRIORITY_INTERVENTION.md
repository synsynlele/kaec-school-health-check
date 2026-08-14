# KHP-OS Stage 2 — Priority & Intervention Intelligence

Stage 2 converts the completed KSHC baseline from a diagnostic report into a governed transformation agenda.

## Product rule

A school may carry **at most three active priorities per KSHC baseline**.

This is deliberate. KHP-OS is not a recommendation warehouse or generic task manager. It exists to help leadership focus on the few institutional changes most likely to improve the school, execute them, collect evidence and review results.

## Deterministic priority engine

Candidate priorities are derived from recorded KSHC evidence:

1. take the latest recorded response for each of the 55 stable indicator IDs;
2. keep only material gaps scoring 1–3;
3. map the indicator to its canonical KHP institutional system and intervention family;
4. calculate a priority score from:
   - maturity severity;
   - weakness of the surrounding KSHC assessment area;
   - additional risk weighting for critical safety/governance and leadership/teaching gaps;
5. present a balanced shortlist with no more than two suggestions from one KSHC chapter.

No AI is required to decide which recorded indicators are weak. AI may enrich interpretation later, but it must not invent evidence or approve a priority.

## Human authority

Only organisation members with role `executive` or `transformation_lead` may approve or archive priorities.

Approval is atomic and creates:

- the approved institutional priority;
- the mapped Intervention Library v1.0 selection;
- an assigned owner;
- a start date and target review date;
- an immutable audit event.

Archiving changes the active agenda without deleting history. The linked institution intervention becomes `abandoned` unless it was already completed.

## Intervention Library v1.0

Stage 2 establishes the database-backed form of the existing 55-indicator KHP-OS Intervention Library:

- `khpos_interventions`
- `khpos_intervention_versions`
- `khpos_indicator_intervention_map`

There are 55 active interventions, 55 version `1.0` playbooks and 55 primary indicator mappings. The many-to-many mapping table allows later library versions to attach additional interventions to one diagnostic signal without changing historical selections.

## Institution transformation records

- `khpos_priorities`
- `khpos_organisation_interventions`

These records are institution-specific. The reusable intervention catalogue remains KAEC-NG methodology/IP; the school-specific priority, owner, dates and implementation history belong to the institution's transformation record.

## Security model

All Stage 2 tables live in the exposed `public` schema but:

- RLS is enabled;
- `anon` and `authenticated` have no direct table privileges;
- application reads are server-mediated after Supabase Auth verification and organisation-membership checks;
- mutation RPCs are `service_role` only;
- the RPCs independently re-check the actor's active organisation role and the recorded KSHC score before mutation.

The service-only functions are:

- `khpos_approve_priority_server`
- `khpos_archive_priority_server`

## Database verification

Migration: `20260814174453_stage2_priority_intervention_engine`

Verified after application:

- 55 interventions;
- 55 intervention versions;
- 55 indicator mappings;
- zero synthetic school priorities;
- zero synthetic organisation interventions;
- `anon` execute permission: false;
- `authenticated` execute permission: false;
- `service_role` execute permission: true.

A rollback-only integration test successfully exercised:

KSHC evidence → priority approval → mapped organisation intervention → audit event → priority archive

and rolled the temporary records back completely.

## User experience

Command Centre → **Build transformation agenda** → evidence-ranked shortlist → leadership approval → active priority + mapped intervention.

The Stage 2 workspace visibly distinguishes:

- diagnostic evidence;
- suggested priority;
- authorised commitment;
- selected intervention;
- planned review horizon.

## Boundary

Stage 2 does **not** yet build generic tasks, kanban boards, evidence uploads or review forms.

The next operating layer is Stage 3 / Implementation: actions, milestones, evidence requirements and execution state attached specifically to approved organisation interventions.
