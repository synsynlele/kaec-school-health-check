-- O25 Parent partnership: receipt, ownership, communication, escalation and
-- independent closure. Safeguarding details stay in the restricted O24 pathway.
create table public.khpos_ops_parent_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  learner_id uuid references public.khpos_ops_learner_anchors(id),
  parent_reference text not null,
  category text not null check(category in ('academic','culture','fees','admission','general')),
  channel text not null check(channel in ('in_person','phone','whatsapp','email','other')),
  summary text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
  due_date date not null,
  status text not null default 'new' check(status in ('new','acknowledged','in_action','escalated','responded','closed')),
  response_summary text,
  response_evidence text,
  response_by uuid references auth.users(id),
  response_at timestamptz,
  escalation_reason text,
  escalated_at timestamptz,
  closure_note text,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_khpos_ops_parent_cases_scope on public.khpos_ops_parent_cases(organisation_id,campus_id,status,due_date);
create table public.khpos_ops_parent_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_parent_cases(id),
  event_type text not null check(event_type in ('recorded','acknowledged','action','communication','escalated','responded','returned','closed')),
  channel text check(channel is null or channel in ('in_person','phone','whatsapp','email','other')),
  note text not null,
  evidence_reference text,
  actor_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_parent_events_case on public.khpos_ops_parent_events(case_id,created_at);
alter table public.khpos_ops_parent_cases enable row level security;
alter table public.khpos_ops_parent_events enable row level security;
revoke all on public.khpos_ops_parent_cases from public,anon,authenticated;
revoke all on public.khpos_ops_parent_events from public,anon,authenticated;

create function public.khpos_ops_get_parent_cases_server(p_actor uuid,p_org uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org)
    or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER']::text[])
  then raise exception 'Active school role and KHP-OS membership required.'; end if;
  return jsonb_build_object(
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.khpos_ops_campuses c where c.organisation_id=p_org and c.status='active' and khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false)),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'classLabel',l.class_label,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_org and l.status='active' and khpos_private.ops_culture_campus_access(p_actor,p_org,l.campus_id,false)),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title,'campusId',a.campus_id,'isMine',a.user_id=p_actor)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_org and a.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER') and (a.campus_id is null and r.code='SCHOOL_GUARDIAN' or exists(select 1 from public.khpos_ops_campuses c where c.id=a.campus_id and khpos_private.ops_culture_campus_access(p_actor,p_org,c.id,false)))),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'learnerId',c.learner_id,'parentReference',c.parent_reference,'category',c.category,'channel',c.channel,'summary',c.summary,'ownerAssignmentId',c.owner_assignment_id,'dueDate',c.due_date,'status',c.status,'responseSummary',c.response_summary,'responseEvidence',c.response_evidence,'responseBy',c.response_by,'escalationReason',c.escalation_reason,'closureNote',c.closure_note,'isOwner',exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor and a.status='active'),'canManage',khpos_private.ops_culture_campus_access(p_actor,p_org,c.campus_id,true),'isGuardian',khpos_private.ops_safeguarding_campus_role(p_actor,p_org,c.campus_id,array['SCHOOL_GUARDIAN']::text[]),'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'type',e.event_type,'channel',e.channel,'note',e.note,'evidenceReference',e.evidence_reference,'createdAt',e.created_at) order by e.created_at) from public.khpos_ops_parent_events e where e.case_id=c.id),'[]'::jsonb)) order by c.created_at desc) from public.khpos_ops_parent_cases c where c.organisation_id=p_org and (khpos_private.ops_culture_campus_access(p_actor,p_org,c.campus_id,true) or c.recorded_by=p_actor or exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor and a.status='active'))),'[]'::jsonb)
  );
end $$;

