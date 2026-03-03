do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'app_role'
      and e.enumlabel = 'editor'
  ) then
    alter type public.app_role add value 'editor';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '') = 'admin';
$$;

create table if not exists public.publication_rules (
  id smallint primary key default 1,
  content_md text not null default '',
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint publication_rules_singleton check (id = 1)
);

alter table public.publication_rules enable row level security;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'publication_rules'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "publication_rules_read_all"
on public.publication_rules
for select
using (true);

create policy "publication_rules_write_admin"
on public.publication_rules
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.bump_rules_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists trg_bump_rules_version on public.publication_rules;

create trigger trg_bump_rules_version
before update on public.publication_rules
for each row
execute function public.bump_rules_version();

insert into public.publication_rules (id, content_md)
values (1, '')
on conflict (id) do nothing;
