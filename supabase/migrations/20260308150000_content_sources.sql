create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'rss',
  url text not null,
  is_enabled boolean not null default true,
  default_topic_id uuid null references public.topics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles (id) on delete set null,
  updated_by uuid null references public.profiles (id) on delete set null,
  constraint content_sources_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint content_sources_type_check check (type in ('rss')),
  constraint content_sources_url_scheme_check check (url ~* '^https?://')
);

create unique index if not exists content_sources_url_unique_idx
  on public.content_sources ((lower(url)));

create index if not exists content_sources_enabled_idx
  on public.content_sources (is_enabled);

create index if not exists content_sources_default_topic_idx
  on public.content_sources (default_topic_id);

create or replace function public.normalize_content_source_row()
returns trigger
language plpgsql
as $$
begin
  new.title := btrim(coalesce(new.title, ''));
  new.type := lower(btrim(coalesce(new.type, 'rss')));
  new.url := btrim(coalesce(new.url, ''));

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_normalize_content_source_row on public.content_sources;

create trigger trg_normalize_content_source_row
before insert or update on public.content_sources
for each row
execute function public.normalize_content_source_row();

alter table public.content_sources enable row level security;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'content_sources'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "content_sources_read_admin"
on public.content_sources
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "content_sources_insert_admin"
on public.content_sources
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "content_sources_update_admin"
on public.content_sources
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "content_sources_delete_admin"
on public.content_sources
for delete
to authenticated
using (public.is_admin(auth.uid()));
