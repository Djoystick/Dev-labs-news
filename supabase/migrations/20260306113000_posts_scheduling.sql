alter table public.posts
  add column if not exists scheduled_at timestamptz null;

alter table public.posts
  add column if not exists published_at timestamptz null;

update public.posts
set published_at = coalesce(published_at, created_at)
where is_published = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_published_requires_no_schedule'
  ) then
    alter table public.posts
      add constraint posts_published_requires_no_schedule
      check ( (is_published = false) or (scheduled_at is null) );
  end if;
end $$;

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);

create index if not exists posts_published_at_idx
  on public.posts (published_at desc)
  where is_published = true;

create index if not exists posts_scheduled_at_idx
  on public.posts (scheduled_at)
  where is_published = false and scheduled_at is not null;

create or replace function public.publish_due_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.posts
  set
    is_published = true,
    published_at = now(),
    scheduled_at = null
  where
    is_published = false
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.publish_due_posts() to authenticated;

create or replace function public.schedule_post(p_post_id uuid, p_scheduled_at timestamptz)
returns void
language sql
as $$
  update public.posts
  set
    is_published = false,
    scheduled_at = p_scheduled_at
  where id = p_post_id;
$$;

grant execute on function public.schedule_post(uuid, timestamptz) to authenticated;

create or replace function public.unschedule_post(p_post_id uuid)
returns void
language sql
as $$
  update public.posts
  set scheduled_at = null
  where id = p_post_id;
$$;

grant execute on function public.unschedule_post(uuid) to authenticated;

notify pgrst, 'reload schema';
