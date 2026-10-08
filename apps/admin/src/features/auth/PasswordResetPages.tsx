/**
 * Password reset (admin-auth.md §2). The request answer is the same whether or not the account
 * exists. The link from the e-mail (Phase K) is /reset-password#token=…: the token is in the URL
 * fragment, so it never reaches server logs or the Referer header. A reset never signs the user in.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../lib/api/client';
import { describeError, fieldErrorsOf } from '../../lib/errors';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input, PasswordInput } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';
import { readResetToken } from './routing';

const requestSchema = z.object({ email: z.string().trim().min(1, 'Введите e-mail.').email('Проверьте e-mail.') });

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema), defaultValues: { email: '' } });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('POST /api/v1/auth/password-reset/request', { body: values });
      setSent(true);
    } catch (e) {
      setError(describeError(e).message);
    }
  });

  return (
    <AuthLayout title="Восстановление пароля">
      {sent ? (
        <div className="space-y-4">
          <Alert tone="ok">Если такая учётная запись существует, на этот e-mail придёт ссылка для смены пароля. Ссылка действует 30 минут.</Alert>
          <p className="text-[13px] text-ink-muted">Письмо не пришло? Обратитесь к администратору: он может задать новый пароль.</p>
          <Link to="/login" className="text-[13px] text-accent hover:underline">
            Вернуться ко входу
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-[13px] text-ink-muted">Укажите e-mail учётной записи. Второй фактор входа после смены пароля сохраняется.</p>
          <FormError message={error} />
          <Field label="E-mail" error={form.formState.errors.email?.message}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="username" autoFocus {...form.register('email')} />}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={form.formState.isSubmitting}>
            Отправить ссылку
          </Button>
          <p className="text-center text-[13px]">
            <Link to="/login" className="text-accent hover:underline">
              Вернуться ко входу
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

const resetSchema = z
  .object({
    newPassword: z.string().min(12, 'Не меньше 12 символов.').max(256, 'Не больше 256 символов.'),
    repeat: z.string(),
  })
  .refine((v) => v.newPassword === v.repeat, { path: ['repeat'], message: 'Пароли не совпадают.' });

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(() => readResetToken(location), [location]);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { newPassword: '', repeat: '' } });

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    if (!token) return;
    setError(null);
    try {
      await api('POST /api/v1/auth/password-reset/confirm', { body: { token, newPassword } });
      // Drop the token from the address bar and history before leaving the page.
      window.history.replaceState(null, '', '/reset-password');
      navigate('/login', { replace: true, state: { reason: 'password_reset' } });
    } catch (e) {
      const fields = fieldErrorsOf(e);
      if (fields.newPassword) form.setError('newPassword', { message: fields.newPassword });
      else setError(describeError(e).message);
    }
  });

  if (!token)
    return (
      <AuthLayout title="Ссылка недействительна">
        <div className="space-y-3">
          <p className="text-[13px] text-ink-muted">Ссылка для смены пароля неполная или устарела. Запросите новую.</p>
          <Link to="/forgot-password" className="text-[13px] text-accent hover:underline">
            Запросить новую ссылку
          </Link>
        </div>
      </AuthLayout>
    );

  const { errors, isSubmitting } = form.formState;
  return (
    <AuthLayout title="Новый пароль">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Новый пароль" hint="Не меньше 12 символов. Удобно использовать фразу из нескольких слов." error={errors.newPassword?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" autoFocus {...form.register('newPassword')} />}
        </Field>
        <Field label="Повторите пароль" error={errors.repeat?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('repeat')} />}
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
          Сменить пароль
        </Button>
      </form>
    </AuthLayout>
  );
}
