import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** A titled card section on admin pages. */
export function Section({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card aria-labelledby={id ? `${id}-title` : undefined} role={id ? 'region' : undefined}>
      <CardHeader>
        <CardTitle id={id ? `${id}-title` : undefined} className="text-title">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
    </Card>
  );
}

/** Polite status line for "Saved" messages and errors. */
export function StatusMessage({
  tone,
  children,
}: {
  tone: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger'
          : 'rounded-md bg-brand-soft px-4 py-3 text-body-sm text-ink'
      }
    >
      {children}
    </p>
  );
}
