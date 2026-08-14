drop policy if exists organisations_member_select on public.organisations;
drop policy if exists organisations_lead_update on public.organisations;
drop policy if exists memberships_member_select on public.organisation_memberships;
drop policy if exists audit_member_select on public.khpos_audit_events;
drop policy if exists assessments_org_member_select on public.assessments;
drop policy if exists answers_org_member_select on public.answers;
drop policy if exists reports_org_member_select on public.reports;

drop function if exists public.khpos_is_assessment_member(uuid);
drop function if exists public.khpos_has_org_role(uuid, text[]);
drop function if exists public.khpos_is_org_member(uuid);

comment on table public.organisations is 'Canonical KHP-OS institution identity. Server-mediated access only in Stage 1B; RLS enabled with no client policies.';
comment on table public.organisation_memberships is 'Institution-scoped KHP-OS authority. Server-mediated access only in Stage 1B; RLS enabled with no client policies.';
