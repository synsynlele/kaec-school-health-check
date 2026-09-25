-- O24 restricted safeguarding foundation. KHP-OS is a record and coordination
-- system; a form submission is not an emergency notification or investigation.
create table public.khpos_ops_safeguarding_designations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  lead_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
  deputy_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
  status text not null default 'active' check(status in ('active','superseded')),
  appointed_by uuid not null references auth.users(id),
  appointed_at timestamptz not null default now(),
  superseded_at timestamptz,
  check(lead_assignment_id<>deputy_assignment_id)
);
create unique index uq_khpos_ops_safeguarding_current on public.khpos_ops_safeguarding_designations(campus_id) where status='active';
create table public.khpos_ops_safeguarding_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  learner_id uuid references public.khpos_ops_learner_anchors(id),
  category text not null check(category in ('disclosure','suspected_harm','peer_harm','staff_allegation','injury','missing_learner','other')),
  urgency text not null check(urgency in ('urgent','standard')),
  reported_facts text not null,
  immediate_protection text not null,
  implicated_user_id uuid references auth.users(id),
  contacted_person text not null check(contacted_person in ('lead','deputy')),
  direct_contact_at timestamptz not null,
  status text not null default 'submitted' check(status in ('submitted','triaged','monitoring','closed')),
  reporter_id uuid not null references auth.users(id),
  reported_at timestamptz not null default now(),
  triage_protection text,
  referral_decision text,
  review_due_at timestamptz,
  triaged_by uuid references auth.users(id),
  triaged_at timestamptz,
  closure_note text,
  external_closure_review_reference text,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index idx_khpos_ops_safeguarding_campus_status on public.khpos_ops_safeguarding_cases(campus_id,status,review_due_at);
create table public.khpos_ops_safeguarding_steps (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_safeguarding_cases(id),
  step_type text not null check(step_type in ('protection','referral','family_contact','follow_up','support','other')),
  action_taken text not null,
  evidence_reference text,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);
