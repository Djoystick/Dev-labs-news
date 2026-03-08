create table if not exists public.ai_import_settings (
  id smallint primary key default 1,
  primary_model text not null default 'qwen-3-235b-a22b-instruct-2507',
  fallback_model text not null default 'gpt-oss-120b',
  rewrite_mode text not null default 'conservative',
  result_length text not null default 'standard',
  max_tags smallint not null default 5,
  use_source_image boolean not null default true,
  dedupe_mode text not null default 'strict_url',
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint ai_import_settings_singleton check (id = 1),
  constraint ai_import_settings_primary_model_check check (
    primary_model in ('qwen-3-235b-a22b-instruct-2507', 'gpt-oss-120b')
  ),
  constraint ai_import_settings_fallback_model_check check (
    fallback_model in ('qwen-3-235b-a22b-instruct-2507', 'gpt-oss-120b')
  ),
  constraint ai_import_settings_rewrite_mode_check check (
    rewrite_mode in ('conservative', 'balanced', 'aggressive')
  ),
  constraint ai_import_settings_result_length_check check (
    result_length in ('short', 'standard', 'long')
  ),
  constraint ai_import_settings_max_tags_check check (
    max_tags between 1 and 5
  ),
  constraint ai_import_settings_dedupe_mode_check check (
    dedupe_mode in ('strict_url', 'url_and_soft_title')
  )
);

alter table public.ai_import_settings enable row level security;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_import_settings'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "ai_import_settings_read_admin"
on public.ai_import_settings
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "ai_import_settings_write_admin"
on public.ai_import_settings
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create or replace function public.bump_ai_import_settings_metadata()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists trg_bump_ai_import_settings_metadata on public.ai_import_settings;

create trigger trg_bump_ai_import_settings_metadata
before update on public.ai_import_settings
for each row
execute function public.bump_ai_import_settings_metadata();

insert into public.ai_import_settings (
  id,
  primary_model,
  fallback_model,
  rewrite_mode,
  result_length,
  max_tags,
  use_source_image,
  dedupe_mode
)
values (
  1,
  'qwen-3-235b-a22b-instruct-2507',
  'gpt-oss-120b',
  'conservative',
  'standard',
  5,
  true,
  'strict_url'
)
on conflict (id) do nothing;
