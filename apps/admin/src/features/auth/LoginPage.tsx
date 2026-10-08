import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../lib/api/client';
import { describeError } from '../../lib/errors';
import { clearEndReason, setSession } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, FormError, Input, PasswordInput } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';
import { routeFor, type LocationState } from './routing';

const schema = z.object({
  email: z.string().trim().min(1, 'Введите e-mail.').email('Проверьте e-mail.'),
  password: z.string().min(1, 'Введите пароль.'),
});
type Values = z.infer<typeof schema>;

const REASONS: Record<string, string> = {
  expired: 'Сеанс завершён. Войдите снова.',
  signed_out: 'Вы вышли из системы.',
  password_reset: 'Пароль изменён. Войдите с новым паролем.',
};

export function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LocationState;
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  useEffect(() => clearEndReason(), []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const view = await api('POST /api/v1/auth/login', { body: values });
      setSession(qc, view);
      // The page asked for before sign-in is kept through the second-factor steps.
      navigate(routeFor(view, state.from), { replace: true, state: { from: state.from } });
    } catch (e) {
      form.resetField('password');
      setError(describeError(e).message);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <AuthLayout title="Вход в админку" description="Soltex Global: управление сайтом.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {state.reason && REASONS[state.reason] ? <Alert tone="info">{REASONS[state.reason]}</Alert> : null}
        <FormError message={error} />
        <Field label="E-mail" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="username" autoFocus {...form.register('email')} />}
        </Field>
        <Field label="Пароль" error={errors.password?.message}>
          {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="current-password" {...form.register('password')} />}
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
          Войти
        </Button>
        <p className="text-center text-[13px]">
          <Link to="/forgot-password" className="text-accent hover:underline">
            Забыли пароль?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
