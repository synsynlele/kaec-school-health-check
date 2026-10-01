-- Distinguish deterministic KAEC baseline drafts from human-only and optional AI-assisted drafts.
alter table public.khpos_ops_policy_versions
  drop constraint if exists khpos_ops_policy_versions_draft_source_check;
alter table public.khpos_ops_policy_versions
  add constraint khpos_ops_policy_versions_draft_source_check
  check (draft_source in ('human','ai_starter','kaec_baseline'));

alter table public.khpos_ops_process_versions
  drop constraint if exists khpos_ops_process_versions_draft_source_check;
alter table public.khpos_ops_process_versions
  add constraint khpos_ops_process_versions_draft_source_check
  check (draft_source in ('human','ai_starter','kaec_baseline'));
