import { z } from 'zod';

export const postFormSchema = z.object({
  content: z.string().min(1, 'Content is required.'),
  cover_url: z.union([z.string().url('Cover URL must be valid.').trim(), z.literal('')]).optional(),
  excerpt: z.string().max(320, 'Excerpt must be 320 characters or fewer.').optional(),
  title: z.string().min(3, 'Title is required.').max(160, 'Title is too long.'),
  topic_id: z.string().min(1, 'Topic is required.'),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
