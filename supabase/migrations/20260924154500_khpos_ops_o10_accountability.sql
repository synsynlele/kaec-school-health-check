create extension if not exists pgcrypto;

create table if not exists public.khpos_ops_staff_recognition (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  recognition_reference text not null,
  category text not null
    check (category in (
      'excellence','collaboration','compassion','equity','initiative',
      'service','improvement','reliability','leadership','other'
    )),
  title text not null,
  evidence_note text not null,
  evidence_reference text,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  unique (organisation_id,recognition_reference)
);

create index if not exists idx_khpos_ops_staff_recognition_staff
  on public.khpos_ops_staff_recognition(staff_id,issued_at desc);
create index if not exists idx_khpos_ops_staff_recognition_issuer
  on public.khpos_ops_staff_recognition(issued_by,issued_at desc);
create index if not exists idx_khpos_ops_staff_recognition_withdrawn_by
  on public.khpos_ops_staff_recognition(withdrawn_by,withdrawn_at desc)
  where withdrawn_by is not null;

create table if not exists public.khpos_ops_staff_accountability_cases (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_reference text not null,
  case_type text not null
    check (case_type in ('corrective','grievance','formal_discipline')),
  source_case_id uuid references public.khpos_ops_staff_accountability_cases(id) on delete set null,
  raised_by_user_id uuid not null references auth.users(id) on delete restrict,
  reporter_staff_id uuid references public.khpos_ops_staff(id) on delete set null,
  subject_staff_id uuid references public.khpos_ops_staff(id) on delete set null,
  grievance_target text
    check (grievance_target is null or grievance_target in (
      'staff_member','decision','working_condition','process','other'
    )),
  title text not null,
  statement text not null,
  relevant_standard text,
  incident_at timestamptz,
  desired_resolution text,
  classification_note text,
  response_due_at timestamptz,
  response_state text not null default 'not_requested'
    check (response_state in ('not_requested','requested','submitted','no_response_recorded')),
  response_requested_at timestamptz,
  response_requested_by uuid references auth.users(id) on delete set null,
  hearing_required boolean not null default false,
  hearing_completed_at timestamptz,
  hearing_record text,
  status text not null
    check (status in (
      'open','awaiting_response','under_review','action_active',
      'decision_recorded','resolved','external_review_required',
      'referred_formal','withdrawn','cancelled','closed'
    )),
  outcome text
    check (outcome is null or outcome in (
      'no_action','expectation_reset','documented_reminder','conduct_commitment',
      'written_warning','final_warning','other_proportionate_action',
      'refer_separation_review',
      'grievance_upheld','grievance_partially_upheld','grievance_not_upheld',
      'grievance_resolved_by_agreement','grievance_referred_other_process'
    )),
  outcome_note text,
  authority_review_reference text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  outcome_delivered_at timestamptz,
  outcome_acknowledged_by uuid references auth.users(id) on delete set null,
  outcome_acknowledged_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (case_type in ('corrective','formal_discipline') and subject_staff_id is not null)
    or case_type='grievance'
  ),
  check (
    case_type<>'grievance'
    or reporter_staff_id is not null
  ),
  check (
    case_type='grievance'
    or grievance_target is null
  ),
  unique (organisation_id,case_reference)
);

create index if not exists idx_khpos_ops_accountability_org_status
  on public.khpos_ops_staff_accountability_cases(organisation_id,status,created_at desc);
create index if not exists idx_khpos_ops_accountability_subject
  on public.khpos_ops_staff_accountability_cases(subject_staff_id,status,created_at desc)
  where subject_staff_id is not null;
create index if not exists idx_khpos_ops_accountability_reporter
  on public.khpos_ops_staff_accountability_cases(reporter_staff_id,status,created_at desc)
  where reporter_staff_id is not null;
create index if not exists idx_khpos_ops_accountability_raised_by
  on public.khpos_ops_staff_accountability_cases(raised_by_user_id,created_at desc);
create index if not exists idx_khpos_ops_accountability_source
  on public.khpos_ops_staff_accountability_cases(source_case_id)
  where source_case_id is not null;
create index if not exists idx_khpos_ops_accountability_decided_by
  on public.khpos_ops_staff_accountability_cases(decided_by,decided_at desc)
  where decided_by is not null;

create table if not exists public.khpos_ops_staff_accountability_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_staff_accountability_cases(id) on delete cascade,
  response_type text not null
    check (response_type in (
      'subject_response','reporter_clarification','manager_clarification',
      'hearing_record','external_review_record','outcome_acknowledgement'
    )),
  submitted_by uuid not null references auth.users(id) on delete restrict,
  response_text text not null,
  evidence_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_accountability_responses_case
  on public.khpos_ops_staff_accountability_responses(case_id,created_at desc);
create index if not exists idx_khpos_ops_accountability_responses_submitter
  on public.khpos_ops_staff_accountability_responses(submitted_by,created_at desc);

create table if not exists public.khpos_ops_staff_accountability_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_staff_accountability_cases(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in (
      'document','communication','observation','operational_record',
      'witness_note','policy_or_standard','other'
    )),
  title text not null,
  note text not null,
  evidence_reference text,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_accountability_evidence_case
  on public.khpos_ops_staff_accountability_evidence(case_id,created_at desc);
create index if not exists idx_khpos_ops_accountability_evidence_added_by
  on public.khpos_ops_staff_accountability_evidence(added_by,created_at desc);

create table if not exists public.khpos_ops_staff_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid not null references public.khpos_ops_staff_accountability_cases(id) on delete cascade,
  staff_id uuid not null references public.khpos_ops_staff(id) on delete cascade,
  action_type text not null
    check (action_type in (
      'expectation_reset','documented_reminder','conduct_commitment',
      'monitoring_period','other'
    )),
  title text not null,
  expected_change text not null,
  due_date date not null,
  status text not null default 'open'
    check (status in ('open','in_progress','evidence_submitted','verified','cancelled')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  completion_note text,
  evidence_reference text,
  submitted_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_khpos_ops_corrective_case
  on public.khpos_ops_staff_corrective_actions(case_id,status,due_date);
create index if not exists idx_khpos_ops_corrective_staff
  on public.khpos_ops_staff_corrective_actions(staff_id,status,due_date);
create index if not exists idx_khpos_ops_corrective_owner
  on public.khpos_ops_staff_corrective_actions(owner_user_id,status,due_date);
create index if not exists idx_khpos_ops_corrective_verified_by
  on public.khpos_ops_staff_corrective_actions(verified_by,verified_at desc)
  where verified_by is not null;
create index if not exists idx_khpos_ops_corrective_cancelled_by
  on public.khpos_ops_staff_corrective_actions(cancelled_by,cancelled_at desc)
  where cancelled_by is not null;

create table if not exists public.khpos_ops_staff_accountability_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  case_id uuid references public.khpos_ops_staff_accountability_cases(id) on delete cascade,
  recognition_id uuid references public.khpos_ops_staff_recognition(id) on delete cascade,
  corrective_action_id uuid references public.khpos_ops_staff_corrective_actions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(case_id,recognition_id,corrective_action_id) >= 1
  )
);

create index if not exists idx_khpos_ops_accountability_events_case
  on public.khpos_ops_staff_accountability_events(case_id,created_at desc)
  where case_id is not null;
create index if not exists idx_khpos_ops_accountability_events_recognition
  on public.khpos_ops_staff_accountability_events(recognition_id,created_at desc)
  where recognition_id is not null;
