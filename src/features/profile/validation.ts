import { z } from 'zod';

export const profileFormSchema = z.object({
  avatar_url: z.string().trim().url('Укажи корректную ссылку.').optional().or(z.literal('')),
  bio: z.string().trim().max(160, 'Максимум 160 символов.').optional().or(z.literal('')),
  full_name: z.string().trim().max(80, 'Максимум 80 символов.').optional().or(z.literal('')),
  handle: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа.')
    .max(32, 'Максимум 32 символа.')
    .regex(/^[a-z0-9_]+$/i, 'Используй латиницу, цифры и _.'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
