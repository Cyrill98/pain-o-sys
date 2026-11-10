import { useTranslation } from 'react-i18next';
import type { PushSupport } from '@/lib/push';

/** Explains why notifications aren't available on this device. */
export function PushHelp({ support }: { support: PushSupport }) {
  const { t } = useTranslation();
  if (support === 'ok') return null;
  const key =
    support === 'install-first'
      ? 'push.installFirst'
      : support === 'no-service-worker'
        ? 'push.devOnly'
        : 'push.unsupported';
  return <p className="text-body-sm text-muted-foreground">{t(key)}</p>;
}
