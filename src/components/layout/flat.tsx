import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type FlatProps = ComponentPropsWithoutRef<'div'>;

export function FlatPage({ className, ...props }: FlatProps) {
  return <div className={cn('w-full px-4 sm:px-6', className)} {...props} />;
}

export function FlatSection({ className, ...props }: FlatProps) {
  return <div className={cn('border-b border-border/60 py-4', className)} {...props} />;
}

export function FlatDivider({ className, ...props }: FlatProps) {
  return <div className={cn('h-px bg-border/60', className)} {...props} />;
}
