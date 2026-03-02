import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must contain at least 8 characters.'),
});

export const signUpSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must contain at least 8 characters.'),
    confirmPassword: z.string().min(8, 'Confirm the password.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
