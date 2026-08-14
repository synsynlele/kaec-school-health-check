revoke all privileges on table public.organisations from authenticated;
revoke all privileges on table public.organisation_memberships from authenticated;
revoke all privileges on table public.khpos_audit_events from authenticated;
revoke all privileges on table public.assessments from authenticated;
revoke all privileges on table public.answers from authenticated;
revoke all privileges on table public.reports from authenticated;

revoke execute on function public.claim_kshc_assessment(uuid) from anon, public;
grant execute on function public.claim_kshc_assessment(uuid) to authenticated;

revoke execute on function public.khpos_is_org_member(uuid) from anon, public;
revoke execute on function public.khpos_has_org_role(uuid, text[]) from anon, public;
revoke execute on function public.khpos_is_assessment_member(uuid) from anon, public;
grant execute on function public.khpos_is_org_member(uuid) to authenticated;
grant execute on function public.khpos_has_org_role(uuid, text[]) to authenticated;
grant execute on function public.khpos_is_assessment_member(uuid) to authenticated;

comment on function public.claim_kshc_assessment(uuid) is 'Intentional authenticated SECURITY DEFINER RPC. It binds auth.uid/auth.jwt email, requires a completed report, checks exact assessment-contact email match, locks the assessment row, and records the claim atomically. No anon execution.';
