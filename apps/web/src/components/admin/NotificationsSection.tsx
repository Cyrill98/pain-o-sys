import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff } from 'lucide-react';
import { PushHelp } from '@/components/pwa/PushHelp';
import { Section, StatusMessage } from '@/components/admin/Section';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';
import {
  currentSubscription,
  disableAdminPush,
  enableAdminPush,
  pushSupport,
  PushError,
  sendTestPush,
  type PushSupport,
} from '@/lib/push';

/** Turn new-request notifications on/off for this device. */
export function NotificationsSection() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const errorMessage = useErrorMessage();
  const lang = useLang();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await pushSupport();
      const sub = s === 'ok' ? await currentSubscription() : null;
      if (!cancelled) {
        setSupport(s);
        setEnabled(Boolean(sub));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (err) {
      const text =
        err instanceof PushError
          ? tc(err.reason === 'denied' ? 'push.denied' : 'push.serverOff')
          : errorMessage(err);
      setMessage({ tone: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title={t('settings.notifications.title')}
      description={t('settings.notifications.description')}
    >
      {support && support !== 'ok' && <PushHelp support={support} />}
      {support === 'ok' && (
        <div className="flex flex-col gap-3">
          {enabled && (
            <StatusMessage tone="success">{t('settings.notifications.on')}</StatusMessage>
          )}
          {message && <StatusMessage tone={message.tone}>{message.text}</StatusMessage>}
          <div className="flex flex-wrap gap-3">
            {enabled ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const { sent } = await sendTestPush();
                      if (sent > 0) {
                        setMessage({ tone: 'success', text: t('settings.notifications.testSent') });
                      }
                    })
                  }
                >
                  <Bell />
                  {t('settings.notifications.test')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await disableAdminPush();
                      setEnabled(false);
                    })
                  }
                >
                  <BellOff />
                  {t('settings.notifications.disable')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await enableAdminPush(lang);
                    setEnabled(true);
                  })
                }
              >
                <Bell />
                {t('settings.notifications.enable')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
