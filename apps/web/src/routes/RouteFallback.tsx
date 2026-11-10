import { useTranslation } from 'react-i18next';

/** Shown for a moment while a page's code loads. */
export function RouteFallback() {
  const { t } = useTranslation();
  return (
    <p role="status" className="p-6 text-muted-foreground">
      {t('loading')}
    </p>
  );
}
