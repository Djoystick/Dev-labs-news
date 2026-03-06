create or replace function public.get_recommended_posts(p_limit integer default 20)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  v_limit int := greatest(coalesce(p_limit, 20), 1);
  v_optional_saved_table regclass;
  v_optional_saved_exclusion text := '';
  v_sql text;
begin
  v_optional_saved_table := coalesce(
    to_regclass('public.bookmarks'),
    to_regclass('public.saved_posts'),
    to_regclass('public.post_bookmarks')
  );

  if uid is not null and v_optional_saved_table is not null then
    v_optional_saved_exclusion := format(
      E'\n      and not exists (\n        select 1\n        from %s s\n        where s.user_id = $2\n          and s.post_id = p.id\n      )',
      v_optional_saved_table
    );
  end if;

  v_sql := format(
    $sql$
      with user_topic_affinity as (
        select
          p.topic_id,
          (count(*) filter (where pr.value = 1) * 2 - count(*) filter (where pr.value = -1))::int as affinity_score
        from public.post_reactions pr
        join public.posts p on p.id = pr.post_id and p.is_published = true
        where $2 is not null
          and pr.user_id = $2
          and pr.created_at >= now() - interval '30 days'
        group by p.topic_id
      ),
      top_topics as (
        select
          uta.topic_id,
          uta.affinity_score
        from user_topic_affinity uta
        order by uta.affinity_score desc, uta.topic_id
        limit 5
      ),
      post_popularity as (
        select
          pr.post_id,
          (count(*) filter (where pr.value = 1) - count(*) filter (where pr.value = -1))::int as global_net_likes
        from public.post_reactions pr
        where pr.created_at >= now() - interval '7 days'
        group by pr.post_id
      ),
      candidates as (
        select
          p.id,
          p.topic_id,
          p.created_at
        from public.posts p
        where p.is_published = true
          and p.created_at >= now() - interval '7 days'
          and (
            $2 is null
            or not exists (
              select 1
              from public.post_reads r
              where r.user_id = $2
                and r.post_id = p.id
            )
          )
          and (
            $2 is null
            or not exists (
              select 1
              from public.favorites f
              where f.user_id = $2
                and f.post_id = p.id
            )
          )%s
      ),
      scored as (
        select
          c.id,
          c.created_at,
          coalesce(tt.affinity_score, 0) as topic_boost,
          coalesce(pp.global_net_likes, 0) as global_net_likes
        from candidates c
        left join top_topics tt on tt.topic_id = c.topic_id
        left join post_popularity pp on pp.post_id = c.id
      )
      select p.*
      from scored s
      join public.posts p on p.id = s.id and p.is_published = true
      order by
        s.topic_boost desc,
        s.global_net_likes desc,
        s.created_at desc
      limit $1
    $sql$,
    v_optional_saved_exclusion
  );

  return query execute v_sql using v_limit, uid;
end;
$$;

grant execute on function public.get_recommended_posts(integer) to anon, authenticated;
