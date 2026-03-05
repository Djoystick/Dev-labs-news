create or replace function public.get_author_handles(p_ids uuid[])
returns table(id uuid, handle text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(
      nullif(to_jsonb(p) ->> 'username', ''),
      nullif(to_jsonb(p) ->> 'nickname', ''),
      nullif(to_jsonb(p) ->> 'handle', ''),
      nullif(to_jsonb(p) ->> 'display_name', ''),
      nullif(to_jsonb(p) ->> 'full_name', ''),
      'Автор'
    ) as handle
  from public.profiles p
  where p.id = any(p_ids);
$$;

grant execute on function public.get_author_handles(uuid[]) to anon, authenticated;
