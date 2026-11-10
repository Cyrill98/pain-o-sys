import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { MessageCircle } from 'lucide-react';
import { REQUEST_STATUSES, type RequestStatus } from '@app/shared';
import { Badge } from '@/components/ui/badge';
import { useRequests } from '@/lib/admin-api';
import { statusVariant } from '@/lib/status';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';
import { cn } from '@/lib/utils';

export function AdminRequests() {
  const { t, i18n } = useTranslation('admin');
  const { t: tr } = useTranslation('request');
  const lang = useLang();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<RequestStatus | undefined>(undefined);
  const requests = useRequests(status);
  const when = new Intl.DateTimeFormat(i18n.language === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kuala_Lumpur',
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-display-md">{t('requests.title')}</h1>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {([undefined, ...REQUEST_STATUSES] as (RequestStatus | undefined)[]).map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-label',
              status === s
                ? 'border-transparent bg-brand-soft text-ink'
                : 'border-line text-muted-foreground',
            )}
          >
            {s ? t(`status.${s}`) : t('requests.all')}
          </button>
        ))}
      </div>

      {requests.isError && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger">
          {errorMessage(requests.error)}
        </p>
      )}
      {requests.isSuccess && requests.data.length === 0 && (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted-foreground">
          {t('requests.empty')}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.data?.map((r) => (
          <li key={r.id}>
            <Link
              to={`/${lang}/admin/requests/${r.id}`}
              className="flex flex-col gap-2 rounded-lg border border-line bg-card p-4 shadow-soft transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-title">{r.clientName}</span>
                <Badge variant={statusVariant(r.status)}>{t(`status.${r.status}`)}</Badge>
              </div>
              <p className="text-body-sm text-muted-foreground">
                {[r.town, tr(`property.options.${r.propertyType}`)].filter(Boolean).join(' · ')} ·{' '}
                {t('requests.areas', { count: r.areaCount })}
              </p>
              <p className="flex items-center justify-between text-caption text-muted-foreground">
                <span>{when.format(new Date(r.createdAt))}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3.5" aria-hidden />
                  {r.whatsappOpened ? t('requests.opened') : t('requests.notOpened')}
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
