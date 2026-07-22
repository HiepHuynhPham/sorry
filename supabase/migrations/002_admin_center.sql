-- Admin Center migration. Run after schema.sql in Supabase SQL Editor.
begin;

alter table public.cases
  add column if not exists recipient_name text not null default '',
  add column if not exists recipient_display_name text not null default '',
  add column if not exists status text not null default 'draft' check (status in ('draft','published','reconciled','archived')),
  add column if not exists visibility text not null default 'admin_only' check (visibility in ('public','private_link','admin_only')),
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists theme jsonb not null default '{}'::jsonb,
  add column if not exists audio_settings jsonb not null default '{"enabled":true,"style":"music_box","music_volume":0.18,"effect_volume":0.34}'::jsonb,
  add column if not exists dodge_limit smallint not null default 2 check (dodge_limit between 0 and 6),
  add column if not exists private_token_hash text,
  add column if not exists created_by uuid references auth.users(id);

update public.cases set
  status = case when id=(select active_case_id from public.site_settings where id=1) then 'published' else 'draft' end,
  visibility = case when id=(select active_case_id from public.site_settings where id=1) then 'public' else 'admin_only' end,
  recipient_name = case slug when 'case-002' then 'Ý' else 'Nhỏ em' end,
  recipient_display_name = case slug when 'case-002' then 'Em Ý' else 'Nhỏ em' end,
  dodge_limit = case slug when 'case-001' then 4 else 2 end;

alter table public.site_settings
  add column if not exists maintenance_mode boolean not null default false,
  add column if not exists global_audio_enabled boolean not null default true,
  add column if not exists safe_mode boolean not null default false;

