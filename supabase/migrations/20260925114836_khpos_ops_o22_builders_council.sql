-- O22: Builders Council governance. Student voice is recorded with an evidence
-- reference; this module does not claim to conduct authenticated ballots.
create table public.khpos_ops_council_cycles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  campus_id uuid not null references public.khpos_ops_campuses(id),
  session_label text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(campus_id,session_label)
);
create table public.khpos_ops_council_seats (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  cycle_id uuid not null references public.khpos_ops_council_cycles(id),
  title text not null,
  seat_type text not null check(seat_type in ('class_representative','senior_leadership')),
  class_label text,
  mission text not null,
  status text not null default 'open' check(status in ('open','filled','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((seat_type='class_representative' and nullif(btrim(class_label),'') is not null)
      or (seat_type='senior_leadership' and class_label is null)),
  unique(cycle_id,title)
);
create table public.khpos_ops_council_candidates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  seat_id uuid not null references public.khpos_ops_council_seats(id),
  learner_id uuid not null references public.khpos_ops_learner_anchors(id),
  nomination_statement text not null,
  nomination_evidence text not null,
  eligibility_note text,
  student_voice_summary text,
  student_voice_evidence text,
  status text not null default 'nominated' check(status in ('nominated','eligible','ineligible','appointed','withdrawn')),
  verified_by uuid references auth.users(id),
  appointed_by uuid references auth.users(id),
  appointed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(seat_id,learner_id)
);
create unique index uq_khpos_ops_council_appointed_seat
  on public.khpos_ops_council_candidates(seat_id) where status='appointed';
create table public.khpos_ops_council_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  candidate_id uuid not null references public.khpos_ops_council_candidates(id),
  review_type text not null check(review_type in ('routine','concern','recall')),
  finding text not null,
  evidence_reference text not null,
  student_response text,
  response_offered_at timestamptz,
  decision text not null check(decision in ('continue','support_plan','remove')),
  action_owner_id uuid references public.khpos_ops_role_assignments(id),
  action_due_date date,
  reviewed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check(decision<>'support_plan' or (action_owner_id is not null and action_due_date is not null)),
  check(decision<>'remove' or (review_type='recall' and response_offered_at is not null and student_response is not null))
);
create table public.khpos_ops_council_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid not null references auth.users(id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_khpos_ops_council_seats_cycle on public.khpos_ops_council_seats(cycle_id,status);
create index idx_khpos_ops_council_candidates_seat on public.khpos_ops_council_candidates(seat_id,status);
create index idx_khpos_ops_council_reviews_candidate on public.khpos_ops_council_reviews(candidate_id,created_at desc);
create index idx_khpos_ops_council_events_entity on public.khpos_ops_council_events(entity_type,entity_id,created_at desc);
do $$ declare t text; begin
  foreach t in array array['khpos_ops_council_cycles','khpos_ops_council_seats','khpos_ops_council_candidates','khpos_ops_council_reviews','khpos_ops_council_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

create function public.khpos_ops_get_council_server(p_actor_user_id uuid,p_organisation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_manage boolean; v_member boolean; v_guardian boolean;
begin
  v_member:=khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id);
  if not v_member then raise exception 'Active organisation membership and KHP-OS partnership are required.'; end if;
  v_manage:=khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER']::text[]);
  if not v_manage then raise exception 'Council workspace requires a School Guardian or Sectional Promoter assignment.'; end if;
  v_guardian:=khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']::text[]);
  return jsonb_build_object(
    'canManage',v_manage,
    'campuses',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.khpos_ops_campuses c where c.organisation_id=p_organisation_id and c.status='active' and (v_guardian or exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.campus_id=c.id and a.user_id=p_actor_user_id and a.status='active' and r.code='SECTIONAL_PROMOTER' and r.organisation_id=p_organisation_id))),'[]'::jsonb),
    'learners',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.display_name,'classLabel',l.class_label,'campusId',l.campus_id) order by l.display_name) from public.khpos_ops_learner_anchors l where l.organisation_id=p_organisation_id and l.status='active' and (v_guardian or exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where a.campus_id=l.campus_id and a.user_id=p_actor_user_id and a.status='active' and r.code='SECTIONAL_PROMOTER' and r.organisation_id=p_organisation_id))),'[]'::jsonb),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',r.title)) from public.khpos_ops_role_assignments a join public.khpos_ops_roles r on r.id=a.role_id where r.organisation_id=p_organisation_id and a.status='active' and (v_guardian or a.campus_id in (select campus_id from public.khpos_ops_role_assignments where user_id=p_actor_user_id and status='active'))),'[]'::jsonb),
    'cycles',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'campusId',c.campus_id,'sessionLabel',c.session_label,'status',c.status,'seats',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'seatType',s.seat_type,'classLabel',s.class_label,'mission',s.mission,'status',s.status,'candidates',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'learnerId',n.learner_id,'status',n.status,'nominationStatement',n.nomination_statement,'nominationEvidence',n.nomination_evidence,'eligibilityNote',n.eligibility_note,'studentVoiceSummary',n.student_voice_summary,'studentVoiceEvidence',n.student_voice_evidence,'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'type',r.review_type,'finding',r.finding,'decision',r.decision,'createdAt',r.created_at) order by r.created_at desc) from public.khpos_ops_council_reviews r where r.candidate_id=n.id),'[]'::jsonb)) order by n.created_at) from public.khpos_ops_council_candidates n where n.seat_id=s.id),'[]'::jsonb)) order by s.created_at) from public.khpos_ops_council_seats s where s.cycle_id=c.id),'[]'::jsonb)) order by c.created_at desc) from public.khpos_ops_council_cycles c where c.organisation_id=p_organisation_id and (v_guardian or exists(select 1 from public.khpos_ops_role_assignments a join public.khpos_ops_roles role on role.id=a.role_id where a.campus_id=c.campus_id and a.user_id=p_actor_user_id and a.status='active' and role.code='SECTIONAL_PROMOTER' and role.organisation_id=p_organisation_id))),'[]'::jsonb)
  );