create index if not exists idx_khpos_ops_accountability_events_action
  on public.khpos_ops_staff_accountability_events(corrective_action_id,created_at desc)
  where corrective_action_id is not null;
create index if not exists idx_khpos_ops_accountability_events_actor
  on public.khpos_ops_staff_accountability_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.khpos_ops_staff_recognition enable row level security;
alter table public.khpos_ops_staff_accountability_cases enable row level security;
alter table public.khpos_ops_staff_accountability_responses enable row level security;
alter table public.khpos_ops_staff_accountability_evidence enable row level security;
alter table public.khpos_ops_staff_corrective_actions enable row level security;
alter table public.khpos_ops_staff_accountability_events enable row level security;

revoke all privileges on table public.khpos_ops_staff_recognition from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_accountability_cases from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_accountability_responses from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_accountability_evidence from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_corrective_actions from public,anon,authenticated;
revoke all privileges on table public.khpos_ops_staff_accountability_events from public,anon,authenticated;

grant select,insert,update,delete on table public.khpos_ops_staff_recognition to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_accountability_cases to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_accountability_responses to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_accountability_evidence to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_corrective_actions to service_role;
grant select,insert,update,delete on table public.khpos_ops_staff_accountability_events to service_role;

create or replace function khpos_private.ops_accountability_has_membership(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.organisation_memberships m
    join public.organisations o on o.id=m.organisation_id
    where m.organisation_id=p_organisation_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and o.status='active'
      and o.partner_status='active'
      and 'khpos_core'=any(coalesce(o.partner_entitlements,'{}'::text[]))
  );
$$;

create or replace function khpos_private.ops_accountability_staff_for_user(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select s.id
  from public.khpos_ops_staff s
  where s.organisation_id=p_organisation_id
    and s.user_id=p_actor_user_id
    and s.status='active'
  order by s.created_at
  limit 1;
$$;

create or replace function khpos_private.ops_accountability_can_manage_subject(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_subject_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_staff s
    where s.id=p_subject_staff_id
      and s.organisation_id=p_organisation_id
      and s.status='active'
      and s.user_id is distinct from p_actor_user_id
      and exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles ar on ar.id=a.role_id
        where a.user_id=p_actor_user_id
          and a.status='active'
          and ar.organisation_id=p_organisation_id
          and ar.status='active'
          and khpos_private.ops_role_is_ancestor(
            p_organisation_id,s.desired_role_id,ar.id
          )
      )
  );
$$;

