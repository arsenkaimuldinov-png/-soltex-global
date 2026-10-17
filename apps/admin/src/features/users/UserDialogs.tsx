/**
 * Create and edit dialogs for users. Options a role may not choose are not offered (core
 * canManageUser); the API applies the same rule again.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { canManageUser, ROLES, type Role } from '@soltex/core/domain';
import { api, isApiError } from '../../lib/api/client';
import type { User } from '../../lib/api/schema.gen';
import { describeError, fieldErrorsOf } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { generatePassword } from '../../lib/password';
import { useSessionView } from '../../lib/session';
import { useStepUp } from '../../lib/step-up';
import { ROLE_LABELS, USER_STATUS_LABELS } from '../../i18n/ru';
import { Advanced, TechValue } from '../../components/ui/Advanced';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, FormError, Input, PasswordInput, Select } from '../../components/ui/Field';

const createSchema = z.object({
  email: z.string().trim().min(1, 'Введите e-mail.').email('Проверьте e-mail.'),
  name: z.string().trim().min(1, 'Введите имя.').max(120, 'Не больше 120 символов.'),
  role: z.enum(ROLES),
  password: z.string().min(12, 'Не меньше 12 символов.').max(256, 'Не больше 256 символов.'),
});
type CreateValues = z.infer<typeof createSchema>;

export function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (u: User) => void }) {
  const { user: actor } = useSessionView();
  const withStepUp = useStepUp();
  const [error, setError] = useState<string | null>(null);
  const roles = ROLES.filter((r) => canManageUser({ actorRole: actor.role, actorId: actor.id, targetId: null, targetRole: null, newRole: r, change: 'create' }));
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { email: '', name: '', role: 'editor', password: '' } });

  useEffect(() => {
    if (open) {
      form.reset({ email: '', name: '', role: 'editor', password: '' });
      setError(null);
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const created = await withStepUp(() => api('POST /api/v1/users', { body: values }));
      onCreated(created);
    } catch (e) {
      if (isApiError(e, 'conflict')) return form.setError('email', { message: 'Пользователь с таким e-mail уже есть.' });
      const fields = fieldErrorsOf(e);
      if (fields.password) return form.setError('password', { message: fields.password });
      const d = describeError(e);
      if (!d.silent) setError(d.message);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Новый пользователь"
      description="Передайте e-mail и начальный пароль лично или по защищённому каналу. Начальный пароль действует 7 дней: при первом входе пользователь настроит второй фактор (если он нужен для роли) и заменит пароль на свой."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="create-user" loading={isSubmitting}>
            Создать
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Имя" error={errors.name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="off" {...form.register('name')} />}
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="off" {...form.register('email')} />}
        </Field>
        <Field label="Роль" error={errors.role?.message}>
          {({ id, describedBy, invalid }) => (
            <Select id={id} aria-describedby={describedBy} invalid={invalid} {...form.register('role')}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Начальный пароль" hint="Не меньше 12 символов. Пользователь заменит его при первом входе." error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <div className="flex gap-2">
              <div className="flex-1">
                <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('password')} />
              </div>
              <Button size="md" onClick={() => form.setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true })}>
                Сгенерировать
              </Button>
            </div>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(1, 'Введите имя.').max(120, 'Не больше 120 символов.'),
  role: z.enum(ROLES),
  status: z.enum(['active', 'disabled']),
});
type EditValues = z.infer<typeof editSchema>;

export function EditUserDialog({ user, onOpenChange, onSaved }: { user: User | null; onOpenChange: (o: boolean) => void; onSaved: (u: User) => void }) {
  const { user: actor } = useSessionView();
  const withStepUp = useStepUp();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema), values: user ? { name: user.name, role: user.role, status: user.status } : undefined });
  useEffect(() => setError(null), [user]);
  if (!user) return null;

  const allowed = (change: 'change_role' | 'change_status' | 'update_profile', newRole?: Role) =>
    canManageUser({ actorRole: actor.role, actorId: actor.id, targetId: user.id, targetRole: user.role, newRole, change });
  const self = user.id === actor.id;
  const canRole = allowed('change_role');
  const canStatus = allowed('change_status');
  const canName = allowed('update_profile');

  const onSubmit = form.handleSubmit(async (values) => {
    const patch: Partial<EditValues> = {};
    if (values.name.trim() !== user.name) patch.name = values.name.trim();
    if (values.role !== user.role) patch.role = values.role;
    if (values.status !== user.status) patch.status = values.status;
    if (!Object.keys(patch).length) return onOpenChange(false);
    setError(null);
    try {
      onSaved(await withStepUp(() => api('PATCH /api/v1/users/{id}', { params: { id: user.id }, body: patch })));
    } catch (e) {
      const d = describeError(e);
      if (!d.silent) setError(d.message);
    }
  });

  const role = form.watch('role');
  const status = form.watch('status');
  const privilegeChange = role !== user.role || status !== user.status;
  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={user.name}
      description={user.email}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="edit-user" loading={isSubmitting} disabled={!form.formState.isDirty}>
            Сохранить
          </Button>
        </>
      }
    >
      <form id="edit-user" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        {!canRole && !canStatus ? (
          <p className="rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-muted">
            {self ? 'Свою роль и статус изменить нельзя: это делает другой администратор.' : 'Учётные записи владельцев может менять только владелец.'}
          </p>
        ) : null}
        <Field label="Имя" error={errors.name?.message}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} disabled={!canName} {...form.register('name')} />}
        </Field>
        <Field label="Роль">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} disabled={!canRole} {...form.register('role')}>
              {ROLES.filter((r) => r === user.role || allowed('change_role', r)).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Статус">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} disabled={!canStatus} {...form.register('status')}>
              <option value="active">{USER_STATUS_LABELS.active}</option>
              <option value="disabled">{USER_STATUS_LABELS.disabled}</option>
            </Select>
          )}
        </Field>
        {privilegeChange ? (
          <p role="status" className="rounded-md border border-warn/25 bg-warn-soft px-3 py-2 text-[13px] text-ink">
            После сохранения пользователь будет выведен из всех сеансов{status === 'disabled' ? ' и не сможет войти' : ''}.
          </p>
        ) : null}
        <Advanced>
          <TechValue label="ID пользователя" value={user.id} />
          <TechValue label="Создан" value={formatDateTime(user.createdAt)} />
        </Advanced>
      </form>
    </Dialog>
  );
}

const initialSchema = z.object({ password: z.string().min(12, 'Не меньше 12 символов.').max(256, 'Не больше 256 символов.') });

/**
 * A new initial password (Phase M-1): for a forgotten or expired one while there is no e-mail. The
 * user's sessions end; they replace it at the next sign-in; their second factor stays.
 */