create index idx_khpos_ops_safeguarding_steps_case on public.khpos_ops_safeguarding_steps(case_id,occurred_at);
create table public.khpos_ops_safeguarding_audit (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  case_id uuid references public.khpos_ops_safeguarding_cases(id),
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  occurred_at timestamptz not null default now()
);
create index idx_khpos_ops_safeguarding_audit_case on public.khpos_ops_safeguarding_audit(case_id,occurred_at desc);
do $$ declare t text; begin
  foreach t in array array['khpos_ops_safeguarding_designations','khpos_ops_safeguarding_cases','khpos_ops_safeguarding_steps','khpos_ops_safeguarding_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

create function khpos_private.ops_safeguarding_campus_role(p_actor uuid,p_org uuid,p_campus uuid,p_codes text[])
returns boolean language sql stable security definer set search_path=public,auth,khpos_private,pg_temp as $$
  select exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org and r.code=any(p_codes)
      and (a.campus_id=p_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN'));
$$;
create function khpos_private.ops_safeguarding_designated(p_actor uuid,p_org uuid,p_campus uuid)
returns boolean language sql stable security definer set search_path=public,auth,khpos_private,pg_temp as $$
  select exists(select 1 from public.khpos_ops_safeguarding_designations d
    join public.khpos_ops_role_assignments a on a.id in (d.lead_assignment_id,d.deputy_assignment_id)
    where d.organisation_id=p_org and d.campus_id=p_campus and d.status='active'
      and a.user_id=p_actor and a.status='active'
      and exists(select 1 from public.khpos_ops_staff s where s.user_id=p_actor and s.organisation_id=p_org and s.status in ('ready','active')));
$$;
create function khpos_private.ops_safeguarding_case_access(p_actor uuid,p_org uuid,p_case uuid)
returns boolean language sql stable security definer set search_path=public,auth,khpos_private,pg_temp as $$
  select exists(select 1 from public.khpos_ops_safeguarding_cases c
    where c.id=p_case and c.organisation_id=p_org and c.implicated_user_id is distinct from p_actor
      and khpos_private.ops_safeguarding_designated(p_actor,p_org,c.campus_id));
$$;

create function public.khpos_ops_get_safeguarding_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_result jsonb;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id)
    or not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[])
  then raise exception 'Active school role and KHP-OS membership required.'; end if;
  select jsonb_build_object(
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'canConfigure',khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN']::text[]),'isDesignated',khpos_private.ops_safeguarding_designated(p_actor_user_id,p_organisation_id,c.id),'configured',exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.campus_id=c.id and d.status='active' and lead.status='active' and deputy.status='active'))) from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and c.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[])),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_organisation_id and l.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,l.campus_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[])),'[]'::jsonb),
    'eligibleAssignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'role',r.title,'campusId',a.campus_id,'userId',a.user_id,'name',s.display_name)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id join public.khpos_ops_staff s on s.user_id=a.user_id and s.organisation_id=p_organisation_id and s.status in ('ready','active') where r.organisation_id=p_organisation_id and a.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER') and exists(select 1 from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and (c.id=a.campus_id or a.campus_id is null and r.code='SCHOOL_GUARDIAN') and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,c.id,array['SCHOOL_GUARDIAN']::text[]))),'[]'::jsonb),
    'contacts',coalesce((select jsonb_agg(jsonb_build_object('campusId',d.campus_id,'leadName',lead_staff.display_name,'leadEmail',lead_staff.account_email,'deputyName',deputy_staff.display_name,'deputyEmail',deputy_staff.account_email)) from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id and lead.status='active' join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id and deputy.status='active' join public.khpos_ops_staff lead_staff on lead_staff.user_id=lead.user_id and lead_staff.organisation_id=p_organisation_id and lead_staff.status in ('ready','active') join public.khpos_ops_staff deputy_staff on deputy_staff.user_id=deputy.user_id and deputy_staff.organisation_id=p_organisation_id and deputy_staff.status in ('ready','active') where d.organisation_id=p_organisation_id and d.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,d.campus_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[])),'[]'::jsonb),
    'designations',coalesce((select jsonb_agg(jsonb_build_object('campusId',d.campus_id,'leadAssignmentId',d.lead_assignment_id,'deputyAssignmentId',d.deputy_assignment_id)) from public.khpos_ops_safeguarding_designations d where d.organisation_id=p_organisation_id and d.status='active' and khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,d.campus_id,array['SCHOOL_GUARDIAN']::text[])),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'learnerId',c.learner_id,'category',c.category,'urgency',c.urgency,'reportedFacts',c.reported_facts,'immediateProtection',c.immediate_protection,'status',c.status,'reportedAt',c.reported_at,'triageProtection',c.triage_protection,'referralDecision',c.referral_decision,'reviewDueAt',c.review_due_at,'closureNote',c.closure_note,'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.step_type,'actionTaken',s.action_taken,'evidenceReference',s.evidence_reference,'occurredAt',s.occurred_at) order by s.occurred_at) from public.khpos_ops_safeguarding_steps s where s.case_id=c.id),'[]'::jsonb)) order by c.reported_at desc) from public.khpos_ops_safeguarding_cases c where c.organisation_id=p_organisation_id and khpos_private.ops_safeguarding_case_access(p_actor_user_id,p_organisation_id,c.id)),'[]'::jsonb)
  ) into v_result;
  insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,actor_id,event_type)
  select p_organisation_id,c.id,p_actor_user_id,'workspace_read' from public.khpos_ops_campuses c
  where c.organisation_id=p_organisation_id and khpos_private.ops_safeguarding_designated(p_actor_user_id,p_organisation_id,c.id);
  return v_result;
end $$;