create or replace function khpos_private.ops_accountability_can_manage_grievance(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_reporter_staff_id uuid,
  p_subject_staff_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_reporter public.khpos_ops_staff%rowtype;
  v_subject public.khpos_ops_staff%rowtype;
  v_actor_role record;
begin
  select * into v_reporter
  from public.khpos_ops_staff
  where id=p_reporter_staff_id
    and organisation_id=p_organisation_id
    and status='active';

  if v_reporter.id is null or v_reporter.user_id=p_actor_user_id then
    return false;
  end if;

  if p_subject_staff_id is not null then
    select * into v_subject
    from public.khpos_ops_staff
    where id=p_subject_staff_id
      and organisation_id=p_organisation_id
      and status='active';

    if v_subject.id is null or v_subject.user_id=p_actor_user_id then
      return false;
    end if;
  end if;

  for v_actor_role in
    select r.id
    from public.khpos_ops_role_assignments a
    join public.khpos_ops_roles r on r.id=a.role_id
    where a.user_id=p_actor_user_id
      and a.status='active'
      and r.organisation_id=p_organisation_id
      and r.status='active'
  loop
    if khpos_private.ops_role_is_ancestor(
      p_organisation_id,v_reporter.desired_role_id,v_actor_role.id
    ) and (
      p_subject_staff_id is null
      or khpos_private.ops_role_is_ancestor(
        p_organisation_id,v_subject.desired_role_id,v_actor_role.id
      )
    ) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function khpos_private.ops_accountability_case_can_manage(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id;

  if v_case.id is null then return false; end if;

  if v_case.case_type='grievance' then
    return khpos_private.ops_accountability_can_manage_grievance(
      p_actor_user_id,p_organisation_id,
      v_case.reporter_staff_id,v_case.subject_staff_id
    );
  end if;

  return khpos_private.ops_accountability_can_manage_subject(
    p_actor_user_id,p_organisation_id,v_case.subject_staff_id
  );
end;
$$;

create or replace function khpos_private.ops_accountability_case_is_reporter(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_staff_accountability_cases c
    left join public.khpos_ops_staff rs on rs.id=c.reporter_staff_id
    where c.id=p_case_id
      and c.organisation_id=p_organisation_id
      and (
        c.raised_by_user_id=p_actor_user_id
        or rs.user_id=p_actor_user_id
      )
  );
$$;

create or replace function khpos_private.ops_accountability_case_is_subject(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select exists(
    select 1
    from public.khpos_ops_staff_accountability_cases c
    join public.khpos_ops_staff ss on ss.id=c.subject_staff_id
    where c.id=p_case_id
      and c.organisation_id=p_organisation_id
      and ss.user_id=p_actor_user_id
      and (
        c.case_type<>'grievance'
        or c.response_state in ('requested','submitted','no_response_recorded')
        or c.status in ('decision_recorded','resolved','closed')
      )
  );
$$;

create or replace function khpos_private.ops_accountability_case_visible(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
  select
    khpos_private.ops_accountability_case_is_reporter(
      p_actor_user_id,p_organisation_id,p_case_id
    )
    or khpos_private.ops_accountability_case_is_subject(
      p_actor_user_id,p_organisation_id,p_case_id
    )
    or khpos_private.ops_accountability_case_can_manage(
      p_actor_user_id,p_organisation_id,p_case_id
    );
$$;

create or replace function public.khpos_ops_get_staff_accountability_server(
  p_actor_user_id uuid,
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_member_role text;
  v_org_name text;
  v_actor_staff_id uuid;
  v_can_manage_any boolean := false;
  v_staff_options jsonb := '[]'::jsonb;
  v_recognitions jsonb := '[]'::jsonb;
  v_cases jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  if not khpos_private.ops_accountability_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  select m.role,o.name into v_member_role,v_org_name
  from public.organisation_memberships m
  join public.organisations o on o.id=m.organisation_id
  where m.organisation_id=p_organisation_id
    and m.user_id=p_actor_user_id
    and m.status='active'
  limit 1;

  v_actor_staff_id := khpos_private.ops_accountability_staff_for_user(
    p_actor_user_id,p_organisation_id
  );

  select exists(
    select 1
    from public.khpos_ops_staff s
    where s.organisation_id=p_organisation_id
      and s.status='active'
      and khpos_private.ops_accountability_can_manage_subject(
        p_actor_user_id,p_organisation_id,s.id
      )
  ) into v_can_manage_any;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'reference',s.staff_reference,
    'displayName',s.display_name,
    'userId',s.user_id,
    'roleId',r.id,
    'roleCode',r.code,
    'roleTitle',r.title,
    'roleLevel',r.role_level,
    'campusName',campus.name,
    'unitName',unit.name,
    'isSelf',s.user_id=p_actor_user_id,
    'canManage',khpos_private.ops_accountability_can_manage_subject(
      p_actor_user_id,p_organisation_id,s.id
    )
  ) order by r.role_level,lower(s.display_name)),'[]'::jsonb)
  into v_staff_options
  from public.khpos_ops_staff s
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  left join public.khpos_ops_campuses campus on campus.id=s.campus_id
  left join public.khpos_ops_units unit on unit.id=s.unit_id
  where s.organisation_id=p_organisation_id
    and s.status='active'
    and (
      s.user_id=p_actor_user_id
      or khpos_private.ops_accountability_can_manage_subject(
        p_actor_user_id,p_organisation_id,s.id
      )
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rec.id,
    'reference',rec.recognition_reference,
    'staffId',rec.staff_id,
    'staffName',s.display_name,
    'roleTitle',r.title,
    'category',rec.category,
    'title',rec.title,
    'evidenceNote',rec.evidence_note,
    'evidenceReference',rec.evidence_reference,
    'issuedAt',rec.issued_at,
    'withdrawnAt',rec.withdrawn_at,
    'withdrawalReason',rec.withdrawal_reason,
    'canWithdraw',rec.withdrawn_at is null
      and khpos_private.ops_accountability_can_manage_subject(
        p_actor_user_id,p_organisation_id,rec.staff_id
      )
  ) order by rec.issued_at desc),'[]'::jsonb)
  into v_recognitions
  from public.khpos_ops_staff_recognition rec
  join public.khpos_ops_staff s on s.id=rec.staff_id
  join public.khpos_ops_roles r on r.id=s.desired_role_id
  where rec.organisation_id=p_organisation_id
    and (
      s.user_id=p_actor_user_id
      or khpos_private.ops_accountability_can_manage_subject(
        p_actor_user_id,p_organisation_id,s.id
      )
    );

  with visible as (
    select c.*
    from public.khpos_ops_staff_accountability_cases c
    where c.organisation_id=p_organisation_id
      and khpos_private.ops_accountability_case_visible(
        p_actor_user_id,p_organisation_id,c.id
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'reference',c.case_reference,
    'caseType',c.case_type,
    'sourceCaseId',c.source_case_id,
    'reporterStaffId',c.reporter_staff_id,
    'reporterName',reporter.display_name,
    'subjectStaffId',c.subject_staff_id,
    'subjectName',subject.display_name,
    'subjectRoleTitle',subject_role.title,
    'grievanceTarget',c.grievance_target,
    'title',c.title,
    'statement',c.statement,
    'relevantStandard',c.relevant_standard,
    'incidentAt',c.incident_at,
    'desiredResolution',c.desired_resolution,
    'classificationNote',case
      when khpos_private.ops_accountability_case_can_manage(
        p_actor_user_id,p_organisation_id,c.id
      ) then c.classification_note
      else null
    end,
    'responseDueAt',c.response_due_at,
    'responseState',c.response_state,
    'hearingRequired',c.hearing_required,
    'hearingCompletedAt',c.hearing_completed_at,
    'status',c.status,
    'outcome',c.outcome,
    'outcomeNote',c.outcome_note,
    'authorityReviewReference',case
      when khpos_private.ops_accountability_case_can_manage(
        p_actor_user_id,p_organisation_id,c.id
      ) then c.authority_review_reference
      else null
    end,
    'decidedAt',c.decided_at,
    'outcomeDeliveredAt',c.outcome_delivered_at,
    'outcomeAcknowledgedAt',c.outcome_acknowledged_at,
    'createdAt',c.created_at,
    'isReporter',khpos_private.ops_accountability_case_is_reporter(
      p_actor_user_id,p_organisation_id,c.id
    ),
    'isSubject',khpos_private.ops_accountability_case_is_subject(
      p_actor_user_id,p_organisation_id,c.id
    ),
    'canManage',khpos_private.ops_accountability_case_can_manage(
      p_actor_user_id,p_organisation_id,c.id
    ),
    'responses',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',resp.id,
        'responseType',resp.response_type,
        'responseText',resp.response_text,
        'evidenceReference',resp.evidence_reference,
        'submittedBy',resp.submitted_by,
        'createdAt',resp.created_at
      ) order by resp.created_at)
      from public.khpos_ops_staff_accountability_responses resp
      where resp.case_id=c.id
        and (
          khpos_private.ops_accountability_case_can_manage(
            p_actor_user_id,p_organisation_id,c.id
          )
          or resp.submitted_by=p_actor_user_id
          or (
            khpos_private.ops_accountability_case_is_subject(
              p_actor_user_id,p_organisation_id,c.id
            )
            and resp.response_type in ('subject_response','hearing_record','outcome_acknowledgement')
          )
          or (
            khpos_private.ops_accountability_case_is_reporter(
              p_actor_user_id,p_organisation_id,c.id
            )
            and resp.response_type in ('reporter_clarification','external_review_record','outcome_acknowledgement')
          )
        )
    ),'[]'::jsonb),
    'evidence',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',ev.id,
        'evidenceType',ev.evidence_type,
        'title',ev.title,
        'note',ev.note,
        'evidenceReference',ev.evidence_reference,
        'addedBy',ev.added_by,
        'createdAt',ev.created_at
      ) order by ev.created_at)
      from public.khpos_ops_staff_accountability_evidence ev
      where ev.case_id=c.id
        and (
          khpos_private.ops_accountability_case_can_manage(
            p_actor_user_id,p_organisation_id,c.id
          )
          or ev.added_by=p_actor_user_id
          or khpos_private.ops_accountability_case_is_subject(
            p_actor_user_id,p_organisation_id,c.id
          )
          or khpos_private.ops_accountability_case_is_reporter(
            p_actor_user_id,p_organisation_id,c.id
          )
        )
    ),'[]'::jsonb),
    'correctiveActions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'actionType',a.action_type,
        'title',a.title,
        'expectedChange',a.expected_change,
        'dueDate',a.due_date,
        'status',a.status,
        'ownerUserId',a.owner_user_id,
        'isOwner',a.owner_user_id=p_actor_user_id,
        'canVerify',khpos_private.ops_accountability_case_can_manage(
          p_actor_user_id,p_organisation_id,c.id
        ),
        'completionNote',a.completion_note,
        'evidenceReference',a.evidence_reference,
        'submittedAt',a.submitted_at,
        'verifiedAt',a.verified_at
      ) order by a.due_date,a.created_at)
      from public.khpos_ops_staff_corrective_actions a
      where a.case_id=c.id
    ),'[]'::jsonb),
    'history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventType',e.event_type,
        'fromStatus',e.from_status,
        'toStatus',e.to_status,
        'note',e.note,
        'createdAt',e.created_at
      ) order by e.created_at desc)
      from (
        select event_type,from_status,to_status,note,created_at
        from public.khpos_ops_staff_accountability_events
        where case_id=c.id
        order by created_at desc
        limit 30
      ) e
    ),'[]'::jsonb)
  ) order by
    case c.status
      when 'external_review_required' then 1
      when 'awaiting_response' then 2
      when 'under_review' then 3
      when 'action_active' then 4
      when 'open' then 5
      when 'decision_recorded' then 6
      when 'resolved' then 7
      when 'referred_formal' then 8
      when 'closed' then 9
      else 10
    end,
    c.created_at desc
  ),'[]'::jsonb)
  into v_cases
  from visible c
  left join public.khpos_ops_staff reporter on reporter.id=c.reporter_staff_id
  left join public.khpos_ops_staff subject on subject.id=c.subject_staff_id
  left join public.khpos_ops_roles subject_role on subject_role.id=subject.desired_role_id;

  select jsonb_build_object(
    'activeCases',count(*) filter (
      where status not in ('closed','withdrawn','cancelled')
    ),
    'awaitingResponse',count(*) filter (where status='awaiting_response'),
    'correctiveActive',count(*) filter (
      where case_type='corrective'
        and status not in ('closed','withdrawn','cancelled','referred_formal')
    ),
    'formalActive',count(*) filter (
      where case_type='formal_discipline'
        and status not in ('closed','cancelled')
    ),
    'grievancesActive',count(*) filter (
      where case_type='grievance'
        and status not in ('closed','withdrawn','cancelled')
    ),
    'externalReviewRequired',count(*) filter (
      where status='external_review_required'
    ),
    'recognitions',(
      select count(*) from public.khpos_ops_staff_recognition rec
      join public.khpos_ops_staff s on s.id=rec.staff_id
      where rec.organisation_id=p_organisation_id
        and rec.withdrawn_at is null
        and (
          s.user_id=p_actor_user_id
          or khpos_private.ops_accountability_can_manage_subject(
            p_actor_user_id,p_organisation_id,s.id
          )
        )
    )
  )
  into v_summary
  from public.khpos_ops_staff_accountability_cases c
  where c.organisation_id=p_organisation_id
    and khpos_private.ops_accountability_case_visible(
      p_actor_user_id,p_organisation_id,c.id
    );

  return jsonb_build_object(
    'organisation',jsonb_build_object('id',p_organisation_id,'name',v_org_name),
    'membershipRole',v_member_role,
    'generatedAt',now(),
    'actorStaffId',v_actor_staff_id,
    'canManageAnyStaff',v_can_manage_any,
    'principle','Recognition reinforces what KNS wants repeated. Corrective and disciplinary action address conduct/accountability through specific evidence and a fair opportunity to respond; capability gaps remain in O9.',
    'legalBoundary','KHP-OS records institutional process and evidence. Employment-law, contract, statutory-entitlement and high-severity separation decisions require the applicable qualified review; O10 does not terminate employment.',
    'staffOptions',v_staff_options,
    'recognitions',v_recognitions,
    'summary',v_summary,
    'cases',v_cases
  );
