alter table public.favorites enable row level security;
alter table public.reading_history enable row level security;
alter table public.topics enable row level security;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists favorites_user_id_created_at_idx
on public.favorites (user_id, created_at desc);

drop policy if exists reading_history_select_own on public.reading_history;
create policy reading_history_select_own
on public.reading_history
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists reading_history_insert_own on public.reading_history;
create policy reading_history_insert_own
on public.reading_history
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists reading_history_update_own on public.reading_history;
create policy reading_history_update_own
on public.reading_history
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists reading_history_user_last_read_idx
on public.reading_history (user_id, last_read_at desc);

create index if not exists reading_history_user_post_idx
on public.reading_history (user_id, post_id);

drop policy if exists topics_select_public on public.topics;
create policy topics_select_public
on public.topics
for select
to public
using (true);

drop policy if exists topics_write_admin on public.topics;
create policy topics_write_admin
on public.topics
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
