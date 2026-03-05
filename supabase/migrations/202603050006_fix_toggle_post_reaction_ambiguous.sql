create or replace function public.toggle_post_reaction(p_post_id uuid, p_value smallint)
returns table(post_id uuid, likes int, dislikes int, my_reaction smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
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
      p_post_id as post_id,
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

revoke all on function public.toggle_post_reaction(uuid, smallint) from public;
grant execute on function public.toggle_post_reaction(uuid, smallint) to authenticated;
