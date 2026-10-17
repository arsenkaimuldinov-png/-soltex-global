import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, isApiError } from '../../lib/api/client';
import { fieldErrorsOf } from '../../lib/errors';
import { SESSION_KEY } from '../../lib/session';
import { Button } from '../../components/ui/Button';
import { Field, PasswordInput } from '../../components/ui/Field';
import { Card } from '../../components/ui/Layout';
import { useToast } from '../../components/ui/Toast';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Введите текущий пароль.'),
    newPassword: z.string().min(12, 'Не меньше 12 символов.').max(256, 'Не больше 256 символов.'),
    repeat: z.string(),
  })
  .refine((v) => v.newPassword === v.repeat, { path: ['repeat'], message: 'Пароли не совпадают.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Новый пароль совпадает с текущим.' });

export function PasswordCard() {
  const toast = useToast();
  return (
    <Card title="Пароль" description="После смены пароля все остальные сеансы будут завершены.">
      <PasswordForm submitLabel="Сменить пароль" onDone={() => toast.success('Пароль изменён. Все другие сеансы завершены.')} />
    </Card>
  );
}

/**
 * Current password, new password twice (Phase M-1: shared with the first-sign-in page, where the
 * current password is the initial one).
 */
export function PasswordForm({ submitLabel, onDone, currentLabel = 'Текущий пароль' }: { submitLabel: string; onDone: () => void; currentLabel?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', repeat: '' } });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api('POST /api/v1/auth/password/change', { body: { currentPassword, newPassword } });
      form.reset();
      await qc.invalidateQueries({ queryKey: SESSION_KEY });
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      onDone();
    } catch (e) {
      if (isApiError(e, 'invalid_credentials')) return form.setError('currentPassword', { message: 'Текущий пароль указан неверно.' });
      const fields = fieldErrorsOf(e);
      if (fields.newPassword) return form.setError('newPassword', { message: fields.newPassword });
      toast.error(e);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4" noValidate>
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <Field label={currentLabel} error={errors.currentPassword?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="current-password" {...form.register('currentPassword')} />}
      </Field>
      <Field label="Новый пароль" hint="Не меньше 12 символов. Удобно использовать фразу из нескольких слов." error={errors.newPassword?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('newPassword')} />}
      </Field>
      <Field label="Повторите новый пароль" error={errors.repeat?.message}>
        {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('repeat')} />}
      </Field>
      <Button type="submit" variant="primary" loading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
