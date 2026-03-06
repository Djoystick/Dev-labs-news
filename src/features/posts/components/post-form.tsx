import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { listTopics } from '@/features/topics/api';
import { FALLBACK_SECTION_TOPICS, filterToSections } from '@/features/topics/sections';
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

type PublishingMode = 'published' | 'draft' | 'scheduled';
type EditablePost = Post & {
  is_published?: boolean | null;
  scheduled_at?: string | null;
};

const emptyValues: PostFormValues = {
  content: '',
  cover_url: '',
  excerpt: '',
  title: '',
  topic_id: '',
};

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (value: number) => value.toString().padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getRoundedScheduledLocal() {
  const scheduledDate = new Date(Date.now() + 30 * 60 * 1000);
  scheduledDate.setSeconds(0, 0);

  const roundedMinutes = Math.ceil(scheduledDate.getMinutes() / 5) * 5;
  if (roundedMinutes === 60) {
    scheduledDate.setHours(scheduledDate.getHours() + 1, 0, 0, 0);
  } else {
    scheduledDate.setMinutes(roundedMinutes, 0, 0);
  }

  return toDatetimeLocal(scheduledDate.toISOString());
}

function getScheduledValidationError(value: string) {
  if (!value.trim()) {
    return 'Укажите дату и время';
  }

  const scheduledDate = new Date(value);
  if (Number.isNaN(scheduledDate.getTime())) {
    return 'Введите корректную дату и время публикации.';
  }

  if (scheduledDate.getTime() < Date.now()) {
    return 'Время не может быть в прошлом';
  }

  return null;
}

