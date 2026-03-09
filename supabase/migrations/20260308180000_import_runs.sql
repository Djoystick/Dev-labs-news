create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  run_type text not null,
  trigger_mode text not null default 'manual',
  status text not null default 'running',
  initiated_by uuid null references public.profiles (id) on delete set null,
  source_url text null,
  source_domain text null,
  content_source_id uuid null references public.content_sources (id) on delete set null,
  feed_url text null,
  discovered_count integer not null default 0,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  constraint import_runs_run_type_check
    check (run_type in ('url_import', 'rss_import')),
  constraint import_runs_trigger_mode_check
    check (trigger_mode in ('manual', 'scheduled')),
  constraint import_runs_status_check
    check (status in ('running', 'success', 'partial_success', 'failed')),
  constraint import_runs_discovered_count_check
    check (discovered_count >= 0),
  constraint import_runs_imported_count_check
    check (imported_count >= 0),
  constraint import_runs_duplicate_count_check
    check (duplicate_count >= 0),
  constraint import_runs_error_count_check
    check (error_count >= 0),
  constraint import_runs_summary_object_check
    check (jsonb_typeof(summary) = 'object'),
  constraint import_runs_finished_after_started_check
    check (finished_at is null or finished_at >= started_at)
);

create index if not exists import_runs_created_at_desc_idx
  on public.import_runs (created_at desc);

create index if not exists import_runs_run_type_idx
  on public.import_runs (run_type);

create index if not exists import_runs_status_idx
  on public.import_runs (status);

create index if not exists import_runs_initiated_by_idx
  on public.import_runs (initiated_by);

create index if not exists import_runs_content_source_id_idx
  on public.import_runs (content_source_id);

alter table public.import_runs enable row level security;

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'import_runs'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke all on table public.import_runs from anon, authenticated;
grant select on table public.import_runs to authenticated;
grant select, insert, update, delete on table public.import_runs to service_role;

create policy "import_runs_read_admin"
on public.import_runs
for select
to authenticated
using (public.is_admin(auth.uid()));
