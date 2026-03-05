insert into public.topics (slug, name)
select 'ai-llm-ml', 'AI / LLM / ML'
where not exists (select 1 from public.topics where slug = 'ai-llm-ml');

insert into public.topics (slug, name)
select 'cybersecurity', 'Кибербезопасность'
where not exists (select 1 from public.topics where slug = 'cybersecurity');

insert into public.topics (slug, name)
select 'gadgets-devices', 'Гаджеты и девайсы'
where not exists (select 1 from public.topics where slug = 'gadgets-devices');

insert into public.topics (slug, name)
select 'dev-devops', 'Разработка и DevOps'
where not exists (select 1 from public.topics where slug = 'dev-devops');

insert into public.topics (slug, name)
select 'cloud-infra', 'Облака и инфраструктура'
where not exists (select 1 from public.topics where slug = 'cloud-infra');

insert into public.topics (slug, name)
select 'data-analytics', 'Данные и аналитика'
where not exists (select 1 from public.topics where slug = 'data-analytics');

insert into public.topics (slug, name)
select 'ar-vr-xr', 'AR/VR/XR'
where not exists (select 1 from public.topics where slug = 'ar-vr-xr');

insert into public.topics (slug, name)
select 'robotics-drones', 'Робототехника и дроны'
where not exists (select 1 from public.topics where slug = 'robotics-drones');

insert into public.topics (slug, name)
select 'ev-autonomy', 'Электромобили и автономность'
where not exists (select 1 from public.topics where slug = 'ev-autonomy');

insert into public.topics (slug, name)
select 'web3-blockchain', 'Web3/Блокчейн'
where not exists (select 1 from public.topics where slug = 'web3-blockchain');
