do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname = 'public' and tablename in ('topics', 'posts', 'profiles'))
       or (schemaname = 'storage' and tablename = 'objects')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '') = 'admin';
$$;

do $$
begin
  create type public.app_role as enum ('admin', 'user');
exception
  when duplicate_object then
    null;
end
$$;

alter table public.posts
  add column if not exists is_published boolean not null default true;

do $$
declare
  role_udt_name text;
  role_constraint record;
begin
  select c.udt_name
  into role_udt_name
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if role_udt_name is null then
    return;
  end if;

  for role_constraint in
    select con.conname
    from pg_constraint as con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', role_constraint.conname);
  end loop;

  if role_udt_name <> 'app_role' then
    execute $sql$
      alter table public.profiles
      alter column role drop default,
      alter column role type public.app_role
      using (
        case
          when role::text = 'admin' then 'admin'::public.app_role
          when role::text = 'user' then 'user'::public.app_role
          else 'user'::public.app_role
        end
      )
    $sql$;
  end if;
end
$$;

update public.profiles
set role = 'user'::public.app_role
where role is null;

alter table public.profiles
  alter column role set default 'user'::public.app_role,
  alter column role set not null;

alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;

drop policy if exists topics_select_public on public.topics;
create policy topics_select_public
on public.topics
for select
using (true);

drop policy if exists topics_insert_admin on public.topics;
create policy topics_insert_admin
on public.topics
for insert
with check (public.is_admin());

drop policy if exists topics_update_admin on public.topics;
create policy topics_update_admin
on public.topics
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists topics_delete_admin on public.topics;
create policy topics_delete_admin
on public.topics
for delete
using (public.is_admin());

drop policy if exists posts_select_published_or_admin on public.posts;
create policy posts_select_published_or_admin
on public.posts
for select
using (is_published = true or public.is_admin());

drop policy if exists posts_insert_admin on public.posts;
create policy posts_insert_admin
on public.posts
for insert
with check (public.is_admin());

drop policy if exists posts_update_admin on public.posts;
create policy posts_update_admin
on public.posts
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists posts_delete_admin on public.posts;
create policy posts_delete_admin
on public.posts
for delete
using (public.is_admin());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Posts bucket read" on storage.objects;
create policy "Posts bucket read"
on storage.objects
for select
using (bucket_id = 'posts');

drop policy if exists "Admin can manage posts bucket" on storage.objects;
create policy "Admin can manage posts bucket"
on storage.objects
for all
using (public.is_admin() and bucket_id = 'posts')
with check (public.is_admin() and bucket_id = 'posts');
