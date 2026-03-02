import { z } from 'zod';

const handlePattern = /^[\p{L}\p{N} _\-.]+$/u;

export function normalizeProfileHandle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeProfileHandleNorm(value: string) {
  return normalizeProfileHandle(value).toLowerCase();
}

export function normalizeOptionalProfileText(value: string | undefined) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export const profileFormSchema = z.object({
  avatar_url: z.string().trim().url('Укажи корректную ссылку.').optional().or(z.literal('')),
  bio: z
    .string()
    .transform(normalizeOptionalProfileText)
    .refine((value) => value.length <= 160, 'Максимум 160 символов.')
    .optional()
    .or(z.literal('')),
  full_name: z
    .string()
    .transform(normalizeOptionalProfileText)
    .refine((value) => value.length <= 60, 'Максимум 60 символов.')
    .optional()
    .or(z.literal('')),
  handle: z
    .string()
    .transform(normalizeProfileHandle)
    .refine((value) => value.length >= 3, 'Минимум 3 символа.')
    .refine((value) => value.length <= 32, 'Максимум 32 символа.')
    .refine((value) => handlePattern.test(value), 'Разрешены буквы, цифры, пробелы, _, - и .'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