end $$;

create function public.khpos_ops_council_action_server(p_actor_user_id uuid,p_organisation_id uuid,p_mode text,p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,khpos_private,pg_temp as $$
declare v_id uuid; v_seat public.khpos_ops_council_seats%rowtype; v_candidate public.khpos_ops_council_candidates%rowtype; v_cycle public.khpos_ops_council_cycles%rowtype; v_learner public.khpos_ops_learner_anchors%rowtype; v_decision text; v_note text;
begin
  if not khpos_private.ops_hpd_has_membership(p_actor_user_id,p_organisation_id)
    or not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN','SECTIONAL_PROMOTER']::text[])
  then raise exception 'Council management requires an active School Guardian or Sectional Promoter assignment.'; end if;
  if p_mode='create_cycle' then
    if nullif(btrim(p_input->>'sessionLabel'),'') is null then raise exception 'Session is required.'; end if;
    if not exists(select 1 from public.khpos_ops_campuses where id=(p_input->>'campusId')::uuid and organisation_id=p_organisation_id and status='active') then raise exception 'Campus is not active in this organisation.'; end if;
    insert into public.khpos_ops_council_cycles(organisation_id,campus_id,session_label,created_by) values(p_organisation_id,(p_input->>'campusId')::uuid,btrim(p_input->>'sessionLabel'),p_actor_user_id) returning id into v_id;
  elsif p_mode='create_seat' then
    select * into v_cycle from public.khpos_ops_council_cycles where id=(p_input->>'cycleId')::uuid and organisation_id=p_organisation_id and status='open' for update;
    if not found then raise exception 'Open council cycle not found.'; end if;
    if nullif(btrim(p_input->>'title'),'') is null or nullif(btrim(p_input->>'mission'),'') is null then raise exception 'Seat title and mission are required.'; end if;
    insert into public.khpos_ops_council_seats(organisation_id,cycle_id,title,seat_type,class_label,mission,created_by) values(p_organisation_id,v_cycle.id,btrim(p_input->>'title'),p_input->>'seatType',nullif(btrim(p_input->>'classLabel'),''),btrim(p_input->>'mission'),p_actor_user_id) returning id into v_id;
  elsif p_mode='nominate' then
    select * into v_seat from public.khpos_ops_council_seats where id=(p_input->>'seatId')::uuid and organisation_id=p_organisation_id and status='open' for update;
    if not found then raise exception 'Open seat not found.'; end if;
    select * into v_learner from public.khpos_ops_learner_anchors where id=(p_input->>'learnerId')::uuid and organisation_id=p_organisation_id and status='active';
    select * into v_cycle from public.khpos_ops_council_cycles where id=v_seat.cycle_id and status='open';
    if v_learner.id is null or v_learner.campus_id<>v_cycle.campus_id then raise exception 'Nominee must be an active learner on this campus.'; end if;
    if v_seat.seat_type='class_representative' and lower(v_learner.class_label)<>lower(v_seat.class_label) then raise exception 'Class representative must belong to that class.'; end if;
    if v_seat.seat_type='senior_leadership' and regexp_replace(upper(v_learner.class_label),'[^A-Z0-9]','','g') not like 'SS1%' and regexp_replace(upper(v_learner.class_label),'[^A-Z0-9]','','g') not like 'SS2%' then raise exception 'Senior leadership is open to SS1 and SS2 learners.'; end if;
    if nullif(btrim(p_input->>'statement'),'') is null or nullif(btrim(p_input->>'evidence'),'') is null then raise exception 'Nomination statement and evidence are required.'; end if;
    insert into public.khpos_ops_council_candidates(organisation_id,seat_id,learner_id,nomination_statement,nomination_evidence,created_by) values(p_organisation_id,v_seat.id,v_learner.id,btrim(p_input->>'statement'),btrim(p_input->>'evidence'),p_actor_user_id) returning id into v_id;
  elsif p_mode in ('eligibility','voice','appoint','review') then
    select * into v_candidate from public.khpos_ops_council_candidates where id=(p_input->>'candidateId')::uuid and organisation_id=p_organisation_id for update;
    if not found then raise exception 'Council candidate not found.'; end if;
    select * into v_seat from public.khpos_ops_council_seats where id=v_candidate.seat_id for update;
    select * into v_cycle from public.khpos_ops_council_cycles where id=v_seat.cycle_id;
    if v_cycle.status<>'open' then raise exception 'Council cycle is closed.'; end if;
    if p_mode='eligibility' then
      if v_candidate.status<>'nominated' or nullif(btrim(p_input->>'note'),'') is null then raise exception 'Nomination and eligibility reason are required.'; end if;
      if p_input->>'outcome' not in ('eligible','ineligible') then raise exception 'Invalid eligibility outcome.'; end if;
      update public.khpos_ops_council_candidates set status=p_input->>'outcome',eligibility_note=btrim(p_input->>'note'),verified_by=p_actor_user_id where id=v_candidate.id;
    elsif p_mode='voice' then
      if v_candidate.status<>'eligible' or nullif(btrim(p_input->>'summary'),'') is null or nullif(btrim(p_input->>'evidence'),'') is null then raise exception 'Eligible candidate, student voice summary and evidence are required.'; end if;
      update public.khpos_ops_council_candidates set student_voice_summary=btrim(p_input->>'summary'),student_voice_evidence=btrim(p_input->>'evidence') where id=v_candidate.id;
    elsif p_mode='appoint' then
      if v_candidate.status<>'eligible' or v_candidate.student_voice_evidence is null then raise exception 'Eligibility and student voice must be recorded first.'; end if;
      if v_seat.status<>'open' then raise exception 'Seat is already filled.'; end if;
      if not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']::text[]) then raise exception 'School Guardian must validate appointment.'; end if;
      update public.khpos_ops_council_candidates set status='appointed',appointed_by=p_actor_user_id,appointed_at=now() where id=v_candidate.id;
      update public.khpos_ops_council_seats set status='filled' where id=v_seat.id;
    else
      if v_candidate.status<>'appointed' or nullif(btrim(p_input->>'finding'),'') is null or nullif(btrim(p_input->>'evidence'),'') is null then raise exception 'Appointed member, finding and evidence are required.'; end if;
      v_decision:=p_input->>'decision';
      if v_decision not in ('continue','support_plan','remove') then raise exception 'Invalid review decision.'; end if;
      if v_decision='remove' and not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']::text[]) then raise exception 'Only School Guardian may decide a recall.'; end if;
      if v_decision='remove' and (p_input->>'type'<>'recall' or nullif(btrim(p_input->>'response'),'') is null or p_input->>'responseOfferedAt' is null) then raise exception 'Recall requires a documented opportunity to respond and the learner response.'; end if;
      if v_decision='support_plan' and not exists (
        select 1 from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles role on role.id=a.role_id
        where a.id=(p_input->>'actionOwnerId')::uuid and a.status='active' and role.organisation_id=p_organisation_id
      ) then raise exception 'Support plan owner must have an active assignment in this organisation.'; end if;
      insert into public.khpos_ops_council_reviews(organisation_id,candidate_id,review_type,finding,evidence_reference,student_response,response_offered_at,decision,action_owner_id,action_due_date,reviewed_by)
      values(p_organisation_id,v_candidate.id,p_input->>'type',btrim(p_input->>'finding'),btrim(p_input->>'evidence'),nullif(btrim(p_input->>'response'),''),(p_input->>'responseOfferedAt')::timestamptz,v_decision,(p_input->>'actionOwnerId')::uuid,(p_input->>'actionDueDate')::date,p_actor_user_id) returning id into v_id;
      if v_decision='remove' then
        update public.khpos_ops_council_candidates set status='withdrawn' where id=v_candidate.id;
        update public.khpos_ops_council_seats set status='open' where id=v_seat.id;
      end if;
    end if;
    v_id:=coalesce(v_id,v_candidate.id);
  else raise exception 'Unsupported council action.';
  end if;
  if not khpos_private.ops_hpd_actor_has_role(p_actor_user_id,p_organisation_id,array['SCHOOL_GUARDIAN']::text[])
    and not exists (
      select 1 from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles role on role.id=a.role_id
      where a.user_id=p_actor_user_id and a.campus_id=coalesce(v_cycle.campus_id,(p_input->>'campusId')::uuid)
        and a.status='active' and role.organisation_id=p_organisation_id and role.code='SECTIONAL_PROMOTER'
    ) then raise exception 'Sectional Promoter may manage only their assigned campus.';
  end if;
  insert into public.khpos_ops_council_events(organisation_id,entity_type,entity_id,action,actor_id,detail) values(p_organisation_id,case when p_mode='create_cycle' then 'cycle' when p_mode='create_seat' then 'seat' when p_mode='review' then 'review' else 'candidate' end,v_id,p_mode,p_actor_user_id,p_input);
  return public.khpos_ops_get_council_server(p_actor_user_id,p_organisation_id);
end $$;

revoke all on function public.khpos_ops_get_council_server(uuid,uuid) from public,anon,authenticated;
revoke all on function public.khpos_ops_council_action_server(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.khpos_ops_get_council_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_council_action_server(uuid,uuid,text,jsonb) to service_role;
