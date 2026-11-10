import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Camera, ListChecks, MessageCircle } from 'lucide-react';
import { PublicLayout } from '@/components/booking/PublicLayout';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Button } from '@/components/ui/button';
import { useLang } from '@/lib/lang';

export function Home() {
  const { t } = useTranslation();
  const lang = useLang();
  const steps = [
    { icon: ListChecks, text: t('home.step1') },
    { icon: Camera, text: t('home.step2') },
    { icon: MessageCircle, text: t('home.step3') },
  ];

  return (
    <PublicLayout>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-display-lg text-balance">{t('home.headline')}</h1>
          <p className="text-body text-muted-foreground">{t('home.sub')}</p>
        </div>

        <ol className="flex flex-col gap-3">
          {steps.map(({ icon: Icon, text }, i) => (
            <li
              key={i}
              className="flex items-center gap-4 rounded-lg border border-line bg-card p-4 shadow-soft"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-body">{text}</span>
            </li>
          ))}
        </ol>

        <Button asChild className="w-full">
          <Link to={`/${lang}/request`}>{t('home.cta')}</Link>
        </Button>

        <InstallPrompt />

        <p className="text-center text-caption text-muted-foreground">
          <Link to={`/${lang}/privacy`} className="underline">
            {t('home.privacy')}
          </Link>
        </p>
      </div>
    </PublicLayout>
  );
}
