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
          setTopicsError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЂР°Р·РґРµР»С‹. РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СЂРµР·РµСЂРІРЅС‹Р№ СЃРїРёСЃРѕРє.');
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
  const submitLabel = isSubmitting ? 'РЎРѕС…СЂР°РЅРµРЅРёРµвЂ¦' : mode === 'create' ? 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ' : 'РЎРѕС…СЂР°РЅРёС‚СЊ';
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
      toast.success('РћР±Р»РѕР¶РєР° Р·Р°РіСЂСѓР¶РµРЅР°.');
    } catch {
      toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РѕР±Р»РѕР¶РєСѓ.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const pageTitle = useMemo(() => (mode === 'create' ? 'РќРѕРІР°СЏ РЅРѕРІРѕСЃС‚СЊ' : 'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РЅРѕРІРѕСЃС‚Рё'), [mode]);

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
        ? [...FALLBACK_SECTION_TOPICS, { id: post.topic_id, slug: 'current', name: 'РўРµРєСѓС‰РёР№ СЂР°Р·РґРµР»', created_at: '' }]
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
                  <AppLink to={`/post/${post.id}`}>РћС‚РєСЂС‹С‚СЊ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅСѓСЋ РІРµСЂСЃРёСЋ</AppLink>
                </Button>
              ) : null}
              <Button asChild variant="ghost">
                <AppLink to="/">РќР°Р·Р°Рґ Рє Р»РµРЅС‚Рµ</AppLink>
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
                  toast.success('РќРѕРІРѕСЃС‚СЊ РѕРїСѓР±Р»РёРєРѕРІР°РЅР°.');
                  navigate('/', { replace: true });
                  return;
                }

                await updatePost(post!.id, payload);
                toast.success('РќРѕРІРѕСЃС‚СЊ СЃРѕС…СЂР°РЅРµРЅР°.');

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

                setSubmitError('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РЅРѕРІРѕСЃС‚СЊ.');
                toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РЅРѕРІРѕСЃС‚СЊ.');
              } finally {
                setIsSubmitting(false);
              }
            })}
          >
            {submitError ? <div className="border-y border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}
            {topicsError ? <StateCard title="Р Р°Р·РґРµР»С‹ РЅРµРґРѕСЃС‚СѓРїРЅС‹" description={topicsError} /> : null}
            {!topicsError && !hasSectionTopics ? <StateCard title="Р Р°Р·РґРµР»С‹ РЅРµ РЅР°Р№РґРµРЅС‹" description="Р Р°Р·РґРµР»С‹ РЅРµ РЅР°Р№РґРµРЅС‹. РџСЂРѕРІРµСЂСЊС‚Рµ РјРёРіСЂР°С†РёРё." /> : null}

            <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">Р—Р°РіРѕР»РѕРІРѕРє</Label>
                  <Input id="title" placeholder="Р’РІРµРґРёС‚Рµ Р·Р°РіРѕР»РѕРІРѕРє" {...form.register('title')} />
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
                    <option value="">Р’С‹Р±РµСЂРёС‚Рµ СЂР°Р·РґРµР»</option>
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
                    <Label htmlFor="cover-upload">РћР±Р»РѕР¶РєР°</Label>
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
                        Р—Р°РіСЂСѓР·РёС‚СЊ
                      </label>
                    </Button>
                  </div>
                  {coverUrl ? (
                    <div className="border-y border-border/60 py-3">
                      <img src={coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
                    </div>
                  ) : (
                    <div className="border-y border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                      Р—Р°РіСЂСѓР·РёС‚Рµ РѕР±Р»РѕР¶РєСѓ, С‡С‚РѕР±С‹ РєР°СЂС‚РѕС‡РєР° РЅРѕРІРѕСЃС‚Рё РІС‹РіР»СЏРґРµР»Р° Р»СѓС‡С€Рµ РІ Р»РµРЅС‚Рµ.
                    </div>
                  )}
                  <Input value={coverUrl ?? ''} readOnly placeholder="URL РѕР±Р»РѕР¶РєРё РїРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё" />
                  {form.formState.errors.cover_url ? <p className="text-sm text-destructive">{form.formState.errors.cover_url.message}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>РўРµРєСЃС‚</Label>
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
                placeholder="Р’РІРµРґРёС‚Рµ С‚РµРєСЃС‚ РЅРѕРІРѕСЃС‚Рё РІ РІРёР·СѓР°Р»СЊРЅРѕРј СЂРµРґР°РєС‚РѕСЂРµ. РЎРѕС…СЂР°РЅРµРЅРёРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РІ markdown."
              />
              {form.formState.errors.content ? <p className="text-sm text-destructive">{form.formState.errors.content.message}</p> : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {mode === 'create' ? 'РџСѓР±Р»РёРєР°С†РёСЏ СЃС‚Р°РЅРµС‚ РґРѕСЃС‚СѓРїРЅР° СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ.' : 'РР·РјРµРЅРµРЅРёСЏ РїСЂРёРјРµРЅСЏС‚СЃСЏ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СЃРѕС…СЂР°РЅРµРЅРёСЏ.'}
              </div>
              <div className="flex flex-wrap gap-3">
                {mode === 'edit' && post && canDeletePost ? (
                  <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    РЈРґР°Р»РёС‚СЊ
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
            <DialogTitle>РЈРґР°Р»РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ?</DialogTitle>
            <DialogDescription>РќРѕРІРѕСЃС‚СЊ Р±СѓРґРµС‚ СѓРґР°Р»РµРЅР° Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.</DialogDescription>
          </DialogHeader>
          <div className="border-y border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              РќРµРѕР±СЂР°С‚РёРјРѕРµ РґРµР№СЃС‚РІРёРµ
            </div>
            РќРѕРІРѕСЃС‚СЊ Р±СѓРґРµС‚ СѓРґР°Р»РµРЅР° СЃСЂР°Р·Сѓ. Р—Р°РіСЂСѓР¶РµРЅРЅС‹Рµ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РѕСЃС‚Р°РЅСѓС‚СЃСЏ РІ storage.
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              РћС‚РјРµРЅР°
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
                  toast.success('РќРѕРІРѕСЃС‚СЊ СѓРґР°Р»РµРЅР°.');
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

                  setSubmitError('РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ.');
                  toast.error('РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ.');
                } finally {
                  setIsSubmitting(false);
                  setIsDeleteDialogOpen(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              РЈРґР°Р»РёС‚СЊ РЅРѕРІРѕСЃС‚СЊ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
