import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { switchLanguageInPath } from '@/i18n/detect';
import { useLogin, useMe } from '@/lib/auth';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';

const ADMIN_PATH = /^\/(en|ms)\/admin(\/|$)/;

export function AdminLogin() {
  const { t } = useTranslation('admin');
  const errorMessage = useErrorMessage();
  const lang = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const me = useMe();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Return to the admin page the admin was trying to open (in the current language) — never an
  // arbitrary URL.
  const from = (location.state as { from?: string } | null)?.from;
  const target =
    from && ADMIN_PATH.test(from) ? switchLanguageInPath(from, lang) : `/${lang}/admin`;

  if (me.data) return <Navigate to={target} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => navigate(target, { replace: true }) },
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <LanguageToggle className="self-end" />
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-display-md">{t('login.title')}</CardTitle>
          <CardDescription>{t('login.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-3">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {login.error && (
              <p
                role="alert"
                className="rounded-md bg-danger-soft px-4 py-3 text-body-sm text-danger"
              >
                {errorMessage(login.error)}
              </p>
            )}
            <Button type="submit" disabled={login.isPending || !email || !password}>
              {login.isPending ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
