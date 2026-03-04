import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RichTextMarkdownEditor } from '@/components/editor/RichTextMarkdownEditor';
import { AppLink } from '@/components/ui/app-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StateCard } from '@/components/ui/state-card';
import { Textarea } from '@/components/ui/textarea';
import { createPost, deletePost, updatePost, type PostMutationInput } from '@/features/posts/api';
import { uploadPostImage } from '@/features/posts/storage';
import { postFormSchema, type PostFormValues } from '@/features/posts/validation';
import { listTopics } from '@/features/topics/api';
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
          setTopicsError('Не удалось загрузить темы.');
          setTopics([]);
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
  const submitLabel = isSubmitting ? 'Сохранение…' : mode === 'create' ? 'Опубликовать' : 'Сохранить';

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
      toast.success('Обложка загружена.');
    } catch {
      toast.error('Не удалось загрузить обложку.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pageTitle = useMemo(() => (mode === 'create' ? 'Новая новость' : 'Редактирование новости'), [mode]);

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
        <Skeleton className="h-16 w-44 rounded-full" />
        <Skeleton className="h-[640px] w-full rounded-[1.75rem]" />
      </div>
    );
  }

  if (topicsError) {
    return <StateCard title="Темы недоступны" description={topicsError} />;
  }

  return (
    <>
      <Card className="mx-auto max-w-5xl overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-secondary/40">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="mt-2 text-3xl">{pageTitle}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-3">
              {post ? (
                <Button asChild variant="outline">
                  <AppLink to={`/post/${post.id}`}>Открыть опубликованную версию</AppLink>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <AppLink to="/">Назад к ленте</AppLink>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
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
                  toast.success('Новость опубликована.');
                  navigate('/', { replace: true });
                  return;
                }

                await updatePost(post!.id, payload);
                toast.success('Новость сохранена.');

                if (returnState?.returnTo === '/my-posts') {
                  navigate('/my-posts', {
                    replace: true,
                    state: { restoreScrollY: returnState.returnScrollY ?? 0 },
                  });
                  return;
                }

                navigate('/', { replace: true });
                return;
                toast.success(mode === 'create' ? 'Новость опубликована.' : 'Новость сохранена.');
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
            {submitError ? <div className="rounded-[1.25rem] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}
            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">Заголовок</Label>
                  <Input id="title" placeholder="Введите заголовок" {...form.register('title')} />
                  {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Анонс</Label>
                  <Textarea id="excerpt" placeholder="Короткое описание для карточек и превью." className="min-h-[120px]" {...form.register('excerpt')} />
                  {form.formState.errors.excerpt ? <p className="text-sm text-destructive">{form.formState.errors.excerpt.message}</p> : null}
                </div>
              </div>

              <div className="space-y-5 rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                <div className="space-y-2">
                  <Label htmlFor="topic_id">Тема</Label>
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
                    <option value="">Выберите тему</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </Select>
                  {form.formState.errors.topic_id ? <p className="text-sm text-destructive">{form.formState.errors.topic_id.message}</p> : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="cover-upload">Обложка</Label>
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
                        Загрузить
                      </label>
                    </Button>
                  </div>
                  {coverUrl ? (
                    <div className="overflow-hidden rounded-[1.25rem] border border-border">
                      <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Загрузите обложку, чтобы карточка новости выглядела лучше в ленте.
                    </div>
                  )}
                  <Input value={coverUrl ?? ''} readOnly placeholder="URL обложки появится после загрузки" />
                  {form.formState.errors.cover_url ? <p className="text-sm text-destructive">{form.formState.errors.cover_url.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Текст</Label>
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
              <div className="text-sm text-muted-foreground">{mode === 'create' ? 'Публикация станет доступна сразу после сохранения.' : 'Изменения применятся сразу после сохранения.'}</div>
              <div className="flex flex-wrap gap-3">
                {mode === 'edit' && post && canDeletePost ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting || isUploadingCover}>
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitLabel}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={canDeletePost ? isDeleteDialogOpen : false} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить новость?</DialogTitle>
            <DialogDescription>Новость будет удалена без возможности восстановления.</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Необратимое действие
            </div>
            Новость будет удалена сразу. Загруженные изображения останутся в storage.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Отмена
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
              Удалить новость
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
