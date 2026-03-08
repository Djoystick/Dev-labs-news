import { motion } from 'framer-motion';
import { ArrowLeft, Clock3, MessageCircle, PencilLine, Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { FlatPage, FlatSection } from '@/components/layout/flat';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthorHandles } from '@/features/profiles/use-author-handles';
import { FeedSkeleton } from '@/features/posts/components/feed-skeleton';
import { markPostRead } from '@/features/posts/mark-post-read';
import { PostCard } from '@/features/posts/components/post-card';
import { BookmarkButton } from '@/features/profile/components/bookmark-button';
import { recordPostView } from '@/features/profile/api';
import { getPost, getPosts } from '@/features/posts/api';
import { EmojiReactionBar } from '@/features/reactions/components/emoji-reaction-bar';
import { PostReactions } from '@/features/reactions/components/PostReactions';
import { useReactions } from '@/features/reactions/use-reactions';
import { normalizeHandle } from '@/lib/author-label';
import { getTelegramMiniAppEnv } from '@/lib/env';
import { buildPreferredPostOpenUrl, getPostPath } from '@/lib/post-links';
import { useAuth } from '@/providers/auth-provider';
import { useReadingPreferences } from '@/providers/preferences-provider';
import type { Post } from '@/types/db';

function getReadingTime(content: string) {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(wordCount / 200));
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10">
          {'Повторить'}
        </Button>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
        <div>
          <Skeleton className="aspect-[16/8] w-full" />
          <div className="space-y-5 py-6 sm:py-8 lg:py-10">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-8 w-5/6 rounded-2xl" />
            <div className="flex gap-3">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-28 w-full rounded-[1.5rem]" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-full rounded-full" />
              <Skeleton className="h-5 w-11/12 rounded-full" />
              <Skeleton className="h-5 w-10/12 rounded-full" />
              <Skeleton className="h-5 w-9/12 rounded-full" />
            </div>
          </div>
        </div>
        <FeedSkeleton />
      </div>
    </FlatPage>
  );
}

