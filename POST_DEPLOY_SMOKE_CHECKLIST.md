# Post-Deploy Smoke Checklist

Quick verification layer for critical import/editorial paths after deploy.

## Scope
- URL -> `import-post-draft`
- Manual RSS import -> `import-rss-source`
- Scheduled RSS import -> `import-rss-scheduled`
- Import history visibility (`import_runs`)
- Draft-only guarantee (no auto-publish)

## Preconditions
- Admin account with access to:
  - `Источники`
  - `Импортировать в черновик`
  - `История импортов`
  - `Панель автора`
- At least one enabled RSS source in `Источники`
- Working scheduler secrets:
  - `CRON_SECRET`
  - `SUPABASE_RSS_SCHEDULED_FUNCTION_URL`
  - `SUPABASE_ANON_KEY`

## 5-minute smoke run
1. **URL import smoke**
   - Open `Импортировать в черновик`.
   - Import a valid article URL.
   - Expected:
     - success or duplicate response is shown,
     - if success: draft opens in editor,
     - created material is still draft (not published).

2. **Manual RSS import smoke**
   - Open `Источники`.
   - Click `Запустить импорт` for one enabled source.
   - Expected:
     - source run finishes with counts,
     - new drafts appear only for imported entries,
     - duplicates are counted, not re-created.

3. **Scheduled RSS smoke**
   - Run GitHub Action `Scheduled RSS import` via `workflow_dispatch`.
   - Expected:
     - run is green only for `success` / `partial_success`,
     - full failure returns failed workflow,
     - no false-green on `status=failed`.

4. **Import history smoke**
   - Open `История импортов`.
   - Expected:
     - new cards for manual and/or scheduled runs,
     - visible status + counters (`Найдено`, `Создано черновиков`, `Дубликаты`, `Ошибки`),
     - `По расписанию` and `Вручную` are distinguishable.

5. **Draft-only guard smoke**
   - Open `Панель автора` and `Черновики`.
   - Confirm imported materials require manual review and are not auto-published.

## Optional SQL sanity checks (Supabase SQL Editor)
```sql
-- Recent import runs
select
  created_at,
  run_type,
  trigger_mode,
  status,
  discovered_count,
  imported_count,
  duplicate_count,
  error_count,
  error_message
from public.import_runs
order by created_at desc
limit 30;
```

```sql
-- Recently imported posts should remain drafts until manual publish
select
  id,
  title,
  is_published,
  source_url,
  import_origin,
  created_at
from public.posts
where created_at > now() - interval '2 hours'
  and (source_url is not null or import_origin = 'manual_import_ai')
order by created_at desc
limit 50;
```

Expected: `is_published = false` for freshly imported content unless manually published by editor/admin.

## Failure triage (quick)
- `UNAUTHORIZED`:
  - check `Authorization` for manual calls,
  - check `x-cron-secret` for scheduled path.
- `CONFIG_MISSING`:
  - verify required function env/secrets.
- `RSS_SOURCE_TIMEOUT` / `IMPORT_TIMEOUT`:
  - retry with lower `maxItems`,
  - check provider/source latency.
- Many `DUPLICATE*`:
  - dedupe works; verify source freshness before re-run.
