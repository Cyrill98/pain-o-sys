import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useLang } from '@/lib/lang';

export function NotFound() {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="font-display text-display-md">{t('notFound.title')}</h1>
      <Link to={`/${lang}`} className="text-brand-text underline underline-offset-4">
        {t('notFound.home')}
      </Link>
    </main>
  );
}
