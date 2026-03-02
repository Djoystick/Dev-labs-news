create extension if not exists pgcrypto;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  telegram_id text unique,
  username text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete restrict,
  title text not null,
  excerpt text,
  content text not null,
  cover_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  author_id uuid references auth.users (id) on delete set null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create index if not exists idx_topics_slug on public.topics (slug);
create index if not exists idx_posts_topic_id on public.posts (topic_id);
create index if not exists idx_posts_created_at_desc on public.posts (created_at desc);
create index if not exists idx_posts_title on public.posts (title);
create index if not exists idx_profiles_role on public.profiles (role);
create unique index if not exists idx_profiles_telegram_id on public.profiles (telegram_id) where telegram_id is not null;

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

create or replace function public.current_profile_role(check_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = check_user_id;
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.current_profile_role(uuid) to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_posts_updated_at on public.posts;

create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();
