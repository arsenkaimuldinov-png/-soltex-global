/**
 * Shared Russian vocabulary of the admin (review §X: statuses are Russian words, no enum values
 * or technical codes in the main UI). Screen-specific sentences live next to their screen.
 * Role names come from @soltex/core (ROLE_LABELS), so the API and the admin use the same words.
 */
export { ROLE_LABELS } from '@soltex/core/domain';

export const USER_STATUS_LABELS = { active: 'Активен', disabled: 'Отключён' } as const;

export const RESULT_LABELS = { success: 'Успешно', failure: 'Ошибка', denied: 'Отказано' } as const;

export const MFA_REQUIREMENT_LABELS = {
  passkey: 'Обязателен ключ доступа (passkey)',
  any: 'Обязателен второй фактор',
  none: 'Второй фактор рекомендуется',
} as const;

/** Audit actions written by the API (docs/admin-auth.md §5). Unknown actions get a neutral label. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Вход в систему',
  'auth.logout': 'Выход из системы',
  'auth.lockout': 'Блокировка входа после неудачных попыток',
  'auth.mfa': 'Подтверждение вторым фактором',
  'auth.password.change': 'Смена пароля',
  'auth.password_reset.request': 'Запрос на сброс пароля',
  'auth.password_reset.confirm': 'Сброс пароля',
  'auth.session.revoke': 'Завершение сеанса',
  'auth.session.revoke_others': 'Завершение других сеансов',
  'mfa.totp.enroll_start': 'Начало подключения приложения-аутентификатора',
  'mfa.totp.enroll': 'Подключено приложение-аутентификатор',
  'mfa.totp.disable': 'Отключено приложение-аутентификатор',
  'mfa.recovery.regenerate': 'Новые резервные коды',
  'mfa.passkey.register': 'Добавлен ключ доступа',
  'mfa.passkey.remove': 'Удалён ключ доступа',
  'user.create': 'Создан пользователь',
  'user.update': 'Изменён пользователь',
  'user.profile_update': 'Изменён профиль',
  'user.mfa_reset': 'Сброшен второй фактор пользователя',
  'user.sessions_revoke': 'Пользователь выведен из всех сеансов',
  'user.bootstrap_owner': 'Создан первый владелец',
  'access.denied': 'Попытка доступа без прав',
  'content.create': 'Создан материал',
  'content.update': 'Изменён материал',
  'content.archive': 'Материал перенесён в архив',
  'content.restore': 'Материал возвращён из архива',
  'translation.update': 'Изменён перевод',
  'translation.approve': 'Перевод утверждён',
  'translation.reopen': 'Перевод возвращён в работу',
  'content.publish': 'Материал отмечен к публикации',
  'content.unpublish': 'Материал снят с публикации',
  'revision.restore': 'Восстановлена версия материала',
  'release.create': 'Создан релиз',
  'release.build': 'Сборка релиза',
  'release.activate': 'Релиз опубликован',
  'release.rollback': 'Откат сайта к релизу',
  'release.retry': 'Повторная сборка релиза',
  'preview.build': 'Сборка предпросмотра',
  'preview.grant': 'Открыт предпросмотр',
  'preview.revoke': 'Предпросмотры закрыты',
  'content.slug_change': 'Изменён адрес страницы',
  'redirect.create': 'Создан редирект',
  'redirect.update': 'Изменён редирект',
  'redirect.delete': 'Удалён редирект',
};
export const auditActionLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? 'Действие в системе';

/** Audit summary reasons and factors shown in plain words. */
export const AUDIT_DETAIL_LABELS: Record<string, string> = {
  wrong_password: 'неверный пароль',
  unknown_account: 'неизвестная учётная запись',
  disabled: 'учётная запись отключена',
  locked: 'вход временно заблокирован',
  invalid_token: 'ссылка недействительна или устарела',
  mfa_required: 'ожидает второй фактор',
  mfa_enrollment_required: 'ожидает настройки второго фактора',
  authenticated: 'вход выполнен',
  throttled: 'слишком частые попытки',
  password: 'пароль',
  passkey: 'ключ доступа',
  totp: 'код из приложения',
  recovery: 'резервный код',
  recovery_code: 'резервный код',
  cli: 'командная строка сервера',
  draft: 'черновик',
  archived: 'в архиве',
  published: 'опубликовано',
  missing: 'нет перевода',
  in_progress: 'в работе',
  outdated: 'устарел',
  approved: 'утверждён',
  queued: 'в очереди',
  ready: 'готов к публикации',
  active: 'на сайте',
  failed: 'ошибка',
  artifact_missing: 'файлы релиза отсутствуют',
  artifact_checksum: 'файлы релиза изменены',
  artifact_unreadable: 'файлы релиза не читаются',
  switch_failed: 'не удалось переключить сайт',
  smoke_failed: 'проверка после переключения не пройдена',
  activation_failed: 'публикация прервана, сайт возвращён',
  worker_lost: 'процесс сборки прервался',
};

/** Language codes in audit details. */
export const LOCALE_NAMES: Record<string, string> = { en: 'английский', ru: 'русский', zh: 'китайский', tr: 'турецкий', ar: 'арабский', es: 'испанский' };

/** Audit resource types of content (docs/admin-content.md §7). */
export const RESOURCE_LABELS: Record<string, string> = {
  page: 'страница',
  project: 'проект',
  technology: 'технология',
  product: 'продукт',
  epcm_stage: 'этап EPC / EPCM',
  patent: 'патент',
  video: 'видео',
  user: 'пользователь',
  release: 'релиз',
  redirect: 'редирект',
};

/** Password policy problems returned by the API (field errors of `password_rejected`). */
export const PASSWORD_PROBLEMS: Record<string, string> = {
  too_short: 'Пароль слишком короткий: нужно не меньше 12 символов.',
  too_long: 'Пароль слишком длинный: не больше 256 символов.',
  too_common: 'Этот пароль слишком распространён. Выберите другой.',
  contains_email: 'Пароль не должен содержать ваш e-mail.',
};

export const GENERIC_ERROR = 'Не удалось выполнить действие. Повторите попытку.';