create function public.khpos_ops_parent_case_action_server(p_actor uuid,p_org uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_case public.khpos_ops_parent_cases%rowtype; v_campus uuid; v_learner uuid; v_owner uuid; v_note text; v_event text; v_channel text; v_evidence text;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor,p_org) or not khpos_private.ops_hpd_actor_has_role(p_actor,p_org,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER']::text[]) then raise exception 'Active school role and KHP-OS membership required.'; end if;
  if p_mode='record' then
    v_campus:=(p_input->>'campusId')::uuid; v_learner:=nullif(p_input->>'learnerId','')::uuid; v_owner:=(p_input->>'ownerAssignmentId')::uuid;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_org and status='active') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,false) then raise exception 'Reporter must serve this active campus.'; end if;
    if v_learner is not null and not exists(select 1 from public.khpos_ops_learner_anchors where id=v_learner and organisation_id=p_org and campus_id=v_campus and status='active') then raise exception 'Learner does not belong to this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=v_owner and a.status='active' and r.organisation_id=p_org and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN')) then raise exception 'A campus leader must own the case.'; end if;
    if p_input->>'category' not in ('academic','culture','fees','admission','general') or p_input->>'channel' not in ('in_person','phone','whatsapp','email','other') or nullif(btrim(p_input->>'parentReference'),'') is null or nullif(btrim(p_input->>'summary'),'') is null or (p_input->>'dueDate')::date<current_date then raise exception 'Parent reference, category, channel, summary and due date are required.'; end if;
    insert into public.khpos_ops_parent_cases(organisation_id,campus_id,learner_id,parent_reference,category,channel,summary,owner_assignment_id,due_date,recorded_by) values(p_org,v_campus,v_learner,btrim(p_input->>'parentReference'),p_input->>'category',p_input->>'channel',btrim(p_input->>'summary'),v_owner,(p_input->>'dueDate')::date,p_actor) returning * into v_case;
    v_event:='recorded'; v_note:=v_case.summary; v_channel:=v_case.channel;
  else
    select * into v_case from public.khpos_ops_parent_cases where id=(p_input->>'caseId')::uuid and organisation_id=p_org for update;
    if v_case.id is null or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_case.campus_id,false) then raise exception 'Parent case unavailable.'; end if;
    v_campus:=v_case.campus_id;
    v_note:=nullif(btrim(p_input->>'note'),''); v_channel:=nullif(p_input->>'channel',''); v_evidence:=nullif(btrim(p_input->>'evidenceReference'),'');
    if v_note is null then raise exception 'A meaningful note is required.'; end if;
    if p_mode='acknowledge' then
      if v_case.status<>'new' or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Campus leader must record how the parent received the acknowledgement.'; end if;
      update public.khpos_ops_parent_cases set status='acknowledged',updated_at=now() where id=v_case.id; v_event:='acknowledged';
    elsif p_mode='action' then
      if v_case.status not in ('acknowledged','in_action','escalated') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) then raise exception 'Campus leader must own the action.'; end if;
      update public.khpos_ops_parent_cases set status=case when status='escalated' then status else 'in_action' end,updated_at=now() where id=v_case.id; v_event:='action';
    elsif p_mode='communication' then
      if v_case.status in ('closed','new') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Campus leader must record communication channel and evidence.'; end if;
      v_event:='communication';
    elsif p_mode='escalate' then
      if v_case.status in ('closed','responded') or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) then raise exception 'Only open cases can be escalated by campus leadership.'; end if;
      if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.status='active' and r.organisation_id=p_org and r.code='SCHOOL_GUARDIAN' and (a.campus_id=v_campus or a.campus_id is null)) then raise exception 'An active School Guardian must be assigned before escalation.'; end if;
      update public.khpos_ops_parent_cases set status='escalated',escalation_reason=v_note,escalated_at=now(),updated_at=now() where id=v_case.id; v_event:='escalated';
    elsif p_mode='respond' then
      if v_case.status not in ('acknowledged','in_action','escalated') or not exists(select 1 from public.khpos_ops_role_assignments where id=v_case.owner_assignment_id and user_id=p_actor and status='active') or v_channel not in ('in_person','phone','whatsapp','email','other') or v_evidence is null then raise exception 'Case owner must document the response channel and delivery evidence.'; end if;
      update public.khpos_ops_parent_cases set status='responded',response_summary=v_note,response_evidence=v_evidence,response_by=p_actor,response_at=now(),updated_at=now() where id=v_case.id; v_event:='responded';
    elsif p_mode='return' then
      if v_case.status<>'responded' or p_actor=v_case.response_by or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) then raise exception 'An independent campus leader must review the response.'; end if;
      update public.khpos_ops_parent_cases set status='in_action',updated_at=now() where id=v_case.id; v_event:='returned';
    elsif p_mode='close' then
      if v_case.status<>'responded' or p_actor=v_case.response_by or not khpos_private.ops_culture_campus_access(p_actor,p_org,v_campus,true) or (v_case.escalated_at is not null and not khpos_private.ops_safeguarding_campus_role(p_actor,p_org,v_campus,array['SCHOOL_GUARDIAN']::text[])) then raise exception 'A different campus leader must verify closure; escalated cases require School Guardian review.'; end if;
      update public.khpos_ops_parent_cases set status='closed',closure_note=v_note,closed_by=p_actor,closed_at=now(),updated_at=now() where id=v_case.id; v_event:='closed';
    else raise exception 'Unsupported parent case action.';
    end if;
  end if;
  insert into public.khpos_ops_parent_events(organisation_id,case_id,event_type,channel,note,evidence_reference,actor_id) values(p_org,v_case.id,v_event,v_channel,v_note,v_evidence,p_actor);
  return public.khpos_ops_get_parent_cases_server(p_actor,p_org);
end $$;

revoke all on function public.khpos_ops_get_parent_cases_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_parent_case_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_get_parent_cases_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_parent_case_action_server(uuid,uuid,text,jsonb) to service_role;