end;
$$;

create or replace function public.khpos_ops_issue_staff_recognition_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_staff_id uuid,
  p_category text,
  p_title text,
  p_evidence_note text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_category text := lower(nullif(btrim(p_category),''));
  v_recognition_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_accountability_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  if not khpos_private.ops_accountability_can_manage_subject(
    p_actor_user_id,p_organisation_id,p_staff_id
  ) then
    raise exception 'Recognition must be issued by an appropriate reporting leader.';
  end if;

  if v_category not in (
    'excellence','collaboration','compassion','equity','initiative',
    'service','improvement','reliability','leadership','other'
  ) then
    raise exception 'Unsupported recognition category.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_evidence_note,'')),'') is null then
    raise exception 'Recognition title and specific evidence are required.';
  end if;

  v_reference := 'REC-'||upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_recognition(
    organisation_id,staff_id,recognition_reference,category,title,
    evidence_note,evidence_reference,issued_by
  ) values (
    p_organisation_id,p_staff_id,v_reference,v_category,left(btrim(p_title),240),
    left(btrim(p_evidence_note),4000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_recognition_id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,recognition_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_recognition_id,p_actor_user_id,
    'recognition_issued',left(btrim(p_title),240)
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_staff_recognition_issued',
    'staff_recognition',v_recognition_id,
    jsonb_build_object('staffId',p_staff_id,'category',v_category,'reference',v_reference)
  );

  return v_recognition_id;
end;
$$;

create or replace function public.khpos_ops_withdraw_staff_recognition_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_recognition_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_rec public.khpos_ops_staff_recognition%rowtype;
begin
  select * into v_rec
  from public.khpos_ops_staff_recognition
  where id=p_recognition_id and organisation_id=p_organisation_id
  for update;

  if v_rec.id is null then raise exception 'Recognition record not found.'; end if;

  if not khpos_private.ops_accountability_can_manage_subject(
    p_actor_user_id,p_organisation_id,v_rec.staff_id
  ) then
    raise exception 'Only an appropriate reporting leader can withdraw recognition.';
  end if;

  if v_rec.withdrawn_at is not null then
    raise exception 'This recognition has already been withdrawn.';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'A withdrawal reason is required.';
  end if;

  update public.khpos_ops_staff_recognition
  set withdrawn_by=p_actor_user_id,
      withdrawn_at=now(),
      withdrawal_reason=left(btrim(p_reason),4000)
  where id=v_rec.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,recognition_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_rec.id,p_actor_user_id,
    'recognition_withdrawn',left(btrim(p_reason),4000)
  );
end;
$$;

create or replace function public.khpos_ops_create_accountability_case_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case_type text := lower(nullif(btrim(p_input->>'caseType'),''));
  v_subject_staff_id uuid;
  v_reporter_staff_id uuid;
  v_grievance_target text := lower(nullif(btrim(p_input->>'grievanceTarget'),''));
  v_title text := nullif(btrim(p_input->>'title'),'');
  v_statement text := nullif(btrim(p_input->>'statement'),'');
  v_standard text := nullif(btrim(p_input->>'relevantStandard'),'');
  v_desired_resolution text := nullif(btrim(p_input->>'desiredResolution'),'');
  v_classification_note text := nullif(btrim(p_input->>'classificationNote'),'');
  v_incident_at timestamptz;
  v_response_due_at timestamptz;
  v_hearing_required boolean := coalesce((p_input->>'hearingRequired')::boolean,false);
  v_source_case_id uuid;
  v_subject_role_code text;
  v_status text;
  v_response_state text;
  v_case_id uuid;
  v_reference text;
