create table if not exists public.topic_notification_deliveries (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists topic_notification_deliveries_post_id_idx
on public.topic_notification_deliveries(post_id);

create index if not exists topic_notification_deliveries_user_id_idx
on public.topic_notification_deliveries(user_id);

alter table public.topic_notification_deliveries enable row level security;

drop policy if exists topic_notification_deliveries_select_own on public.topic_notification_deliveries;
create policy topic_notification_deliveries_select_own
on public.topic_notification_deliveries
for select
to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';

