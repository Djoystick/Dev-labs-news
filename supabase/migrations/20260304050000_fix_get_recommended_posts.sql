create index if not exists posts_published_topic_created_idx
on public.posts (topic_id, created_at desc)
where is_published = true;

create index if not exists favorites_user_post_idx
on public.favorites (user_id, post_id);

create or replace function public.get_recommended_posts(p_limit int default 20)
returns setof public.posts
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    return query
    select p.*
    from public.posts as p
    where p.is_published = true
    order by p.created_at desc
    limit p_limit;
  end if;

  return query
  select p.*
  from public.posts as p
  where p.is_published = true
    and not exists (
      select 1
      from public.favorites as f
      where f.user_id = auth.uid()
        and f.post_id = p.id
    )
  order by
    exists (
      select 1
      from public.user_topic_preferences as utp
      where utp.user_id = auth.uid()
        and utp.topic_id = p.topic_id
    ) desc,
    p.created_at desc
  limit p_limit;
end;
$$;
