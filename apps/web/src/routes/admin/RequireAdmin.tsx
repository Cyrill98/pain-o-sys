import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '@/lib/auth';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';

/** Gate for /:lng/admin/*. Signed-out visitors go to the login page and come back after. */
export function RequireAdmin() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const me = useMe();
  const lang = useLang();
  const location = useLocation();

  if (me.isPending) {
    return <p className="p-6 text-muted-foreground">{t('loading')}</p>;
  }
  if (me.isError) {
    return (
      <p role="alert" className="m-4 rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger">
        {errorMessage(me.error)}
      </p>
    );
  }
  if (!me.data) {
    return <Navigate to={`/${lang}/admin/login`} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
