insert into public.topics (slug, name)
select 'gamedev', 'Геймдев и игры'
where not exists (select 1 from public.topics where slug = 'gamedev');
