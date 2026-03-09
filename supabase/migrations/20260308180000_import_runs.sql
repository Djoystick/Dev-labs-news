begin;

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  run_type text not null check (run_type in ('url_import', 'rss_import')),
  trigger_mode text not null default 'manual' check (trigger_mode in ('manual', 'scheduled')),
  status text not null default 'running' check (status in ('running', 'success', 'partial_success', 'failed')),
  initiated_by uuid,
  source_url text,
  source_domain text,
  content_source_id uuid,
  feed_url text,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists import_runs_created_at_idx
  on public.import_runs (created_at desc);

create index if not exists import_runs_run_type_idx
  on public.import_runs (run_type);

create index if not exists import_runs_status_idx
  on public.import_runs (status);

alter table public.import_runs enable row level security;

drop policy if exists "Admins can read import runs" on public.import_runs;

create policy "Admins can read import runs"
  on public.import_runs
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

commit;
