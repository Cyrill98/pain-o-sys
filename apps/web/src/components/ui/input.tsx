import * as React from 'react';
import { cn } from '@/lib/utils';

// Tenang: 48px tall, 14px radius, border-strong outline, always 16px text (stops iOS zoom).
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-tap w-full min-w-0 rounded-md border border-input bg-card px-4 text-body text-foreground transition-colors selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-label file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
