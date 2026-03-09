import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, Eye, ImagePlus, LoaderCircle, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { RichTextMarkdownEditor } from '@/components/editor/RichTextMarkdownEditor';
import { FlatSection } from '@/components/layout/flat';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { createPost, deletePost, updatePost, type PostMutationInput } from '@/features/posts/api';
import {
  clearPostDraft,
  getPostDraftStorageKey,
  hasMeaningfulPostDraft,
  readPostDraft,
  writePostDraft,
  type PostDraftPayload,
} from '@/features/posts/draft-autosave';
import { uploadPostImage } from '@/features/posts/storage';
import { postFormSchema, type PostFormValues } from '@/features/posts/validation';
import {
  normalizePostCustomTag,
  normalizePostCustomTags,
  POST_CUSTOM_TAG_MAX_LENGTH,
  POST_CUSTOM_TAGS_LIMIT,
} from '@/features/posts/custom-tags';
import { listTopics } from '@/features/topics/api';
import { FALLBACK_SECTION_TOPICS, filterToSections } from '@/features/topics/sections';
import { getPostPath } from '@/lib/post-links';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { Post, Topic } from '@/types/db';

type PostFormProps = {
  mode: 'create' | 'edit';
  post?: Post | null;
  userId: string;
};

type ReturnState = {
  returnTo?: string;
  returnScrollY?: number;
};

type PublishingMode = 'published' | 'draft';
type TagFeedback = {
  kind: 'error' | 'info' | 'success';
  message: string;
};

type PrePublishChecklistKey =
  | 'title'
  | 'excerpt'
  | 'content'
  | 'source'
  | 'topics'
  | 'cover'
  | 'facts';

type PrePublishChecklistItem = {
  key: PrePublishChecklistKey;
  label: string;
};
type EditablePost = Post & {
  is_published?: boolean | null;
};

const PRE_PUBLISH_CHECKLIST_ITEMS: PrePublishChecklistItem[] = [
  { key: 'title', label: 'Заголовок проверен' },
  { key: 'excerpt', label: 'Лид / краткое описание проверены' },
  { key: 'content', label: 'Основной текст проверен' },
  { key: 'source', label: 'Источник проверен' },
  { key: 'topics', label: 'Тема и теги проверены' },
  { key: 'cover', label: 'Обложка / изображение проверены' },
  { key: 'facts', label: 'Факты проверены вручную' },
];

function createEmptyPrePublishChecklistState() {
  return PRE_PUBLISH_CHECKLIST_ITEMS.reduce((acc, item) => {
    acc[item.key] = false;
    return acc;
  }, {} as Record<PrePublishChecklistKey, boolean>);
}

function getImportOriginLabel(origin: string | null | undefined, importNote: string | null | undefined) {
  const normalizedOrigin = typeof origin === 'string' ? origin.trim().toLowerCase() : '';
  const normalizedNote = typeof importNote === 'string' ? importNote.toLowerCase() : '';

  if (normalizedOrigin === 'manual_import_ai') {
    if (normalizedNote.includes('source registry')) {
      return 'RSS-импорт + AI-черновик';
    }

    return 'Импорт по URL + AI-черновик';
  }

  if (!normalizedOrigin) {
    return 'Импортированный черновик';
  }

  return normalizedOrigin;
}

const emptyValues: PostFormValues = {
  content: '',
  cover_url: '',
  custom_tags: [],
  excerpt: '',
  title: '',
  topic_id: '',
};

function resolvePublishingMode(post: EditablePost | null): PublishingMode {
  if (!post) {
    return 'draft';
  }

  if (post.is_published === true) {
    return 'published';
  }

  return 'draft';
}

function toDraftFormValues(values: PostFormValues) {
  return {
    content: values.content ?? '',
    cover_url: values.cover_url ?? '',
    custom_tags: normalizePostCustomTags(values.custom_tags),
    excerpt: values.excerpt ?? '',
    title: values.title ?? '',
    topic_id: values.topic_id ?? '',
  };
}

function areTagsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function PostForm({ mode, post, userId }: PostFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const editablePost = post ? (post as EditablePost) : null;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<PublishingMode>('draft');
  const [tagInputValue, setTagInputValue] = useState('');
  const [tagFeedback, setTagFeedback] = useState<TagFeedback | null>(null);
  const [prePublishChecklist, setPrePublishChecklist] = useState<Record<PrePublishChecklistKey, boolean>>(
    createEmptyPrePublishChecklistState(),
  );
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'restored' | null>(null);
  const [hasCheckedDraftRestore, setHasCheckedDraftRestore] = useState(false);
  const lastSavedSnapshotRef = useRef('');
  const hasRestoredDraftRef = useRef(false);

  const form = useForm<PostFormValues>({
    defaultValues: emptyValues,
    resolver: zodResolver(postFormSchema),
  });

  const watchedTitle = form.watch('title');
  const watchedContent = form.watch('content');
  const watchedExcerpt = form.watch('excerpt');
  const watchedCoverUrl = form.watch('cover_url');
  const watchedCustomTags = form.watch('custom_tags');
  const watchedTopicId = form.watch('topic_id');
  const initialFormValues = useMemo<PostFormValues>(
    () => ({
      content: editablePost?.content ?? '',
      cover_url: editablePost?.cover_url ?? '',
      custom_tags: normalizePostCustomTags(editablePost?.custom_tags),
      excerpt: editablePost?.excerpt ?? '',
      title: editablePost?.title ?? '',
      topic_id: editablePost?.topic_id ?? '',
    }),
    [editablePost?.content, editablePost?.cover_url, editablePost?.custom_tags, editablePost?.excerpt, editablePost?.title, editablePost?.topic_id],
  );
  const draftStorageKey = useMemo(() => {
    if (mode === 'create') {
      return getPostDraftStorageKey({ mode: 'create' });
    }

    if (!editablePost?.id) {
      return null;
    }

    return getPostDraftStorageKey({ mode: 'edit', postId: editablePost.id });
  }, [editablePost?.id, mode]);
  const initialPublishMode = useMemo<PublishingMode>(() => {
    return resolvePublishingMode(editablePost);
  }, [editablePost, mode]);

  useEffect(() => {
    hasRestoredDraftRef.current = false;
    lastSavedSnapshotRef.current = '';
    setHasCheckedDraftRestore(false);
    setAutosaveStatus(null);
  }, [draftStorageKey]);

  useEffect(() => {
    form.reset(initialFormValues);
    setTagInputValue('');
  }, [form, initialFormValues]);

  useEffect(() => {
    setPublishMode(initialPublishMode);
  }, [initialPublishMode]);

  useEffect(() => {
    setPrePublishChecklist(createEmptyPrePublishChecklistState());
  }, [editablePost?.id, mode]);

  useEffect(() => {
    if (!draftStorageKey || hasRestoredDraftRef.current) {
      if (!hasCheckedDraftRestore) {
        setHasCheckedDraftRestore(true);
      }

      return;
    }

    const draft = readPostDraft(draftStorageKey);
    hasRestoredDraftRef.current = true;

    if (!draft) {
      setHasCheckedDraftRestore(true);
      return;
    }

    if (!hasMeaningfulPostDraft(draft)) {
      clearPostDraft(draftStorageKey);
      setHasCheckedDraftRestore(true);
      return;
    }

    const currentValues = toDraftFormValues(form.getValues());
    const currentHasValues = hasMeaningfulPostDraft({
      ...currentValues,
      custom_tags: currentValues.custom_tags,
      scheduled_at: '',
    });
    const currentMatchesInitial =
      currentValues.title === initialFormValues.title &&
      currentValues.content === initialFormValues.content &&
      currentValues.excerpt === initialFormValues.excerpt &&
      currentValues.cover_url === initialFormValues.cover_url &&
      areTagsEqual(currentValues.custom_tags, initialFormValues.custom_tags) &&
      currentValues.topic_id === initialFormValues.topic_id;

    if (currentMatchesInitial || !currentHasValues) {
      const restoredValues: PostFormValues = {
        title: draft.title.length > 0 ? draft.title : initialFormValues.title,
        content: draft.content.length > 0 ? draft.content : initialFormValues.content,
        excerpt: draft.excerpt.length > 0 ? draft.excerpt : initialFormValues.excerpt,
        cover_url: draft.cover_url.length > 0 ? draft.cover_url : initialFormValues.cover_url,
        custom_tags: draft.custom_tags.length > 0 ? draft.custom_tags : initialFormValues.custom_tags,
        topic_id: draft.topic_id.length > 0 ? draft.topic_id : initialFormValues.topic_id,
      };
      const restoredMode: PublishingMode = draft.publish_mode === 'published' ? 'published' : 'draft';

      form.reset(restoredValues);
      setTagInputValue('');
      setPublishMode(restoredMode);
      setAutosaveStatus('restored');
      lastSavedSnapshotRef.current = JSON.stringify({
        ...restoredValues,
        publish_mode: restoredMode,
        scheduled_at: '',
      });
    }

    setHasCheckedDraftRestore(true);
  }, [
    draftStorageKey,
    form,
    hasCheckedDraftRestore,
    initialFormValues,
    initialPublishMode,
  ]);

  useEffect(() => {
    let ignore = false;

    async function loadTopics() {
      setTopicsLoading(true);
      setTopicsError(null);

      try {
        const data = await listTopics();
        if (!ignore) {
          setTopics(data);
        }
      } catch {
        if (!ignore) {
          setTopicsError('Не удалось загрузить разделы. Используется резервный список.');
          setTopics(FALLBACK_SECTION_TOPICS);
        }
      } finally {
        if (!ignore) {
          setTopicsLoading(false);
        }
      }
    }

    void loadTopics();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!draftStorageKey || !hasCheckedDraftRestore || isSubmitting) {
      return;
    }

    const nextPayloadBase = {
      title: watchedTitle ?? '',
      content: watchedContent ?? '',
      excerpt: watchedExcerpt ?? '',
      cover_url: watchedCoverUrl ?? '',
      custom_tags: normalizePostCustomTags(watchedCustomTags),
      topic_id: watchedTopicId ?? '',
      publish_mode: publishMode,
      scheduled_at: '',
    };

    if (!hasMeaningfulPostDraft(nextPayloadBase)) {
      if (lastSavedSnapshotRef.current) {
        clearPostDraft(draftStorageKey);
        lastSavedSnapshotRef.current = '';
        setAutosaveStatus(null);
      }

      return;
    }

    const nextSnapshot = JSON.stringify(nextPayloadBase);
    if (nextSnapshot === lastSavedSnapshotRef.current) {
      return;
    }

    const timerId = window.setTimeout(() => {
      const payloadToSave: PostDraftPayload = {
        ...nextPayloadBase,
        updatedAt: new Date().toISOString(),
      };

      writePostDraft(draftStorageKey, payloadToSave);
      lastSavedSnapshotRef.current = nextSnapshot;
      setAutosaveStatus('saved');
    }, 800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    draftStorageKey,
    hasCheckedDraftRestore,
    isSubmitting,
    publishMode,
    watchedContent,
    watchedCoverUrl,
    watchedCustomTags,
    watchedExcerpt,
    watchedTitle,
    watchedTopicId,
  ]);

  const coverUrl = watchedCoverUrl;
  const isPublishedMaterial = publishMode === 'published';
  const isImportedMaterial = Boolean(
    editablePost?.import_origin || editablePost?.source_url || editablePost?.source_domain || editablePost?.import_note,
  );
  const importOriginLabel = getImportOriginLabel(editablePost?.import_origin, editablePost?.import_note);
  const completedChecklistItems = PRE_PUBLISH_CHECKLIST_ITEMS.filter((item) => prePublishChecklist[item.key]).length;
  const isPrePublishChecklistComplete = completedChecklistItems === PRE_PUBLISH_CHECKLIST_ITEMS.length;
  const canDeletePost = profile?.role === 'admin';
  const canSaveAsDraft = mode === 'create' || !isPublishedMaterial;
  const publishActionLabel = mode === 'edit' && isPublishedMaterial ? 'Обновить публикацию' : 'Опубликовать';
  const statusHint = isPublishedMaterial ? 'Статус: опубликовано' : 'Статус: черновик';
  const publicationHint =
    isPublishedMaterial
      ? 'Публикация обновится после сохранения.'
      : 'Черновик останется в редакторском контуре и не появится в публичных лентах.';

  const autosaveHint =
    autosaveStatus === 'restored' ? 'Восстановлен черновик' : autosaveStatus === 'saved' ? 'Сохранено' : null;

  const returnState = useMemo(() => {
    const state = location.state as ReturnState | null;
    if (!state || typeof state !== 'object') {
      return null;
    }

    const returnTo = typeof state.returnTo === 'string' ? state.returnTo : undefined;
    const returnScrollY = typeof state.returnScrollY === 'number' && Number.isFinite(state.returnScrollY) ? Math.max(0, state.returnScrollY) : 0;
    return {
      returnScrollY,
      returnTo,
    };
  }, [location.state]);

  const handleBack = () => {
    if (returnState?.returnTo && returnState.returnTo !== location.pathname) {
      navigate(returnState.returnTo, {
        replace: true,
        state: typeof returnState.returnScrollY === 'number' ? { restoreScrollY: returnState.returnScrollY } : null,
      });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/author', { replace: true });
  };

  const currentCustomTags = useMemo(() => normalizePostCustomTags(watchedCustomTags), [watchedCustomTags]);

  const applyCustomTags = (nextTags: string[]) => {
    const normalized = normalizePostCustomTags(nextTags);
    form.setValue('custom_tags', normalized, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleAddCustomTags = (rawValue: string) => {
    const rawTokens = rawValue.split(/[\n,]+/g);
    const nextTags = [...currentCustomTags];
    const existing = new Set(currentCustomTags);
    let addedCount = 0;
    let skippedEmpty = 0;
    let skippedTooLong = 0;
    let skippedDuplicate = 0;
    let skippedLimit = 0;

    for (const rawToken of rawTokens) {
      const trimmed = rawToken.trim();
      if (!trimmed) {
        skippedEmpty += 1;
        continue;
      }

      if (trimmed.length > POST_CUSTOM_TAG_MAX_LENGTH) {
        skippedTooLong += 1;
        continue;
      }

      const normalized = normalizePostCustomTag(trimmed);
      if (!normalized) {
        skippedEmpty += 1;
        continue;
      }

      if (existing.has(normalized)) {
        skippedDuplicate += 1;
        continue;
      }

      if (nextTags.length >= POST_CUSTOM_TAGS_LIMIT) {
        skippedLimit += 1;
        continue;
      }

      existing.add(normalized);
      nextTags.push(normalized);
      addedCount += 1;
    }

    if (addedCount > 0) {
      applyCustomTags(nextTags);
      setTagInputValue('');

      const skippedCount = skippedEmpty + skippedTooLong + skippedDuplicate + skippedLimit;
      if (skippedCount > 0) {
        setTagFeedback({
          kind: 'info',
          message: `Добавлено: ${addedCount}. Пропущено: ${skippedCount}.`,
        });
      } else {
        setTagFeedback({
          kind: 'success',
          message: `Добавлено тегов: ${addedCount}.`,
        });
      }
      return;
    }

    if (skippedLimit > 0) {
      setTagFeedback({
        kind: 'error',
        message: `Достигнут лимит: максимум ${POST_CUSTOM_TAGS_LIMIT} тегов.`,
      });
      return;
    }

    if (skippedDuplicate > 0) {
      setTagFeedback({
        kind: 'error',
        message: 'Такой тег уже добавлен.',
      });
      return;
    }

    if (skippedTooLong > 0) {
      setTagFeedback({
        kind: 'error',
        message: `Тег слишком длинный. Лимит: ${POST_CUSTOM_TAG_MAX_LENGTH} символа(ов).`,
      });
      return;
    }

    setTagFeedback({
      kind: 'error',
      message: 'Введите непустой тег.',
    });
  };

  const handleRemoveCustomTag = (tagToRemove: string) => {
    applyCustomTags(currentCustomTags.filter((tag) => tag !== tagToRemove));
    setTagFeedback(null);
  };

  const toggleChecklistItem = (key: PrePublishChecklistKey, checked: boolean) => {
    setPrePublishChecklist((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const markChecklistDone = () => {
    setPrePublishChecklist(
      PRE_PUBLISH_CHECKLIST_ITEMS.reduce((acc, item) => {
        acc[item.key] = true;
        return acc;
      }, {} as Record<PrePublishChecklistKey, boolean>),
    );
  };

  const handleCoverUpload = async (file: File) => {
    setIsUploadingCover(true);
    try {
      const { publicUrl } = await uploadPostImage(file, 'covers');
      form.setValue('cover_url', publicUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success('Обложка загружена.');
    } catch {
      toast.error('Не удалось загрузить обложку.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pageTitle = useMemo(() => (mode === 'create' ? 'Новая новость' : 'Редактирование новости'), [mode]);

  const clearDraftAfterSave = () => {
    if (!draftStorageKey) {
      return;
    }

    clearPostDraft(draftStorageKey);
    lastSavedSnapshotRef.current = '';
    setAutosaveStatus(null);
  };

  const submitPost = async (values: PostFormValues, nextMode: PublishingMode) => {
    if (nextMode === 'published' && !isPrePublishChecklistComplete) {
      const message = 'Перед публикацией пройдите весь чеклист редакторской проверки.';
      setSubmitError(message);
      toast.error(message);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload: PostMutationInput = {
        author_id: editablePost?.author_id ?? userId,
        content: values.content,
        cover_url: values.cover_url?.trim() || null,
        custom_tags: normalizePostCustomTags(values.custom_tags),
        excerpt: values.excerpt?.trim() || null,
        is_published: nextMode === 'published',
        scheduled_at: null,
        title: values.title.trim(),
        topic_id: values.topic_id,
      };

      if (mode === 'create') {
        const createdPost = await createPost(payload);
        setPublishMode(nextMode);
        clearDraftAfterSave();
        toast.success(nextMode === 'published' ? 'Публикация опубликована.' : 'Черновик сохранён.');

        if (nextMode === 'published') {
          navigate(getPostPath(createdPost.id), { replace: true });
          return;
        }

        navigate(`/admin/edit/${createdPost.id}`, {
          replace: true,
          state: {
            returnTo: returnState?.returnTo ?? '/author',
            returnScrollY: returnState?.returnScrollY ?? 0,
          },
        });
        return;
      }

      await updatePost(editablePost!.id, payload);
      setPublishMode(nextMode);
      clearDraftAfterSave();
      toast.success(nextMode === 'published' ? 'Публикация обновлена.' : 'Черновик сохранён.');

      if (returnState?.returnTo && returnState.returnTo !== location.pathname) {
        navigate(returnState.returnTo, {
          replace: true,
          state: { restoreScrollY: returnState.returnScrollY ?? 0 },
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[PostForm] submit failed', error);
      }

      setSubmitError('Не удалось сохранить новость.');
      toast.error('Не удалось сохранить новость.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitByMode = (nextMode: PublishingMode) => {
    void form.handleSubmit(async (values) => {
      await submitPost(values, nextMode);
    })();
  };

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.debug('[PostForm] context', {
      mode,
      roleSource: 'AdminGuard -> profile.role',
      userId,
    });
  }, [mode, userId]);

  if (topicsLoading) {
    return (
      <div>
        <FlatSection className="pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="mt-2 text-3xl font-bold">{pageTitle}</h1>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="ghost" className="rounded-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                {'Назад'}
              </Button>
            </div>
          </div>
        </FlatSection>
        <div className="space-y-5 pt-6">
          <Skeleton className="h-16 w-44" />
          <Skeleton className="h-[640px] w-full" />
        </div>
      </div>
    );
  }

  const sectionTopics = filterToSections(topics);
  const hasSectionTopics = sectionTopics.length > 0;
  const topicOptions =
    hasSectionTopics
      ? sectionTopics
      : post?.topic_id
        ? [...FALLBACK_SECTION_TOPICS, { id: post.topic_id, slug: 'current', name: 'Текущий раздел', created_at: '' }]
        : FALLBACK_SECTION_TOPICS;
  const previewTitle = (watchedTitle ?? '').trim() || 'Без заголовка';
  const previewExcerpt = (watchedExcerpt ?? '').trim();
  const previewContent = (watchedContent ?? '').trim();
  const previewCustomTags = normalizePostCustomTags(watchedCustomTags);
  const previewTopicName = topicOptions.find((topic) => topic.id === watchedTopicId)?.name ?? 'Раздел не выбран';

  return (
    <>
      <div>
        <FlatSection className="pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="mt-2 text-3xl font-bold">{pageTitle}</h1>
            <div className="flex flex-wrap gap-3">
              {post ? (
                <Button asChild variant="outline">
                  <AppLink to={getPostPath(post.id)}>{isPublishedMaterial ? 'Открыть опубликованную версию' : 'Открыть черновик'}</AppLink>
                </Button>
              ) : null}
              <Button type="button" variant="ghost" className="rounded-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                {'Назад'}
              </Button>
            </div>
          </div>
        </FlatSection>

        <div className="pt-6">
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(async (values) => {
              await submitPost(values, publishMode === 'published' ? 'published' : 'draft');
            })}
          >
            {submitError ? <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}
            {topicsError ? <StateCard title="Разделы недоступны" description={topicsError} /> : null}
            {!topicsError && !hasSectionTopics ? <StateCard title="Разделы не найдены" description="Не удалось найти разделы. Обратитесь к администратору." /> : null}

            {isImportedMaterial ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Импортированный черновик</p>
                <p className="mt-2 text-sm text-amber-100/95">
                  {`Происхождение: ${importOriginLabel}. Перед публикацией обязательно проверьте источник и факты вручную.`}
                </p>
                {editablePost?.source_url ? (
                  <a
                    href={editablePost.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block break-all text-sm text-amber-100 underline underline-offset-2 hover:text-amber-50"
                  >
                    {editablePost.source_url}
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{'Заголовок'}</Label>
                  <Input id="title" placeholder="Введите заголовок" {...form.register('title')} />
                  {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="custom-tags-input">Кастомные теги</Label>
                    <p className="text-xs text-muted-foreground">
                      {currentCustomTags.length}/{POST_CUSTOM_TAGS_LIMIT}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="custom-tags-input"
                      value={tagInputValue}
                      onChange={(event) => {
                        setTagInputValue(event.target.value);
                        if (tagFeedback) {
                          setTagFeedback(null);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ',') {
                          return;
                        }

                        event.preventDefault();
                        handleAddCustomTags(tagInputValue);
                      }}
                      placeholder="Добавьте тег и нажмите Enter"
                      maxLength={180}
                      disabled={currentCustomTags.length >= POST_CUSTOM_TAGS_LIMIT}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="sm:w-auto"
                      onClick={() => handleAddCustomTags(tagInputValue)}
                      disabled={currentCustomTags.length >= POST_CUSTOM_TAGS_LIMIT || !tagInputValue.trim()}
                    >
                      Добавить
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">До 5 тегов, без дублей. Можно разделять запятой.</p>
                  {tagFeedback ? (
                    <p className={cn('text-xs', tagFeedback.kind === 'error' ? 'text-destructive' : tagFeedback.kind === 'success' ? 'text-emerald-300' : 'text-muted-foreground')}>
                      {tagFeedback.message}
                    </p>
                  ) : null}
                  {currentCustomTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {currentCustomTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/40 px-2.5 py-1 text-xs">
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomTag(tag)}
                            className="text-muted-foreground transition hover:text-foreground"
                            aria-label={`Удалить тег ${tag}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {typeof form.formState.errors.custom_tags?.message === 'string' ? (
                    <p className="text-sm text-destructive">{form.formState.errors.custom_tags.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="topic_id">Раздел</Label>
                  <Select
                    id="topic_id"
                    value={form.watch('topic_id')}
                    onChange={(event) => {
                      form.setValue('topic_id', event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <option value="">{'Выберите раздел'}</option>
                    {topicOptions.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.topic_id ? <p className="text-sm text-destructive">{form.formState.errors.topic_id.message}</p> : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="cover-upload">{'Обложка'}</Label>
                    <input
                      id="cover-upload"
                      accept="image/*"
                      className="hidden"
                      type="file"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleCoverUpload(file);
                        }
                      }}
                    />
                    <Button asChild type="button" variant="outline" size="sm" disabled={isUploadingCover}>
                      <label htmlFor="cover-upload" className="cursor-pointer">
                        {isUploadingCover ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        {'Загрузить'}
                      </label>
                    </Button>
                  </div>
                  {coverUrl ? (
                    <div className="border-y border-border/60 py-3">
                      <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="border-y border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      {'Загрузите обложку, чтобы карточка новости выглядела лучше в ленте.'}
                    </div>
                  )}
                  <Input value={coverUrl ?? ''} readOnly placeholder="URL обложки появится после загрузки" />
                  {form.formState.errors.cover_url ? <p className="text-sm text-destructive">{form.formState.errors.cover_url.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{'Текст'}</Label>
                <p className="text-xs text-muted-foreground">Markdown</p>
              </div>
              <RichTextMarkdownEditor
                value={form.watch('content')}
                onChange={(value) => {
                  form.setValue('content', value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                minHeight={320}
                placeholder="Введите текст новости в визуальном редакторе. Сохранение выполняется в markdown."
              />
              {form.formState.errors.content ? <p className="text-sm text-destructive">{form.formState.errors.content.message}</p> : null}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Редакторский чеклист перед публикацией</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Публикация доступна только после прохождения всех пунктов ручной проверки.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={markChecklistDone}
                  disabled={isPrePublishChecklistComplete}
                >
                  Отметить все
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {PRE_PUBLISH_CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-cyan-500"
                      checked={prePublishChecklist[item.key]}
                      onChange={(event) => toggleChecklistItem(item.key, event.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {`Готово: ${completedChecklistItems}/${PRE_PUBLISH_CHECKLIST_ITEMS.length}`}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs text-white/60">{statusHint}</p>
                <p className="text-sm text-muted-foreground">{publicationHint}</p>
                {autosaveHint ? <p className="text-xs text-white/60">{autosaveHint}</p> : null}
                {!isPublishedMaterial ? (
                  <p className="text-xs text-muted-foreground">
                    Следующий шаг: откройте предпросмотр, пройдите чеклист и публикуйте вручную.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setIsPreviewDialogOpen(true)}>
                  <Eye className="h-4 w-4" />
                  {'Предпросмотр'}
                </Button>
                {canSaveAsDraft ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting || isUploadingCover}
                    onClick={() => submitByMode('draft')}
                  >
                    {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {'Сохранить черновик'}
                  </Button>
                ) : null}
                {mode === 'edit' && editablePost && canDeletePost ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    {'Удалить'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={isSubmitting || isUploadingCover || !isPrePublishChecklistComplete}
                  onClick={() => submitByMode('published')}
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {publishActionLabel}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{'Предпросмотр материала'}</DialogTitle>
            <DialogDescription>{'Проверка перед ручной публикацией. Предпросмотр не делает материал публичным.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
              <span className="rounded-full border border-white/15 px-2.5 py-1">{isPublishedMaterial ? 'Опубликовано' : 'Черновик'}</span>
              <span className="rounded-full border border-white/15 px-2.5 py-1">{previewTopicName}</span>
              {previewCustomTags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/15 px-2.5 py-1">
                  #{tag}
                </span>
              ))}
            </div>
            <h2 className="font-['Source_Serif_4'] text-3xl font-bold leading-tight">{previewTitle}</h2>
            {previewExcerpt ? <p className="text-sm leading-7 text-muted-foreground">{previewExcerpt}</p> : null}
            {coverUrl ? (
              <div className="overflow-hidden rounded-xl border border-border/70">
                <img src={coverUrl} alt="" className="aspect-[16/8] w-full object-cover" />
              </div>
            ) : null}
            <div className="prose prose-slate max-w-none prose-headings:font-['Source_Serif_4'] dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent || 'Текст пока не добавлен.'}</ReactMarkdown>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={canDeletePost ? isDeleteDialogOpen : false} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{'Удалить новость?'}</DialogTitle>
            <DialogDescription>{'Новость будет удалена без возможности восстановления.'}</DialogDescription>
          </DialogHeader>
          <div className="border-y border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {'Необратимое действие'}
            </div>
            {'Новость будет удалена сразу. Загруженные изображения останутся в storage.'}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {'Отмена'}
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!post) {
                  return;
                }

                setIsSubmitting(true);
                setSubmitError(null);

                try {
                  await deletePost(post.id);
                  if (draftStorageKey) {
                    clearPostDraft(draftStorageKey);
                    lastSavedSnapshotRef.current = '';
                  }
                  toast.success('Новость удалена.');
                  if (returnState?.returnTo && returnState.returnTo !== location.pathname) {
                    navigate(returnState.returnTo, {
                      replace: true,
                      state: { restoreScrollY: Math.max(0, (returnState.returnScrollY ?? 0) - 120) },
                    });
                  } else {
                    navigate('/');
                  }
                } catch (error) {
                  if (import.meta.env.DEV) {
                    console.error('[PostForm] delete failed', error);
                  }

                  setSubmitError('Не удалось удалить новость.');
                  toast.error('Не удалось удалить новость.');
                } finally {
                  setIsSubmitting(false);
                  setIsDeleteDialogOpen(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {'Удалить новость'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
