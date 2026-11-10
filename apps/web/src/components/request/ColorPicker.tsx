import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { COLOR_FAMILIES, type Color, type ColorFamily } from '@app/shared';
import { Input } from '@/components/ui/input';
import { readableOn } from '@/lib/color-utils';
import { cn } from '@/lib/utils';

/** Swatch grid with family chips and search. `value` is a color id. */
export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: Color[];
  value: string | null;
  onChange: (color: Color) => void;
}) {
  const { t } = useTranslation('request');
  const [family, setFamily] = useState<ColorFamily | 'all'>('all');
  const [query, setQuery] = useState('');

  const present = useMemo(
    () => COLOR_FAMILIES.filter((f) => colors.some((c) => c.family === f)),
    [colors],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return colors.filter(
      (c) =>
        (family === 'all' || c.family === family) &&
        (!q || c.name.toLowerCase().includes(q) || (c.code ?? '').toLowerCase().includes(q)),
    );
  }, [colors, family, query]);

  if (colors.length === 0) {
    return <p className="text-body-sm text-muted-foreground">{t('colors.none')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('colors.search')}
        aria-label={t('colors.search')}
      />
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(['all', ...present] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFamily(f)}
            aria-pressed={family === f}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-label transition-colors',
              family === f
                ? 'border-transparent bg-brand-soft text-ink'
                : 'border-line text-muted-foreground hover:bg-accent',
            )}
          >
            {t(`colors.families.${f}`)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{t('colors.empty')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shown.map((c) => {
            const selected = c.id === value;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c)}
                  aria-pressed={selected}
                  aria-label={[c.name, c.code].filter(Boolean).join(' ')}
                  className={cn(
                    'flex w-full flex-col overflow-hidden rounded-md border text-left transition-shadow',
                    selected ? 'border-ink ring-2 ring-ink' : 'border-line',
                  )}
                >
                  <span
                    className="relative flex h-16 items-start justify-end p-1.5"
                    style={{ backgroundColor: c.hex, color: readableOn(c.hex) }}
                  >
                    {selected && <Check className="size-5" aria-hidden />}
                  </span>
                  <span className="bg-card px-2 py-1.5">
                    <span className="block truncate text-caption">{c.name}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {c.code ?? t(`colors.finish.${c.finish}`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
