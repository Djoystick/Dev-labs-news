alter table public.profiles
  add column if not exists for_you_digest_enabled boolean not null default false,
  add column if not exists for_you_digest_threshold integer not null default 10;

update public.profiles
set for_you_digest_enabled = false
where for_you_digest_enabled is null;

update public.profiles
set for_you_digest_threshold = 10
where for_you_digest_threshold is null
  or for_you_digest_threshold not in (10, 20, 30);

alter table public.profiles
  alter column for_you_digest_enabled set default false,
  alter column for_you_digest_enabled set not null,
  alter column for_you_digest_threshold set default 10,
  alter column for_you_digest_threshold set not null;

alter table public.profiles
  drop constraint if exists profiles_for_you_digest_threshold_check;

alter table public.profiles
  add constraint profiles_for_you_digest_threshold_check
  check (for_you_digest_threshold in (10, 20, 30));

notify pgrst, 'reload schema';
