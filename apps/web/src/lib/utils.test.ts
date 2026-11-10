import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn with the Tenang theme', () => {
  it('keeps a text colour alongside a Tenang font size', () => {
    expect(cn('text-destructive-foreground', 'text-body')).toBe(
      'text-destructive-foreground text-body',
    );
    expect(cn('text-brand-text', 'text-label')).toBe('text-brand-text text-label');
  });

  it('still lets a later font size replace an earlier one', () => {
    expect(cn('text-body', 'text-title')).toBe('text-title');
    expect(cn('text-sm', 'text-body')).toBe('text-body');
  });

  it('understands shadow-soft, rounded-pill and the tap size', () => {
    expect(cn('shadow-sm', 'shadow-soft')).toBe('shadow-soft');
    expect(cn('shadow-soft', 'shadow-ink')).toBe('shadow-soft shadow-ink');
    expect(cn('rounded-md', 'rounded-pill')).toBe('rounded-pill');
    expect(cn('h-9', 'h-tap')).toBe('h-tap');
    expect(cn('min-h-tap', 'min-h-16')).toBe('min-h-16');
  });
});