begin
  if not khpos_private.ops_accountability_has_membership(
    p_actor_user_id,p_organisation_id
  ) then
    raise exception 'Active organisation membership and KHP-OS partnership are required.';
  end if;

  if v_case_type not in ('corrective','grievance','formal_discipline') then
    raise exception 'Unsupported accountability case type.';
  end if;

  if v_title is null or v_statement is null then
    raise exception 'Case title and specific statement are required.';
  end if;

  if nullif(p_input->>'incidentAt','') is not null then
    begin v_incident_at := (p_input->>'incidentAt')::timestamptz;
    exception when others then raise exception 'Incident date/time is invalid.'; end;
  end if;

  if nullif(p_input->>'sourceCaseId','') is not null then
    begin v_source_case_id := (p_input->>'sourceCaseId')::uuid;
    exception when others then raise exception 'Source case identifier is invalid.'; end;

    if not exists(
      select 1
      from public.khpos_ops_staff_accountability_cases
      where id=v_source_case_id and organisation_id=p_organisation_id
    ) then
      raise exception 'Source accountability case was not found.';
    end if;
  end if;

  if v_case_type='grievance' then
    v_reporter_staff_id := khpos_private.ops_accountability_staff_for_user(
      p_actor_user_id,p_organisation_id
    );

    if v_reporter_staff_id is null then
      raise exception 'Only an active deployed staff member can raise a staff grievance.';
    end if;

    if v_grievance_target not in (
      'staff_member','decision','working_condition','process','other'
    ) then
      raise exception 'Choose what the grievance concerns.';
    end if;

    if v_grievance_target='staff_member' then
      begin v_subject_staff_id := (p_input->>'subjectStaffId')::uuid;
      exception when others then raise exception 'A staff grievance against a person requires the subject staff member.'; end;

      if not exists(
        select 1 from public.khpos_ops_staff
        where id=v_subject_staff_id
          and organisation_id=p_organisation_id
          and status='active'
      ) then
        raise exception 'Grievance subject must be an active staff member.';
      end if;

      if v_subject_staff_id=v_reporter_staff_id then
        raise exception 'A staff member cannot raise a grievance against themselves.';
      end if;
    end if;

    if v_desired_resolution is null then
      raise exception 'State the resolution or change you are seeking.';
    end if;

    v_status := case
      when not exists(
        select 1
        from public.khpos_ops_role_assignments a
        join public.khpos_ops_roles ar on ar.id=a.role_id
        where a.status='active'
          and ar.organisation_id=p_organisation_id
          and ar.status='active'
          and khpos_private.ops_role_is_ancestor(
            p_organisation_id,
            (select desired_role_id from public.khpos_ops_staff where id=v_reporter_staff_id),
            ar.id
          )
          and (
            v_subject_staff_id is null
            or (
              a.user_id is distinct from
                (select user_id from public.khpos_ops_staff where id=v_subject_staff_id)
              and khpos_private.ops_role_is_ancestor(
                p_organisation_id,
                (select desired_role_id from public.khpos_ops_staff where id=v_subject_staff_id),
                ar.id
              )
            )
          )
      ) then 'external_review_required'
      else 'open'
    end;
    v_response_state := 'not_requested';

  else
    begin v_subject_staff_id := (p_input->>'subjectStaffId')::uuid;
    exception when others then raise exception 'Corrective and formal disciplinary cases require the subject staff member.'; end;

    if not exists(
      select 1 from public.khpos_ops_staff
      where id=v_subject_staff_id
        and organisation_id=p_organisation_id
        and status='active'
    ) then
      raise exception 'Accountability subject must be an active staff member.';
    end if;

    if not khpos_private.ops_accountability_can_manage_subject(
      p_actor_user_id,p_organisation_id,v_subject_staff_id
    ) then
      raise exception 'Only the appropriate reporting leader can open this accountability case.';
    end if;

    select r.code into v_subject_role_code
    from public.khpos_ops_staff s
    join public.khpos_ops_roles r on r.id=s.desired_role_id
    where s.id=v_subject_staff_id;

    if v_subject_role_code='VISION_CUSTODIAN' then
      raise exception 'A Vision Custodian conduct case requires independent external governance; the subject cannot be managed through the internal reporting line.';
    end if;

    if v_standard is null then
      raise exception 'State the policy, standard, commitment or known expectation relevant to this case.';
    end if;

    if v_classification_note is null then
      raise exception 'Explain why this is a conduct/accountability matter rather than an unresolved capability gap for O9.';
    end if;

    begin v_response_due_at := (p_input->>'responseDueAt')::timestamptz;
    exception when others then raise exception 'A valid response deadline is required.'; end;

    if v_response_due_at<=now() then
      raise exception 'Response deadline must be in the future when the case is issued.';
    end if;

    v_status := 'awaiting_response';
    v_response_state := 'requested';
  end if;

  v_reference := case v_case_type
    when 'corrective' then 'COR-'
    when 'grievance' then 'GRV-'
    else 'DIS-'
  end || upper(substr(gen_random_uuid()::text,1,8));

  insert into public.khpos_ops_staff_accountability_cases(
    organisation_id,case_reference,case_type,source_case_id,raised_by_user_id,
    reporter_staff_id,subject_staff_id,grievance_target,title,statement,
    relevant_standard,incident_at,desired_resolution,classification_note,
    response_due_at,response_state,response_requested_at,response_requested_by,
    hearing_required,status
  ) values (
    p_organisation_id,v_reference,v_case_type,v_source_case_id,p_actor_user_id,
    v_reporter_staff_id,v_subject_staff_id,
    case when v_case_type='grievance' then v_grievance_target else null end,
    left(v_title,240),left(v_statement,6000),left(v_standard,3000),
    v_incident_at,left(v_desired_resolution,4000),left(v_classification_note,4000),
    v_response_due_at,v_response_state,
    case when v_response_state='requested' then now() else null end,
    case when v_response_state='requested' then p_actor_user_id else null end,
    case when v_case_type='formal_discipline' then v_hearing_required else false end,
    v_status
  ) returning id into v_case_id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,to_status,note,metadata
  ) values (
    p_organisation_id,v_case_id,p_actor_user_id,'case_created',v_status,
    left(v_title,240),
    jsonb_build_object(
      'caseType',v_case_type,
      'subjectStaffId',v_subject_staff_id,
      'reporterStaffId',v_reporter_staff_id,
      'responseDueAt',v_response_due_at,
      'hearingRequired',v_hearing_required
    )
  );

  insert into public.khpos_ops_audit_events(
    organisation_id,actor_user_id,event_type,object_type,object_id,metadata
  ) values (
    p_organisation_id,p_actor_user_id,'ops_accountability_case_created',
    'staff_accountability_case',v_case_id,
    jsonb_build_object('reference',v_reference,'caseType',v_case_type)
  );

  return v_case_id;
end;
$$;

create or replace function public.khpos_ops_accountability_request_response_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_response_due_at timestamptz,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_from_status text;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if not khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  ) then
    raise exception 'Only the appropriate case manager can request a formal response.';
  end if;

  if v_case.subject_staff_id is null then
    raise exception 'This case has no staff subject who can be asked to respond.';
  end if;

  if v_case.status in ('closed','withdrawn','cancelled','referred_formal') then
    raise exception 'A closed/referred case cannot request a response.';
  end if;

  if p_response_due_at<=now() then
    raise exception 'Response deadline must be in the future.';
  end if;

  v_from_status := v_case.status;

  update public.khpos_ops_staff_accountability_cases
  set response_state='requested',
      response_due_at=p_response_due_at,
      response_requested_at=now(),
      response_requested_by=p_actor_user_id,
      status='awaiting_response',
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'response_requested',
    v_from_status,'awaiting_response',
    left(nullif(btrim(coalesce(p_note,'')),''),4000)
  );
end;
$$;

create or replace function public.khpos_ops_submit_accountability_response_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_response_text text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_subject_user uuid;
  v_response_id uuid;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if v_case.subject_staff_id is null or v_case.response_state<>'requested' then
    raise exception 'This case is not currently requesting a subject response.';
  end if;

  select user_id into v_subject_user
  from public.khpos_ops_staff
  where id=v_case.subject_staff_id and organisation_id=p_organisation_id;

  if v_subject_user is distinct from p_actor_user_id then
    raise exception 'Only the staff member named in the allegation can submit this response.';
  end if;

  if nullif(btrim(coalesce(p_response_text,'')),'') is null then
    raise exception 'A response to the stated allegation/concern is required.';
  end if;

  insert into public.khpos_ops_staff_accountability_responses(
    organisation_id,case_id,response_type,submitted_by,response_text,evidence_reference
  ) values (
    p_organisation_id,v_case.id,'subject_response',p_actor_user_id,
    left(btrim(p_response_text),8000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000)
  ) returning id into v_response_id;

  update public.khpos_ops_staff_accountability_cases
  set response_state='submitted',
      status='under_review',
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'subject_response_submitted',
    v_case.status,'under_review','Staff response submitted before decision.'
  );

  return v_response_id;
end;
$$;

