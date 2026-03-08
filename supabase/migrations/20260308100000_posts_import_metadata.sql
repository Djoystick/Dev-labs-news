alter table public.posts
  add column if not exists source_url text null;

alter table public.posts
  add column if not exists source_domain text null;

alter table public.posts
  add column if not exists import_origin text null;

alter table public.posts
  add column if not exists import_note text null;

create index if not exists posts_source_domain_idx
  on public.posts (source_domain);

create index if not exists posts_source_url_idx
  on public.posts (source_url)
  where source_url is not null;

create unique index if not exists posts_source_url_unique_idx
  on public.posts ((lower(source_url)))
  where source_url is not null;
