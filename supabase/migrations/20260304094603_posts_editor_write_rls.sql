-- 20260304094603_posts_editor_write_rls.sql
-- Allow editors to manage ONLY their own posts (admin keeps full access)
-- Backend-only fix: RLS policies for public.posts

-- --- Helpers ---------------------------------------------------------------

-- Admin role check helper (bypasses profiles RLS safely)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- Editor role check helper (bypasses profiles RLS safely)
create or replace function public.is_editor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'editor'
  );
$$;

revoke all on function public.is_editor(uuid) from public;
grant execute on function public.is_editor(uuid) to authenticated;

-- --- Policies on public.posts ---------------------------------------------
-- NOTE: These policies are permissive. They add editor rights without removing admin rights.

-- INSERT: admin OR editor inserting own post
drop policy if exists posts_insert_editor on public.posts;
create policy posts_insert_editor
on public.posts
for insert
to authenticated
with check (
  public.is_admin(auth.uid())
  OR (public.is_editor(auth.uid()) AND author_id = auth.uid())
);

-- UPDATE: admin OR editor updating own post
drop policy if exists posts_update_editor on public.posts;
create policy posts_update_editor
on public.posts
for update
to authenticated
using (
  public.is_admin(auth.uid())
  OR (public.is_editor(auth.uid()) AND author_id = auth.uid())
)
with check (
  public.is_admin(auth.uid())
  OR (public.is_editor(auth.uid()) AND author_id = auth.uid())
);

-- DELETE: admin OR editor deleting own post
drop policy if exists posts_delete_editor on public.posts;
create policy posts_delete_editor
on public.posts
for delete
to authenticated
using (
  public.is_admin(auth.uid())
  OR (public.is_editor(auth.uid()) AND author_id = auth.uid())
);