create or replace function public.khpos_ops_accountability_record_no_response_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if not khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  ) then
    raise exception 'Only the appropriate case manager can record non-response.';
  end if;

  if v_case.response_state<>'requested' or v_case.response_due_at is null then
    raise exception 'This case is not awaiting a requested response.';
  end if;

  if now()<v_case.response_due_at then
    raise exception 'The response deadline has not yet passed.';
  end if;

  if nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Record what notice/reminder was provided before treating the case as no response.';
  end if;

  update public.khpos_ops_staff_accountability_cases
  set response_state='no_response_recorded',
      status='under_review',
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'no_response_recorded',
    v_case.status,'under_review',left(btrim(p_note),4000)
  );
end;
$$;

create or replace function public.khpos_ops_add_accountability_evidence_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_evidence_type text,
  p_title text,
  p_note text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_type text := lower(nullif(btrim(p_evidence_type),''));
  v_evidence_id uuid;
begin
  if not khpos_private.ops_accountability_case_visible(
    p_actor_user_id,p_organisation_id,p_case_id
  ) then
    raise exception 'This accountability case is outside your visibility.';
  end if;

  if v_type not in (
    'document','communication','observation','operational_record',
    'witness_note','policy_or_standard','other'
  ) then
    raise exception 'Unsupported accountability evidence type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_note,'')),'') is null then
    raise exception 'Evidence title and note are required.';
  end if;

  insert into public.khpos_ops_staff_accountability_evidence(
    organisation_id,case_id,evidence_type,title,note,evidence_reference,added_by
  ) values (
    p_organisation_id,p_case_id,v_type,left(btrim(p_title),240),
    left(btrim(p_note),6000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000),
    p_actor_user_id
  ) returning id into v_evidence_id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,note,metadata
  ) values (
    p_organisation_id,p_case_id,p_actor_user_id,'evidence_added',
    left(btrim(p_title),240),
    jsonb_build_object('evidenceId',v_evidence_id,'evidenceType',v_type)
  );

  return v_evidence_id;
end;
$$;

create or replace function public.khpos_ops_record_accountability_hearing_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_hearing_record text,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if v_case.case_type<>'formal_discipline' or not v_case.hearing_required then
    raise exception 'This formal disciplinary case does not require a recorded hearing step.';
  end if;

  if not khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  ) then
    raise exception 'Only the appropriate case manager can record the hearing.';
  end if;

  if v_case.response_state not in ('submitted','no_response_recorded') then
    raise exception 'Complete the response opportunity before the disciplinary hearing record.';
  end if;

  if nullif(btrim(coalesce(p_hearing_record,'')),'') is null then
    raise exception 'A hearing record is required.';
  end if;

  update public.khpos_ops_staff_accountability_cases
  set hearing_completed_at=now(),
      hearing_record=left(btrim(p_hearing_record),8000),
      status='under_review',
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_responses(
    organisation_id,case_id,response_type,submitted_by,response_text,evidence_reference
  ) values (
    p_organisation_id,v_case.id,'hearing_record',p_actor_user_id,
    left(btrim(p_hearing_record),8000),
    left(nullif(btrim(coalesce(p_evidence_reference,'')),''),1000)
  );

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'hearing_recorded',
    'Required disciplinary hearing/meeting step recorded.'
  );
end;
$$;

create or replace function public.khpos_ops_create_corrective_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_action_type text,
  p_title text,
  p_expected_change text,
  p_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_subject public.khpos_ops_staff%rowtype;
  v_type text := lower(nullif(btrim(p_action_type),''));
  v_action_id uuid;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if v_case.case_type not in ('corrective','formal_discipline') then
    raise exception 'Corrective actions can only belong to corrective or formal disciplinary cases.';
  end if;

  if not khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  ) then
    raise exception 'Only the appropriate case manager can create corrective action.';
  end if;

  if v_case.response_state not in ('submitted','no_response_recorded') then
    raise exception 'Do not impose corrective action before the staff response opportunity is complete.';
  end if;

  if v_case.hearing_required and v_case.hearing_completed_at is null then
    raise exception 'Complete the required hearing step before creating corrective action.';
  end if;

  if v_type not in (
    'expectation_reset','documented_reminder','conduct_commitment',
    'monitoring_period','other'
  ) then
    raise exception 'Unsupported corrective action type.';
  end if;

  if nullif(btrim(coalesce(p_title,'')),'') is null
     or nullif(btrim(coalesce(p_expected_change,'')),'') is null then
    raise exception 'Corrective action title and expected change are required.';
  end if;

  if p_due_date<current_date then
    raise exception 'Corrective action due date cannot be in the past.';
  end if;

  select * into v_subject
  from public.khpos_ops_staff
  where id=v_case.subject_staff_id and organisation_id=p_organisation_id;

  if v_subject.id is null or v_subject.user_id is null then
    raise exception 'Subject staff account is required for owned corrective action.';
  end if;

  insert into public.khpos_ops_staff_corrective_actions(
    organisation_id,case_id,staff_id,action_type,title,expected_change,
    due_date,status,owner_user_id,created_by
  ) values (
    p_organisation_id,v_case.id,v_subject.id,v_type,left(btrim(p_title),240),
    left(btrim(p_expected_change),5000),p_due_date,'open',
    v_subject.user_id,p_actor_user_id
  ) returning id into v_action_id;

  update public.khpos_ops_staff_accountability_cases
  set status='action_active',
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,corrective_action_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,v_action_id,p_actor_user_id,
    'corrective_action_created',v_case.status,'action_active',
    left(btrim(p_title),240)
  );

  return v_action_id;
end;
$$;

create or replace function public.khpos_ops_corrective_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_action_id uuid,
  p_action text,
  p_note text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_action public.khpos_ops_staff_corrective_actions%rowtype;
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_evidence text := nullif(btrim(coalesce(p_evidence_reference,'')),'');
  v_is_owner boolean := false;
  v_can_manage boolean := false;
  v_from_status text;
  v_to_status text;
