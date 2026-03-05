import { z } from 'zod';

export const postFormSchema = z.object({
  content: z.string().min(1, 'Текст обязателен.'),
  cover_url: z.union([z.string().url('Некорректный URL обложки.').trim(), z.literal('')]).optional(),
  excerpt: z.string().max(320, 'Анонс должен быть не длиннее 320 символов.').optional(),
  title: z.string().min(3, 'Заголовок обязателен.').max(160, 'Заголовок слишком длинный.'),
  topic_id: z.string().min(1, 'Раздел обязателен.'),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
