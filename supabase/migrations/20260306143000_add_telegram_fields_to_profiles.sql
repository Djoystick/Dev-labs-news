alter table public.profiles
  add column if not exists telegram_user_id bigint null,
  add column if not exists telegram_notifications_enabled boolean not null default false,
  add column if not exists telegram_linked_at timestamptz null;

