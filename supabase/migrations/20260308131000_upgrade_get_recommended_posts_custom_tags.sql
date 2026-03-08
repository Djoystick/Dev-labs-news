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
      with profile_topics as (
        select utp.topic_id
        from public.user_topic_preferences utp
        where $2 is not null
          and utp.user_id = $2
      ),
      profile_topics_meta as (
        select count(*)::int as topic_count
        from profile_topics
      ),
      user_topic_signal_rows as (
        select
          p.topic_id,
          (count(*) filter (where pr.value = 1) * 3 - count(*) filter (where pr.value = -1) * 4)::numeric as reaction_score,
          0::numeric as read_score,
          0::numeric as favorite_score
        from public.post_reactions pr
        join public.posts p on p.id = pr.post_id and p.is_published = true
        where $2 is not null
          and pr.user_id = $2
          and pr.created_at >= now() - interval '60 days'
        group by p.topic_id

        union all

        select
          p.topic_id,
          0::numeric as reaction_score,
          least(count(*)::numeric, 20)::numeric as read_score,
          0::numeric as favorite_score
        from public.post_reads r
        join public.posts p on p.id = r.post_id and p.is_published = true
        where $2 is not null
          and r.user_id = $2
          and r.created_at >= now() - interval '45 days'
        group by p.topic_id

        union all

        select
          p.topic_id,
          0::numeric as reaction_score,
          0::numeric as read_score,
          least(count(*)::numeric * 2, 24)::numeric as favorite_score
        from public.favorites f
        join public.posts p on p.id = f.post_id and p.is_published = true
        where $2 is not null
          and f.user_id = $2
          and f.created_at >= now() - interval '90 days'
        group by p.topic_id
      ),
      user_topic_signals as (
        select
          s.topic_id,
          (sum(s.reaction_score) + sum(s.read_score) + sum(s.favorite_score))::numeric as interest_score
        from user_topic_signal_rows s
        group by s.topic_id
      ),
      user_tag_signal_rows as (
        select
          signal_rows.tag,
          (
            sum(signal_rows.reaction_score)
            + sum(signal_rows.read_score)
            + sum(signal_rows.favorite_score)
          )::numeric as interest_score
        from (
          select
            tags.tag,
            (count(*) filter (where pr.value = 1) * 1.8 - count(*) filter (where pr.value = -1) * 2.4)::numeric as reaction_score,
            0::numeric as read_score,
            0::numeric as favorite_score
          from public.post_reactions pr
          join public.posts p on p.id = pr.post_id and p.is_published = true
          join lateral unnest(coalesce(p.custom_tags, '{}'::text[])) tags(tag) on true
          where $2 is not null
            and pr.user_id = $2
            and pr.created_at >= now() - interval '60 days'
          group by tags.tag

          union all

          select
            tags.tag,
            0::numeric as reaction_score,
            least(count(*)::numeric * 0.8, 12)::numeric as read_score,
            0::numeric as favorite_score
          from public.post_reads r
          join public.posts p on p.id = r.post_id and p.is_published = true
          join lateral unnest(coalesce(p.custom_tags, '{}'::text[])) tags(tag) on true
          where $2 is not null
            and r.user_id = $2
            and r.created_at >= now() - interval '45 days'
          group by tags.tag

          union all

          select
            tags.tag,
            0::numeric as reaction_score,
            0::numeric as read_score,
            least(count(*)::numeric * 1.5, 18)::numeric as favorite_score
          from public.favorites f
          join public.posts p on p.id = f.post_id and p.is_published = true
          join lateral unnest(coalesce(p.custom_tags, '{}'::text[])) tags(tag) on true
          where $2 is not null
            and f.user_id = $2
            and f.created_at >= now() - interval '90 days'
          group by tags.tag
        ) signal_rows
        group by signal_rows.tag
      ),
      post_popularity as (
        select
          pr.post_id,
          (count(*) filter (where pr.value = 1) - count(*) filter (where pr.value = -1))::numeric as global_net_likes
        from public.post_reactions pr
        where pr.created_at >= now() - interval '7 days'
        group by pr.post_id
      ),
      candidates as (
        select
          p.id,
          p.topic_id,
          p.created_at,
          coalesce(uts.interest_score, 0)::numeric as topic_interest_score,
          coalesce((
            select
              least(greatest(sum(utg.interest_score), -8::numeric), 20::numeric)
            from unnest(coalesce(p.custom_tags, '{}'::text[])) post_tag(tag)
            join user_tag_signal_rows utg on utg.tag = post_tag.tag
          ), 0)::numeric as tag_interest_score,
          coalesce(pp.global_net_likes, 0)::numeric as popularity_score,
          case
            when exists (
              select 1
              from profile_topics pt
              where pt.topic_id = p.topic_id
            ) then 1
            else 0
          end as in_profile_topics
        from public.posts p
        left join user_topic_signals uts on uts.topic_id = p.topic_id
        left join post_popularity pp on pp.post_id = p.id
        cross join profile_topics_meta ptm
        where p.is_published = true
          and p.created_at >= now() - interval '7 days'
          and (
            $2 is null
            or ptm.topic_count = 0
            or exists (
              select 1
              from profile_topics pt
              where pt.topic_id = p.topic_id
            )
          )
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
          )
          and (
            $2 is null
            or not exists (
              select 1
              from public.post_reactions prn
              where prn.user_id = $2
                and prn.post_id = p.id
                and prn.value = -1
            )
          )%s
      ),
      scored as (
        select
          c.id,
          c.topic_id,
          c.created_at,
          (
            (case when c.in_profile_topics = 1 then 14 else -6 end)
            + c.topic_interest_score
            + (c.tag_interest_score * 0.45)
            + (c.popularity_score * 0.55)
            + greatest(0::numeric, 48::numeric - (extract(epoch from (now() - c.created_at)) / 3600)::numeric) * 0.12
          )::numeric as base_score
        from candidates c
      ),
      ranked as (
        select
          s.id,
          s.created_at,
          s.base_score,
          row_number() over (partition by s.topic_id order by s.base_score desc, s.created_at desc) as topic_rank
        from scored s
      )
      select p.*
      from ranked r
      join public.posts p on p.id = r.id and p.is_published = true
      order by
        (r.base_score - greatest(r.topic_rank - 1, 0) * 1.25) desc,
        r.created_at desc
      limit $1
    $sql$,
    v_optional_saved_exclusion
  );

  return query execute v_sql using v_limit, uid;
end;
$$;

grant execute on function public.get_recommended_posts(integer) to anon, authenticated;

notify pgrst, 'reload schema';