function formatScheduledHuman(value: string) {
  if (!value.trim()) {
    return null;
  }

  const scheduledDate = new Date(value);
  if (Number.isNaN(scheduledDate.getTime())) {
    return null;
  }

  return scheduledDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolvePublishingMode(post: EditablePost | null): PublishingMode {
  if (!post) {
    return 'published';
  }

  if (post.is_published === true) {
    return 'published';
  }

  if (post.scheduled_at) {
    const scheduledDate = new Date(post.scheduled_at);
    if (!Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()) {
      return 'scheduled';
    }
  }

  return 'draft';
}

function toDraftFormValues(values: PostFormValues) {
  return {
    content: values.content ?? '',
    cover_url: values.cover_url ?? '',
    excerpt: values.excerpt ?? '',
    title: values.title ?? '',
    topic_id: values.topic_id ?? '',
  };
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<PublishingMode>('published');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [scheduledError, setScheduledError] = useState<string | null>(null);
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
  const watchedTopicId = form.watch('topic_id');
  const initialFormValues = useMemo<PostFormValues>(
    () => ({
      content: editablePost?.content ?? '',
      cover_url: editablePost?.cover_url ?? '',
      excerpt: editablePost?.excerpt ?? '',
      title: editablePost?.title ?? '',
      topic_id: editablePost?.topic_id ?? '',
    }),
    [editablePost?.content, editablePost?.cover_url, editablePost?.excerpt, editablePost?.title, editablePost?.topic_id],
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
    if (mode === 'create') {
      return 'published';
    }

    return resolvePublishingMode(editablePost);
  }, [editablePost, mode]);
  const initialScheduledLocal = useMemo(
    () => (initialPublishMode === 'scheduled' ? toDatetimeLocal(editablePost?.scheduled_at) : ''),
    [editablePost?.scheduled_at, initialPublishMode],
  );

  useEffect(() => {
    hasRestoredDraftRef.current = false;
    lastSavedSnapshotRef.current = '';
    setHasCheckedDraftRestore(false);
    setAutosaveStatus(null);
  }, [draftStorageKey]);

  useEffect(() => {
    form.reset(initialFormValues);
  }, [form, initialFormValues]);

  useEffect(() => {
    setPublishMode(initialPublishMode);
    setScheduledLocal(initialScheduledLocal);
    setScheduledError(null);
  }, [initialPublishMode, initialScheduledLocal]);

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
      scheduled_at: '',
    });
    const currentMatchesInitial =
      currentValues.title === initialFormValues.title &&
      currentValues.content === initialFormValues.content &&
      currentValues.excerpt === initialFormValues.excerpt &&
      currentValues.cover_url === initialFormValues.cover_url &&
      currentValues.topic_id === initialFormValues.topic_id;

    if (currentMatchesInitial || !currentHasValues) {
      const restoredValues: PostFormValues = {
        title: draft.title.length > 0 ? draft.title : initialFormValues.title,
        content: draft.content.length > 0 ? draft.content : initialFormValues.content,
        excerpt: draft.excerpt.length > 0 ? draft.excerpt : initialFormValues.excerpt,
        cover_url: draft.cover_url.length > 0 ? draft.cover_url : initialFormValues.cover_url,
        topic_id: draft.topic_id.length > 0 ? draft.topic_id : initialFormValues.topic_id,
      };
      const restoredMode: PublishingMode = draft.publish_mode;
      const restoredScheduled = restoredMode === 'scheduled' ? draft.scheduled_at : '';

      form.reset(restoredValues);
      setPublishMode(restoredMode);
      setScheduledLocal(restoredScheduled);
      setScheduledError(restoredMode === 'scheduled' ? getScheduledValidationError(restoredScheduled) : null);
      setAutosaveStatus('restored');
      lastSavedSnapshotRef.current = JSON.stringify({
        ...restoredValues,
        publish_mode: restoredMode,
        scheduled_at: restoredScheduled,
      });
    }

    setHasCheckedDraftRestore(true);
  }, [
    draftStorageKey,
    form,
    hasCheckedDraftRestore,
    initialFormValues,
    initialPublishMode,
    initialScheduledLocal,
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
      topic_id: watchedTopicId ?? '',
      publish_mode: publishMode,
      scheduled_at: publishMode === 'scheduled' ? scheduledLocal : '',
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
    scheduledLocal,
    watchedContent,
    watchedCoverUrl,
    watchedExcerpt,
    watchedTitle,
    watchedTopicId,
  ]);

  const coverUrl = watchedCoverUrl;
  const submitLabel = isSubmitting
    ? 'Сохранение…'
    : publishMode === 'published'
      ? mode === 'create'
        ? 'Опубликовать'
        : 'Сохранить и опубликовать'
      : publishMode === 'draft'
        ? 'Сохранить черновик'
        : 'Запланировать';
  const isEditingScheduledPost = mode === 'edit' && initialPublishMode === 'scheduled';
  const scheduledHumanDate = formatScheduledHuman(scheduledLocal);
  const statusHint =
    publishMode === 'published'
      ? 'Статус: Опубликовано'
      : publishMode === 'draft'
        ? 'Статус: Черновик'
        : scheduledHumanDate
          ? `Статус: Запланировано на ${scheduledHumanDate}`
          : 'Статус: Запланировано';
  const canDeletePost = profile?.role === 'admin';
  const publicationHint =
    publishMode === 'published'
      ? 'Публикация станет доступна сразу после сохранения.'
      : publishMode === 'draft'
        ? 'Материал сохранится как черновик без публикации.'
        : 'Публикация выйдет автоматически в указанное время.';

  const autosaveHint =
    autosaveStatus === 'restored' ? 'Восстановлен черновик' : autosaveStatus === 'saved' ? 'Сохранено' : null;

  const returnState = useMemo(() => {
    const state = location.state as ReturnState | null;
    if (!state || typeof state !== 'object') {
      return null;
    }

    const returnScrollY = typeof state.returnScrollY === 'number' && Number.isFinite(state.returnScrollY) ? Math.max(0, state.returnScrollY) : 0;
    return {
      returnScrollY,
      returnTo: state.returnTo,
    };
  }, [location.state]);

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

  const handlePublishModeChange = (nextMode: PublishingMode) => {
    setPublishMode(nextMode);

    if (nextMode !== 'scheduled') {
      setScheduledError(null);
      return;
    }

    if (!scheduledLocal.trim() && !isEditingScheduledPost) {
      const defaultScheduledLocal = getRoundedScheduledLocal();
      setScheduledLocal(defaultScheduledLocal);
      setScheduledError(getScheduledValidationError(defaultScheduledLocal));
      return;
    }

    setScheduledError(getScheduledValidationError(scheduledLocal));
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
      <div className="space-y-5">
        <Skeleton className="h-16 w-44" />
        <Skeleton className="h-[640px] w-full" />
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

  return (
    <>
      <div>
        <FlatSection className="pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="mt-2 text-3xl font-bold">{pageTitle}</h1>
            <div className="flex flex-wrap gap-3">
              {post ? (
                <Button asChild variant="outline">
                  <AppLink to={`/post/${post.id}`}>{'Открыть опубликованную версию'}</AppLink>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <AppLink to="/">{'Назад к ленте'}</AppLink>
              </Button>
            </div>
          </div>
        </FlatSection>

        <div className="pt-6">
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(async (values) => {
              setSubmitError(null);
              setScheduledError(null);

              let scheduledAt: string | null = null;
              if (publishMode === 'scheduled') {
                const validationError = getScheduledValidationError(scheduledLocal);
                if (validationError) {
                  setScheduledError(validationError);
                  return;
                }

                scheduledAt = new Date(scheduledLocal).toISOString();
              }

              setIsSubmitting(true);

              try {
                const payload: PostMutationInput = {
                  author_id: editablePost?.author_id ?? userId,
                  content: values.content,
                  cover_url: values.cover_url?.trim() || null,
                  excerpt: values.excerpt?.trim() || null,
                  is_published: publishMode === 'published',
                  scheduled_at: publishMode === 'scheduled' ? scheduledAt : null,
                  title: values.title.trim(),
                  topic_id: values.topic_id,
                };

                if (mode === 'create') {
                  await createPost(payload);
                  if (draftStorageKey) {
                    clearPostDraft(draftStorageKey);
                    lastSavedSnapshotRef.current = '';
                  }
                  toast.success('Новость опубликована.');
                  navigate('/', { replace: true });
                  return;
                }

                await updatePost(editablePost!.id, payload);
                if (draftStorageKey) {
                  clearPostDraft(draftStorageKey);
                  lastSavedSnapshotRef.current = '';
                }
                toast.success('Новость сохранена.');

                if (returnState?.returnTo === '/my-posts') {
                  navigate('/my-posts', {
                    replace: true,
                    state: { restoreScrollY: returnState.returnScrollY ?? 0 },
                  });
                  return;
                }

                navigate('/', { replace: true });
              } catch (error) {
                if (import.meta.env.DEV) {
                  console.error('[PostForm] submit failed', error);
                }

                setSubmitError('Не удалось сохранить новость.');
                toast.error('Не удалось сохранить новость.');
              } finally {
                setIsSubmitting(false);
              }
            })}
          >
            {submitError ? <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}
            {topicsError ? <StateCard title="Разделы недоступны" description={topicsError} /> : null}
            {!topicsError && !hasSectionTopics ? <StateCard title="Разделы не найдены" description="Разделы не найдены. Проверьте миграции." /> : null}

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{'Заголовок'}</Label>
                  <Input id="title" placeholder="Введите заголовок" {...form.register('title')} />
                  {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
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

            <div className="space-y-3 border-t border-border/70 pt-6">
              <Label>{'Режим публикации'}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handlePublishModeChange('published')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm transition-colors',
                    publishMode === 'published' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
                  )}
                >
                  {'Опубликовать'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePublishModeChange('draft')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm transition-colors',
                    publishMode === 'draft' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
                  )}
                >
                  {'Черновик'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePublishModeChange('scheduled')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm transition-colors',
                    publishMode === 'scheduled' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10',
                  )}
                >
                  {'Запланировать'}
                </button>
              </div>
              <p className="text-xs text-white/60">{statusHint}</p>
              {publishMode === 'scheduled' ? (
                <div className="space-y-2">
                  <Label htmlFor="scheduled-at">{'Дата и время публикации'}</Label>
                  <Input
                    id="scheduled-at"
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setScheduledLocal(nextValue);
                      setScheduledError(getScheduledValidationError(nextValue));
                    }}
                  />
                </div>
              ) : null}
              {scheduledError ? <p className="text-sm text-destructive">{scheduledError}</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{publicationHint}</p>
                {autosaveHint ? <p className="text-xs text-white/60">{autosaveHint}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {mode === 'edit' && editablePost && canDeletePost ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    {'Удалить'}
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting || isUploadingCover || Boolean(scheduledError)}>
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitLabel}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

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
                  if (returnState?.returnTo === '/my-posts') {
                    navigate('/my-posts', {
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