create table if not exists public.case_responses (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(id) on delete restrict,
  response_type text not null check (response_type in ('forgiven','still_angry','need_time','food')),
  message text check (message is null or char_length(message) between 1 and 300),
  anonymous_session_id uuid not null,
  is_read boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.case_views (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(id) on delete restrict,
  anonymous_session_id uuid not null,
  device_type text not null check (device_type in ('desktop','mobile')),
  created_at timestamptz not null default now()
);

create table if not exists public.case_versions (
  id bigint generated always as identity primary key,
  case_id bigint not null references public.cases(id) on delete restrict,
  version_number integer not null,
  snapshot jsonb not null,
  change_summary text not null default 'Cập nhật hồ sơ',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(case_id,version_number)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text not null,
  entity_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists case_responses_case_created_idx on public.case_responses(case_id,created_at desc);
create index if not exists case_responses_unread_idx on public.case_responses(is_read) where not is_read and not is_archived;
create index if not exists case_views_dedupe_idx on public.case_views(case_id,anonymous_session_id,created_at desc);
create index if not exists case_versions_case_idx on public.case_versions(case_id,version_number desc);
create unique index if not exists cases_one_published_idx on public.cases((status)) where status='published';

alter table public.case_responses enable row level security;
alter table public.case_views enable row level security;
alter table public.case_versions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "public reads active case" on public.cases;
drop policy if exists "public reads active setting" on public.site_settings;
revoke select on public.site_settings from anon;
revoke select on public.cases from anon;

create or replace function public.active_public_case_id() returns bigint language sql stable security definer set search_path=public,pg_temp as $$
  select active_case_id from site_settings where id=1 and not maintenance_mode
$$;
create or replace function public.get_public_site_state()
returns table(active_case_id bigint,maintenance_mode boolean,global_audio_enabled boolean,safe_mode boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  select s.active_case_id,s.maintenance_mode,s.global_audio_enabled,s.safe_mode from site_settings s where s.id=1
$$;
create policy "public reads active case" on public.cases for select to anon using (
  is_enabled and status='published' and visibility='public'
  and id=public.active_public_case_id()
);
create policy "admin manages cases" on public.cases for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "admin manages responses" on public.case_responses for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "admin reads views" on public.case_views for select to authenticated using (public.is_site_admin());
create policy "admin manages versions" on public.case_versions for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "admin reads audit" on public.audit_logs for select to authenticated using (public.is_site_admin());

revoke all on public.case_responses,public.case_views,public.case_versions,public.audit_logs from anon;
grant select(id,slug,case_number,recipient_name,recipient_display_name,title,short_description,status,visibility,content,theme,audio_settings,dodge_limit,is_enabled,created_at,updated_at) on public.cases to anon;
grant select,insert,update on public.case_responses to authenticated;
grant select on public.case_views,public.audit_logs to authenticated;
grant select,insert on public.case_versions to authenticated;
grant select,insert,update on public.cases to authenticated;
grant select,update on public.site_settings to authenticated;

-- Anonymous writes only through these security-definer functions. They never expose other responses.
create or replace function public.submit_case_response(p_case_id bigint,p_response_type text,p_message text,p_session_id uuid)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare new_id bigint; clean_message text;
begin
  if p_response_type not in ('forgiven','still_angry','need_time','food') then raise exception 'invalid_response'; end if;
  clean_message := nullif(btrim(p_message),'');
  if clean_message is not null and char_length(clean_message)>300 then raise exception 'message_too_long'; end if;
  if not exists(select 1 from cases c join site_settings s on s.active_case_id=c.id where s.id=1 and c.id=p_case_id and c.status='published' and c.visibility='public' and c.is_enabled) then raise exception 'case_not_public'; end if;
  if (select count(*) from case_responses where anonymous_session_id=p_session_id and created_at>now()-interval '24 hours')>=3 then raise exception 'rate_limited'; end if;
  insert into case_responses(case_id,response_type,message,anonymous_session_id) values(p_case_id,p_response_type,clean_message,p_session_id) returning id into new_id;
  return new_id;
end $$;

create or replace function public.record_case_view(p_case_id bigint,p_session_id uuid,p_device_type text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_device_type not in ('desktop','mobile') then raise exception 'invalid_device'; end if;
  if not exists(select 1 from cases c join site_settings s on s.active_case_id=c.id where s.id=1 and c.id=p_case_id and c.status='published' and c.visibility='public' and c.is_enabled) then return false; end if;
  if exists(select 1 from case_views where case_id=p_case_id and anonymous_session_id=p_session_id and created_at>now()-interval '6 hours') then return false; end if;
  insert into case_views(case_id,anonymous_session_id,device_type) values(p_case_id,p_session_id,p_device_type); return true;
end $$;

create or replace function public.publish_case(p_case_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare old_id bigint;
begin
  if not public.is_site_admin() then raise exception 'forbidden'; end if;
  if not exists(select 1 from cases where id=p_case_id and is_enabled) then raise exception 'case_not_found'; end if;
  select active_case_id into old_id from site_settings where id=1 for update;
  update cases set status='draft',visibility='admin_only',updated_at=now() where id=old_id and id<>p_case_id and status='published';
  update cases set status='published',visibility='public',updated_at=now() where id=p_case_id;
  update site_settings set active_case_id=p_case_id,updated_by=auth.uid(),updated_at=now() where id=1;
  insert into audit_logs(action,entity_type,entity_id,metadata,created_by) values('publish','case',p_case_id,jsonb_build_object('previous_case_id',old_id),auth.uid());
end $$;

revoke all on function public.active_public_case_id() from public;
revoke all on function public.get_public_site_state() from public;
revoke all on function public.submit_case_response(bigint,text,text,uuid) from public;
revoke all on function public.record_case_view(bigint,uuid,text) from public;
revoke all on function public.publish_case(bigint) from public;
grant execute on function public.active_public_case_id() to anon,authenticated;
grant execute on function public.get_public_site_state() to anon,authenticated;
grant execute on function public.submit_case_response(bigint,text,text,uuid) to anon,authenticated;
grant execute on function public.record_case_view(bigint,uuid,text) to anon,authenticated;
grant execute on function public.publish_case(bigint) to authenticated;

-- Snapshot every admin update before it changes the row; newer history is never deleted.
create or replace function public.version_case_before_update() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare next_version integer;
begin
  if auth.uid() is not null and public.is_site_admin() then
    select coalesce(max(version_number),0)+1 into next_version from case_versions where case_id=old.id;
    insert into case_versions(case_id,version_number,snapshot,change_summary,created_by) values(old.id,next_version,to_jsonb(old),'Tự động lưu trước cập nhật',auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists cases_version_before_update on public.cases;
create trigger cases_version_before_update before update on public.cases for each row execute function public.version_case_before_update();

commit;
