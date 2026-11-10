import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useParams } from 'react-router';
import { isLanguage, preferredLanguage } from '@/i18n/detect';

/** Validates the `:lng` segment and keeps i18next, <html lang> and the title in sync. */
export function LangLayout() {
  const { lng } = useParams();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  useLayoutEffect(() => {
    if (!isLanguage(lng)) return;
    // Covers back/forward and links between languages; the toggle switches eagerly.
    if (i18n.language !== lng) void i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
  }, [lng, i18n]);

  useLayoutEffect(() => {
    document.title = t('appName');
  }, [t, lng]);

  if (!isLanguage(lng)) {
    // e.g. /admin → /ms/admin for someone who chose Malay
    return (
      <Navigate
        to={{ pathname: `/${preferredLanguage()}${location.pathname}`, search: location.search }}
        replace
      />
    );
  }
  return <Outlet />;
}
