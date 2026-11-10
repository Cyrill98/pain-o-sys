import { useTranslation } from 'react-i18next';
import { PublicLayout } from '@/components/booking/PublicLayout';

const SECTIONS = ['what', 'why', 'who', 'keep', 'rights'] as const;

/** PDPA privacy notice (EN/MS). Business name and contact details still to be added. */
export function Privacy() {
  const { t } = useTranslation('request');
  return (
    <PublicLayout>
      <article className="flex flex-col gap-6">
        <h1 className="font-display text-display-md">{t('privacy.title')}</h1>
        <p className="text-body">{t('privacy.intro')}</p>
        {SECTIONS.map((s) => (
          <section key={s} className="flex flex-col gap-2">
            <h2 className="text-title">{t(`privacy.${s}Title`)}</h2>
            <p className="text-body text-muted-foreground">{t(`privacy.${s}Body`)}</p>
          </section>
        ))}
      </article>
    </PublicLayout>
  );
}
