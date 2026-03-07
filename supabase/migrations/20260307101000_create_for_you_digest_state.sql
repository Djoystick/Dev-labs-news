create table if not exists public.for_you_digest_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_bucket integer not null default 0 check (current_bucket >= 0),
  last_notified_count integer not null default 0 check (last_notified_count >= 0),
  last_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_for_you_digest_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_for_you_digest_state_updated_at on public.for_you_digest_state;

create trigger trg_for_you_digest_state_updated_at
before update on public.for_you_digest_state
for each row
execute function public.set_for_you_digest_state_updated_at();

alter table public.for_you_digest_state enable row level security;

revoke all on table public.for_you_digest_state from anon, authenticated;
grant select, insert, update, delete on table public.for_you_digest_state to service_role;

notify pgrst, 'reload schema';
