import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { NotificationsSection } from '@/components/admin/NotificationsSection';
import { Section, StatusMessage } from '@/components/admin/Section';
import { Field } from '@/components/request/fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminSettings, useUpdateSettings } from '@/lib/admin-api';
import { useErrorMessage } from '@/lib/errors';
import { useLang } from '@/lib/lang';

export function AdminSettings() {
  const { t } = useTranslation('admin');
  const lang = useLang();
  const errorMessage = useErrorMessage();
  const settings = useAdminSettings();
  const update = useUpdateSettings();
  // What the admin has typed so far; until then the form shows the saved values.
  const [edits, setEdits] = useState<{ name?: string; whatsapp?: string }>({});
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const data = settings.data;
  const name = edits.name ?? data?.businessName ?? '';
  const whatsapp = edits.whatsapp ?? data?.whatsappNumber ?? '';

  const link = `${window.location.origin}/${lang}`;
  const dirty = data ? name !== data.businessName || whatsapp !== data.whatsappNumber : false;

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    update.mutate(
      { businessName: name, whatsappNumber: whatsapp },
      {
        onSuccess: () => {
          setEdits({});
          setSaved(true);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-display-md">{t('settings.title')}</h1>

      <Section title={t('settings.business.title')}>
        <form onSubmit={onSave} className="flex flex-col gap-5">
          <Field label={t('settings.business.name')} htmlFor="s-name">
            <Input
              id="s-name"
              value={name}
              maxLength={80}
              onChange={(e) => setEdits((v) => ({ ...v, name: e.target.value }))}
            />
          </Field>
          <Field
            label={t('settings.business.whatsapp')}
            hint={t('settings.business.whatsappHelp')}
            htmlFor="s-wa"
          >
            <Input
              id="s-wa"
              type="tel"
              inputMode="tel"
              placeholder="012-345 6789"
              value={whatsapp}
              onChange={(e) => {
                setEdits((v) => ({ ...v, whatsapp: e.target.value }));
                setSaved(false);
              }}
            />
          </Field>
          {data && data.whatsappNumber === '' && (
            <StatusMessage tone="error">{t('settings.business.notSet')}</StatusMessage>
          )}
          {update.isError && (
            <StatusMessage tone="error">{errorMessage(update.error)}</StatusMessage>
          )}
          {saved && <StatusMessage tone="success">{t('actions.saved')}</StatusMessage>}
          <Button type="submit" className="self-start" disabled={!dirty || update.isPending}>
            {update.isPending ? t('actions.saving') : t('actions.save')}
          </Button>
        </form>
      </Section>

      <Section title={t('settings.link.title')} description={t('settings.link.description')}>
        <code className="rounded-md bg-muted px-3 py-2 text-body-sm break-all">{link}</code>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => {
            void navigator.clipboard?.writeText(link).then(() => setCopied(true));
          }}
        >
          <Copy />
          {copied ? t('settings.link.copied') : t('settings.link.copy')}
        </Button>
      </Section>

      <NotificationsSection />
    </div>
  );
}
