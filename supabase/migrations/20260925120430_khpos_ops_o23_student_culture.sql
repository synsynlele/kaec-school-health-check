-- O23: ordinary culture concerns and student voice. Safeguarding content belongs
-- to its restricted pathway. This register stores a referral reference only.
create table public.khpos_ops_culture_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  learner_id uuid references public.khpos_ops_learner_anchors(id),
  category text not null check(category in ('classroom_behaviour','attendance_concern','peer_conflict','student_voice','recognition')),
  summary text not null,
  evidence_reference text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
  due_date date not null,
  status text not null default 'open' check(status in ('open','in_action','awaiting_review','verified','referred_safeguarding')),
  response_summary text,
  verification_note text,
  referral_reference text,
  reported_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reported_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check(category not in ('classroom_behaviour','attendance_concern','peer_conflict') or learner_id is not null)
);
create table public.khpos_ops_culture_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_culture_cases(id),
  action text not null,
  expected_change text not null,
  owner_assignment_id uuid not null references public.khpos_ops_role_assignments(id),
  due_date date not null,
  status text not null default 'open' check(status in ('open','evidence_submitted','verified','returned')),
  completion_note text,
  completion_evidence text,
  submitted_by uuid references auth.users(id),
  verified_by uuid references auth.users(id),
  verification_note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.khpos_ops_culture_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_culture_cases(id),
  action_id uuid references public.khpos_ops_culture_actions(id),
  event_type text not null,
  actor_id uuid not null references auth.users(id),
  note text,
  occurred_at timestamptz not null default now()
);
create index idx_khpos_ops_culture_cases_scope on public.khpos_ops_culture_cases(organisation_id,campus_id,status,due_date);
create index idx_khpos_ops_culture_actions_case on public.khpos_ops_culture_actions(case_id,status,due_date);
create index idx_khpos_ops_culture_events_case on public.khpos_ops_culture_events(case_id,occurred_at desc);
do $$ declare t text; begin
  foreach t in array array['khpos_ops_culture_cases','khpos_ops_culture_actions','khpos_ops_culture_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

create function khpos_private.ops_culture_campus_access(p_actor uuid,p_org uuid,p_campus uuid,p_manage boolean)
returns boolean language sql stable security definer set search_path=public,auth,khpos_private,pg_temp as $$
  select exists(select 1 from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor and a.status='active' and r.organisation_id=p_org
      and (a.campus_id=p_campus or (a.campus_id is null and r.code='SCHOOL_GUARDIAN'))
      and r.code=any(case when p_manage then array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER']::text[]
                          else array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[] end));
$$;

create function public.khpos_ops_get_culture_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id) then
    raise exception 'Active KHP-OS organisation membership is required.';
  end if;
  if not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR']::text[]) then
    raise exception 'Culture workspace requires an active school role.';
  end if;
  return jsonb_build_object(
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and c.status='active' and khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,c.id,false)),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'classLabel',l.class_label,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_organisation_id and l.status='active' and khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,l.campus_id,false)),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title,'campusId',a.campus_id,'isMine',a.user_id=p_actor_user_id)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_organisation_id and a.status='active' and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR') and (a.campus_id is null and r.code='SCHOOL_GUARDIAN' or a.campus_id in (select c.id from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,c.id,false)))),'[]'::jsonb),
    'cases',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'learnerId',c.learner_id,'category',c.category,'summary',c.summary,'evidenceReference',c.evidence_reference,'ownerAssignmentId',c.owner_assignment_id,'dueDate',c.due_date,'status',c.status,'responseSummary',c.response_summary,'verificationNote',c.verification_note,'referralReference',c.referral_reference,'isOwner',exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active'),'canManage',khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,c.campus_id,true),'actions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'action',x.action,'expectedChange',x.expected_change,'ownerAssignmentId',x.owner_assignment_id,'dueDate',x.due_date,'status',x.status,'completionNote',x.completion_note,'completionEvidence',x.completion_evidence,'submittedBy',x.submitted_by,'isOwner',exists(select 1 from public.khpos_ops_role_assignments a where a.id=x.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active')) order by x.created_at) from public.khpos_ops_culture_actions x where x.case_id=c.id),'[]'::jsonb)) order by c.reported_at desc) from public.khpos_ops_culture_cases c where c.organisation_id=p_organisation_id and (khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,c.campus_id,true) or c.reported_by=p_actor_user_id or exists(select 1 from public.khpos_ops_role_assignments a where a.id=c.owner_assignment_id and a.user_id=p_actor_user_id and a.status='active') or exists(select 1 from public.khpos_ops_culture_actions x join public.khpos_ops_role_assignments a on a.id=x.owner_assignment_id where x.case_id=c.id and a.user_id=p_actor_user_id and a.status='active'))),'[]'::jsonb)
  );
