import type { Post } from '@/types/post';

export const postSeeds: Post[] = [
  {
    id: 'post-1',
    topic_id: 'topic-frontend',
    title: 'Shipping React 19 patterns without losing Telegram WebApp ergonomics',
    excerpt: 'A compact MVP stack for Mini Apps: fast boot, theme sync, safe areas, and clean card-driven reading flows.',
    content: 'TODO: Replace mock feed with Supabase posts in Stage 3.',
    cover_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-03-01T08:30:00.000Z',
    updated_at: '2026-03-01T08:30:00.000Z',
    author_id: null,
  },
  {
    id: 'post-2',
    topic_id: 'topic-backend',
    title: 'Postgres-first content models for lean editorial products',
    excerpt: 'Designing posts, topics, and profiles so admin CRUD and RLS stay simple from the first release.',
    content: 'TODO: Replace mock feed with Supabase posts in Stage 3.',
    cover_url: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-02-28T15:10:00.000Z',
    updated_at: '2026-02-28T15:10:00.000Z',
    author_id: null,
  },
  {
    id: 'post-3',
    topic_id: 'topic-devops',
    title: 'Vercel preview pipelines for content teams that move daily',
    excerpt: 'Draft-friendly deployments, strict environment boundaries, and practical rollout checks before Telegram traffic lands.',
    content: 'TODO: Replace mock feed with Supabase posts in Stage 3.',
    cover_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    created_at: '2026-02-27T12:05:00.000Z',
    updated_at: '2026-02-27T12:05:00.000Z',
    author_id: null,
  },
];
