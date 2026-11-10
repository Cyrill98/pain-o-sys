import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { LANGUAGES, type Language } from '@app/shared';
import { saveLanguage, switchLanguageInPath } from '@/i18n/detect';
import { useLang } from '@/lib/lang';
import { cn } from '@/lib/utils';

/** EN | BM switch. Keeps the current page, remembers the choice. */
export function LanguageToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const choose = (lang: Language) => {
    if (lang === current) return;
    saveLanguage(lang);
    void i18n.changeLanguage(lang);
    navigate(
      {
        pathname: switchLanguageInPath(location.pathname, lang),
        search: location.search,
        hash: location.hash,
      },
      { replace: true, state: location.state },
    );
  };

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={cn('inline-flex h-tap rounded-full bg-muted p-1', className)}
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-pressed={lang === current}
          aria-label={t(`language.name.${lang}`)}
          onClick={() => choose(lang)}
          className={cn(
            'min-w-12 rounded-full px-3 text-label transition-colors',
            lang === current
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`language.short.${lang}`)}
        </button>
      ))}
    </div>
  );
}
