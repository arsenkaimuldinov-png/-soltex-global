import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../../lib/api/client';
import { setSession, useSessionView } from '../../lib/session';
import { useUnsavedChangesGuard } from '../../lib/unsaved';
import { ROLE_LABELS } from '../../i18n/ru';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Card, Facts } from '../../components/ui/Layout';
import { useToast } from '../../components/ui/Toast';

const schema = z.object({ name: z.string().trim().min(1, 'Введите имя.').max(120, 'Не больше 120 символов.') });

export function ProfileCard() {
  const view = useSessionView();
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), values: { name: view.user.name } });
  useUnsavedChangesGuard(form.formState.isDirty);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const next = await api('PATCH /api/v1/auth/profile', { body: values });
      setSession(qc, next);
      form.reset({ name: next.user.name });
      toast.success('Профиль сохранён');
    } catch (e) {
      toast.error(e);
    }
  });

  return (
    <Card title="Профиль">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Facts
          items={[
            { label: 'E-mail', value: view.user.email },
            { label: 'Роль', value: ROLE_LABELS[view.user.role] },
          ]}
        />
        <Field label="Имя" hint="Отображается в журнале действий и в списке пользователей." error={form.formState.errors.name?.message} className="max-w-sm">
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" {...form.register('name')} />}
        </Field>
        <Button type="submit" variant="primary" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
          Сохранить
        </Button>
      </form>
    </Card>
  );
}
