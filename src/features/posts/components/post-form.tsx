import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { uploadPostImage } from '@/features/posts/storage';
import { postFormSchema, type PostFormValues } from '@/features/posts/validation';
import { listTopics } from '@/features/topics/api';
import { FALLBACK_SECTION_TOPICS, filterToSections } from '@/features/topics/sections';
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

const emptyValues: PostFormValues = {
  content: '',
  cover_url: '',
  excerpt: '',
  title: '',
  topic_id: '',
};

export function PostForm({ mode, post, userId }: PostFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<PostFormValues>({
    defaultValues: emptyValues,
    resolver: zodResolver(postFormSchema),
  });

  useEffect(() => {
    form.reset({
      content: post?.content ?? '',
      cover_url: post?.cover_url ?? '',
      excerpt: post?.excerpt ?? '',
      title: post?.title ?? '',
      topic_id: post?.topic_id ?? '',
    });
  }, [form, post]);

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
          setTopicsError('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0440\u0430\u0437\u0434\u0435\u043B\u044B. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0440\u0435\u0437\u0435\u0440\u0432\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A.');
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

  const coverUrl = form.watch('cover_url');
  const submitLabel = isSubmitting ? '\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435\u2026' : mode === 'create' ? '\u041E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u0442\u044C' : '\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C';
  const canDeletePost = profile?.role === 'admin';

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
      toast.success('\u041E\u0431\u043B\u043E\u0436\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430.');
    } catch {
      toast.error('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043E\u0431\u043B\u043E\u0436\u043A\u0443.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pageTitle = useMemo(() => (mode === 'create' ? '\u041D\u043E\u0432\u0430\u044F \u043D\u043E\u0432\u043E\u0441\u0442\u044C' : '\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438'), [mode]);

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
        ? [...FALLBACK_SECTION_TOPICS, { id: post.topic_id, slug: 'current', name: '\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0440\u0430\u0437\u0434\u0435\u043B', created_at: '' }]
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
                  <AppLink to={`/post/${post.id}`}>{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u043D\u043D\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E'}</AppLink>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <AppLink to="/">{'\u041D\u0430\u0437\u0430\u0434 \u043A \u043B\u0435\u043D\u0442\u0435'}</AppLink>
              </Button>
            </div>
          </div>
        </FlatSection>

        <div className="pt-6">
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(async (values) => {
              setIsSubmitting(true);
              setSubmitError(null);

              try {
                const payload: PostMutationInput = {
                  author_id: post?.author_id ?? userId,
                  content: values.content,
                  cover_url: values.cover_url?.trim() || null,
                  excerpt: values.excerpt?.trim() || null,
                  title: values.title.trim(),
                  topic_id: values.topic_id,
                };

                if (mode === 'create') {
                  await createPost(payload);
                  toast.success('\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u043E\u043F\u0443\u0431\u043B\u0438\u043A\u043E\u0432\u0430\u043D\u0430.');
                  navigate('/', { replace: true });
                  return;
                }

                await updatePost(post!.id, payload);
                toast.success('\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430.');

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

                setSubmitError('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C.');
                toast.error('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C.');
              } finally {
                setIsSubmitting(false);
              }
            })}
          >
            {submitError ? <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}
            {topicsError ? <StateCard title="\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B" description={topicsError} /> : null}
            {!topicsError && !hasSectionTopics ? <StateCard title="\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B" description="\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u044B. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438." /> : null}

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{'\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A'}</Label>
                  <Input id="title" placeholder="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A" {...form.register('title')} />
                  {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="topic_id">Section</Label>
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
                    <option value="">{'\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043B'}</option>
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
                    <Label htmlFor="cover-upload">{'\u041E\u0431\u043B\u043E\u0436\u043A\u0430'}</Label>
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
                        {'\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C'}
                      </label>
                    </Button>
                  </div>
                  {coverUrl ? (
                    <div className="border-y border-border/60 py-3">
                      <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="border-y border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      {'\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043E\u0431\u043B\u043E\u0436\u043A\u0443, \u0447\u0442\u043E\u0431\u044B \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043D\u043E\u0432\u043E\u0441\u0442\u0438 \u0432\u044B\u0433\u043B\u044F\u0434\u0435\u043B\u0430 \u043B\u0443\u0447\u0448\u0435 \u0432 \u043B\u0435\u043D\u0442\u0435.'}
                    </div>
                  )}
                  <Input value={coverUrl ?? ''} readOnly placeholder="URL \u043E\u0431\u043B\u043E\u0436\u043A\u0438 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438" />
                  {form.formState.errors.cover_url ? <p className="text-sm text-destructive">{form.formState.errors.cover_url.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{'\u0422\u0435\u043A\u0441\u0442'}</Label>
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
                placeholder="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043A\u0441\u0442 \u043D\u043E\u0432\u043E\u0441\u0442\u0438 \u0432 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u043C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435. \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u0432 markdown."
              />
              {form.formState.errors.content ? <p className="text-sm text-destructive">{form.formState.errors.content.message}</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {mode === 'create' ? '\u041F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u044F \u0441\u0442\u0430\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.' : '\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0442\u0441\u044F \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F.'}
              </div>
              <div className="flex flex-wrap gap-3">
                {mode === 'edit' && post && canDeletePost ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    {'\u0423\u0434\u0430\u043B\u0438\u0442\u044C'}
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting || isUploadingCover}>
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
            <DialogTitle>{'\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C?'}</DialogTitle>
            <DialogDescription>{'\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0431\u0435\u0437 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F.'}</DialogDescription>
          </DialogHeader>
          <div className="border-y border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {'\u041D\u0435\u043E\u0431\u0440\u0430\u0442\u0438\u043C\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435'}
            </div>
            {'\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u0430 \u0441\u0440\u0430\u0437\u0443. \u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u044B\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u0432 storage.'}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {'\u041E\u0442\u043C\u0435\u043D\u0430'}
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
                  toast.success('\u041D\u043E\u0432\u043E\u0441\u0442\u044C \u0443\u0434\u0430\u043B\u0435\u043D\u0430.');
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

                  setSubmitError('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C.');
                  toast.error('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C.');
                } finally {
                  setIsSubmitting(false);
                  setIsDeleteDialogOpen(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {'\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0441\u0442\u044C'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