export function InitialPasswordDialog({ user, onOpenChange, onDone }: { user: User | null; onOpenChange: (o: boolean) => void; onDone: (u: User) => void }) {
  const withStepUp = useStepUp();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof initialSchema>>({ resolver: zodResolver(initialSchema), defaultValues: { password: '' } });
  useEffect(() => {
    if (user) {
      form.reset({ password: '' });
      setError(null);
    }
  }, [user, form]);
  if (!user) return null;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await withStepUp(() => api('POST /api/v1/users/{id}/initial-password', { params: { id: user.id }, body: { password } }));
      onDone(user);
    } catch (e) {
      const fields = fieldErrorsOf(e);
      if (fields.password) return form.setError('password', { message: fields.password });
      const d = describeError(e);
      if (!d.silent) setError(d.message);
    }
  });

  const { errors, isSubmitting } = form.formState;
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={`Новый начальный пароль: ${user.name}`}
      description="Сначала убедитесь, что просьба исходит от самого пользователя. Все его сеансы будут завершены; новый пароль действует 7 дней, при входе пользователь заменит его на свой. Второй фактор остаётся прежним."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button variant="primary" type="submit" form="initial-password" loading={isSubmitting}>
            Выдать пароль
          </Button>
        </>
      }
    >
      <form id="initial-password" onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Начальный пароль" hint="Передайте его лично или по защищённому каналу." error={errors.password?.message}>
          {({ id, describedBy, invalid }) => (
            <div className="flex gap-2">
              <div className="flex-1">
                <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...form.register('password')} />
              </div>
              <Button size="md" onClick={() => form.setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true })}>
                Сгенерировать
              </Button>
            </div>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
