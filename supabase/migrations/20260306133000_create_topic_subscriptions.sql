create table if not exists public.topic_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists topic_subscriptions_topic_id_idx
on public.topic_subscriptions(topic_id);

create index if not exists topic_subscriptions_user_id_idx
on public.topic_subscriptions(user_id);

alter table public.topic_subscriptions enable row level security;

drop policy if exists topic_subscriptions_select_own on public.topic_subscriptions;
create policy topic_subscriptions_select_own
on public.topic_subscriptions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists topic_subscriptions_insert_own on public.topic_subscriptions;
create policy topic_subscriptions_insert_own
on public.topic_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists topic_subscriptions_delete_own on public.topic_subscriptions;
create policy topic_subscriptions_delete_own
on public.topic_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';
