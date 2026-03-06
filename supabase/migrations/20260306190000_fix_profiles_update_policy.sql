alter table public.profiles enable row level security;

grant update on table public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

