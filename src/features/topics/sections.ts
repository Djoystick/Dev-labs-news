import type { Topic } from '@/types/db';

export const SECTION_DEFINITIONS = [
  { slug: 'ai-llm-ml', name: 'AI / LLM / ML' },
  { slug: 'cybersecurity', name: 'Кибербезопасность' },
  { slug: 'gadgets-devices', name: 'Гаджеты и девайсы' },
  { slug: 'dev-devops', name: 'Разработка и DevOps' },
  { slug: 'cloud-infra', name: 'Облака и инфраструктура' },
  { slug: 'data-analytics', name: 'Данные и аналитика' },
  { slug: 'ar-vr-xr', name: 'AR/VR/XR' },
  { slug: 'robotics-drones', name: 'Робототехника и дроны' },
  { slug: 'ev-autonomy', name: 'Электромобили и автономность' },
  { slug: 'web3-blockchain', name: 'Web3/Блокчейн' },
  { slug: 'gamedev', name: 'Геймдев и игры' },
] as const;

export const SECTION_SLUG_ALLOWLIST = SECTION_DEFINITIONS.map((section) => section.slug);

const sectionAllowlist = new Set<string>(SECTION_SLUG_ALLOWLIST);

export const FALLBACK_SECTION_TOPICS: Topic[] = SECTION_DEFINITIONS.map((section) => ({
  id: section.slug,
  slug: section.slug,
  name: section.name,
  created_at: '',
}));

export function filterToSections<T extends Pick<Topic, 'slug'>>(topics: T[]): T[] {
  return topics.filter((topic) => sectionAllowlist.has(topic.slug));
}
