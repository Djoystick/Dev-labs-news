import { getSupabaseClient } from '@/lib/supabase';

const bucketName = 'posts';

function getFileExtension(file: File) {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? 'bin' : 'bin';
}

export async function uploadPostImage(file: File, folder: 'covers' | 'inline' = 'covers') {
  const supabase = getSupabaseClient();
  const extension = getFileExtension(file);
  const filePath = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucketName).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload image. ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return {
    filePath,
    publicUrl,
  };
}
