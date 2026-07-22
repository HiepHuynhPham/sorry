-- Secure MVP case builder. Run after 002_admin_center.sql.
begin;

create or replace function public.create_case_draft(p_payload jsonb)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare
  new_id bigint;
  number_text text := btrim(p_payload->>'case_number');
  generated_slug text;
  dodge smallint := coalesce((p_payload->>'dodge_limit')::smallint,2);
begin
  if not public.is_site_admin() then raise exception 'forbidden'; end if;
  if p_payload is null or octet_length(p_payload::text) > 20000 then raise exception 'invalid_payload_size'; end if;
  if number_text !~ '^[0-9]{3}$' then raise exception 'invalid_case_number'; end if;
  generated_slug := 'case-' || number_text;
  if exists(select 1 from cases where case_number=number_text or slug=generated_slug) then raise exception 'case_number_exists'; end if;
  if coalesce(char_length(btrim(p_payload->>'title')),0) not between 3 and 100 then raise exception 'invalid_title'; end if;
  if coalesce(char_length(btrim(p_payload->>'recipient_name')),0) not between 1 and 60 then raise exception 'invalid_recipient'; end if;
  if coalesce(char_length(btrim(p_payload->>'short_description')),0) not between 3 and 180 then raise exception 'invalid_description'; end if;
  if dodge not between 0 and 6 then raise exception 'invalid_dodge_limit'; end if;
  if jsonb_typeof(p_payload->'content') <> 'object' or jsonb_typeof(p_payload->'theme') <> 'object' or jsonb_typeof(p_payload->'audio_settings') <> 'object' then raise exception 'invalid_payload'; end if;

  insert into cases(slug,case_number,recipient_name,recipient_display_name,title,short_description,status,visibility,content,theme,audio_settings,dodge_limit,is_enabled,created_by)
  values(generated_slug,number_text,btrim(p_payload->>'recipient_name'),left(btrim(coalesce(p_payload->>'recipient_display_name',p_payload->>'recipient_name')),60),btrim(p_payload->>'title'),btrim(p_payload->>'short_description'),'draft','admin_only',p_payload->'content',p_payload->'theme',p_payload->'audio_settings',dodge,true,auth.uid())
  returning id into new_id;
  insert into audit_logs(action,entity_type,entity_id,metadata,created_by) values('create','case',new_id,jsonb_build_object('case_number',number_text,'status','draft'),auth.uid());
  return new_id;
end $$;

revoke all on function public.create_case_draft(jsonb) from public;
grant execute on function public.create_case_draft(jsonb) to authenticated;

commit;
notify pgrst,'reload schema';
