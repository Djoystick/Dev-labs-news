create table if not exists public.user_topic_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists user_topic_preferences_topic_id_idx
on public.user_topic_preferences(topic_id);

create index if not exists user_topic_preferences_user_id_idx
on public.user_topic_preferences(user_id);

alter table public.user_topic_preferences enable row level security;

drop policy if exists user_topic_preferences_select_own on public.user_topic_preferences;

create policy user_topic_preferences_select_own
on public.user_topic_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists user_topic_preferences_insert_own on public.user_topic_preferences;

create policy user_topic_preferences_insert_own
on public.user_topic_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists user_topic_preferences_delete_own on public.user_topic_preferences;

create policy user_topic_preferences_delete_own
on public.user_topic_preferences
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.set_my_topics(topic_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null';
  end if;

  delete from public.user_topic_preferences
  where user_id = v_uid;

  if coalesce(array_length(topic_ids, 1), 0) > 0 then
    insert into public.user_topic_preferences (user_id, topic_id)
    select v_uid, t.topic_id
    from (
      select distinct topic_id
      from unnest(topic_ids) as t(topic_id)
      where topic_id is not null
    ) as t;

    get diagnostics v_inserted = row_count;
  end if;

  return v_inserted;
end;
$$;
