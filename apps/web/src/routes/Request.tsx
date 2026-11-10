import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Check, ChevronDown, Copy, Eye, MessageCircle, Plus, Trash2 } from 'lucide-react';
import {
  AREAS_BY_PROPERTY,
  AREA_CONDITIONS,
  MAX_AREAS,
  PROPERTY_TYPES,
  type AreaCondition,
  type AreaType,
  type Color,
  type CreateRequestResponse,
  type PropertyType,
} from '@app/shared';
import { PublicLayout } from '@/components/booking/PublicLayout';
import { Turnstile } from '@/components/booking/Turnstile';
import { ColorPicker } from '@/components/request/ColorPicker';
import { Field, Segmented, Select, Textarea } from '@/components/request/fields';
import { Visualizer, type VisualizerResult } from '@/components/request/Visualizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { readableOn } from '@/lib/color-utils';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';
import { TURNSTILE_SITE_KEY } from '@/lib/config';
import {
  createRequest,
  reportWhatsappOpened,
  uploadImage,
  useColors,
  usePublicSettings,
} from '@/lib/public-api';
import { cn } from '@/lib/utils';

type Step = 'property' | 'areas' | 'details' | 'contact' | 'sent';
const FORM_STEPS: Step[] = ['property', 'areas', 'details', 'contact'];

interface AreaDraft {
  key: string;
  areaType: AreaType;
  label: string;
  exterior: boolean;
  sizeSqft: string;
  condition: AreaCondition;
  furnished: boolean;
  colorId: string | null;
  original: Blob | null;
  snapshot: Blob | null;
  snapshotUrl: string | null;
}

let counter = 0;
const newArea = (areaType: AreaType): AreaDraft => ({
  key: `a${++counter}`,
  areaType,
  label: '',
  exterior: areaType === 'exterior_wall' || areaType === 'fence',
  sizeSqft: '',
  condition: 'good',
  furnished: false,
  colorId: null,
  original: null,
  snapshot: null,
  snapshotUrl: null,
});

