insert into public.topics (slug, name)
values
  ('frontend', 'Frontend'),
  ('backend', 'Backend'),
  ('devops', 'DevOps'),
  ('product', 'Product')
on conflict (slug) do update
set name = excluded.name;

insert into public.posts (topic_id, title, excerpt, content, cover_url)
select
  t.id,
  'Shipping React admin flows without bloated dashboards',
  'A compact editorial control surface with markdown, media uploads, and role-gated CRUD.',
  E'# Shipping React admin flows\n\nThis is a seeded markdown post for Dev-labs News.\n\n## Why it matters\n\n- Admin CRUD is now wired to Supabase.\n- Content is stored as markdown.\n- Cover images live in Supabase Storage.\n\n```ts\nexport const ready = true;\n```\n\n> Seed data should stay minimal and readable.\n',
  null
from public.topics t
where t.slug = 'frontend'
and not exists (
  select 1
  from public.posts
  where title = 'Shipping React admin flows without bloated dashboards'
)
limit 1;

insert into public.posts (topic_id, title, excerpt, content, cover_url)
select
  t.id,
  'Designing RLS-first content systems for small editorial teams',
  'Keep auth, profile roles, storage policies, and write permissions aligned from the first MVP.',
  E'# Designing RLS-first content systems\n\nWhen `profiles.role = admin`, the UI can expose write actions while Postgres remains the real guardrail.\n\n## Checklist\n\n1. Public read for topics and posts\n2. Admin-only writes for content and storage\n3. Self-service access to own profile\n',
  null
from public.topics t
where t.slug = 'backend'
and not exists (
  select 1
  from public.posts
  where title = 'Designing RLS-first content systems for small editorial teams'
)
limit 1;
