-- 1) Ensure enum value 'editor' exists in public.app_role
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

-- 2) Helpers based on JWT claim app_role (NOT on table column)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role','') = 'admin';
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role','') = 'editor';
$$;

-- 3) Make sure RLS is enabled
alter table public.posts enable row level security;

-- 4) Drop ALL existing policies on public.posts to avoid conflicts
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'posts'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- 5) Recreate policies

-- Read:
-- - everyone: published
-- - admin: everything
-- - editor: own posts (including drafts)
create policy "posts_select"
on public.posts
for select
using (
  is_published = true
  or public.is_admin()
  or (public.is_editor() and author_id = auth.uid())
);

-- Insert:
-- - admin can insert any
create policy "posts_insert_admin"
on public.posts
for insert
with check (public.is_admin());

-- - editor can insert only own posts (author_id must be set to auth.uid())
create policy "posts_insert_editor_own"
on public.posts
for insert
with check (public.is_editor() and author_id = auth.uid());

-- Update:
-- - admin any
create policy "posts_update_admin"
on public.posts
for update
using (public.is_admin())
with check (public.is_admin());

-- - editor only own
create policy "posts_update_editor_own"
on public.posts
for update
using (public.is_editor() and author_id = auth.uid())
with check (public.is_editor() and author_id = auth.uid());

-- Delete:
-- - admin any
create policy "posts_delete_admin"
on public.posts
for delete
using (public.is_admin());

-- - editor only own
create policy "posts_delete_editor_own"
on public.posts
for delete
using (public.is_editor() and author_id = auth.uid());