-- Preserve durable provenance for human-authored and AI-assisted governance drafts.
alter table public.khpos_ops_policy_versions
  add column if not exists draft_source text not null default 'human',
  add column if not exists draft_model text;

alter table public.khpos_ops_policy_versions
  drop constraint if exists khpos_ops_policy_versions_draft_source_check;
alter table public.khpos_ops_policy_versions
  add constraint khpos_ops_policy_versions_draft_source_check
  check (draft_source in ('human','ai_starter'));

alter table public.khpos_ops_process_versions
  add column if not exists draft_source text not null default 'human',
  add column if not exists draft_model text;

alter table public.khpos_ops_process_versions
  drop constraint if exists khpos_ops_process_versions_draft_source_check;
alter table public.khpos_ops_process_versions
  add constraint khpos_ops_process_versions_draft_source_check
  check (draft_source in ('human','ai_starter'));

comment on column public.khpos_ops_policy_versions.draft_source is
  'Origin of the editable draft. AI starter drafts still require normal author review, submission and independent approval.';

comment on column public.khpos_ops_process_versions.draft_source is
  'Origin of the editable draft. AI starter drafts still require normal author review, submission and independent approval.';
