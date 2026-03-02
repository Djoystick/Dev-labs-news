import { z } from 'zod';

const handlePattern = /^[\p{L}\p{N}_.-]+(?: [\p{L}\p{N}_.-]+)*$/u;

export function normalizeProfileHandle(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
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
    .min(3, 'Минимум 3 символа.')
    .max(32, 'Максимум 32 символа.')
    .refine((value) => value === value.trim(), 'Не добавляй пробелы в начале или конце.')
    .refine((value) => !/\s{2,}/u.test(value), 'Используй не более одного пробела подряд.')
    .refine((value) => handlePattern.test(value), 'Разрешены буквы, цифры, пробелы, _, - и .')
    .transform(normalizeProfileHandle),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
