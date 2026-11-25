create table public.khpos_availability_handoffs (
  case_id uuid primary key references public.khpos_ops_staff_availability_cases(id) on delete cascade,
  forwarded_by uuid not null references auth.users(id),
  forwarded_at timestamptz not null default now(),
  note text not null check (length(note) between 1 and 2000)
);
alter table public.khpos_availability_handoffs enable row level security;
revoke all on public.khpos_availability_handoffs from public,anon,authenticated,service_role;

create function public.khpos_availability_handoff_action_server(
  actor uuid, school uuid, request_id uuid, action text, note text, coverage boolean
)
returns void language plpgsql security definer set search_path='' as $$
declare
  request public.khpos_ops_staff_availability_cases;
  staff public.khpos_ops_staff;
  guardian boolean;
begin
  if not khpos_private.ops_availability_has_membership(actor,school) then
    raise exception 'Active school membership is required.';
  end if;
  select * into request from public.khpos_ops_staff_availability_cases c
    where c.id=request_id and c.organisation_id=school for update;
  if not found then raise exception 'Availability case not found.'; end if;
  select * into staff from public.khpos_ops_staff s where s.id=request.staff_id;
  guardian := khpos_private.learner_register_role(actor,school,staff.campus_id,array['SCHOOL_GUARDIAN']);
  if action='forward_guardian' then
    if staff.user_id=actor or guardian or request.status<>'pending_approval'
      or not khpos_private.ops_availability_can_review_staff(actor,school,staff.id)
      or not khpos_private.learner_register_role(actor,school,staff.campus_id,
        array['ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER','FINANCE_ADMIN_OFFICER','SCHOOL_CUSTODIAN']) then
      raise exception 'Only the assigned reporting leader can forward this pending request.';
    end if;
    if coalesce(length(btrim(note)),0) not between 1 and 2000 then
      raise exception 'Add a short recommendation for the School Guardian.';
    end if;
    if not exists (
      select 1 from public.khpos_ops_role_assignments a
      join public.khpos_ops_roles r on r.id=a.role_id
      where a.user_id is distinct from staff.user_id and a.user_id<>actor
        and r.organisation_id=school and r.code='SCHOOL_GUARDIAN'
        and khpos_private.learner_register_role(a.user_id,school,staff.campus_id,array['SCHOOL_GUARDIAN'])
        and khpos_private.ops_availability_can_review_staff(a.user_id,school,staff.id)
    ) then raise exception 'No eligible School Guardian is assigned to decide this request.'; end if;

    insert into public.khpos_availability_handoffs(case_id,forwarded_by,note)
      values(request.id,actor,btrim(note)) on conflict(case_id) do nothing;
    if found then
      insert into public.khpos_ops_staff_availability_events(
        organisation_id,availability_case_id,actor_user_id,event_type,from_status,to_status,note,metadata
      ) values(school,request.id,actor,'availability_forward_guardian',request.status,request.status,null,'{}');
      insert into public.khpos_ops_audit_events(organisation_id,actor_user_id,event_type,object_type,object_id,metadata)
      values(school,actor,'ops_availability_forward_guardian','staff_availability',request.id,'{}');
    end if;
    return;
  end if;
  if action in ('approve','decline','require_coverage','confirm_coverage')
    and exists(select 1 from public.khpos_availability_handoffs h where h.case_id=request.id)
    and (not guardian or exists(select 1 from public.khpos_availability_handoffs h where h.case_id=request.id and h.forwarded_by=actor)) then
    raise exception 'Only an independent School Guardian can decide this forwarded request.';
  end if;
  perform public.khpos_ops_availability_action_server(actor,school,request_id,action,note,coverage);
end
$$;

create function public.khpos_availability_handoffs_server(actor uuid, school uuid, only_pending boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'caseId',c.id,'requestedAt',c.created_at,'forwardedAt',h.forwarded_at,'pending',c.status='pending_approval',
    'canDecide',permissions.can_decide,'canForward',permissions.can_forward,
    'note',case when permissions.can_decide or h.forwarded_by=actor then h.note else null end
  ) order by h.forwarded_at desc),'[]'::jsonb)
  from public.khpos_ops_staff_availability_cases c
  left join public.khpos_availability_handoffs h on c.id=h.case_id
  join public.khpos_ops_staff s on s.id=c.staff_id
  cross join lateral (select
    h.forwarded_by<>actor and khpos_private.learner_register_role(actor,school,s.campus_id,array['SCHOOL_GUARDIAN'])
    and khpos_private.ops_availability_can_review_staff(actor,school,s.id) as can_decide,
    h.case_id is null and c.status='pending_approval' and s.user_id is distinct from actor
    and not khpos_private.learner_register_role(actor,school,s.campus_id,array['SCHOOL_GUARDIAN'])
    and khpos_private.ops_availability_can_review_staff(actor,school,s.id)
    and khpos_private.learner_register_role(actor,school,s.campus_id,
      array['ACADEMIC_INSPECTOR','SKILL_INSPECTOR','SECTIONAL_PROMOTER','SCHOOL_CARE_OPERATIONS_OFFICER','FINANCE_ADMIN_OFFICER','SCHOOL_CUSTODIAN']) as can_forward
  ) permissions
  where c.organisation_id=school and khpos_private.ops_availability_has_membership(actor,school)
    and (case when only_pending then (permissions.can_decide or permissions.can_forward) and c.status='pending_approval'
      else permissions.can_forward or (h.case_id is not null and
        (permissions.can_decide or s.user_id=actor or h.forwarded_by=actor
          or khpos_private.ops_availability_can_review_staff(actor,school,s.id))) end);
$$;

revoke all on function public.khpos_availability_handoff_action_server(uuid,uuid,uuid,text,text,boolean),
  public.khpos_availability_handoffs_server(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.khpos_availability_handoff_action_server(uuid,uuid,uuid,text,text,boolean),
  public.khpos_availability_handoffs_server(uuid,uuid,boolean) to service_role;
