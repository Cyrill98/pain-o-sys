import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, MessageCircle, Phone, Trash2 } from 'lucide-react';
import { REQUEST_STATUSES, type RequestStatus } from '@app/shared';
import { Section, StatusMessage } from '@/components/admin/Section';
import { Textarea } from '@/components/request/fields';
import { Button } from '@/components/ui/button';
import {
  photoUrl,
  useAdminSettings,
  useDeleteRequest,
  usePatchRequest,
  useRequest,
} from '@/lib/admin-api';
import { ApiRequestError } from '@/lib/api';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';
import { cn } from '@/lib/utils';

const waLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export function AdminRequestDetail() {
  const { t, i18n } = useTranslation('admin');
  const { t: tr } = useTranslation('request');
  const { id } = useParams();
  const lang = useLang();
  const errorMessage = useErrorMessage();
  const request = useRequest(id);
  const settings = useAdminSettings();
  const patch = usePatchRequest(id ?? '');
  const remove = useDeleteRequest();
  const navigate = useNavigate();
  const [draftNotes, setDraftNotes] = useState<string | null>(null);

  const r = request.data;
  const notes = draftNotes ?? r?.adminNotes ?? '';

  if (request.isError) {
    const gone = request.error instanceof ApiRequestError && request.error.status === 404;
    return (
      <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger">
        {gone ? t('requests.notFound') : errorMessage(request.error)}
      </p>
    );
  }
  if (!r) return <p className="text-muted-foreground">…</p>;

  const when = new Intl.DateTimeFormat(i18n.language === 'ms' ? 'ms-MY' : 'en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(r.createdAt));
  const greeting = t('requests.waGreeting', {
    name: r.clientName,
    business: settings.data?.businessName ?? '',
  });
  const dirty = notes !== r.adminNotes;

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/${lang}/admin`}
        className="inline-flex items-center gap-2 text-label text-brand-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('requests.back')}
      </Link>

      <div>
        <h1 className="font-display text-display-md">{r.clientName}</h1>
        <p className="text-body-sm text-muted-foreground">
          {t('requests.received')}: {when}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild>
          <a href={waLink(r.phone, greeting)} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
            {t('requests.whatsapp')}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`tel:${r.phone}`}>
            <Phone />
            {t('requests.call')}
          </a>
        </Button>
      </div>

      <Section title={t('requests.statusLabel')}>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label={t('requests.statusLabel')}
        >
          {REQUEST_STATUSES.map((s: RequestStatus) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={r.status === s}
              disabled={patch.isPending}
              onClick={() => patch.mutate({ status: s })}
              className={cn(
                'h-10 rounded-full border px-4 text-label',
                r.status === s ? 'border-transparent bg-brand-soft text-ink' : 'border-line',
              )}
            >
              {t(`status.${s}`)}
            </button>
          ))}
        </div>
        {patch.isError && <StatusMessage tone="error">{errorMessage(patch.error)}</StatusMessage>}
      </Section>

      <Section title={t('requests.client')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
          <dt className="text-muted-foreground">{t('requests.phone')}</dt>
          <dd>{r.phone}</dd>
          <dt className="text-muted-foreground">{t('requests.property')}</dt>
          <dd>{tr(`property.options.${r.propertyType}`)}</dd>
          {(r.address || r.town) && (
            <>
              <dt className="text-muted-foreground">{t('requests.address')}</dt>
              <dd>{[r.address, r.town].filter(Boolean).join(', ')}</dd>
            </>
          )}
          {r.preferredDates && (
            <>
              <dt className="text-muted-foreground">{t('requests.dates')}</dt>
              <dd>{r.preferredDates}</dd>
            </>
          )}
          {r.notes && (
            <>
              <dt className="text-muted-foreground">{t('requests.notes')}</dt>
              <dd className="whitespace-pre-wrap">{r.notes}</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title={t('requests.areasTitle')}>
        <ul className="flex flex-col gap-6">
          {r.areas.map((a) => (
            <li key={a.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-10 shrink-0 rounded-full border border-line"
                  style={{ backgroundColor: a.colorHex ?? 'transparent' }}
                />
                <div>
                  <p className="text-label">{a.label || tr(`areas.names.${a.areaType}`)}</p>
                  <p className="text-body-sm text-muted-foreground">
                    {a.colorName
                      ? [a.colorName, a.colorCode, a.colorHex].filter(Boolean).join(' · ')
                      : tr('details.noColor')}
                  </p>
                </div>
              </div>
              <p className="text-body-sm text-muted-foreground">
                {[
                  a.sizeSqft ? t('requests.size', { size: a.sizeSqft }) : null,
                  a.exterior ? t('requests.exterior') : t('requests.interior'),
                  tr(`details.conditions.${a.condition}`),
                  a.furnished ? t('requests.furnished') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {(a.snapshotId || a.originalPhotoId) && (
                <div className="grid grid-cols-2 gap-2">
                  {a.originalPhotoId && (
                    <a href={photoUrl(a.originalPhotoId)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={photoUrl(a.originalPhotoId)}
                        alt={t('requests.originalTitle')}
                        loading="lazy"
                        className="w-full rounded-md border border-line"
                      />
                      <span className="text-caption text-muted-foreground">
                        {t('requests.originalTitle')}
                      </span>
                    </a>
                  )}
                  {a.snapshotId && (
                    <a href={photoUrl(a.snapshotId)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={photoUrl(a.snapshotId)}
                        alt={t('requests.previewTitle')}
                        loading="lazy"
                        className="w-full rounded-md border border-line"
                      />
                      <span className="text-caption text-muted-foreground">
                        {t('requests.previewTitle')}
                      </span>
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('requests.adminNotes')}>
        <Textarea value={notes} maxLength={2000} onChange={(e) => setDraftNotes(e.target.value)} />
        <Button
          type="button"
          className="self-start"
          disabled={!dirty || patch.isPending}
          onClick={() =>
            patch.mutate({ adminNotes: notes }, { onSuccess: () => setDraftNotes(null) })
          }
        >
          {patch.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </Section>

      <Section title={t('requests.deleteTitle')} description={t('requests.deleteHelp')}>
        {remove.isError && <StatusMessage tone="error">{errorMessage(remove.error)}</StatusMessage>}
        <Button
          type="button"
          variant="outline"
          className="self-start border-danger text-danger"
          disabled={remove.isPending}
          onClick={() => {
            if (!window.confirm(t('requests.deleteConfirm', { name: r.clientName }))) return;
            remove.mutate(r.id, {
              onSuccess: () => navigate(`/${lang}/admin`, { replace: true }),
            });
          }}
        >
          <Trash2 />
          {t('requests.delete')}
        </Button>
      </Section>
    </div>
  );
}
