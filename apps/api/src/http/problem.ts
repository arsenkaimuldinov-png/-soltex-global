/**
 * RFC 9457 Problem Details (approved §19). Every error response of /api/v1 is
 * `application/problem+json`:
 *   { type, title, status, code, detail?, errors?, request_id }
 * Titles are Russian (shown in the admin). No stack traces, SQL, paths or secrets, ever.
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { z } from 'zod';

export const PROBLEM_CODES = {
  validation_failed: { status: 400, title: 'Некорректные данные запроса' },
  bad_request: { status: 400, title: 'Некорректный запрос' },
  unauthenticated: { status: 401, title: 'Требуется вход в систему' },
  invalid_credentials: { status: 401, title: 'Неверный e-mail или пароль' },
  mfa_required: { status: 401, title: 'Требуется подтверждение вторым фактором' },
  mfa_invalid: { status: 401, title: 'Неверный код или ключ доступа' },
  forbidden: { status: 403, title: 'Недостаточно прав' },
  csrf_rejected: { status: 403, title: 'Запрос отклонён (защита от подделки запросов)' },
  mfa_enrollment_required: { status: 403, title: 'Необходимо настроить второй фактор входа' },
  step_up_required: { status: 403, title: 'Подтвердите действие вторым фактором' },
  not_found: { status: 404, title: 'Не найдено' },
  conflict: { status: 409, title: 'Конфликт с текущим состоянием' },
  password_rejected: { status: 422, title: 'Пароль не соответствует требованиям' },
  challenge_invalid: { status: 400, title: 'Запрос подтверждения устарел или уже использован' },
  payload_too_large: { status: 413, title: 'Слишком большой запрос' },
  unsupported_media_type: { status: 415, title: 'Неподдерживаемый формат запроса' },
  rate_limited: { status: 429, title: 'Слишком много запросов, повторите позже' },
  login_throttled: { status: 429, title: 'Слишком много неудачных попыток входа, повторите позже' },
  internal_error: { status: 500, title: 'Внутренняя ошибка сервера' },
} as const;

export type ProblemCode = keyof typeof PROBLEM_CODES;

export interface FieldError {
  field: string;
  message: string;
}

export class Problem extends Error {
  constructor(
    readonly code: ProblemCode,
    readonly detail?: string,
    readonly extra: { errors?: FieldError[]; retryAfterSeconds?: number } = {}
  ) {
    super(code);
  }
}

export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    code: z.string(),
    detail: z.string().optional(),
    errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    request_id: z.string(),
  })
  .meta({ id: 'Problem', description: 'RFC 9457 Problem Details' });

export function sendProblem(request: FastifyRequest, reply: FastifyReply, p: Problem) {
  const def = PROBLEM_CODES[p.code];
  if (p.extra.retryAfterSeconds !== undefined) reply.header('retry-after', String(Math.max(1, Math.ceil(p.extra.retryAfterSeconds))));
  return reply
    .code(def.status)
    .header('content-type', 'application/problem+json; charset=utf-8')
    .header('cache-control', 'no-store')
    .send(
      JSON.stringify({
        type: `urn:soltex:problem:${p.code}`,
        title: def.title,
        status: def.status,
        code: p.code,
        ...(p.detail ? { detail: p.detail } : {}),
        ...(p.extra.errors ? { errors: p.extra.errors } : {}),
        request_id: request.id,
      })
    );
}

/** Register the error and not-found handlers on the app. */
export function registerProblemHandlers(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => sendProblem(request, reply, new Problem('not_found')));

  app.setErrorHandler((error: FastifyError | Problem, request, reply) => {
    if (error instanceof Problem) return sendProblem(request, reply, error);
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map((v) => ({
        field: [v.instancePath.replace(/^\//, '').replace(/\//g, '.'), (v.params as { issue?: { path?: unknown[] } })?.issue?.path?.join('.')]
          .filter(Boolean)
          .join('') || (error.validationContext ?? 'body'),
        message: v.message ?? 'invalid',
      }));
      return sendProblem(request, reply, new Problem('validation_failed', undefined, { errors }));
    }
    const status = (error as FastifyError).statusCode;
    if (status === 413) return sendProblem(request, reply, new Problem('payload_too_large'));
    if (status === 415) return sendProblem(request, reply, new Problem('unsupported_media_type'));
    if (status === 429) return sendProblem(request, reply, new Problem('rate_limited'));
    if (status && status >= 400 && status < 500 && !isResponseSerializationError(error))
      return sendProblem(request, reply, new Problem('bad_request'));
    // Unexpected: full detail goes to the server log only (with the request id).
    request.log.error({ err: error }, 'unhandled error');
    return sendProblem(request, reply, new Problem('internal_error'));
  });
}
