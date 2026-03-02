import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { listTopics } from '@/features/topics/api';
import { createPost, deletePost, updatePost, type PostMutationInput } from '@/features/posts/api';
import { uploadPostImage } from '@/features/posts/storage';
import { postFormSchema, type PostFormValues } from '@/features/posts/validation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { StateCard } from '@/components/ui/state-card';
import { MarkdownEditor } from '@/features/posts/components/markdown-editor';
import type { Post, Topic } from '@/types/db';

type PostFormProps = {
  mode: 'create' | 'edit';
  post?: Post | null;
  userId: string;
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
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
      } catch (error) {
        if (!ignore) {
          setTopicsError(error instanceof Error ? error.message : 'Failed to load topics.');
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
  const submitLabel = mode === 'create' ? 'Create post' : 'Save changes';

  const handleInlineImageUpload = async (file: File) => {
    const { publicUrl } = await uploadPostImage(file, 'inline');
    toast.success('Inline image uploaded.');
    return publicUrl;
  };

  const handleCoverUpload = async (file: File) => {
    setIsUploadingCover(true);

    try {
      const { publicUrl } = await uploadPostImage(file, 'covers');
      form.setValue('cover_url', publicUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success('Cover uploaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload cover.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pageTitle = useMemo(() => (mode === 'create' ? 'New post' : 'Edit post'), [mode]);

  if (topicsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-44 rounded-full" />
        <Skeleton className="h-[640px] w-full rounded-[1.75rem]" />
      </div>
    );
  }

  if (topicsError) {
    return <StateCard title="Topics unavailable" description={topicsError} />;
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
                  <Link to={`/post/${post.id}`}>Open published view</Link>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <Link to="/">Back to feed</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(async (values) => {
              setIsSubmitting(true);

              try {
                const payload: PostMutationInput = {
                  author_id: post?.author_id ?? userId,
                  content: values.content,
                  cover_url: values.cover_url?.trim() || null,
                  excerpt: values.excerpt?.trim() || null,
                  title: values.title.trim(),
                  topic_id: values.topic_id,
                };

                const nextPost = mode === 'create' ? await createPost(payload) : await updatePost(post!.id, payload);
                toast.success(mode === 'create' ? 'Post created.' : 'Post updated.');
                navigate(`/post/${nextPost.id}`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to save the post.');
              } finally {
                setIsSubmitting(false);
              }
            })}
          >
            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="Ship useful engineering stories" {...form.register('title')} />
                  {form.formState.errors.title ? <p className="text-sm text-destructive">{form.formState.errors.title.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea id="excerpt" placeholder="A concise summary for cards and previews." className="min-h-[120px]" {...form.register('excerpt')} />
                  {form.formState.errors.excerpt ? <p className="text-sm text-destructive">{form.formState.errors.excerpt.message}</p> : null}
                </div>
              </div>

              <div className="space-y-5 rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
                <div className="space-y-2">
                  <Label htmlFor="topic_id">Topic</Label>
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
                    <option value="">Select topic</option>
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
                    <Label htmlFor="cover-upload">Cover image</Label>
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
                        Upload cover
                      </label>
                    </Button>
                  </div>
                  {coverUrl ? (
                    <div className="overflow-hidden rounded-[1.25rem] border border-border">
                      <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Upload a cover to create a stronger card preview on the feed.
                    </div>
                  )}
                  <Input value={coverUrl ?? ''} readOnly placeholder="Cover URL will appear here after upload" />
                  {form.formState.errors.cover_url ? <p className="text-sm text-destructive">{form.formState.errors.cover_url.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Content</Label>
                <p className="text-xs text-muted-foreground">Markdown</p>
              </div>
              <MarkdownEditor
                editorKey={`${mode}-${post?.id ?? 'new'}`}
                markdown={form.watch('content')}
                onChange={(value) => {
                  form.setValue('content', value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                onUploadImage={handleInlineImageUpload}
              />
              {form.formState.errors.content ? <p className="text-sm text-destructive">{form.formState.errors.content.message}</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">{mode === 'create' ? 'Публикация станет доступна сразу после сохранения.' : 'Изменения применятся сразу после сохранения.'}</div>
              <div className="flex flex-wrap gap-3">
                {mode === 'edit' && post ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>Пост будет удалён без возможности восстановления.</DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Permanent action
            </div>
            Запись будет удалена сразу. Загруженные изображения останутся в storage.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!post) {
                  return;
                }

                setIsSubmitting(true);

                try {
                  await deletePost(post.id);
                  toast.success('Post deleted.');
                  navigate('/');
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to delete the post.');
                } finally {
                  setIsSubmitting(false);
                  setIsDeleteDialogOpen(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