async function copyPostLink(url: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

type PostWithDiscussionFields = Post & {
  commentsUrl?: string | null;
  comments_url?: string | null;
  discussionUrl?: string | null;
  discussion_url?: string | null;
  sourceUrl?: string | null;
  source_url?: string | null;
  telegramUrl?: string | null;
  telegram_url?: string | null;
};

function parseExternalUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = new URL(normalizedValue, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function getDiscussionUrl(post: Post) {
  const source = post as PostWithDiscussionFields;
  const candidates = [
    source.discussion_url,
    source.discussionUrl,
    source.comments_url,
    source.commentsUrl,
    source.telegram_url,
    source.telegramUrl,
    source.source_url,
    source.sourceUrl,
  ];

  for (const candidate of candidates) {
    const parsed = parseExternalUrl(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function openExternalUrl(url: string) {
  try {
    const telegramWebApp = (window as Window & { Telegram?: { WebApp?: { openLink?: (value: string) => void; openTelegramLink?: (value: string) => void } } }).Telegram?.WebApp;
    if (telegramWebApp?.openTelegramLink && url.startsWith('https://t.me/')) {
      telegramWebApp.openTelegramLink(url);
      return true;
    }

    if (telegramWebApp?.openLink) {
      telegramWebApp.openLink(url);
      return true;
    }
  } catch {
    // no-op: fallback below
  }

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(openedWindow);
}

function getSafeFromPath(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized.startsWith('/')) {
    return null;
  }

  return normalized || null;
}

export function PostPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { motionEnabled, textSizeClassName, textWidthClassName } = useReadingPreferences();
  const telegramMiniAppEnv = getTelegramMiniAppEnv();
  const fromPath = useMemo(() => {
    const state = location.state as { from?: unknown } | null;
    return getSafeFromPath(state?.from);
  }, [location.state]);
  const [post, setPost] = useState<Post | null>(null);
  const [latestPosts, setLatestPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [latestLoading, setLatestLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const reactionIds = useMemo(() => {
    const ids: string[] = [];
    if (post?.id) {
      ids.push(post.id);
    }
    latestPosts.forEach((latestPost) => {
      ids.push(latestPost.id);
    });
    return [...new Set(ids)];
  }, [latestPosts, post?.id]);
  const { summariesById, toggle, isPending } = useReactions(reactionIds);
  const { getName } = useAuthorHandles(post?.author_id ? [post.author_id] : []);

  const createdAtLabel = useMemo(() => {
    if (!post) {
      return '';
    }

    const sourceDate = post.is_published ? post.published_at ?? post.created_at : post.updated_at ?? post.created_at;
    return new Date(sourceDate).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [post]);

  const readingTime = useMemo(() => (post ? getReadingTime(post.content) : 1), [post]);
  const authorLabel = useMemo(() => {
    if (!post) {
      return '';
    }

    return normalizeHandle(getName(post.author_id)) ?? 'Редакция DevLabs';
  }, [getName, post]);
  const shareUrl = useMemo(() => {
    if (!id) {
      return '';
    }

    return buildPreferredPostOpenUrl(id, telegramMiniAppEnv);
  }, [id, telegramMiniAppEnv]);

  const handleBack = useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }

    if (fromPath && fromPath !== location.pathname) {
      navigate(fromPath, { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [fromPath, location.key, location.pathname, navigate]);

  const retry = useCallback(() => {
    setRetryToken((current) => current + 1);
  }, []);

  const handleShare = useCallback(async () => {
    if (!post || !shareUrl) {
      return;
    }

    const sharePayload = {
      text: post.title,
      title: post.title,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(sharePayload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await copyPostLink(shareUrl);
    if (copied) {
      toast.success('Ссылка скопирована');
      return;
    }

    toast.error('Не удалось поделиться ссылкой');
  }, [post, shareUrl]);

  useEffect(() => {
    const scrollEl = document.getElementById('app-scroll');

    if (scrollEl instanceof HTMLElement) {
      scrollEl.scrollTo({ top: 0, behavior: motionEnabled ? 'smooth' : 'auto' });
      return;
    }

    window.scrollTo({ top: 0, behavior: motionEnabled ? 'smooth' : 'auto' });
  }, [id, motionEnabled]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadPost() {
      if (!id) {
        setPost(null);
        setError('Post not found.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedPost = await getPost(id, controller.signal);

        if (!ignore) {
          setPost(loadedPost);
        }
      } catch (loadError) {
        if (!ignore && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setPost(null);
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить материал.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [id, retryToken]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function loadLatest() {
      setLatestLoading(true);
      setLatestError(null);

      try {
        const response = await getPosts({
          page: 1,
          pageSize: 6,
          publishedOnly: true,
          signal: controller.signal,
          sort: 'newest',
        });

        if (!ignore) {
          setLatestPosts(response.items.filter((item) => item.id !== id).slice(0, 5));
        }
      } catch (loadError) {
        if (!ignore && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setLatestPosts([]);
          setLatestError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить последние новости.');
        }
      } finally {
        if (!ignore) {
          setLatestLoading(false);
        }
      }
    }

    void loadLatest();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [id, retryToken]);

  useEffect(() => {
    if (!post?.id || !post.is_published) {
      return;
    }

    void markPostRead(post.id, {
      path: getPostPath(post.id),
      topicKey: post.topic?.id ?? post.topic_id ?? null,
      title: post.title,
      updatedAt: new Date().toISOString(),
    });
  }, [post?.id, post?.is_published, post?.title, post?.topic?.id, post?.topic_id]);

  useEffect(() => {
    if (!post?.id || !user?.id || !post.is_published) {
      return;
    }

    const historyKey = `dev-labs-read:${user.id}:${post.id}`;
    const lastRecorded = window.sessionStorage.getItem(historyKey);

    if (lastRecorded && Date.now() - Number(lastRecorded) < 5000) {
      return;
    }

    window.sessionStorage.setItem(historyKey, String(Date.now()));
    void recordPostView(user.id, post.id).catch(() => {
      window.sessionStorage.removeItem(historyKey);
    });
  }, [post?.id, post?.is_published, user?.id]);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !post) {
    return (
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {'Назад'}
          </Button>
          <InlineError message={error ?? 'Не удалось загрузить материал.'} onRetry={retry} />
        </div>
      </FlatPage>
    );
  }

  const topic = post.topic;
  const topicHref = topic?.slug ? `/?topic=${topic.slug}` : '/';
  const canEditPost = profile?.role === 'admin' || (profile?.role === 'editor' && Boolean(user?.id) && post.author_id === user?.id);
  const isDraftPreview = !post.is_published;
  const discussionUrl = getDiscussionUrl(post);

  if (isDraftPreview && !canEditPost) {
    return (
      <FlatPage className="safe-pb py-6 sm:py-8">
        <div className="space-y-4">
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {'Назад'}
          </Button>
          <InlineError message="Черновик недоступен по публичной ссылке." onRetry={retry} />
        </div>
      </FlatPage>
    );
  }

  return (
    <FlatPage className="safe-pb py-6 sm:py-8">
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 border-b border-border/60 pb-5">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {'Назад'}
          </Button>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="transition hover:text-foreground">
              {'Новости'}
            </Link>
            {topic ? (
              <>
                <span>/</span>
                <Link to={topicHref} className="transition hover:text-foreground">
                  {topic.name}
                </Link>
              </>
            ) : null}
          </nav>
        </motion.div>

        <motion.article initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          {post.cover_url ? <img src={post.cover_url} alt="" loading="eager" className="aspect-[16/8] w-full object-cover" /> : null}
          <div className="space-y-8 py-6 sm:py-8 lg:py-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{topic?.name ?? 'Новости'}</span>
                  <span className="text-xs text-muted-foreground">{authorLabel}</span>
                  {isDraftPreview ? <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">{'Черновик'}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isDraftPreview ? <BookmarkButton postId={post.id} size="sm" variant="outline" showLabel className="h-10 px-3" /> : null}
                  {!isDraftPreview ? <Button type="button" size="sm" variant="outline" onClick={() => void handleShare()}>
                    <Share2 className="h-4 w-4" />
                    {'Поделиться'}
                  </Button> : null}
                  {!isDraftPreview && discussionUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const opened = openExternalUrl(discussionUrl);
                        if (!opened) {
                          toast.error('Не удалось открыть обсуждение');
                        }
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {'Обсудить'}
                    </Button>
                  ) : null}
                  {canEditPost ? (
                    <Button asChild size="sm" variant="outline">
                      <AppLink to={`/admin/edit/${post.id}`}>
                        <PencilLine className="h-4 w-4" />
                        {'Редактировать'}
                      </AppLink>
                    </Button>
                  ) : null}
                </div>
              </div>

              <h1 className="max-w-4xl font-['Source_Serif_4'] text-4xl font-bold leading-tight text-balance sm:text-5xl">{post.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  {readingTime} {'мин чтения'}
                </span>
                <span>{createdAtLabel}</span>
              </div>

              {!isDraftPreview ? <PostReactions postId={post.id} summary={summariesById.get(post.id)} disabled={isPending(post.id)} onToggle={toggle} /> : null}
              {!isDraftPreview ? <EmojiReactionBar postId={post.id} /> : null}

              {isDraftPreview ? (
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {'Это предпросмотр черновика. Материал виден только редактору и не участвует в публичных лентах или уведомлениях.'}
                </div>
              ) : null}

              {post.excerpt ? <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{post.excerpt}</p> : null}
            </div>

            <FlatSection>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'AI-автор'}</p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                {'Этот материал подготовлен с помощью ИИ и адаптирован для быстрого чтения. Перед тем как опираться на информацию, проверьте источники и контекст.'}
              </p>
            </FlatSection>

            <div className={`prose prose-slate max-w-none prose-headings:font-['Source_Serif_4'] prose-pre:bg-slate-950 dark:prose-invert ${textSizeClassName} ${textWidthClassName}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
                  code: ({ className, children, ...props }) => (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ),
                  img: ({ alt, src }) => <img alt={alt ?? ''} src={src ?? ''} loading="lazy" />,
                }}
              >
                {post.content?.trim() || post.excerpt || ''}
              </ReactMarkdown>
            </div>
          </div>
        </motion.article>

        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{'Ещё'}</p>
            <h2 className="text-3xl font-extrabold">{'Последние новости'}</h2>
          </div>

          {latestError ? <InlineError message={latestError} onRetry={retry} /> : null}

          {latestLoading ? (
            <FeedSkeleton />
          ) : latestPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{'Пока больше материалов нет.'}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {latestPosts.map((latestPost, index) => (
                <PostCard
                  key={latestPost.id}
                  post={latestPost}
                  index={index}
                  reactionSummary={summariesById.get(latestPost.id)}
                  reactionsDisabled={isPending(latestPost.id)}
                  onToggleReaction={toggle}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </FlatPage>
  );
}
