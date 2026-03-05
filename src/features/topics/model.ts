import type { Post } from '@/types/db';

export const TOPIC_LABELS = [
  'AI / LLM / ML',
  'Кибербезопасность',
  'Гаджеты и девайсы',
  'Разработка и DevOps',
  'Облака и инфраструктура',
  'Данные и аналитика',
  'AR/VR/XR',
  'Робототехника и дроны',
  'Электромобили и автономность',
  'Web3/Блокчейн',
  'Геймдев и игры',
] as const;

const TOPIC_KEYS = [
  'ai-llm-ml',
  'cybersecurity',
  'gadgets-devices',
  'dev-devops',
  'cloud-infra',
  'data-analytics',
  'ar-vr-xr',
  'robotics-drones',
  'ev-autonomy',
  'web3-blockchain',
  'gamedev',
] as const;
const topicKeySet = new Set<string>(TOPIC_KEYS);

const TOPIC_KEYWORDS: Record<TopicKey, string[]> = {
  'ai-llm-ml': ['ai', 'llm', 'ml', 'machine learning', 'gpt', 'rag', 'нейросеть', 'искусственный интеллект'],
  cybersecurity: ['security', 'cyber', 'infosec', 'zero trust', 'кибер', 'безопас', 'уязвим', 'шифр'],
  'gadgets-devices': ['gadget', 'device', 'smartphone', 'wearable', 'смартфон', 'ноутбук', 'гаджет', 'девайс'],
  'dev-devops': ['devops', 'frontend', 'backend', 'typescript', 'javascript', 'react', 'docker', 'kubernetes', 'разработ'],
  'cloud-infra': ['cloud', 'infrastructure', 'aws', 'gcp', 'azure', 'serverless', 'sre', 'облако', 'инфраструкт'],
  'data-analytics': ['data', 'analytics', 'etl', 'sql', 'warehouse', 'lakehouse', 'аналит', 'данные'],
  'ar-vr-xr': ['ar', 'vr', 'xr', 'mixed reality', 'virtual reality', 'augmented reality'],
  'robotics-drones': ['robot', 'robotics', 'drone', 'uav', 'робот', 'дрон'],
  'ev-autonomy': ['electric vehicle', 'tesla', 'autonomous', 'self-driving', 'электромоб', 'автоном', 'беспилот'],
  'web3-blockchain': ['web3', 'blockchain', 'crypto', 'ethereum', 'solana', 'defi', 'nft', 'блокч', 'крипт'],
  gamedev: ['gamedev', 'game dev', 'gaming', 'videogame', 'unity', 'unreal', 'игр', 'геймдев'],
};

const TOPIC_LABEL_BY_KEY: Record<TopicKey, (typeof TOPIC_LABELS)[number]> = {
  'ai-llm-ml': TOPIC_LABELS[0],
  cybersecurity: TOPIC_LABELS[1],
  'gadgets-devices': TOPIC_LABELS[2],
  'dev-devops': TOPIC_LABELS[3],
  'cloud-infra': TOPIC_LABELS[4],
  'data-analytics': TOPIC_LABELS[5],
  'ar-vr-xr': TOPIC_LABELS[6],
  'robotics-drones': TOPIC_LABELS[7],
  'ev-autonomy': TOPIC_LABELS[8],
  'web3-blockchain': TOPIC_LABELS[9],
  gamedev: TOPIC_LABELS[10],
};

export type TopicKey = (typeof TOPIC_KEYS)[number];
export type TopicFilterState = Record<TopicKey, boolean>;

export function createDefaultTopicFilterState(): TopicFilterState {
  return TOPIC_KEYS.reduce<TopicFilterState>((state, key) => {
    state[key] = true;
    return state;
  }, {} as TopicFilterState);
}

export function getEnabledTopicKeys(state: TopicFilterState): TopicKey[] {
  return TOPIC_KEYS.filter((key) => state[key]);
}

function getPostSearchText(post: Pick<Post, 'title' | 'excerpt' | 'topic'>) {
  return [post.title, post.excerpt, post.topic?.slug, post.topic?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getMatchedTopicKeys(post: Pick<Post, 'title' | 'excerpt' | 'topic'>): TopicKey[] {
  const searchText = getPostSearchText(post);

  if (!searchText) {
    return [];
  }

  return TOPIC_KEYS.filter((key) => TOPIC_KEYWORDS[key].some((keyword) => searchText.includes(keyword.toLowerCase())));
}

export function matchesTopicFilters(post: Pick<Post, 'title' | 'excerpt' | 'topic'>, state: TopicFilterState): boolean {
  const enabledKeys = getEnabledTopicKeys(state);

  if (enabledKeys.length === TOPIC_KEYS.length) {
    return true;
  }

  if (enabledKeys.length === 0) {
    return false;
  }

  const matchedKeys = getMatchedTopicKeys(post);

  if (matchedKeys.length === 0) {
    return true;
  }

  return matchedKeys.some((key) => state[key]);
}

export function getVisiblePosts(posts: Post[], state: TopicFilterState): Post[] {
  const enabledKeys = getEnabledTopicKeys(state);

  if (enabledKeys.length === 0) {
    return [];
  }

  if (enabledKeys.length === TOPIC_KEYS.length) {
    return posts;
  }

  return posts.filter((post) => matchesTopicFilters(post, state));
}

export function normalizeTopicFilterState(value: unknown): TopicFilterState {
  const defaults = createDefaultTopicFilterState();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const candidate = value as Record<string, unknown>;

  for (const key of TOPIC_KEYS) {
    if (typeof candidate[key] === 'boolean') {
      defaults[key] = candidate[key] as boolean;
    }
  }

  return defaults;
}

export function isTopicKey(value: string): value is TopicKey {
  return topicKeySet.has(value);
}

export const topicKeys = TOPIC_KEYS;
export const topicLabels = TOPIC_LABEL_BY_KEY;
