create index if not exists idx_o15_assurance_events_actor
  on public.khpos_ops_academic_assurance_events(actor_user_id);
create index if not exists idx_o15_assurance_events_closeout
  on public.khpos_ops_academic_assurance_events(closeout_id);
create index if not exists idx_o15_assurance_events_correction
  on public.khpos_ops_academic_assurance_events(correction_id);
create index if not exists idx_o15_assurance_events_org
  on public.khpos_ops_academic_assurance_events(organisation_id);
create index if not exists idx_o15_assurance_events_package
  on public.khpos_ops_academic_assurance_events(package_id);
create index if not exists idx_o15_assurance_events_readiness
  on public.khpos_ops_academic_assurance_events(readiness_item_id);

create index if not exists idx_o15_closeouts_approved_by
  on public.khpos_ops_academic_closeouts(approved_by);
create index if not exists idx_o15_closeouts_closed_by
  on public.khpos_ops_academic_closeouts(closed_by);
create index if not exists idx_o15_closeouts_prepared_by
  on public.khpos_ops_academic_closeouts(prepared_by);

create index if not exists idx_o15_integrity_representation_by
  on public.khpos_ops_academic_integrity_cases(representation_recorded_by);
create index if not exists idx_o15_integrity_closed_by
  on public.khpos_ops_academic_integrity_cases(closed_by);
create index if not exists idx_o15_integrity_decided_by
  on public.khpos_ops_academic_integrity_cases(decided_by);
create index if not exists idx_o15_integrity_reported_by
  on public.khpos_ops_academic_integrity_cases(reported_by);
create index if not exists idx_o15_integrity_stream
  on public.khpos_ops_academic_integrity_cases(stream_id);

create index if not exists idx_o15_integrity_evidence_added_by
  on public.khpos_ops_academic_integrity_evidence(added_by);
create index if not exists idx_o15_integrity_evidence_org
  on public.khpos_ops_academic_integrity_evidence(organisation_id);

create index if not exists idx_o15_cycles_approved_by
  on public.khpos_ops_assessment_cycles(approved_by);
create index if not exists idx_o15_cycles_closed_by
  on public.khpos_ops_assessment_cycles(closed_by);
create index if not exists idx_o15_cycles_created_by
  on public.khpos_ops_assessment_cycles(created_by);
create index if not exists idx_o15_cycles_started_by
  on public.khpos_ops_assessment_cycles(started_by);

create index if not exists idx_o15_packages_created_by
  on public.khpos_ops_assessment_packages(created_by);
create index if not exists idx_o15_packages_moderator
  on public.khpos_ops_assessment_packages(moderator_user_id);

create index if not exists idx_o15_readiness_created_by
  on public.khpos_ops_exam_readiness_items(created_by);
create index if not exists idx_o15_readiness_exception_by
  on public.khpos_ops_exam_readiness_items(exception_accepted_by);
create index if not exists idx_o15_readiness_org
  on public.khpos_ops_exam_readiness_items(organisation_id);
create index if not exists idx_o15_readiness_submitted_by
  on public.khpos_ops_exam_readiness_items(submitted_by);
create index if not exists idx_o15_readiness_verified_by
  on public.khpos_ops_exam_readiness_items(verified_by);

create index if not exists idx_o15_corrections_cancelled_by
  on public.khpos_ops_result_corrections(cancelled_by);
create index if not exists idx_o15_corrections_implemented_by
  on public.khpos_ops_result_corrections(implemented_by);
create index if not exists idx_o15_corrections_requested_by
  on public.khpos_ops_result_corrections(requested_by);
create index if not exists idx_o15_corrections_reviewed_by
  on public.khpos_ops_result_corrections(reviewed_by);
create index if not exists idx_o15_corrections_term
  on public.khpos_ops_result_corrections(term_id);
create index if not exists idx_o15_corrections_verified_by
  on public.khpos_ops_result_corrections(verified_by);