end $$;

create function public.khpos_ops_culture_action_server(p_actor_user_id uuid,p_organisation_id uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_case public.khpos_ops_culture_cases%rowtype; v_action public.khpos_ops_culture_actions%rowtype; v_campus uuid; v_learner uuid; v_owner uuid; v_case_id uuid; v_action_id uuid; v_note text;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id) then raise exception 'Active KHP-OS organisation membership is required.'; end if;
  if p_mode='report' then
    v_campus:=(p_input->>'campusId')::uuid; v_learner:=nullif(p_input->>'learnerId','')::uuid; v_owner:=(p_input->>'ownerAssignmentId')::uuid;
    if not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_campus,false) then raise exception 'Reporter has no school role on this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_campuses where id=v_campus and organisation_id=p_organisation_id and status='active') then raise exception 'Active campus required.'; end if;
    if v_learner is not null and not exists(select 1 from public.khpos_ops_learner_anchors where id=v_learner and organisation_id=p_organisation_id and campus_id=v_campus and status='active') then raise exception 'Learner must belong to this campus.'; end if;
    if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=v_owner and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER') and (a.campus_id=v_campus or a.campus_id is null and r.code='SCHOOL_GUARDIAN')) then raise exception 'A campus leader must own the response.'; end if;
    if p_input->>'category' not in ('classroom_behaviour','attendance_concern','peer_conflict','student_voice','recognition') or nullif(btrim(p_input->>'summary'),'') is null or nullif(btrim(p_input->>'evidenceReference'),'') is null or (p_input->>'dueDate')::date<current_date then raise exception 'Category, summary, evidence and future due date are required.'; end if;
    insert into public.khpos_ops_culture_cases(organisation_id,campus_id,learner_id,category,summary,evidence_reference,owner_assignment_id,due_date,reported_by)
    values(p_organisation_id,v_campus,v_learner,p_input->>'category',btrim(p_input->>'summary'),btrim(p_input->>'evidenceReference'),v_owner,(p_input->>'dueDate')::date,p_actor_user_id) returning id into v_case_id;
  else
    if p_mode in ('triage','create_action','submit_case','verify_case','refer_safeguarding') then
      select * into v_case from public.khpos_ops_culture_cases where id=(p_input->>'caseId')::uuid and organisation_id=p_organisation_id for update;
    else
      select * into v_action from public.khpos_ops_culture_actions where id=(p_input->>'actionId')::uuid and organisation_id=p_organisation_id for update;
      if found then select * into v_case from public.khpos_ops_culture_cases where id=v_action.case_id and organisation_id=p_organisation_id for update; end if;
    end if;
    if v_case.id is null then raise exception 'Culture case not found.'; end if;
    v_case_id:=v_case.id;
    if not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,false) then raise exception 'No school role on this campus.'; end if;
    if p_mode='refer_safeguarding' then
      if v_case.status='referred_safeguarding' or nullif(btrim(p_input->>'referralReference'),'') is null then raise exception 'Provide the restricted safeguarding referral reference.'; end if;
      if not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,true) then raise exception 'Campus leader must record the referral.'; end if;
      update public.khpos_ops_culture_cases set status='referred_safeguarding',referral_reference=btrim(p_input->>'referralReference'),updated_at=now() where id=v_case.id;
    elsif p_mode='triage' then
      if v_case.status<>'open' or not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,true) then raise exception 'Campus leader must triage an open case.'; end if;
      update public.khpos_ops_culture_cases set status='in_action',updated_at=now() where id=v_case.id;
    elsif p_mode='create_action' then
      if v_case.status not in ('open','in_action') or not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,true) then raise exception 'Campus leader must plan action on an open case.'; end if;
      v_owner:=(p_input->>'ownerAssignmentId')::uuid;
      if not exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.id=v_owner and a.status='active' and r.organisation_id=p_organisation_id and r.code in ('SCHOOL_GUARDIAN','SECTIONAL_PROMOTER','TEACHER','SKILLS_FACILITATOR') and (a.campus_id=v_case.campus_id or a.campus_id is null and r.code='SCHOOL_GUARDIAN')) then raise exception 'Action owner must serve this campus.'; end if;
      if nullif(btrim(p_input->>'action'),'') is null or nullif(btrim(p_input->>'expectedChange'),'') is null or (p_input->>'dueDate')::date<current_date then raise exception 'Action, expected change and due date are required.'; end if;
      insert into public.khpos_ops_culture_actions(organisation_id,case_id,action,expected_change,owner_assignment_id,due_date,created_by) values(p_organisation_id,v_case.id,btrim(p_input->>'action'),btrim(p_input->>'expectedChange'),v_owner,(p_input->>'dueDate')::date,p_actor_user_id) returning id into v_action_id;
      update public.khpos_ops_culture_cases set status='in_action',updated_at=now() where id=v_case.id;
    elsif p_mode='submit_action' then
      if v_case.status<>'in_action' or v_action.status not in ('open','returned') or not exists(select 1 from public.khpos_ops_role_assignments where id=v_action.owner_assignment_id and user_id=p_actor_user_id and status='active') then raise exception 'Assigned owner must complete an open action.'; end if;
      if nullif(btrim(p_input->>'note'),'') is null or nullif(btrim(p_input->>'evidenceReference'),'') is null then raise exception 'Completion note and evidence are required.'; end if;
      update public.khpos_ops_culture_actions set status='evidence_submitted',completion_note=btrim(p_input->>'note'),completion_evidence=btrim(p_input->>'evidenceReference'),submitted_by=p_actor_user_id,updated_at=now() where id=v_action.id;
    elsif p_mode in ('verify_action','return_action') then
      if v_case.status<>'in_action' or v_action.status<>'evidence_submitted' or not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,true) or p_actor_user_id=v_action.submitted_by then raise exception 'Independent campus leader must review submitted evidence.'; end if;
      if nullif(btrim(p_input->>'note'),'') is null then raise exception 'Verification reason required.'; end if;
      update public.khpos_ops_culture_actions set status=case when p_mode='verify_action' then 'verified' else 'returned' end,verification_note=btrim(p_input->>'note'),verified_by=p_actor_user_id,updated_at=now() where id=v_action.id;
    elsif p_mode='submit_case' then
      if v_case.status not in ('open','in_action') or not exists(select 1 from public.khpos_ops_role_assignments where id=v_case.owner_assignment_id and user_id=p_actor_user_id and status='active') then raise exception 'Assigned case owner must submit the response.'; end if;
      if v_case.category in ('classroom_behaviour','attendance_concern','peer_conflict') and not exists(select 1 from public.khpos_ops_culture_actions where case_id=v_case.id) then raise exception 'Behaviour and attendance concerns require an owned response action.'; end if;
      if exists(select 1 from public.khpos_ops_culture_actions where case_id=v_case.id and status<>'verified') then raise exception 'Every action must be independently verified before closure review.'; end if;
      if nullif(btrim(p_input->>'note'),'') is null then raise exception 'Outcome summary required.'; end if;
      update public.khpos_ops_culture_cases set status='awaiting_review',response_summary=btrim(p_input->>'note'),updated_at=now() where id=v_case.id;
    elsif p_mode='verify_case' then
      if v_case.status<>'awaiting_review' or not khpos_private.ops_culture_campus_access(p_actor_user_id,p_organisation_id,v_case.campus_id,true) or p_actor_user_id=(select user_id from public.khpos_ops_role_assignments where id=v_case.owner_assignment_id) then raise exception 'A different campus leader must verify the outcome.'; end if;
      if nullif(btrim(p_input->>'note'),'') is null then raise exception 'Verification note required.'; end if;
      update public.khpos_ops_culture_cases set status='verified',verification_note=btrim(p_input->>'note'),reviewed_by=p_actor_user_id,reviewed_at=now(),updated_at=now() where id=v_case.id;
    else raise exception 'Unsupported culture action.';
    end if;
  end if;
  insert into public.khpos_ops_culture_events(organisation_id,case_id,action_id,event_type,actor_id,note)
  values(p_organisation_id,v_case_id,v_action_id,p_mode,p_actor_user_id,case when p_mode='refer_safeguarding' then 'Restricted referral recorded' else left(coalesce(p_input->>'note',p_input->>'summary',p_input->>'action',''),500) end);
  return public.khpos_ops_get_culture_server(p_actor_user_id,p_organisation_id);
end $$;

revoke all on function khpos_private.ops_culture_campus_access(uuid,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.khpos_ops_get_culture_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_culture_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function khpos_private.ops_culture_campus_access(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.khpos_ops_get_culture_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_culture_action_server(uuid,uuid,text,jsonb) to service_role;
