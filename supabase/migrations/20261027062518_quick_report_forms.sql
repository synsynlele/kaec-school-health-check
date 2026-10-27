-- Additive form capabilities. Existing templates, report snapshots and history are unchanged.
alter table public.kaec_hq_reporting_submissions add column quick_answers jsonb;
alter table public.kaec_hq_reporting_submissions add constraint hq_quick_answers_object check(quick_answers is null or (jsonb_typeof(quick_answers)='object' and length(quick_answers::text)<5000));

create or replace function khpos_private.report_validate_fields(p_fields jsonb,p_payload jsonb default null) returns void language plpgsql set search_path='' as $$
declare f jsonb; parent jsonb; rule jsonb; k text; v jsonb; seen text[]:='{}'; visible text[]:='{}'; show boolean; val jsonb;
begin
 if jsonb_typeof(p_fields) is distinct from 'array' then raise exception 'Use 1 to 30 report fields.'; end if;
 if jsonb_array_length(p_fields) not between 1 and 30 then raise exception 'Use 1 to 30 report fields.'; end if;
 if p_payload is not null and (jsonb_typeof(p_payload) is distinct from 'object' or length(p_payload::text)>100000) then raise exception 'Report answers must be an object under 100 KB.'; end if;
 for f in select value from jsonb_array_elements(p_fields) loop
  k:=f->>'key'; rule:=f->'showWhen'; show:=true;
  if jsonb_typeof(f) is distinct from 'object' or k is null or k!~'^[a-zA-Z][a-zA-Z0-9_]{0,49}$' or k=any(seen) or length(btrim(coalesce(f->>'label',''))) not between 1 and 160 or coalesce(f->>'type','') not in ('text','textarea','number','date','boolean','select','multiselect','url') then raise exception 'Every report field needs a unique key, label and supported type.'; end if;
  if f ? 'required' and jsonb_typeof(f->'required')<>'boolean' then raise exception 'Required must be Yes or No.'; end if;
  if f->>'type' in ('select','multiselect') then
   if jsonb_typeof(f->'options') is distinct from 'array' then raise exception 'Choice fields need 1 to 30 options.'; end if;
   if jsonb_array_length(f->'options') not between 1 and 30 then raise exception 'Choice fields need 1 to 30 options.'; end if;
   if exists(select 1 from jsonb_array_elements(f->'options') opt where jsonb_typeof(opt)<>'string' or length(btrim(opt#>>'{}')) not between 1 and 160) or (select count(*)<>count(distinct opt) from jsonb_array_elements(f->'options') opt) then raise exception 'Choice options must be unique non-empty text of up to 160 characters.'; end if;
  end if;
  if rule is not null and rule<>'null'::jsonb then
   if jsonb_typeof(rule) is distinct from 'object' or not coalesce((rule->>'key')=any(seen),false) then raise exception 'A follow-up must refer to an earlier choice question.'; end if;
   select value into parent from jsonb_array_elements(p_fields) where value->>'key'=rule->>'key';
   val:=rule->'value';
   if parent->>'type'='boolean' then
    if jsonb_typeof(val) is distinct from 'boolean' then raise exception 'A Yes/No follow-up needs a Yes/No answer.'; end if;
   elsif parent->>'type' in ('select','multiselect') then
    if val is null or jsonb_typeof(val)<>'string' or not ((parent->'options') @> jsonb_build_array(val)) then raise exception 'Choose a valid follow-up answer.'; end if;
   else raise exception 'A follow-up must refer to a choice question.';
   end if;
   if p_payload is not null then
    show:=coalesce((rule->>'key')=any(visible),false) and case when parent->>'type'='multiselect' then coalesce((p_payload->(rule->>'key')) @> jsonb_build_array(val),false) else coalesce((p_payload->(rule->>'key'))=val,false) end;
   end if;
  end if;
  seen:=array_append(seen,k);
  if show then visible:=array_append(visible,k); end if;
  if p_payload is not null then
   v:=p_payload->k;
   if not show then
    if v is not null and v not in ('null'::jsonb,'""'::jsonb,'[]'::jsonb) then raise exception 'Remove answers to hidden follow-up questions.'; end if;
    continue;
   end if;
   if coalesce((f->>'required')::boolean,false) and (v is null or v='null'::jsonb or v='[]'::jsonb or (jsonb_typeof(v)='string' and btrim(v#>>'{}')='')) then raise exception 'Complete the required field: %',f->>'label'; end if;
   if v is not null and v<>'null'::jsonb and v<>'""'::jsonb then
    if f->>'type'='multiselect' then
     if jsonb_typeof(v)<>'array' then raise exception '% must be a list of choices.',f->>'label'; end if;
     if jsonb_array_length(v)>30 or exists(select 1 from jsonb_array_elements(v) opt where jsonb_typeof(opt)<>'string' or not ((f->'options') @> jsonb_build_array(opt))) or (select count(*)<>count(distinct opt) from jsonb_array_elements(v) opt) then raise exception 'Choose distinct available options for %.',f->>'label'; end if;
     if jsonb_array_length(v)>1 and (v ?| array['None this period','No work this period','Not applicable']) then raise exception 'Choose either none/not applicable or the relevant work options.'; end if;
    else
     if f->>'type'='number' and jsonb_typeof(v)<>'number' then raise exception '% must be a number.',f->>'label'; end if;
     if f->>'type'='boolean' and jsonb_typeof(v)<>'boolean' then raise exception '% must be Yes or No.',f->>'label'; end if;
     if f->>'type' not in ('number','boolean') and jsonb_typeof(v)<>'string' then raise exception '% must be text.',f->>'label'; end if;
     if length(v#>>'{}')>12000 then raise exception 'An answer exceeds 12,000 characters.'; end if;
     if f->>'type'='select' and not ((f->'options') @> jsonb_build_array(v)) then raise exception 'Choose an available option for %.',f->>'label'; end if;
     if f->>'type'='date' then perform (v#>>'{}')::date; end if;
     if f->>'type'='url' and (v#>>'{}')!~'^https://[^[:space:]@]+$' then raise exception 'Evidence links must use HTTPS without credentials.'; end if;
    end if;
   end if;
  end if;
 end loop;
 if p_payload is not null and exists(select 1 from jsonb_object_keys(p_payload) x where not x=any(seen)) then raise exception 'Report contains fields outside its saved form.'; end if;
end $$;
revoke all on function khpos_private.report_validate_fields(jsonb,jsonb) from public,anon,authenticated;
