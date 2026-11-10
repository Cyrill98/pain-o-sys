import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Native <select> styled like <Input>. */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-tap w-full rounded-md border border-input bg-card px-4 text-body text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-md border border-input bg-card px-4 py-3 text-body text-foreground placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-label">
        {label}
      </label>
      {children}
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Two or three mutually exclusive buttons. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-tap flex-1 items-center justify-center rounded-full border px-3 text-label transition-colors',
            value === o.value
              ? 'border-transparent bg-brand-soft text-ink'
              : 'border-line hover:bg-accent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
