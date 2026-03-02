import { getSupabaseClient } from '@/lib/supabase';

const bucketName = 'avatars';

function getFileExtension(file: File) {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? 'bin' : 'bin';
}

export async function uploadAvatar(userId: string, file: File) {
  const supabase = getSupabaseClient();
  const extension = getFileExtension(file);
  const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucketName).upload(filePath, file, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    throw new Error(`Не удалось загрузить аватар. ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl,
  };
}
