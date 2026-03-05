create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  contact text null,
  subject text not null,
  message text not null,
  page text null,
  user_agent text null
);

alter table public.support_requests enable row level security;

drop policy if exists support_requests_insert_auth on public.support_requests;
create policy support_requests_insert_auth
on public.support_requests
for insert
to authenticated
with check (true);

notify pgrst, 'reload schema';
