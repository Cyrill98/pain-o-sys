import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, SquarePlus, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { dismissInstall, isInstallDismissed, promptInstall, useInstallState } from '@/lib/install';
import { cn } from '@/lib/utils';

/** iPhone/iPad: browsers can't install for you, so show the three Safari steps. */
function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const steps = [
    { icon: <Share className="size-5" aria-hidden />, text: t('install.iosStep1') },
    { icon: <SquarePlus className="size-5" aria-hidden />, text: t('install.iosStep2') },
    { icon: <Smartphone className="size-5" aria-hidden />, text: t('install.iosStep3') },
  ];
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={t('install.gotIt')}>
        <DialogHeader>
          <DialogTitle>{t('install.iosTitle')}</DialogTitle>
          <DialogDescription>{t('install.iosNote')}</DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md bg-muted px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-label text-primary-foreground">
                {i + 1}
              </span>
              <span className="flex-1 text-body">{s.text}</span>
              <span className="shrink-0 text-brand-text">{s.icon}</span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button onClick={onClose}>{t('install.gotIt')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Install the app" card. Android/desktop Chrome: one tap opens the browser's install dialog.
 * iPhone/iPad: opens the Add-to-Home-Screen steps. Hidden once installed, where install isn't
 * possible, and (when `dismissible`) for two weeks after "Not now".
 */
export function InstallPrompt({
  dismissible = true,
  className,
}: {
  dismissible?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const state = useInstallState();
  const [dismissed, setDismissed] = useState(() => dismissible && isInstallDismissed());
  const [showSteps, setShowSteps] = useState(false);

  if (state === 'installed' || state === 'none' || dismissed) return null;

  return (
    <section
      aria-label={t('install.title')}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-soft',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <img src="/pwa-64x64.png" alt="" width={48} height={48} className="size-12 rounded-md" />
        <div className="flex flex-col gap-1">
          <h2 className="text-title">{t('install.title')}</h2>
          <p className="text-body-sm text-muted-foreground">{t('install.body')}</p>
        </div>
      </div>
      <div className="flex gap-3">
        {dismissible && (
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              dismissInstall();
              setDismissed(true);
            }}
          >
            {t('install.notNow')}
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={() => (state === 'ios' ? setShowSteps(true) : void promptInstall())}
        >
          {state === 'ios' ? t('install.howTo') : t('install.install')}
        </Button>
      </div>
      <IosSteps open={showSteps} onClose={() => setShowSteps(false)} />
    </section>
  );
}
