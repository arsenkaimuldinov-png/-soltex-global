/**
 * «Изменить адрес» of a published project / technology / product (Phase I-2, review §O): the old
 * and new addresses in all six languages, and the 301 redirect from the old address (on by default).
 * The change reaches the site with the next release; the redirect goes live together with it.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { slugify } from '@soltex/core/seo';
import { api, isApiError } from '../../lib/api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, FormError, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { FIELD_ERROR_LABELS } from '../content/model';
import { saveErrorMessage } from '../content/shared';
import { LOCALE_INFO } from '../translations/model';
import { redirectErrorMessage, slugChangeUrls } from './model';

type Routable = 'projects' | 'technologies' | 'products';

export function SlugDialog({
  collection,
  record,
  pathPrefix,
  open,
  onOpenChange,
}: {
  collection: Routable;
  record: { id: string; version: number; slug: string };
  pathPrefix: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [slug, setSlug] = useState(record.slug);
  const [redirect, setRedirect] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug(record.slug);
      setRedirect(true);
      setError(undefined);
      setFormError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = slug.trim();
  const changed = !!next && next !== record.slug;

  const submit = async () => {
    if (!changed) {
      setError(FIELD_ERROR_LABELS.unchanged);
      return;
    }
    setBusy(true);
    setError(undefined);
    setFormError(null);
    try {
      const res = await api(`POST /api/v1/content/${collection}/{id}/slug` as 'POST /api/v1/content/projects/{id}/slug', {
        params: { id: record.id },
        headers: { 'if-match': `"${record.version}"` },
        body: { slug: next, redirect },
      });
      void qc.invalidateQueries({ queryKey: ['content', collection] });
      void qc.invalidateQueries({ queryKey: ['seo'] });
      void qc.invalidateQueries({ queryKey: ['redirects'] });
      toast.success(res.redirect ? 'Адрес изменён, редирект со старого адреса создан' : 'Адрес изменён');
      onOpenChange(false);
    } catch (e) {
      const fe = isApiError(e) ? e.fieldErrors : [];
      if (fe.length) setError(fe.map((x) => (x.field === 'slug' ? FIELD_ERROR_LABELS[x.message] ?? 'Проверьте адрес.' : redirectErrorMessage(x.message))).join(' '));
      else setFormError(saveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rows = slugChangeUrls(pathPrefix, record.slug, changed ? next : record.slug);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Изменить адрес"
      description="Адрес одинаков на всех языках. Изменение попадёт на сайт со следующим релизом."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" loading={busy} disabled={!changed} onClick={() => void submit()}>
            Изменить адрес
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormError message={formError} />
        <Field label="Новый адрес" hint={`Латинские строчные буквы, цифры и дефисы. Например: ${slugify('Solbar Israel plant')}`} error={error}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} invalid={invalid} className="font-mono" spellCheck={false} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
          )}
        </Field>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-xs" aria-label="Адреса на всех языках">
            <thead className="bg-subtle text-left text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Язык</th>
                <th scope="col" className="px-3 py-2 font-medium">Сейчас</th>
                <th scope="col" className="sr-only">→</th>
                <th scope="col" className="px-3 py-2 font-medium">Станет</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {rows.map((r) => (
                <tr key={r.locale} data-slug-row={r.locale}>
                  <td className="px-3 py-1.5 font-sans font-semibold">{LOCALE_INFO[r.locale].short}</td>
                  <td className="px-3 py-1.5 break-all text-ink-muted" dir="ltr">{r.from}</td>
                  <td className="px-1 py-1.5 text-ink-faint">
                    <ArrowRight className="size-3.5" aria-hidden />
                  </td>
                  <td className="px-3 py-1.5 break-all" dir="ltr">{changed ? r.to : '…'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={redirect} onChange={(e) => setRedirect(e.target.checked)} />
          <span>
            <span className="font-medium">Создать 301-редирект со старого адреса</span>
            <span className="block text-ink-muted">Рекомендуется: ссылки, закладки и позиции в поиске перейдут на новый адрес. Редиректы, которые вели на старый адрес, будут перенаправлены на новый.</span>
          </span>
        </label>
        {!redirect ? <Alert tone="warn">Без редиректа старые ссылки и закладки перестанут работать: посетители увидят страницу «Не найдено».</Alert> : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