begin
  select * into v_action
  from public.khpos_ops_staff_corrective_actions
  where id=p_action_id and organisation_id=p_organisation_id
  for update;

  if v_action.id is null then raise exception 'Corrective action not found.'; end if;

  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=v_action.case_id and organisation_id=p_organisation_id;

  v_is_owner := v_action.owner_user_id=p_actor_user_id;
  v_can_manage := khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  );
  v_from_status := v_action.status;

  if p_action='start' then
    if not v_is_owner then raise exception 'Only the staff action owner can start the corrective commitment.'; end if;
    if v_action.status<>'open' then raise exception 'Only an open corrective action can be started.'; end if;
    v_to_status := 'in_progress';
    update public.khpos_ops_staff_corrective_actions
    set status='in_progress',updated_at=now()
    where id=v_action.id;

  elsif p_action='submit_evidence' then
    if not v_is_owner then raise exception 'Only the staff action owner can submit completion evidence.'; end if;
    if v_action.status not in ('open','in_progress') then
      raise exception 'Only open or in-progress corrective action can submit evidence.';
    end if;
    if v_note is null or v_evidence is null then
      raise exception 'Completion note and evidence reference are required.';
    end if;
    v_to_status := 'evidence_submitted';
    update public.khpos_ops_staff_corrective_actions
    set status='evidence_submitted',
        completion_note=left(v_note,4000),
        evidence_reference=left(v_evidence,1000),
        submitted_at=now(),
        updated_at=now()
    where id=v_action.id;

  elsif p_action='verify' then
    if not v_can_manage then raise exception 'Only the appropriate case manager can verify corrective action.'; end if;
    if v_action.status<>'evidence_submitted' then
      raise exception 'Only submitted corrective evidence can be verified.';
    end if;
    if v_action.owner_user_id=p_actor_user_id then
      raise exception 'The corrective action owner cannot verify their own completion.';
    end if;
    v_to_status := 'verified';
    update public.khpos_ops_staff_corrective_actions
    set status='verified',
        verified_by=p_actor_user_id,
        verified_at=now(),
        updated_at=now()
    where id=v_action.id;

  elsif p_action='reopen' then
    if not v_can_manage then raise exception 'Only the appropriate case manager can reopen corrective action.'; end if;
    if v_action.status not in ('evidence_submitted','verified') then
      raise exception 'Only submitted or verified corrective action can be reopened.';
    end if;
    if v_note is null then raise exception 'Explain why the corrective action is being reopened.'; end if;
    v_to_status := 'in_progress';
    update public.khpos_ops_staff_corrective_actions
    set status='in_progress',
        verified_by=null,
        verified_at=null,
        updated_at=now()
    where id=v_action.id;

  elsif p_action='cancel' then
    if not v_can_manage then raise exception 'Only the appropriate case manager can cancel corrective action.'; end if;
    if v_action.status in ('verified','cancelled') then
      raise exception 'Verified or cancelled corrective action cannot be cancelled.';
    end if;
    if v_note is null then raise exception 'Explain why the corrective action is being cancelled.'; end if;
    v_to_status := 'cancelled';
    update public.khpos_ops_staff_corrective_actions
    set status='cancelled',
        cancelled_by=p_actor_user_id,
        cancelled_at=now(),
        cancellation_reason=left(v_note,4000),
        updated_at=now()
    where id=v_action.id;

  else
    raise exception 'Unsupported corrective action.';
  end if;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,corrective_action_id,actor_user_id,event_type,
    from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,v_action.id,p_actor_user_id,
    'corrective_'||p_action,v_from_status,v_to_status,left(v_note,4000),
    jsonb_build_object('evidenceReference',v_evidence)
  );
end;
$$;

create or replace function public.khpos_ops_accountability_decide_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_outcome text,
  p_outcome_note text,
  p_authority_review_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_outcome text := lower(nullif(btrim(p_outcome),''));
  v_note text := nullif(btrim(coalesce(p_outcome_note,'')),'');
  v_authority_ref text := nullif(btrim(coalesce(p_authority_review_reference,'')),'');
  v_evidence_count integer := 0;
  v_to_status text;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  if not khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  ) then
    raise exception 'Only the appropriate case manager can decide this case.';
  end if;

  if v_case.status in ('closed','withdrawn','cancelled','referred_formal') then
    raise exception 'This accountability case cannot receive another decision.';
  end if;

  if v_note is null then
    raise exception 'A reasoned outcome note is required.';
  end if;

  select count(*)::integer into v_evidence_count
  from public.khpos_ops_staff_accountability_evidence
  where case_id=v_case.id;

  if v_case.case_type in ('corrective','formal_discipline') then
    if v_case.response_state not in ('submitted','no_response_recorded') then
      raise exception 'Complete the staff response opportunity before a conduct decision.';
    end if;

    if v_case.hearing_required and v_case.hearing_completed_at is null then
      raise exception 'Complete the required hearing step before the disciplinary decision.';
    end if;

    if v_evidence_count=0 then
      raise exception 'Add specific evidence before making a corrective/disciplinary decision.';
    end if;

    if v_case.case_type='corrective' and v_outcome not in (
      'no_action','expectation_reset','documented_reminder','conduct_commitment'
    ) then
      raise exception 'Unsupported corrective-case outcome.';
    end if;

    if v_case.case_type='formal_discipline' and v_outcome not in (
      'no_action','corrective_action','written_warning','final_warning',
      'other_proportionate_action','refer_separation_review'
    ) then
      raise exception 'Unsupported formal disciplinary outcome.';
    end if;

    if v_outcome='refer_separation_review' and v_authority_ref is null then
      raise exception 'A separation recommendation requires a contract/legal/authority review reference; O10 does not terminate employment directly.';
    end if;

    v_to_status := case
      when v_outcome in ('expectation_reset','documented_reminder','conduct_commitment','corrective_action')
        then 'action_active'
      else 'decision_recorded'
    end;

  else
    if v_case.status='external_review_required' then
      raise exception 'This grievance requires independent external review and cannot be decided through the internal reporting line.';
    end if;

    if v_outcome not in (
      'grievance_upheld','grievance_partially_upheld','grievance_not_upheld',
      'grievance_resolved_by_agreement','grievance_referred_other_process'
    ) then
      raise exception 'Unsupported grievance outcome.';
    end if;

    if v_case.subject_staff_id is not null
       and v_case.response_state not in ('submitted','no_response_recorded') then
      raise exception 'Where a grievance names a staff subject, complete the response opportunity before deciding the grievance.';
    end if;

    if v_evidence_count=0 then
      raise exception 'Add specific grievance evidence before recording the outcome.';
    end if;

    v_to_status := 'resolved';
  end if;

  update public.khpos_ops_staff_accountability_cases
  set outcome=v_outcome,
      outcome_note=left(v_note,6000),
      authority_review_reference=left(v_authority_ref,1000),
      decided_by=p_actor_user_id,
      decided_at=now(),
      outcome_delivered_at=now(),
      status=v_to_status,
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,from_status,to_status,note,metadata
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'case_decided',
    v_case.status,v_to_status,left(v_note,6000),
    jsonb_build_object(
      'outcome',v_outcome,
      'authorityReviewReference',v_authority_ref
    )
  );
end;
$$;

create or replace function public.khpos_ops_accountability_acknowledge_outcome_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_allowed boolean := false;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  v_allowed :=
    khpos_private.ops_accountability_case_is_subject(
      p_actor_user_id,p_organisation_id,v_case.id
    )
    or khpos_private.ops_accountability_case_is_reporter(
      p_actor_user_id,p_organisation_id,v_case.id
    );

  if not v_allowed then
    raise exception 'Only the affected staff/reporting party can acknowledge this outcome.';
  end if;

  if v_case.outcome is null or v_case.decided_at is null then
    raise exception 'This case has no recorded outcome to acknowledge.';
  end if;

  if v_case.outcome_acknowledged_at is not null then
    raise exception 'This outcome has already been acknowledged.';
  end if;

  update public.khpos_ops_staff_accountability_cases
  set outcome_acknowledged_by=p_actor_user_id,
      outcome_acknowledged_at=now(),
      updated_at=now()
  where id=v_case.id;

  insert into public.khpos_ops_staff_accountability_responses(
    organisation_id,case_id,response_type,submitted_by,response_text
  ) values (
    p_organisation_id,v_case.id,'outcome_acknowledgement',p_actor_user_id,
    coalesce(left(v_note,4000),'Outcome received. Acknowledgement does not necessarily mean agreement.')
  );

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'outcome_acknowledged',
    coalesce(left(v_note,4000),'Outcome received; acknowledgement is not agreement.')
  );
end;
$$;

