/**
 * New draft: the title and what the record cannot exist without (main image, required relations,
 * patent placements). Everything else is filled in the editor. The address (slug) is proposed from
 * the title; roles with the SEO permission may set it here.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { slugify } from '@soltex/core/seo';
import { api } from '../../lib/api/client';
import { useCan } from '../../lib/session';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { FormError } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ContentField } from './CollectionEditor';
import { toApiValue, toFormValue, validateField, type FormValues } from './form';
import { COLLECTION_UI, type CollectionName, type FieldDef } from './model';
import { apiFieldErrors, saveErrorMessage } from './shared';

export function CreateDialog({ collection, open, onOpenChange, onCreated }: { collection: CollectionName; open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const ui = COLLECTION_UI[collection];
  const can = useCan();
  const qc = useQueryClient();
  const toast = useToast();
  const withSlug = ui.routable && can('seo.edit');
  const fields: FieldDef[] = [
    ...ui.createFields.map((n) => ui.fields.find((f) => f.name === n)!),
    ...(withSlug ? [{ ...ui.fields.find((f) => f.kind === 'slug')!, hint: 'Можно оставить пустым — адрес будет предложен по названию.' }] : []),
  ];
  const empty = (): FormValues => Object.fromEntries(fields.map((f) => [f.name, toFormValue(f.kind, f.kind === 'placements' ? ['registry'] : null) ?? '']));
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(empty());
      setErrors({});
      setFormError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.kind === 'slug' && !values[f.name]) continue;
      const e = validateField(f, values[f.name]);
      if (e) errs[f.name] = e;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.kind === 'slug' && !values[f.name]) continue;
      body[f.name] = toApiValue(f.kind, values[f.name]);
    }
    setBusy(true);
    setFormError(null);
    try {
      const rec = (await api(`POST /api/v1/content/${collection}` as 'POST /api/v1/content/projects', { body: body as never })) as { id: string };
      void qc.invalidateQueries({ queryKey: ['content', collection] });
      toast.success('Черновик создан');
      onOpenChange(false);
      onCreated(rec.id);
    } catch (e) {
      const fe = apiFieldErrors(e);
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(saveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = String(values.title ?? '');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={ui.newTitle}
      description="Создаётся черновик: на сайте он не показывается. Остальные поля заполните в редакторе."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()}>
            Создать черновик
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
        {fields.map((f) => (
          <div key={f.name}>
            <ContentField def={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))} />
            {f.kind === 'slug' && !values.slug && title ? <p className="mt-1 font-mono text-xs text-ink-muted">{ui.pathPrefix}{slugify(title) || '…'}</p> : null}
          </div>
        ))}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
