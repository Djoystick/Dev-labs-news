do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'app_role'
      and e.enumlabel = 'editor'
  ) then
    alter type public.app_role add value 'editor';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'app_role','') = 'admin';
$$;

create or replace function public.set_profile_role_by_handle(
  p_handle text,
  p_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text;
  v_row public.profiles;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if p_handle is null or length(btrim(p_handle)) = 0 then
    raise exception 'handle is required';
  end if;

  v_norm := lower(regexp_replace(btrim(p_handle), '^@', ''));

  select count(*) into v_count
  from public.profiles
  where handle_norm = v_norm
     or lower(coalesce(username, '')) = v_norm
     or lower(coalesce(handle, '')) = v_norm;

  if v_count = 0 then
    raise exception 'profile not found';
  elsif v_count > 1 then
    raise exception 'multiple profiles match (handle not unique)';
  end if;

  update public.profiles
  set role = p_role
  where handle_norm = v_norm
     or lower(coalesce(username, '')) = v_norm
     or lower(coalesce(handle, '')) = v_norm
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.set_profile_role_by_handle(text, public.app_role) to authenticated;
