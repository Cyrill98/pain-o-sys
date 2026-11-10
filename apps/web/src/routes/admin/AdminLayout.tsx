import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { useNewCount } from '@/lib/admin-api';
import { useLogout, useMe } from '@/lib/auth';
import { useLang } from '@/lib/lang';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  const { t } = useTranslation('admin');
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const lang = useLang();
  const newCount = useNewCount();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate(`/${lang}/admin/login`, { replace: true }),
    });
  };

  const links = [
    { to: `/${lang}/admin`, label: t('nav.requests'), end: true, badge: newCount.data ?? 0 },
    { to: `/${lang}/admin/colors`, label: t('nav.colors'), end: false },
    { to: `/${lang}/admin/settings`, label: t('nav.settings'), end: false },
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <span className="font-display text-title font-medium">{t('title')}</span>
          <div className="flex items-center gap-3">
            <span className="hidden text-body-sm text-muted-foreground sm:inline">
              {me.data?.name ?? me.data?.email}
            </span>
            <LanguageToggle />
            <Button variant="outline" onClick={onLogout} disabled={logout.isPending}>
              {t('signOut')}
            </Button>
          </div>
        </div>
        <nav aria-label={t('nav.label')} className="mx-auto max-w-3xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-2">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex h-10 items-center rounded-full px-4 text-label whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-brand-soft text-ink'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  {link.label}
                  {'badge' in link && link.badge ? (
                    <span
                      aria-label={t('nav.newBadge', { count: link.badge })}
                      className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-clay px-1.5 text-caption text-on-clay"
                    >
                      {link.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
