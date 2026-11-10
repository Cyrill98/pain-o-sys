import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { PaintRoller } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLang } from '@/lib/lang';
import { usePublicSettings } from '@/lib/public-api';
import { useTranslation } from 'react-i18next';

/** Header (business name → home, EN | BM) and a phone-width column. */
export function PublicLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  const settings = usePublicSettings();
  const name = settings.data?.businessName ?? t('appName');
  return (
    <div className={`mx-auto flex min-h-dvh flex-col px-4 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
      <header className="flex items-center justify-between gap-3 py-4">
        <Link
          to={`/${lang}`}
          className="font-display text-title flex items-center gap-2 font-medium"
        >
          <PaintRoller className="size-5 text-brand-text" aria-hidden />
          <span className="truncate">{name}</span>
        </Link>
        <LanguageToggle />
      </header>
      <main className="flex flex-1 flex-col pb-12">{children}</main>
    </div>
  );
}
