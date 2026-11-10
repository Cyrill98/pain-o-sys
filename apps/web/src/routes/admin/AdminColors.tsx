import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import {
  COLOR_FAMILIES,
  COLOR_FINISHES,
  HEX_RE,
  type Color,
  type ColorFamily,
  type ColorFinish,
} from '@app/shared';
import { Section, StatusMessage } from '@/components/admin/Section';
import { Field, Select, Textarea } from '@/components/request/fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useAdminColors,
  useCreateColor,
  useDeleteColor,
  useImportColors,
  useUpdateColor,
} from '@/lib/admin-api';
import { guessFamily, readableOn } from '@/lib/color-utils';
import { parseCsv } from '@/lib/colors-csv';
import { useErrorMessage } from '@/lib/errors';

interface Draft {
  id: string | null;
  name: string;
  code: string;
  hex: string;
  family: ColorFamily;
  finish: ColorFinish;
  collection: string;
  active: boolean;
  /** True once the admin picks a family themselves; until then it follows the HEX. */
  familyTouched: boolean;
}

const blank = (): Draft => ({
  id: null,
  name: '',
  code: '',
  hex: '#FFFFFF',
  family: 'white',
  finish: 'matt',
  collection: '',
  active: true,
  familyTouched: false,
});

const fromColor = (c: Color): Draft => ({
  id: c.id,
  name: c.name,
  code: c.code ?? '',
  hex: c.hex,
  family: c.family,
  finish: c.finish,
  collection: c.collection ?? '',
  active: c.active,
  familyTouched: true,
});

export function AdminColors() {
  const { t } = useTranslation('admin');
  const errorMessage = useErrorMessage();
  const colors = useAdminColors();
  const create = useCreateColor();
  const update = useUpdateColor();
  const remove = useDeleteColor();
  const importer = useImportColors();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [csv, setCsv] = useState('');
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const hexOk = draft ? HEX_RE.test(draft.hex) : false;
  const saving = create.isPending || update.isPending;

  const setHex = (value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const hex = value.startsWith('#') || value === '' ? value : `#${value}`;
      return {
        ...d,
        hex,
        family: !d.familyTouched && HEX_RE.test(hex) ? guessFamily(hex) : d.family,
      };
    });

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !hexOk || !draft.name.trim()) return;
    const body = {
      name: draft.name,
      code: draft.code || null,
      hex: draft.hex,
      family: draft.family,
      finish: draft.finish,
      collection: draft.collection || null,
      active: draft.active,
    };
    const done = { onSuccess: () => setDraft(null) };
    if (draft.id) update.mutate({ id: draft.id, patch: body }, done);
    else create.mutate(body, done);
  };

  const onImport = () => {
    const { colors: rows, skipped } = parseCsv(csv);
    if (rows.length === 0) {
      setCsvMessage(t('colors.importNone'));
      return;
    }
    importer.mutate(rows, {
      onSuccess: (res) => {
        const r = res as { imported: number };
        setCsvMessage(
          [
            t('colors.imported', { count: r.imported }),
            skipped ? t('colors.importSkipped', { count: skipped }) : '',
          ]
            .filter(Boolean)
            .join(' '),
        );
        setCsv('');
      },
    });
  };

  const list = colors.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-display-md">{t('colors.title')}</h1>
          <p className="text-body-sm text-muted-foreground">{t('colors.description')}</p>
        </div>
        <Button type="button" onClick={() => setDraft(blank())}>
          <Plus />
          {t('colors.add')}
        </Button>
      </div>

      {draft && (
        <Section title={draft.id ? t('colors.edit') : t('colors.add')}>
          <form onSubmit={onSave} className="flex flex-col gap-5">
            <div className="flex items-end gap-3">
              <Field label={t('colors.hex')} htmlFor="col-hex">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={t('colors.hex')}
                    value={hexOk ? draft.hex.toLowerCase() : '#ffffff'}
                    onChange={(e) => setHex(e.target.value)}
                    className="h-tap w-16 cursor-pointer rounded-md border border-input bg-card p-1"
                  />
                  <Input
                    id="col-hex"
                    value={draft.hex}
                    maxLength={7}
                    onChange={(e) => setHex(e.target.value.toUpperCase())}
                    aria-invalid={!hexOk}
                    className="w-32 font-mono"
                  />
                </div>
              </Field>
            </div>
            {!hexOk && <p className="text-caption text-danger">{t('colors.hexInvalid')}</p>}
            <Field label={t('colors.name')} htmlFor="col-name">
              <Input
                id="col-name"
                value={draft.name}
                maxLength={80}
                required
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label={t('colors.code')} htmlFor="col-code">
              <Input
                id="col-code"
                value={draft.code}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('colors.family')} htmlFor="col-family">
                <Select
                  id="col-family"
                  value={draft.family}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      family: e.target.value as ColorFamily,
                      familyTouched: true,
                    })
                  }
                >
                  {COLOR_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {t(`colors.families.${f}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('colors.finish')} htmlFor="col-finish">
                <Select
                  id="col-finish"
                  value={draft.finish}
                  onChange={(e) => setDraft({ ...draft, finish: e.target.value as ColorFinish })}
                >
                  {COLOR_FINISHES.map((f) => (
                    <option key={f} value={f}>
                      {t(`colors.finishes.${f}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t('colors.collection')} htmlFor="col-collection">
              <Input
                id="col-collection"
                value={draft.collection}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, collection: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-3 text-body">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="size-5 accent-[var(--brand-text)]"
              />
              {t('colors.visible')}
            </label>
            {(create.isError || update.isError) && (
              <StatusMessage tone="error">
                {errorMessage(create.error ?? update.error)}
              </StatusMessage>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving || !hexOk || !draft.name.trim()}>
                {saving ? t('actions.saving') : t('actions.save')}
              </Button>
            </div>
          </form>
        </Section>
      )}

      {colors.isSuccess && list.length === 0 && !draft && (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted-foreground">
          {t('colors.empty')}
        </p>
      )}
      {colors.isError && <StatusMessage tone="error">{errorMessage(colors.error)}</StatusMessage>}

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-card p-2 pr-3"
          >
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-md border border-line text-caption"
              style={{ backgroundColor: c.hex, color: readableOn(c.hex) }}
            >
              {!c.active && <EyeOff className="size-5" aria-label={t('colors.hidden')} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-label">{c.name}</p>
              <p className="truncate text-caption text-muted-foreground">
                {[c.code, c.hex, t(`colors.finishes.${c.finish}`)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={c.active ? t('colors.hidden') : t('colors.visible')}
              onClick={() => update.mutate({ id: c.id, patch: { active: !c.active } })}
            >
              {c.active ? <Eye /> : <EyeOff />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('actions.edit')}
              onClick={() => setDraft(fromColor(c))}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('actions.delete')}
              onClick={() => {
                if (window.confirm(t('colors.deleteConfirm', { name: c.name })))
                  remove.mutate(c.id);
              }}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <Section title={t('colors.import')} description={t('colors.importHelp')}>
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={t('colors.importPlaceholder')}
          className="font-mono text-body-sm"
          aria-label={t('colors.import')}
        />
        {csvMessage && <StatusMessage tone="success">{csvMessage}</StatusMessage>}
        {importer.isError && (
          <StatusMessage tone="error">{errorMessage(importer.error)}</StatusMessage>
        )}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={!csv.trim() || importer.isPending}
          onClick={onImport}
        >
          <Upload />
          {t('colors.importButton')}
        </Button>
      </Section>
    </div>
  );
}
