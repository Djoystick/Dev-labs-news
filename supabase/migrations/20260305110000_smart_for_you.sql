create table if not exists public.post_reads (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reads_user_created_idx
on public.post_reads (user_id, created_at desc);

create index if not exists post_reads_post_idx
on public.post_reads (post_id);

alter table public.post_reads enable row level security;

drop policy if exists post_reads_select_own on public.post_reads;
create policy post_reads_select_own
  on public.post_reads
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists post_reads_insert_own on public.post_reads;
create policy post_reads_insert_own
  on public.post_reads
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists post_reads_delete_own on public.post_reads;
create policy post_reads_delete_own
  on public.post_reads
  for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.mark_post_read(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.post_reads (post_id, user_id)
  values (p_post_id, v_uid)
  on conflict (post_id, user_id) do nothing;
end;
$$;

revoke all on function public.mark_post_read(uuid) from public;
grant execute on function public.mark_post_read(uuid) to authenticated;

create or replace function public.get_recommended_posts(p_limit int default 20)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(coalesce(p_limit, 20), 1);
begin
  return query
  with affinity_from_reactions as (
    select
      p.topic_id,
      count(*) filter (where pr.value = 1)::numeric as likes_count,
      count(*) filter (where pr.value = -1)::numeric as dislikes_count,
      0::numeric as bookmarks_count
    from public.post_reactions pr
    join public.posts p on p.id = pr.post_id
    where v_uid is not null
      and pr.user_id = v_uid
      and pr.created_at >= now() - interval '30 days'
    group by p.topic_id
  ),
  affinity_from_bookmarks as (
    select
      p.topic_id,
      0::numeric as likes_count,
      0::numeric as dislikes_count,
      count(*)::numeric as bookmarks_count
    from public.favorites f
    join public.posts p on p.id = f.post_id
    where v_uid is not null
      and f.user_id = v_uid
      and f.created_at >= now() - interval '30 days'
    group by p.topic_id
  ),
  affinity as (
    select
      a.topic_id,
      (sum(a.likes_count) * 3 + sum(a.bookmarks_count) * 2 - sum(a.dislikes_count))::numeric as affinity_score
    from (
      select * from affinity_from_reactions
      union all
      select * from affinity_from_bookmarks
    ) a
    group by a.topic_id
  ),
  affinity_max as (
    select nullif(max(greatest(af.affinity_score, 0)), 0)::numeric as max_affinity_score
    from affinity af
  ),
  popularity as (
    select
      pr.post_id,
      (count(*) filter (where pr.value = 1) - count(*) filter (where pr.value = -1))::numeric as pop_score
    from public.post_reactions pr
    where pr.created_at >= now() - interval '7 days'
    group by pr.post_id
  ),
  candidates as (
    select
      p.id,
      p.topic_id,
      p.created_at,
      coalesce(pop.pop_score, 0)::numeric as pop_score
    from public.posts p
    left join popularity pop on pop.post_id = p.id
    where p.is_published = true
      and p.created_at >= now() - interval '7 days'
      and (
        v_uid is null
        or not exists (
          select 1
          from public.post_reads prd
          where prd.post_id = p.id
            and prd.user_id = v_uid
        )
      )
      and (
        v_uid is null
        or not exists (
          select 1
          from public.favorites f
          where f.post_id = p.id
            and f.user_id = v_uid
        )
      )
  ),
  scored as (
    select
      c.id,
      c.created_at,
      (
        c.pop_score * (
          1 + coalesce(af.affinity_score / am.max_affinity_score, 0)
        )
      )::numeric as score
    from candidates c
    left join affinity af on af.topic_id = c.topic_id
    cross join affinity_max am
  )
  select p.*
  from scored s
  join public.posts p on p.id = s.id
  order by s.score desc, s.created_at desc
  limit v_limit;
end;
$$;

notify pgrst, 'reload schema';
