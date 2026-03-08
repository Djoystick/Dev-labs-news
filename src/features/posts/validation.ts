import { z } from 'zod';
import { normalizePostCustomTags, POST_CUSTOM_TAG_MAX_LENGTH, POST_CUSTOM_TAGS_LIMIT } from '@/features/posts/custom-tags';

export const postFormSchema = z.object({
  content: z.string().min(1, 'Текст обязателен.'),
  cover_url: z.union([z.string().url('Некорректный URL обложки.').trim(), z.literal('')]).optional(),
  custom_tags: z
    .array(z.string())
    .transform((tags) => normalizePostCustomTags(tags))
    .refine((tags) => tags.length <= POST_CUSTOM_TAGS_LIMIT, `Можно добавить не более ${POST_CUSTOM_TAGS_LIMIT} тегов.`)
    .refine((tags) => tags.every((tag) => tag.length > 0), 'Пустые теги недопустимы.')
    .refine((tags) => tags.every((tag) => tag.length <= POST_CUSTOM_TAG_MAX_LENGTH), `Ограничьте тег до ${POST_CUSTOM_TAG_MAX_LENGTH} символов.`),
  excerpt: z.string().max(320, 'Анонс должен быть не длиннее 320 символов.').optional(),
  title: z.string().min(3, 'Заголовок обязателен.').max(160, 'Заголовок слишком длинный.'),
  topic_id: z.string().min(1, 'Раздел обязателен.'),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
