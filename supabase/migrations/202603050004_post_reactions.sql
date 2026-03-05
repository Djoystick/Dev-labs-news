create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_reactions enable row level security;

drop policy if exists post_reactions_select_own on public.post_reactions;
create policy post_reactions_select_own
  on public.post_reactions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists post_reactions_insert_own on public.post_reactions;
create policy post_reactions_insert_own
  on public.post_reactions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists post_reactions_update_own on public.post_reactions;
create policy post_reactions_update_own
  on public.post_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists post_reactions_delete_own on public.post_reactions;
create policy post_reactions_delete_own
  on public.post_reactions for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.get_post_reaction_summaries(p_post_ids uuid[])
returns table(post_id uuid, likes int, dislikes int, my_reaction smallint)
language sql
stable
security definer
set search_path = public
as $$
  with uid as (select auth.uid() as id)
  select
    p.id as post_id,
    coalesce(sum(case when r.value = 1 then 1 else 0 end), 0)::int as likes,
    coalesce(sum(case when r.value = -1 then 1 else 0 end), 0)::int as dislikes,
    coalesce(max(case when (select id from uid) is not null and r.user_id = (select id from uid) then r.value end), 0)::smallint as my_reaction
  from unnest(p_post_ids) as p(id)
  left join public.post_reactions r on r.post_id = p.id
  group by p.id;
$$;

grant execute on function public.get_post_reaction_summaries(uuid[]) to anon, authenticated;

create or replace function public.toggle_post_reaction(p_post_id uuid, p_value smallint)
returns table(post_id uuid, likes int, dislikes int, my_reaction smallint)
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_value not in (-1, 1) then
    raise exception 'invalid reaction';
  end if;

  if exists (
    select 1 from public.post_reactions
    where post_id = p_post_id and user_id = uid and value = p_value
  ) then
    delete from public.post_reactions
    where post_id = p_post_id and user_id = uid;
  else
    insert into public.post_reactions(post_id, user_id, value)
    values (p_post_id, uid, p_value)
    on conflict (post_id, user_id) do update
      set value = excluded.value;
  end if;

  return query
    select
      p_post_id,
      count(*) filter (where value = 1)::int as likes,
      count(*) filter (where value = -1)::int as dislikes,
      coalesce((select value from public.post_reactions where post_id = p_post_id and user_id = uid), 0)::smallint as my_reaction
    from public.post_reactions
    where post_id = p_post_id;
end;
$$;

revoke all on function public.toggle_post_reaction(uuid, smallint) from public;
grant execute on function public.toggle_post_reaction(uuid, smallint) to authenticated;
