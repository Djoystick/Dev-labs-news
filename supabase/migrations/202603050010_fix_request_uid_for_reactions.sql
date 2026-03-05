-- helper: try to extract user id from multiple claim locations
create or replace function public._request_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
  claims jsonb;
begin
  -- old-style setting (what auth.uid() uses)
  v := nullif(current_setting('request.jwt.claim.sub', true), '');
  if v is not null then
    return v::uuid;
  end if;

  -- new-style setting (PostgREST can store claims JSON here)
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;

  if claims is null then
    return null;
  end if;

  v := nullif(coalesce(
    claims->>'sub',
    claims->>'user_id',
    claims->>'uid',
    claims->>'id'
  ), '');

  if v is null then
    return null;
  end if;

  return v::uuid;
end;
$$;

-- patch internal impl to use _request_uid()
create or replace function public._toggle_post_reaction_impl(p_post_id uuid, p_value smallint)
returns table(out_post_id uuid, likes int, dislikes int, my_reaction smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public._request_uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_value not in (-1, 1) then
    raise exception 'invalid reaction';
  end if;

  if exists (
    select 1
    from public.post_reactions pr
    where pr.post_id = p_post_id
      and pr.user_id = v_uid
      and pr.value = p_value
  ) then
    delete from public.post_reactions pr
    where pr.post_id = p_post_id
      and pr.user_id = v_uid;
  else
    insert into public.post_reactions(post_id, user_id, value)
    values (p_post_id, v_uid, p_value)
    on conflict (post_id, user_id) do update
      set value = excluded.value;
  end if;

  return query
    select
      p_post_id as out_post_id,
      count(*) filter (where pr.value = 1)::int as likes,
      count(*) filter (where pr.value = -1)::int as dislikes,
      coalesce(
        (select pr2.value
         from public.post_reactions pr2
         where pr2.post_id = p_post_id and pr2.user_id = v_uid),
        0
      )::smallint as my_reaction
    from public.post_reactions pr
    where pr.post_id = p_post_id;
end;
$$;

-- also patch summaries to compute my_reaction using same uid (otherwise my_reaction can be stuck at 0)
create or replace function public.get_post_reaction_summaries(p_post_ids uuid[])
returns table(post_id uuid, likes int, dislikes int, my_reaction smallint)
language sql
stable
security definer
set search_path = public
as $$
  with uid as (select public._request_uid() as id)
  select
    p.id as post_id,
    coalesce(sum(case when r.value = 1 then 1 else 0 end), 0)::int as likes,
    coalesce(sum(case when r.value = -1 then 1 else 0 end), 0)::int as dislikes,
    coalesce(max(case when (select id from uid) is not null and r.user_id = (select id from uid) then r.value end), 0)::smallint as my_reaction
  from unnest(p_post_ids) as p(id)
  left join public.post_reactions r on r.post_id = p.id
  group by p.id;
$$;

-- keep permissions as intended
grant execute on function public.get_post_reaction_summaries(uuid[]) to anon, authenticated;
revoke all on function public.toggle_post_reaction(uuid, smallint) from public;
grant execute on function public.toggle_post_reaction(uuid, smallint) to authenticated;

notify pgrst, 'reload schema';