create function public.khpos_ops_safeguarding_action_server(p_actor_user_id uuid,p_organisation_id uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_campus uuid; v_case public.khpos_ops_safeguarding_cases%rowtype; v_lead public.khpos_ops_role_assignments%rowtype; v_deputy public.khpos_ops_role_assignments%rowtype; v_id uuid; v_learner uuid; v_implicated uuid;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id) then raise exception 'Active KHP-OS membership required.'; end if;
  if p_mode='designate' then
    v_campus:=(p_input->>'campusId')::uuid;
    if not khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,v_campus,array['SCHOOL_GUARDIAN']::text[]) then raise exception 'School Guardian must appoint the safeguarding lead and deputy.'; end if;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_organisation_id and status='active') then raise exception 'Active campus required.'; end if;
    select a.* into v_lead from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=(p_input->>'leadAssignmentId')::uuid and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN');
    select a.* into v_deputy from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=(p_input->>'deputyAssignmentId')::uuid and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN');
    if v_lead.id is null or v_deputy.id is null or v_lead.user_id=v_deputy.user_id then raise exception 'Lead and deputy must be two different active people assigned to the campus.'; end if;
    if not exists(select 1 from public.khpos_ops_staff where user_id=v_lead.user_id and organisation_id=p_organisation_id and status in ('ready','active')) or not exists(select 1 from public.khpos_ops_staff where user_id=v_deputy.user_id and organisation_id=p_organisation_id and status in ('ready','active')) then raise exception 'Lead and deputy must have ready or active staff records.'; end if;
    update public.khpos_ops_safeguarding_designations set status='superseded',superseded_at=now() where campus_id=v_campus and status='active';
    insert into public.khpos_ops_safeguarding_designations(organisation_id,campus_id,lead_assignment_id,deputy_assignment_id,appointed_by) values(p_organisation_id,v_campus,v_lead.id,v_deputy.id,p_actor_user_id);
    insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,actor_id,event_type) values(p_organisation_id,v_campus,p_actor_user_id,'designation_changed');
    return jsonb_build_object('ok',true);
  elsif p_mode='report' then
    v_campus:=(p_input->>'campusId')::uuid; v_learner:=nullif(p_input->>'learnerId','')::uuid;
    if not khpos_private.ops_safeguarding_campus_role(p_actor_user_id,p_organisation_id,v_campus,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[]) then raise exception 'Only assigned school staff may report on this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.organisation_id=p_organisation_id and d.campus_id=v_campus and d.status='active' and lead.status='active' and deputy.status='active' and exists(select 1 from public.khpos_ops_staff where user_id=lead.user_id and organisation_id=p_organisation_id and status in ('ready','active')) and exists(select 1 from public.khpos_ops_staff where user_id=deputy.user_id and organisation_id=p_organisation_id and status in ('ready','active'))) then raise exception 'Safeguarding lead and deputy must be active before digital intake. Contact the School Guardian directly.'; end if;
    if v_learner is not null and not exists(select 1 from public.khpos_ops_learner_anchors where id=v_learner and organisation_id=p_organisation_id and campus_id=v_campus and status='active') then raise exception 'Learner does not belong to the campus.'; end if;
    if p_input->>'category' not in ('disclosure','suspected_harm','peer_harm','staff_allegation','injury','missing_learner','other') or p_input->>'urgency' not in ('urgent','standard') or nullif(btrim(p_input->>'reportedFacts'),'') is null or nullif(btrim(p_input->>'immediateProtection'),'') is null then raise exception 'Category, urgency, factual account and immediate protection are required.'; end if;
    if p_input->>'contactedPerson' not in ('lead','deputy') or p_input->>'directContactConfirmed'<>'true' then raise exception 'Direct contact with the designated lead or deputy must be confirmed before digital intake.'; end if;
    if p_input->>'implicatedRole' not in ('none','lead','deputy','other') then raise exception 'Select whether a designated person is implicated.'; end if;
    if p_input->>'implicatedRole'=p_input->>'contactedPerson' then raise exception 'Contact the other designated person when the first is implicated.'; end if;
    select case p_input->>'implicatedRole' when 'lead' then lead.user_id when 'deputy' then deputy.user_id else null end into v_implicated
      from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id
      where d.campus_id=v_campus and d.status='active';
    insert into public.khpos_ops_safeguarding_cases(organisation_id,campus_id,learner_id,category,urgency,reported_facts,immediate_protection,implicated_user_id,contacted_person,direct_contact_at,reporter_id)
      values(p_organisation_id,v_campus,v_learner,p_input->>'category',p_input->>'urgency',btrim(p_input->>'reportedFacts'),btrim(p_input->>'immediateProtection'),v_implicated,p_input->>'contactedPerson',now(),p_actor_user_id) returning id into v_id;
    insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,case_id,actor_id,event_type) values(p_organisation_id,v_campus,v_id,p_actor_user_id,'report_submitted');
    return jsonb_build_object('receiptId',v_id,'accepted',true);
  end if;
  select * into v_case from public.khpos_ops_safeguarding_cases where id=(p_input->>'caseId')::uuid and organisation_id=p_organisation_id for update;
  if v_case.id is null or not khpos_private.ops_safeguarding_case_access(p_actor_user_id,p_organisation_id,v_case.id) then raise exception 'Restricted safeguarding case unavailable.'; end if;
  v_campus:=v_case.campus_id;
  if p_mode='triage' then
    if v_case.status<>'submitted' or nullif(btrim(p_input->>'protection'),'') is null or nullif(btrim(p_input->>'referralDecision'),'') is null or (p_input->>'reviewDueAt')::timestamptz<=now() then raise exception 'Protection, referral decision and next review are required.'; end if;
    update public.khpos_ops_safeguarding_cases set status='triaged',triage_protection=btrim(p_input->>'protection'),referral_decision=btrim(p_input->>'referralDecision'),review_due_at=(p_input->>'reviewDueAt')::timestamptz,triaged_by=p_actor_user_id,triaged_at=now(),updated_at=now() where id=v_case.id;
  elsif p_mode='record_step' then
    if v_case.status not in ('triaged','monitoring') or p_input->>'stepType' not in ('protection','referral','family_contact','follow_up','support','other') or nullif(btrim(p_input->>'actionTaken'),'') is null then raise exception 'Triage first, then record a valid safeguarding step.'; end if;
    insert into public.khpos_ops_safeguarding_steps(organisation_id,case_id,step_type,action_taken,evidence_reference,actor_id) values(p_organisation_id,v_case.id,p_input->>'stepType',btrim(p_input->>'actionTaken'),nullif(btrim(p_input->>'evidenceReference'),''),p_actor_user_id);
    update public.khpos_ops_safeguarding_cases set status='monitoring',updated_at=now() where id=v_case.id;
  elsif p_mode='close' then
    if v_case.status<>'monitoring' or nullif(btrim(p_input->>'note'),'') is null or not exists(select 1 from public.khpos_ops_safeguarding_steps where case_id=v_case.id and step_type='follow_up') then raise exception 'Follow-up and a documented closure review are required.'; end if;
    if p_actor_user_id=v_case.triaged_by and (
      v_case.implicated_user_id is null
      or not exists(select 1 from public.khpos_ops_safeguarding_designations d join public.khpos_ops_role_assignments lead on lead.id=d.lead_assignment_id join public.khpos_ops_role_assignments deputy on deputy.id=d.deputy_assignment_id where d.campus_id=v_case.campus_id and d.status='active' and ((lead.user_id=p_actor_user_id and deputy.user_id=v_case.implicated_user_id) or (deputy.user_id=p_actor_user_id and lead.user_id=v_case.implicated_user_id)))
      or nullif(btrim(p_input->>'externalReviewReference'),'') is null
      or not exists(select 1 from public.khpos_ops_safeguarding_steps where case_id=v_case.id and step_type='referral')
    ) then raise exception 'Independent designated closure is required; when the other designated person is implicated, record external referral and review evidence.'; end if;
    update public.khpos_ops_safeguarding_cases set status='closed',closure_note=btrim(p_input->>'note'),external_closure_review_reference=nullif(btrim(p_input->>'externalReviewReference'),''),closed_by=p_actor_user_id,closed_at=now(),updated_at=now() where id=v_case.id;
  else raise exception 'Unsupported safeguarding action.';
  end if;
  insert into public.khpos_ops_safeguarding_audit(organisation_id,campus_id,case_id,actor_id,event_type) values(p_organisation_id,v_campus,v_case.id,p_actor_user_id,p_mode);
  return jsonb_build_object('ok',true);
end $$;

revoke all on function khpos_private.ops_safeguarding_campus_role(uuid,uuid,uuid,text[]) from public,anon,authenticated;
revoke all on function khpos_private.ops_safeguarding_designated(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function khpos_private.ops_safeguarding_case_access(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_get_safeguarding_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_safeguarding_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function khpos_private.ops_safeguarding_campus_role(uuid,uuid,uuid,text[]) to service_role;
grant execute on function khpos_private.ops_safeguarding_designated(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_safeguarding_case_access(uuid,uuid,uuid) to service_role;
grant execute on function public.khpos_ops_get_safeguarding_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_safeguarding_action_server(uuid,uuid,text,jsonb) to service_role;
