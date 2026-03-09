import { recordTopicRead, recordTopicSkim } from '@/features/recommendations/preferences';

const sectionImpressions = new Set<string>();
const cardImpressions = new Set<string>();
const cardOpens = new Set<string>();
const cardDwellSignals = new Set<string>();
const seeAllClicks = new Set<string>();
const chipSelections = new Set<string>();
const quickExitSignals = new Set<string>();
const scrollMilestones = new Set<string>();
const positiveByTopic = new Map<string, number>();
const negativeByTopic = new Map<string, number>();

const maxPositiveSignalsPerTopic = 12;
const maxNegativeSignalsPerTopic = 3;

function normalizeTopicId(topicId: string | null | undefined) {
  if (!topicId) {
    return null;
  }

  const normalized = topicId.trim();
  return normalized.length > 0 ? normalized : null;
}

function applyPositive(topicId: string, weight = 1) {
  const current = positiveByTopic.get(topicId) ?? 0;
  const allowed = Math.max(0, Math.min(weight, maxPositiveSignalsPerTopic - current));

  if (allowed <= 0) {
    return;
  }

  for (let index = 0; index < allowed; index += 1) {
    recordTopicRead(topicId);
  }

  positiveByTopic.set(topicId, current + allowed);
}

function applyNegative(topicId: string, weight = 1) {
  const current = negativeByTopic.get(topicId) ?? 0;
  const allowed = Math.max(0, Math.min(weight, maxNegativeSignalsPerTopic - current));

  if (allowed <= 0) {
    return;
  }

  for (let index = 0; index < allowed; index += 1) {
    recordTopicSkim(topicId);
  }

  negativeByTopic.set(topicId, current + allowed);
}

export function indexDigestSectionImpression(topicId: string) {
  const normalizedTopicId = normalizeTopicId(topicId);
  if (!normalizedTopicId) {
    return;
  }

  const dedupeKey = `section:${normalizedTopicId}`;
  if (sectionImpressions.has(dedupeKey)) {
    return;
  }

  sectionImpressions.add(dedupeKey);
  applyPositive(normalizedTopicId, 1);
}

export function indexDigestCardImpression(postId: string, topicId: string) {
  const normalizedTopicId = normalizeTopicId(topicId);
  const normalizedPostId = postId.trim();
  if (!normalizedTopicId || !normalizedPostId) {
    return;
  }

  const dedupeKey = `card:${normalizedPostId}`;
  if (cardImpressions.has(dedupeKey)) {
    return;
  }

  cardImpressions.add(dedupeKey);
  applyPositive(normalizedTopicId, 1);
}

export function indexDigestCardOpen(postId: string, topicId: string) {
  const normalizedTopicId = normalizeTopicId(topicId);
  const normalizedPostId = postId.trim();
  if (!normalizedTopicId || !normalizedPostId) {
    return;
  }

  const dedupeKey = `open:${normalizedPostId}`;
  if (cardOpens.has(dedupeKey)) {
    return;
  }

  cardOpens.add(dedupeKey);
  applyPositive(normalizedTopicId, 2);
}

export function indexDigestCardViewTime(postId: string, topicId: string, durationMs: number) {
  const normalizedTopicId = normalizeTopicId(topicId);
  const normalizedPostId = postId.trim();
  if (!normalizedTopicId || !normalizedPostId || !Number.isFinite(durationMs) || durationMs < 8000) {
    return;
  }

  const dedupeKey = `dwell:${normalizedPostId}`;
  if (cardDwellSignals.has(dedupeKey)) {
    return;
  }

  cardDwellSignals.add(dedupeKey);
  if (durationMs >= 45000) {
    applyPositive(normalizedTopicId, 2);
    return;
  }

  applyPositive(normalizedTopicId, 1);
}

export function indexDigestSeeAllClick(topicId: string) {
  const normalizedTopicId = normalizeTopicId(topicId);
  if (!normalizedTopicId) {
    return;
  }

  const dedupeKey = `see-all:${normalizedTopicId}`;
  if (seeAllClicks.has(dedupeKey)) {
    return;
  }

  seeAllClicks.add(dedupeKey);
  applyPositive(normalizedTopicId, 2);
}

export function indexDigestChipSelection(topicId: string, isReturnToTopic: boolean) {
  const normalizedTopicId = normalizeTopicId(topicId);
  if (!normalizedTopicId) {
    return;
  }

  const dedupeKey = `${isReturnToTopic ? 'chip:return' : 'chip:first'}:${normalizedTopicId}`;
  if (chipSelections.has(dedupeKey)) {
    return;
  }

  chipSelections.add(dedupeKey);
  applyPositive(normalizedTopicId, isReturnToTopic ? 2 : 1);
}

export function indexDigestScrollDepth(topicId: string, depthPercent: number) {
  const normalizedTopicId = normalizeTopicId(topicId);
  if (!normalizedTopicId || !Number.isFinite(depthPercent) || depthPercent <= 0) {
    return;
  }

  const milestones = [25, 50, 75, 95] as const;
  for (const milestone of milestones) {
    if (depthPercent < milestone) {
      continue;
    }

    const dedupeKey = `scroll:${normalizedTopicId}:${milestone}`;
    if (scrollMilestones.has(dedupeKey)) {
      continue;
    }

    scrollMilestones.add(dedupeKey);
    applyPositive(normalizedTopicId, 1);
  }
}

export function indexDigestQuickExit(topicId: string, durationMs: number) {
  const normalizedTopicId = normalizeTopicId(topicId);
  if (!normalizedTopicId || !Number.isFinite(durationMs) || durationMs >= 8000) {
    return;
  }

  const dedupeKey = `quick-exit:${normalizedTopicId}`;
  if (quickExitSignals.has(dedupeKey)) {
    return;
  }

  quickExitSignals.add(dedupeKey);
  applyNegative(normalizedTopicId, 1);
}
