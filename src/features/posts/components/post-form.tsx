import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Eye, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
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
import { listTopics } from '@/features/topics/api';
import { FALLBACK_SECTION_TOPICS, filterToSections } from '@/features/topics/sections';
import { getPostPath } from '@/lib/post-links';
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
type EditablePost = Post & {
  is_published?: boolean | null;
};

const emptyValues: PostFormValues = {
  content: '',
  cover_url: '',
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
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<PublishingMode>('draft');
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
  }, [form, initialFormValues]);

  useEffect(() => {
    setPublishMode(initialPublishMode);
  }, [initialPublishMode]);

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
      const restoredMode: PublishingMode = draft.publish_mode === 'published' ? 'published' : 'draft';

      form.reset(restoredValues);
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
    watchedExcerpt,
    watchedTitle,
    watchedTopicId,
  ]);

  const coverUrl = watchedCoverUrl;
  const isPublishedMaterial = publishMode === 'published';
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

  const clearDraftAfterSave = () => {
    if (!draftStorageKey) {
      return;
    }

    clearPostDraft(draftStorageKey);
    lastSavedSnapshotRef.current = '';
    setAutosaveStatus(null);
  };

  const submitPost = async (values: PostFormValues, nextMode: PublishingMode) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const payload: PostMutationInput = {
        author_id: editablePost?.author_id ?? userId,
        content: values.content,
        cover_url: values.cover_url?.trim() || null,
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

        navigate(`/admin/edit/${createdPost.id}`, { replace: true, state: { returnTo: '/author' } });
        return;
      }

      await updatePost(editablePost!.id, payload);
      setPublishMode(nextMode);
      clearDraftAfterSave();
      toast.success(nextMode === 'published' ? 'Публикация обновлена.' : 'Черновик сохранён.');

      if (returnState?.returnTo === '/my-posts' || returnState?.returnTo === '/author') {
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
  const previewTitle = (watchedTitle ?? '').trim() || 'Без заголовка';
  const previewExcerpt = (watchedExcerpt ?? '').trim();
  const previewContent = (watchedContent ?? '').trim();
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
              await submitPost(values, publishMode === 'published' ? 'published' : 'draft');
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

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs text-white/60">{statusHint}</p>
                <p className="text-sm text-muted-foreground">{publicationHint}</p>
                {autosaveHint ? <p className="text-xs text-white/60">{autosaveHint}</p> : null}
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
                  disabled={isSubmitting || isUploadingCover}
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
                  if (returnState?.returnTo === '/my-posts' || returnState?.returnTo === '/author') {
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
