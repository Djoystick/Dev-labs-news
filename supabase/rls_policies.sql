alter table public.topics enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.reading_history enable row level security;

drop policy if exists "topics_select_public" on public.topics;
create policy "topics_select_public"
on public.topics
for select
to anon, authenticated
using (true);

drop policy if exists "topics_admin_write" on public.topics;
create policy "topics_admin_write"
on public.topics
for all
to authenticated
using (
  public.is_admin(auth.uid())
)
with check (
  public.is_admin(auth.uid())
);

drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public"
on public.posts
for select
to anon, authenticated
using (true);

drop policy if exists "posts_admin_write" on public.posts;
create policy "posts_admin_write"
on public.posts
for all
to authenticated
using (
  public.is_admin(auth.uid())
)
with check (
  public.is_admin(auth.uid())
);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_select_admin_all" on public.profiles;
create policy "profiles_select_admin_all"
on public.profiles
for select
to authenticated
using (
  public.is_admin(auth.uid())
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  and role = 'user'
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = public.current_profile_role(auth.uid())
);

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "reading_history_select_own" on public.reading_history;
create policy "reading_history_select_own"
on public.reading_history
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "reading_history_insert_own" on public.reading_history;
create policy "reading_history_insert_own"
on public.reading_history
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "reading_history_update_own" on public.reading_history;
create policy "reading_history_update_own"
on public.reading_history
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "reading_history_delete_own" on public.reading_history;
create policy "reading_history_delete_own"
on public.reading_history
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "posts_bucket_public_read" on storage.objects;
create policy "posts_bucket_public_read"
on storage.objects
for select
to public
using (bucket_id = 'posts');

drop policy if exists "posts_bucket_admin_insert" on storage.objects;
create policy "posts_bucket_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'posts'
  and public.is_admin(auth.uid())
);

drop policy if exists "posts_bucket_admin_update" on storage.objects;
create policy "posts_bucket_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'posts'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'posts'
  and public.is_admin(auth.uid())
);

drop policy if exists "posts_bucket_admin_delete" on storage.objects;
create policy "posts_bucket_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'posts'
  and public.is_admin(auth.uid())
);

drop policy if exists "avatars_bucket_public_read" on storage.objects;
create policy "avatars_bucket_public_read"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "avatars_bucket_owner_insert" on storage.objects;
create policy "avatars_bucket_owner_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_bucket_owner_update" on storage.objects;
create policy "avatars_bucket_owner_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_bucket_owner_delete" on storage.objects;
create policy "avatars_bucket_owner_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