export function Request() {
  const { t } = useTranslation('request');
  const { t: tc } = useTranslation();
  const lang = useLang();
  const errorMessage = useErrorMessage();
  const colorsQuery = useColors();
  const settings = usePublicSettings();
  const colors = useMemo(() => colorsQuery.data ?? [], [colorsQuery.data]);

  const [step, setStep] = useState<Step>('property');
  const [property, setProperty] = useState<PropertyType | null>(null);
  const [areas, setAreas] = useState<AreaDraft[]>([]);
  const [contact, setContact] = useState({
    name: '',
    phone: '',
    town: '',
    address: '',
    dates: '',
    notes: '',
  });
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState('');
  const [tokenReset, setTokenReset] = useState(0);
  const [busy, setBusy] = useState<'upload' | 'send' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<CreateRequestResponse | null>(null);
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // Free object URLs of preview thumbnails when leaving the page.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  const update = (key: string, patch: Partial<AreaDraft>) =>
    setAreas((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const chooseProperty = (p: PropertyType) => {
    if (p !== property) setAreas([]);
    setProperty(p);
    setStep('areas');
  };

  const toggleArea = (type: AreaType) =>
    setAreas((list) =>
      list.some((a) => a.areaType === type)
        ? list.filter((a) => a.areaType !== type)
        : list.length >= MAX_AREAS
          ? list
          : [...list, newArea(type)],
    );

  const duplicate = (a: AreaDraft) =>
    setAreas((list) => {
      if (list.length >= MAX_AREAS) return list;
      const i = list.findIndex((x) => x.key === a.key);
      const copy = { ...newArea(a.areaType), exterior: a.exterior, condition: a.condition };
      return [...list.slice(0, i + 1), copy, ...list.slice(i + 1)];
    });

  const onPreview = (areaKey: string, r: VisualizerResult) => {
    const url = URL.createObjectURL(r.snapshot);
    urls.current.push(url);
    update(areaKey, {
      colorId: r.colorId,
      original: r.original,
      snapshot: r.snapshot,
      snapshotUrl: url,
    });
    setPreviewFor(null);
  };

  const colorOf = (id: string | null): Color | undefined => colors.find((c) => c.id === id);
  const previewCount = areas.filter((a) => a.snapshot).length;
  const needsToken = Boolean(TURNSTILE_SITE_KEY);
  const canSubmit =
    contact.name.trim() !== '' &&
    contact.phone.trim() !== '' &&
    consent &&
    (!needsToken || token !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!property || !canSubmit || busy) return;
    setError(null);
    try {
      setBusy('upload');
      const withPhotos = await Promise.all(
        areas.map(async (a) => ({
          a,
          originalPhotoId: a.original ? await uploadImage(a.original) : null,
          snapshotId: a.snapshot ? await uploadImage(a.snapshot) : null,
        })),
      );
      setBusy('send');
      const res = await createRequest({
        name: contact.name,
        phone: contact.phone,
        town: contact.town,
        address: contact.address,
        preferredDates: contact.dates,
        notes: contact.notes,
        propertyType: property,
        lang,
        consent: true,
        turnstileToken: token,
        areas: withPhotos.map(({ a, originalPhotoId, snapshotId }) => ({
          areaType: a.areaType,
          label: a.label || undefined,
          exterior: a.exterior,
          sizeSqft: a.sizeSqft ? Math.round(Number(a.sizeSqft)) : undefined,
          condition: a.condition,
          furnished: a.furnished,
          colorId: a.colorId,
          originalPhotoId,
          snapshotId,
        })),
      });
      setResult(res);
      setStep('sent');
    } catch (err) {
      setError(err);
      setToken('');
      setTokenReset((n) => n + 1);
    } finally {
      setBusy(null);
    }
  };

  const copyMessage = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.message);
      setCopied(true);
    } catch {
      // Clipboard blocked: the text is still selectable on the page.
    }
  };

  const stepIndex = FORM_STEPS.indexOf(step);
  const back = () => setStep(FORM_STEPS[Math.max(0, stepIndex - 1)]!);
  const previewArea = areas.find((a) => a.key === previewFor);

  return (
    <PublicLayout>
      <div ref={top} className="flex flex-col gap-6">
        {step !== 'sent' && (
          <nav aria-label={t('stepLabel', { n: stepIndex + 1, total: FORM_STEPS.length })}>
            <ol className="flex gap-1.5">
              {FORM_STEPS.map((s, i) => (
                <li
                  key={s}
                  aria-current={s === step ? 'step' : undefined}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    i <= stepIndex ? 'bg-brand-text' : 'bg-line',
                  )}
                />
              ))}
            </ol>
            <p className="mt-2 text-caption text-muted-foreground">
              {t('stepLabel', { n: stepIndex + 1, total: FORM_STEPS.length })} ·{' '}
              {t(`steps.${step}`)}
            </p>
          </nav>
        )}

        {step === 'property' && (
          <section className="flex flex-col gap-4">
            <h1 className="font-display text-display-md">{t('property.title')}</h1>
            <ul className="grid grid-cols-2 gap-3">
              {PROPERTY_TYPES.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => chooseProperty(p)}
                    aria-pressed={property === p}
                    className={cn(
                      'flex min-h-20 w-full items-center justify-center rounded-lg border bg-card px-3 py-4 text-center text-label shadow-soft transition-colors hover:bg-accent',
                      property === p ? 'border-ink ring-2 ring-ink' : 'border-line',
                    )}
                  >
                    {t(`property.options.${p}`)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 'areas' && property && (
          <section className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-display-md">{t('areas.title')}</h1>
              <p className="mt-1 text-body-sm text-muted-foreground">{t('areas.hint')}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {AREAS_BY_PROPERTY[property].map((type) => {
                const on = areas.some((a) => a.areaType === type);
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => toggleArea(type)}
                      aria-pressed={on}
                      className={cn(
                        'flex min-h-tap w-full items-center justify-between gap-3 rounded-md border bg-card px-4 text-left text-body transition-colors hover:bg-accent',
                        on ? 'border-ink ring-2 ring-ink' : 'border-line',
                      )}
                    >
                      {t(`areas.names.${type}`)}
                      {on && <Check className="size-5 text-brand-text" aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={back}>
                {tc('back')}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={areas.length === 0}
                onClick={() => setStep('details')}
              >
                {tc('next')}
              </Button>
            </div>
            {areas.length === 0 && (
              <p className="text-caption text-muted-foreground">{t('areas.none')}</p>
            )}
          </section>
        )}

        {step === 'details' && (
          <section className="flex flex-col gap-4">
            <div>
              <h1 className="font-display text-display-md">{t('details.title')}</h1>
              <p className="mt-1 text-body-sm text-muted-foreground">{t('details.hint')}</p>
            </div>
            {areas.map((a) => {
              const color = colorOf(a.colorId);
              const open = pickerFor === a.key;
              return (
                <Card key={a.key}>
                  <CardContent className="flex flex-col gap-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-title">{t(`areas.names.${a.areaType}`)}</h2>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => duplicate(a)}
                          disabled={areas.length >= MAX_AREAS}
                          aria-label={t('details.duplicate')}
                        >
                          <Plus />
                        </Button>
                        {areas.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setAreas((l) => l.filter((x) => x.key !== a.key))}
                            aria-label={t('details.removeArea')}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Field label={t('details.label')} htmlFor={`label-${a.key}`}>
                      <Input
                        id={`label-${a.key}`}
                        value={a.label}
                        maxLength={60}
                        placeholder={t('details.labelPlaceholder')}
                        onChange={(e) => update(a.key, { label: e.target.value })}
                      />
                    </Field>

                    <div className="flex flex-col gap-2">
                      <span className="text-label">{t('details.color')}</span>
                      <button
                        type="button"
                        onClick={() => setPickerFor(open ? null : a.key)}
                        aria-expanded={open}
                        className="flex min-h-tap items-center gap-3 rounded-md border border-input bg-card px-3 text-left"
                      >
                        <span
                          aria-hidden
                          className="size-8 shrink-0 rounded-full border border-line"
                          style={{ backgroundColor: color?.hex ?? 'transparent' }}
                        />
                        <span className="flex-1 truncate">
                          {color
                            ? [color.name, color.code].filter(Boolean).join(' · ')
                            : t('details.noColor')}
                        </span>
                        <span className="text-label text-brand-text">
                          {color ? t('details.change') : t('details.pick')}
                        </span>
                        <ChevronDown
                          className={cn('size-4 transition-transform', open && 'rotate-180')}
                          aria-hidden
                        />
                      </button>
                      {open && (
                        <ColorPicker
                          colors={colors}
                          value={a.colorId}
                          onChange={(c) => {
                            update(a.key, { colorId: c.id });
                            setPickerFor(null);
                          }}
                        />
                      )}
                    </div>

                    {a.snapshotUrl ? (
                      <div className="flex flex-col gap-2">
                        <img
                          src={a.snapshotUrl}
                          alt={t('details.previewDone')}
                          className="w-full rounded-md border border-line"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => setPreviewFor(a.key)}
                          >
                            <Eye />
                            {t('details.previewAgain')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              update(a.key, { original: null, snapshot: null, snapshotUrl: null })
                            }
                          >
                            {t('details.removePreview')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewFor(a.key)}
                        disabled={colors.length === 0}
                      >
                        <Eye />
                        {t('details.preview')}
                      </Button>
                    )}

                    <Field
                      label={t('details.size')}
                      hint={t('details.sizeHint')}
                      htmlFor={`size-${a.key}`}
                    >
                      <Input
                        id={`size-${a.key}`}
                        inputMode="numeric"
                        value={a.sizeSqft}
                        onChange={(e) =>
                          update(a.key, { sizeSqft: e.target.value.replace(/\D/g, '').slice(0, 6) })
                        }
                      />
                    </Field>

                    <Segmented
                      label={t('details.where')}
                      value={a.exterior ? 'out' : 'in'}
                      onChange={(v) => update(a.key, { exterior: v === 'out' })}
                      options={[
                        { value: 'in', label: t('details.interior') },
                        { value: 'out', label: t('details.exterior') },
                      ]}
                    />

                    <Field label={t('details.condition')} htmlFor={`cond-${a.key}`}>
                      <Select
                        id={`cond-${a.key}`}
                        value={a.condition}
                        onChange={(e) =>
                          update(a.key, { condition: e.target.value as AreaCondition })
                        }
                      >
                        {AREA_CONDITIONS.map((c) => (
                          <option key={c} value={c}>
                            {t(`details.conditions.${c}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`furn-${a.key}`} className="text-body">
                        {t('details.furnished')}
                      </label>
                      <Switch
                        id={`furn-${a.key}`}
                        checked={a.furnished}
                        onCheckedChange={(v) => update(a.key, { furnished: v })}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={back}>
                {tc('back')}
              </Button>
              <Button type="button" className="flex-1" onClick={() => setStep('contact')}>
                {tc('next')}
              </Button>
            </div>
          </section>
        )}

        {step === 'contact' && (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
            <h1 className="font-display text-display-md">{t('contact.title')}</h1>

            <div className="rounded-md bg-brand-soft px-4 py-3 text-body-sm">
              <p className="text-label">{t('contact.summary')}</p>
              <p>
                {property && t(`property.options.${property}`)} ·{' '}
                {t('contact.areasCount', { count: areas.length })}
                {previewCount > 0 && ` · ${t('contact.previews', { count: previewCount })}`}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {areas.map((a) => {
                  const c = colorOf(a.colorId);
                  return (
                    <li
                      key={a.key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-caption"
                    >
                      <span
                        aria-hidden
                        className="size-3 rounded-full border border-line"
                        style={{
                          backgroundColor: c?.hex ?? 'transparent',
                          color: c ? readableOn(c.hex) : undefined,
                        }}
                      />
                      {a.label || t(`areas.names.${a.areaType}`)}
                    </li>
                  );
                })}
              </ul>
            </div>

            <Field label={t('contact.name')} htmlFor="c-name">
              <Input
                id="c-name"
                autoComplete="name"
                maxLength={80}
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                required
              />
            </Field>
            <Field label={t('contact.phone')} hint={t('contact.phoneHelp')} htmlFor="c-phone">
              <Input
                id="c-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="012-345 6789"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                required
              />
            </Field>
            <Field label={t('contact.town')} htmlFor="c-town">
              <Input
                id="c-town"
                autoComplete="address-level2"
                maxLength={80}
                value={contact.town}
                onChange={(e) => setContact({ ...contact, town: e.target.value })}
              />
            </Field>
            <Field label={t('contact.address')} htmlFor="c-address">
              <Input
                id="c-address"
                autoComplete="street-address"
                maxLength={200}
                value={contact.address}
                onChange={(e) => setContact({ ...contact, address: e.target.value })}
              />
            </Field>
            <Field label={t('contact.dates')} hint={t('contact.datesHelp')} htmlFor="c-dates">
              <Input
                id="c-dates"
                maxLength={200}
                value={contact.dates}
                onChange={(e) => setContact({ ...contact, dates: e.target.value })}
              />
            </Field>
            <Field label={t('contact.notes')} htmlFor="c-notes">
              <Textarea
                id="c-notes"
                maxLength={600}
                value={contact.notes}
                onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              />
            </Field>

            <label className="flex items-start gap-3 text-body-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-[var(--brand-text)]"
              />
              <span>
                {t('contact.consent')}{' '}
                <Link to={`/${lang}/privacy`} className="text-brand-text underline" target="_blank">
                  {t('contact.privacy')}
                </Link>
              </span>
            </label>

            <Turnstile onToken={setToken} lang={lang} resetKey={tokenReset} />

            {error != null && (
              <p
                role="alert"
                className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger"
              >
                {errorMessage(error)}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={back}
                disabled={busy !== null}
              >
                {tc('back')}
              </Button>
              <Button type="submit" className="flex-[2]" disabled={!canSubmit || busy !== null}>
                {busy === 'upload'
                  ? t('contact.uploading')
                  : busy === 'send'
                    ? t('contact.submitting')
                    : t('contact.submit')}
              </Button>
            </div>
          </form>
        )}

        {step === 'sent' && result && (
          <section className="flex flex-col gap-5">
            <h1 className="font-display text-display-md">{t('sent.title')}</h1>
            <p className="text-body">{opened ? t('sent.opened') : t('sent.body')}</p>

            {result.whatsappUrl ? (
              <Button asChild className="w-full">
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setOpened(true);
                    void reportWhatsappOpened(result.id, result.token).catch(() => undefined);
                  }}
                >
                  <MessageCircle />
                  {t('sent.open')}
                </a>
              </Button>
            ) : (
              settings.isSuccess && (
                <p className="rounded-md bg-clay-soft px-4 py-3 text-body-sm text-clay-text">
                  {t('sent.noWhatsapp')}
                </p>
              )
            )}

            <div className="flex flex-col gap-2">
              <p className="text-caption text-muted-foreground">{t('sent.fallback')}</p>
              <Button type="button" variant="outline" onClick={() => void copyMessage()}>
                {copied ? <Check /> : <Copy />}
                {copied ? t('sent.copied') : t('sent.copy')}
              </Button>
              <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-caption whitespace-pre-wrap">
                {result.message}
              </pre>
            </div>

            <Button asChild variant="ghost">
              <Link to={`/${lang}`} reloadDocument>
                {t('sent.again')}
              </Link>
            </Button>
          </section>
        )}
      </div>

      {previewArea && (
        <Visualizer
          colors={colors}
          initialColorId={previewArea.colorId}
          onCancel={() => setPreviewFor(null)}
          onDone={(r) => onPreview(previewArea.key, r)}
        />
      )}
    </PublicLayout>
  );
}
