import * as React from 'react';
import type { HTMLAttributes } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = Dialog.Root;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  Dialog.DialogContentProps & {
    side?: 'left' | 'right';
  }
>(({ children, className, side = 'left', ...props }, ref) => {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <Dialog.Content
        ref={ref}
        className={cn(
          'fixed top-0 z-[80] h-full w-[88vw] max-w-sm border-border bg-background/96 p-6 shadow-2xl backdrop-blur data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'left'
            ? 'left-0 border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left'
            : 'right-0 border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
          className,
        )}
        {...props}
      >
        <Dialog.Close className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
});
SheetContent.displayName = Dialog.Content.displayName;

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />;
}

export const SheetTitle = React.forwardRef<React.ElementRef<typeof Dialog.Title>, React.ComponentPropsWithoutRef<typeof Dialog.Title>>(({ className, ...props }, ref) => (
  <Dialog.Title ref={ref} className={cn('text-2xl font-extrabold leading-none tracking-tight', className)} {...props} />
));
SheetTitle.displayName = Dialog.Title.displayName;

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => <Dialog.Description ref={ref} className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />);
SheetDescription.displayName = Dialog.Description.displayName;
