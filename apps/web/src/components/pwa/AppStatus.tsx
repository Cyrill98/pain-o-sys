import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/lib/online';

/**
 * Registers the service worker (production builds) and shows two banners at the bottom of the
 * screen: "you're offline" and "a new version is available — Reload".
 */
export function AppStatus() {
  const { t } = useTranslation();
  const online = useOnline();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app stays open (the admin's phone).
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (online && !needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {!online && (
        <p
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-ink px-4 py-3 text-body-sm text-surface-100 shadow-soft"
        >
          <WifiOff className="size-5 shrink-0" aria-hidden />
          {t('pwa.offline')}
        </p>
      )}
      {needRefresh && (
        <div
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-lg border border-line bg-card px-4 py-2 shadow-soft"
        >
          <span className="text-body-sm">{t('pwa.update')}</span>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            {t('pwa.reload')}
          </Button>
        </div>
      )}
    </div>
  );
}
