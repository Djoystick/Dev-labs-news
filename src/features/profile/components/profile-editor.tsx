import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, LoaderCircle, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { updateProfileDetails } from '@/features/profile/api';
import { uploadAvatar } from '@/features/profile/storage';
import { profileFormSchema, type ProfileFormValues } from '@/features/profile/validation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Profile } from '@/types/db';

function getInitials(value: string | null | undefined) {
  if (!value) {
    return 'DL';
  }

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);

    return () => {
      mediaQuery.removeEventListener('change', updateMatch);
    };
  }, []);

  return isMobile;
}

type ProfileEditorProps = {
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: Profile) => void;
  open: boolean;
  profile: Profile;
  userEmail: string | null | undefined;
};

export function ProfileEditor({ onOpenChange, onSaved, open, profile, userEmail }: ProfileEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const isMobile = useIsMobile();
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      avatar_url: profile.avatar_url ?? '',
      bio: profile.bio ?? '',
      full_name: profile.full_name ?? '',
      handle: profile.handle ?? profile.username ?? '',
    },
    resolver: zodResolver(profileFormSchema),
  });

  useEffect(() => {
    form.reset({
      avatar_url: profile.avatar_url ?? '',
      bio: profile.bio ?? '',
      full_name: profile.full_name ?? '',
      handle: profile.handle ?? profile.username ?? '',
    });
  }, [form, profile]);

  const avatarUrl = form.watch('avatar_url');
  const previewName = form.watch('full_name') || form.watch('handle') || userEmail || 'Reader';

  const content = (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={avatarUrl || undefined} alt={previewName} />
          <AvatarFallback className="text-lg">{getInitials(previewName)}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <input
            id="avatar-upload"
            accept="image/*"
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (!file) {
                return;
              }

              setIsUploadingAvatar(true);

              void uploadAvatar(profile.id, file)
                .then(({ publicUrl }) => {
                  form.setValue('avatar_url', publicUrl, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  toast.success('Аватар обновлён.');
                })
                .catch((error) => {
                  toast.error(error instanceof Error ? error.message : 'Не удалось загрузить аватар.');
                })
                .finally(() => {
                  setIsUploadingAvatar(false);
                });
            }}
          />
          <Button asChild size="sm" variant="outline" className="h-9 rounded-full px-3" disabled={isUploadingAvatar}>
            <label htmlFor="avatar-upload" className="cursor-pointer">
              {isUploadingAvatar ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Загрузить аватар
            </label>
          </Button>
        </div>
      </div>

      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          setIsSaving(true);

          try {
            const nextProfile = await updateProfileDetails(profile.id, {
              avatar_url: values.avatar_url?.trim() || null,
              bio: values.bio?.trim() || null,
              full_name: values.full_name?.trim() || null,
              handle: values.handle.trim().toLowerCase(),
            });

            toast.success('Профиль сохранён.');
            onSaved(nextProfile);
            onOpenChange(false);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Не удалось сохранить профиль.');
          } finally {
            setIsSaving(false);
          }
        })}
      >
        <div className="space-y-2">
          <Label htmlFor="profile-handle">Псевдоним</Label>
          <Input id="profile-handle" placeholder="devreader" {...form.register('handle')} />
          {form.formState.errors.handle ? <p className="text-sm text-destructive">{form.formState.errors.handle.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-full-name">Имя</Label>
          <Input id="profile-full-name" placeholder="Как тебя зовут" {...form.register('full_name')} />
          {form.formState.errors.full_name ? <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-bio">О себе</Label>
          <Textarea id="profile-bio" className="min-h-[110px]" placeholder="Коротко о себе" {...form.register('bio')} />
          {form.formState.errors.bio ? <p className="text-sm text-destructive">{form.formState.errors.bio.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-avatar-url">Ссылка на аватар</Label>
          <Input id="profile-avatar-url" placeholder="https://..." {...form.register('avatar_url')} />
          {form.formState.errors.avatar_url ? <p className="text-sm text-destructive">{form.formState.errors.avatar_url.message}</p> : null}
        </div>
        <div className="grid gap-4 rounded-[1.25rem] border border-border/70 bg-secondary/40 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold text-muted-foreground">Telegram username</p>
            <p className="mt-1 break-all">{profile.username ? `@${profile.username}` : 'Не указан'}</p>
          </div>
          <div>
            <p className="font-semibold text-muted-foreground">Email</p>
            <p className="mt-1 break-all">{userEmail ?? 'Не указан'}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || isUploadingAvatar}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      </form>
    </div>
  );

  const header = useMemo(
    () => (
      <>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold">Редактировать профиль</h2>
          <p className="text-sm leading-6 text-muted-foreground">Обнови псевдоним, имя, описание и аватар.</p>
        </div>
        {content}
      </>
    ),
    [content],
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="safe-pt w-full max-w-md overflow-y-auto">
          {header}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>Обнови псевдоним, имя, описание и аватар.</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
