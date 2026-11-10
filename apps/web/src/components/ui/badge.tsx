import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

// Tenang status badges: pill, label type, soft tint + readable text colour.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-3 py-1 text-label whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-4',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        confirmed: 'bg-brand-soft text-ink',
        pending: 'bg-clay-soft text-clay-text',
        declined: 'bg-danger-soft text-danger',
        outline: 'border border-line text-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

function Badge({
  className,
  variant = 'neutral',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