create or replace function public.khpos_ops_accountability_case_action_server(
  p_actor_user_id uuid,
  p_organisation_id uuid,
  p_case_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public,auth,khpos_private,pg_temp
as $$
declare
  v_case public.khpos_ops_staff_accountability_cases%rowtype;
  v_is_reporter boolean := false;
  v_can_manage boolean := false;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
  v_from_status text;
  v_to_status text;
begin
  select * into v_case
  from public.khpos_ops_staff_accountability_cases
  where id=p_case_id and organisation_id=p_organisation_id
  for update;

  if v_case.id is null then raise exception 'Accountability case not found.'; end if;

  v_is_reporter := khpos_private.ops_accountability_case_is_reporter(
    p_actor_user_id,p_organisation_id,v_case.id
  );
  v_can_manage := khpos_private.ops_accountability_case_can_manage(
    p_actor_user_id,p_organisation_id,v_case.id
  );
  v_from_status := v_case.status;

  if p_action='acknowledge_grievance' then
    if v_case.case_type<>'grievance' or not v_can_manage then
      raise exception 'Only the appropriate grievance manager can acknowledge this grievance.';
    end if;
    if v_case.status<>'open' then
      raise exception 'Only an open grievance can be acknowledged.';
    end if;
    v_to_status := 'under_review';
    update public.khpos_ops_staff_accountability_cases
    set status='under_review',updated_at=now()
    where id=v_case.id;

  elsif p_action='refer_formal' then
    if v_case.case_type not in ('corrective','grievance') or not v_can_manage then
      raise exception 'Only the appropriate case manager can refer this case to formal discipline.';
    end if;
    if v_note is null then raise exception 'Explain why a separate formal disciplinary case is required.'; end if;
    v_to_status := 'referred_formal';
    update public.khpos_ops_staff_accountability_cases
    set status='referred_formal',updated_at=now()
    where id=v_case.id;

  elsif p_action='resolve_corrective' then
    if v_case.case_type<>'corrective' or not v_can_manage then
      raise exception 'Only the appropriate case manager can resolve a corrective case.';
    end if;
    if exists(
      select 1
      from public.khpos_ops_staff_corrective_actions a
      where a.case_id=v_case.id
        and a.status not in ('verified','cancelled')
    ) then
      raise exception 'Verify or formally cancel open corrective actions before resolving the case.';
    end if;
    if v_note is null then raise exception 'Record why the corrective case is resolved.'; end if;
    v_to_status := 'resolved';
    update public.khpos_ops_staff_accountability_cases
    set status='resolved',updated_at=now()
    where id=v_case.id;

  elsif p_action='withdraw_grievance' then
    if v_case.case_type<>'grievance' or not v_is_reporter then
      raise exception 'Only the reporting staff member can withdraw their grievance.';
    end if;
    if v_case.status in ('resolved','closed','withdrawn','cancelled') then
      raise exception 'This grievance can no longer be withdrawn.';
    end if;
    if v_note is null then raise exception 'Record why the grievance is being withdrawn.'; end if;
    v_to_status := 'withdrawn';
    update public.khpos_ops_staff_accountability_cases
    set status='withdrawn',updated_at=now()
    where id=v_case.id;

  elsif p_action='cancel' then
    if not v_can_manage then
      raise exception 'Only the appropriate case manager can cancel this case.';
    end if;
    if v_case.status in ('closed','withdrawn','cancelled') then
      raise exception 'This case is already closed/withdrawn/cancelled.';
    end if;
    if v_note is null then raise exception 'Record why the case is being cancelled.'; end if;
    v_to_status := 'cancelled';
    update public.khpos_ops_staff_accountability_cases
    set status='cancelled',updated_at=now()
    where id=v_case.id;
    update public.khpos_ops_staff_corrective_actions
    set status='cancelled',
        cancelled_by=p_actor_user_id,
        cancelled_at=now(),
        cancellation_reason=coalesce(cancellation_reason,'Parent case cancelled.'),
        updated_at=now()
    where case_id=v_case.id
      and status not in ('verified','cancelled');

  elsif p_action='close' then
    if not v_can_manage then
      raise exception 'Only the appropriate case manager can close this case.';
    end if;
    if v_case.status not in ('resolved','decision_recorded','referred_formal') then
      raise exception 'Only resolved, decided or formally referred cases can be closed.';
    end if;
    if exists(
      select 1
      from public.khpos_ops_staff_corrective_actions a
      where a.case_id=v_case.id
        and a.status not in ('verified','cancelled')
    ) then
      raise exception 'Open corrective actions must be verified or cancelled before case closure.';
    end if;
    v_to_status := 'closed';
    update public.khpos_ops_staff_accountability_cases
    set status='closed',
        closed_by=p_actor_user_id,
        closed_at=now(),
        updated_at=now()
    where id=v_case.id;

  else
    raise exception 'Unsupported accountability case action.';
  end if;

  insert into public.khpos_ops_staff_accountability_events(
    organisation_id,case_id,actor_user_id,event_type,
    from_status,to_status,note
  ) values (
    p_organisation_id,v_case.id,p_actor_user_id,'case_'||p_action,
    v_from_status,v_to_status,left(v_note,4000)
  );
end;
$$;

revoke execute on function khpos_private.ops_accountability_has_membership(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_staff_for_user(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_can_manage_subject(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_can_manage_grievance(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_case_can_manage(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_case_is_reporter(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_case_is_subject(uuid,uuid,uuid)
  from public,anon,authenticated;
revoke execute on function khpos_private.ops_accountability_case_visible(uuid,uuid,uuid)
  from public,anon,authenticated;

revoke execute on function public.khpos_ops_get_staff_accountability_server(uuid,uuid)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_issue_staff_recognition_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_withdraw_staff_recognition_server(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_accountability_case_server(uuid,uuid,jsonb)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_accountability_request_response_server(uuid,uuid,uuid,timestamptz,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_submit_accountability_response_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_accountability_record_no_response_server(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_add_accountability_evidence_server(uuid,uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_record_accountability_hearing_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_create_corrective_action_server(uuid,uuid,uuid,text,text,text,date)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_corrective_action_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_accountability_decide_server(uuid,uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_accountability_acknowledge_outcome_server(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke execute on function public.khpos_ops_accountability_case_action_server(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;

grant execute on function khpos_private.ops_accountability_has_membership(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_staff_for_user(uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_can_manage_subject(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_can_manage_grievance(uuid,uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_case_can_manage(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_case_is_reporter(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_case_is_subject(uuid,uuid,uuid) to service_role;
grant execute on function khpos_private.ops_accountability_case_visible(uuid,uuid,uuid) to service_role;

grant execute on function public.khpos_ops_get_staff_accountability_server(uuid,uuid) to service_role;
grant execute on function public.khpos_ops_issue_staff_recognition_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_withdraw_staff_recognition_server(uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_create_accountability_case_server(uuid,uuid,jsonb) to service_role;
grant execute on function public.khpos_ops_accountability_request_response_server(uuid,uuid,uuid,timestamptz,text) to service_role;
grant execute on function public.khpos_ops_submit_accountability_response_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_accountability_record_no_response_server(uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_add_accountability_evidence_server(uuid,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.khpos_ops_record_accountability_hearing_server(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.khpos_ops_create_corrective_action_server(uuid,uuid,uuid,text,text,text,date) to service_role;
grant execute on function public.khpos_ops_corrective_action_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_accountability_decide_server(uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.khpos_ops_accountability_acknowledge_outcome_server(uuid,uuid,uuid,text) to service_role;
grant execute on function public.khpos_ops_accountability_case_action_server(uuid,uuid,uuid,text,text) to service_role;
