/**
 * Typed client for /api/v1 (same origin, approved §10). Types come from the OpenAPI contract
 * (schema.gen.ts). Rules:
 *  - cookies only (`credentials: 'same-origin'`); no token is ever read or stored by the SPA;
 *  - every state-changing request carries the CSRF header the API requires (admin-auth.md §6);
 *  - errors are RFC 9457 problems → `ApiError` with the request id for the error toast;
 *  - optimistic locking: content changes pass `headers: { 'if-match': '"<version>"' }`.
 */
import type { OperationKey, Operations, Problem } from './schema.gen';

export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'soltex-admin';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly fieldErrors: { field: string; message: string }[];
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, problem: Partial<Problem>, requestId: string | null, retryAfter: number | null) {
    super(problem.title ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code ?? (status === 0 ? 'network_error' : 'unknown_error');
    this.title = problem.title ?? '';
    this.detail = problem.detail;
    this.fieldErrors = problem.errors ?? [];
    this.requestId = problem.request_id ?? requestId;
    this.retryAfterSeconds = retryAfter;
  }
}

export const isApiError = (e: unknown, code?: string): e is ApiError => e instanceof ApiError && (code === undefined || e.code === code);

type Op<K extends OperationKey> = Operations[K];
type Args<K extends OperationKey> = ([Op<K>['body']] extends [never] ? { body?: undefined } : { body: Op<K>['body'] }) &
  ([Op<K>['query']] extends [never] ? { query?: undefined } : { query?: Op<K>['query'] }) &
  ([Op<K>['params']] extends [never] ? { params?: undefined } : { params: Op<K>['params'] }) &
  ([Op<K>['headers']] extends [never] ? { headers?: undefined } : { headers?: Op<K>['headers'] });

/** Listeners for session-level failures (handled once, centrally, by the session layer). */
type Listener = (e: ApiError, key: OperationKey) => void;
const listeners = new Set<Listener>();
export function onApiError(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (input, init) => fetch(input, init);
/** Tests only. */
export function setFetch(fn: FetchLike) {
  fetchImpl = fn;
}

export function buildUrl(key: OperationKey, params?: Record<string, string>, query?: Record<string, unknown>): string {
  let url = key.slice(key.indexOf(' ') + 1).replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params?.[name];
    if (v === undefined) throw new Error(`missing path parameter ${name}`);
    return encodeURIComponent(v);
  });
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  if (s) url += `?${s}`;
  return url;
}

export async function api<K extends OperationKey>(key: K, ...[args]: {} extends Args<K> ? [Args<K>?] : [Args<K>]): Promise<Op<K>['response']> {
  return request(key, args ?? {}, undefined);
}

/**
 * Media upload (Phase J): the file itself as the request body (`application/octet-stream`); the
 * API decides the type from the bytes. Other arguments as for `api`.
 */
export async function uploadFile<K extends OperationKey>(key: K, file: Blob, ...[args]: {} extends Args<K> ? [Args<K>?] : [Args<K>]): Promise<Op<K>['response']> {
  return request(key, args ?? {}, file);
}

async function request<K extends OperationKey>(key: K, args: object, file: Blob | undefined): Promise<Op<K>['response']> {
  const method = key.slice(0, key.indexOf(' '));
  const a = args as { body?: unknown; query?: Record<string, unknown>; params?: Record<string, string>; headers?: Record<string, string | undefined> };
  const headers: Record<string, string> = { Accept: 'application/json' };
  for (const [k, v] of Object.entries(a.headers ?? {})) if (v !== undefined) headers[k] = v;
  if (method !== 'GET') headers[CSRF_HEADER] = CSRF_VALUE;
  if (file) headers['Content-Type'] = 'application/octet-stream';
  else if (a.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetchImpl(buildUrl(key, a.params, a.query), {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: file ?? (a.body === undefined ? undefined : JSON.stringify(a.body)),
    });
  } catch {
    const e = new ApiError(0, { title: 'Нет связи с сервером. Проверьте подключение и повторите.' }, null, null);
    listeners.forEach((l) => l(e, key));
    throw e;
  }

  const requestId = res.headers.get('x-request-id');
  if (res.ok) {
    if (res.status === 204 || res.status === 202) return undefined as Op<K>['response'];
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as Op<K>['response'];
  }

  let problem: Partial<Problem> = {};
  try {
    problem = (await res.json()) as Problem;
  } catch {
    /* non-JSON error (proxy page): keep defaults */
  }
  const retry = Number(res.headers.get('retry-after'));
  const e = new ApiError(res.status, problem, requestId, Number.isFinite(retry) && retry > 0 ? retry : null);
  listeners.forEach((l) => l(e, key));
  throw e;
}
