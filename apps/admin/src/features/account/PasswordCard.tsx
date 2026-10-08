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
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', repeat: '' } });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api('POST /api/v1/auth/password/change', { body: { currentPassword, newPassword } });
      form.reset();
      void qc.invalidateQueries({ queryKey: SESSION_KEY });
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      toast.success('Пароль изменён. Все другие сеансы завершены.');
    } catch (e) {
      if (isApiError(e, 'invalid_credentials')) return form.setError('currentPassword', { message: 'Текущий пароль указан неверно.' });
      const fields = fieldErrorsOf(e);
      if (fields.newPassword) return form.setError('newPassword', { message: fields.newPassword });
      toast.error(e);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <Card title="Пароль" description="После смены пароля все остальные сеансы будут завершены.">
      <form onSubmit={onSubmit} className="max-w-sm space-y-4" noValidate>
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <Field label="Текущий пароль" error={errors.currentPassword?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="current-password" {...form.register('currentPassword')} />}
        </Field>
        <Field label="Новый пароль" hint="Не меньше 12 символов. Удобно использовать фразу из нескольких слов." error={errors.newPassword?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('newPassword')} />}
        </Field>
        <Field label="Повторите новый пароль" error={errors.repeat?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('repeat')} />}
        </Field>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Сменить пароль
        </Button>
      </form>
    </Card>
  );
}
