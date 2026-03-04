create index if not exists posts_published_topic_created_idx
on public.posts (topic_id, created_at desc)
where is_published = true;

create index if not exists favorites_user_post_idx
on public.favorites (user_id, post_id);

create or replace function public.get_recommended_posts(p_limit int default 20)
returns setof public.posts
language sql
security invoker
set search_path = public
as $$
  with current_user as (
    select auth.uid() as uid
  )
  select p.*
  from public.posts as p
  cross join current_user as cu
  where p.is_published = true
    and (
      cu.uid is null
      or not exists (
        select 1
        from public.favorites as f
        where f.user_id = cu.uid
          and f.post_id = p.id
      )
    )
  order by
    case
      when cu.uid is not null
        and exists (
          select 1
          from public.user_topic_preferences as utp
          where utp.user_id = cu.uid
            and utp.topic_id = p.topic_id
        ) then 1
      else 0
    end desc,
    p.created_at desc
  limit coalesce(p_limit, 20);
$$;
