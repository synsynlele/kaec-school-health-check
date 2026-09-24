create index if not exists idx_o16_discovery_term
  on public.khpos_ops_potential_discovery_records(term_id);

create index if not exists idx_o16_events_actor
  on public.khpos_ops_potential_events(actor_user_id);
create index if not exists idx_o16_events_discovery
  on public.khpos_ops_potential_events(discovery_id)
  where discovery_id is not null;
create index if not exists idx_o16_events_evidence
  on public.khpos_ops_potential_events(evidence_id)
  where evidence_id is not null;
create index if not exists idx_o16_events_exploration
  on public.khpos_ops_potential_events(exploration_id)
  where exploration_id is not null;
create index if not exists idx_o16_events_hypothesis
  on public.khpos_ops_potential_events(hypothesis_id)
  where hypothesis_id is not null;
create index if not exists idx_o16_events_org
  on public.khpos_ops_potential_events(organisation_id);
create index if not exists idx_o16_events_reflection
  on public.khpos_ops_potential_events(reflection_id)
  where reflection_id is not null;

create index if not exists idx_o16_evidence_term
  on public.khpos_ops_potential_evidence(term_id);
create index if not exists idx_o16_evidence_withdrawn_by
  on public.khpos_ops_potential_evidence(withdrawn_by)
  where withdrawn_by is not null;

create index if not exists idx_o16_exploration_cancelled_by
  on public.khpos_ops_potential_explorations(cancelled_by)
  where cancelled_by is not null;
create index if not exists idx_o16_exploration_completed_by
  on public.khpos_ops_potential_explorations(completed_by)
  where completed_by is not null;
create index if not exists idx_o16_exploration_term
  on public.khpos_ops_potential_explorations(term_id);

create index if not exists idx_o16_hypothesis_origin_term
  on public.khpos_ops_potential_hypotheses(origin_term_id)
  where origin_term_id is not null;
create index if not exists idx_o16_hypothesis_retired_by
  on public.khpos_ops_potential_hypotheses(retired_by)
  where retired_by is not null;

create index if not exists idx_o16_reflection_term
  on public.khpos_ops_potential_reflections(term_id);

create index if not exists idx_o16_review_cancelled_by
  on public.khpos_ops_potential_reviews(cancelled_by)
  where cancelled_by is not null;
create index if not exists idx_o16_review_returned_by
  on public.khpos_ops_potential_reviews(returned_by)
  where returned_by is not null;
create index if not exists idx_o16_review_term
  on public.khpos_ops_potential_reviews(term_id);
