alter table public.posts
  add column if not exists custom_tags text[] not null default '{}'::text[];

create or replace function public.normalize_post_custom_tags(p_tags text[])
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select deduped.tag_norm
      from (
        select distinct on (normalized.tag_norm)
          normalized.tag_norm,
          normalized.ord
        from (
          select
            lower(btrim(tag_value)) as tag_norm,
            ord
          from unnest(coalesce(p_tags, '{}'::text[])) with ordinality as tags(tag_value, ord)
        ) normalized
        where normalized.tag_norm <> ''
          and char_length(normalized.tag_norm) <= 32
        order by normalized.tag_norm, normalized.ord
      ) deduped
      order by deduped.ord
      limit 5
    ),
    '{}'::text[]
  );
$$;

update public.posts
set custom_tags = public.normalize_post_custom_tags(custom_tags)
where custom_tags is distinct from public.normalize_post_custom_tags(custom_tags);

alter table public.posts
  drop constraint if exists posts_custom_tags_max_count_check;

alter table public.posts
  add constraint posts_custom_tags_max_count_check
  check (coalesce(array_length(custom_tags, 1), 0) <= 5);

alter table public.posts
  drop constraint if exists posts_custom_tags_normalized_check;

alter table public.posts
  add constraint posts_custom_tags_normalized_check
  check (custom_tags = public.normalize_post_custom_tags(custom_tags));

create or replace function public.apply_post_custom_tags_defaults()
returns trigger
language plpgsql
as $$
begin
  new.custom_tags := public.normalize_post_custom_tags(new.custom_tags);
  return new;
end;
$$;

drop trigger if exists trg_posts_normalize_custom_tags on public.posts;

create trigger trg_posts_normalize_custom_tags
before insert or update of custom_tags on public.posts
for each row
execute function public.apply_post_custom_tags_defaults();

create index if not exists posts_custom_tags_gin_idx
  on public.posts using gin (custom_tags);
