create or replace function public.get_for_you_digest_stats(p_user_id uuid)
returns table (
  candidate_count integer,
  newest_post_created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := p_user_id;
  v_optional_saved_table regclass;
  v_optional_saved_exclusion text := '';
  v_sql text;
begin
  if uid is null then
    raise exception 'p_user_id is required';
  end if;

  v_optional_saved_table := coalesce(
    to_regclass('public.bookmarks'),
    to_regclass('public.saved_posts'),
    to_regclass('public.post_bookmarks')
  );

  if v_optional_saved_table is not null then
    v_optional_saved_exclusion := format(
      E'\n      and not exists (\n        select 1\n        from %s s\n        where s.user_id = $1\n          and s.post_id = p.id\n      )',
      v_optional_saved_table
    );
  end if;

  v_sql := format(
    $sql$
      with candidates as (
        select
          p.id,
          p.created_at
        from public.posts p
        where p.is_published = true
          and p.created_at >= now() - interval '7 days'
          and exists (
            select 1
            from public.user_topic_preferences utp
            where utp.user_id = $1
              and utp.topic_id = p.topic_id
          )
          and not exists (
            select 1
            from public.post_reads r
            where r.user_id = $1
              and r.post_id = p.id
          )
          and not exists (
            select 1
            from public.favorites f
            where f.user_id = $1
              and f.post_id = p.id
          )%s
      )
      select
        count(*)::integer as candidate_count,
        max(c.created_at) as newest_post_created_at
      from candidates c
    $sql$,
    v_optional_saved_exclusion
  );

  return query execute v_sql using uid;
end;
$$;

revoke all on function public.get_for_you_digest_stats(uuid) from public, anon, authenticated;
grant execute on function public.get_for_you_digest_stats(uuid) to service_role;

notify pgrst, 'reload schema';
