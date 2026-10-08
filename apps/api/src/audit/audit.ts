/**
 * Audit log writer (approved §17.2). Append-only by database permission and trigger.
 *
 * Summaries are small, flat objects of action details. To make leaking a secret or personal
 * data structurally hard, keys are checked against a deny-list and values against a size limit;
 * a violation is a programming error and throws.
 */
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { auditEvents } from '../db/schema.ts';
import type { Queryable } from '../db/client.ts';

export type AuditResult = 'success' | 'failure' | 'denied';
type SummaryValue = string | number | boolean | null | string[];

export interface AuditInput {
  action: string;
  result: AuditResult;
  actorId?: string | null;
  resourceType?: string;
  resourceId?: string | null;
  summary?: Record<string, SummaryValue>;
}

const FORBIDDEN_KEY = /pass(word|phrase)?|token|secret|otp|code|cookie|session|hash(?!ed_email)|e-?mail(?!_hash)|phone|message|key$/i;
const ALLOWED_KEYS = new Set(['reason', 'method', 'role', 'previous_role', 'new_role', 'status', 'factor', 'count', 'fields', 'permission', 'step_up', 'email_hash', 'target', 'remaining', 'revoked', 'level']);

export class AuditSummaryError extends Error {}

export function checkSummary(summary: Record<string, SummaryValue>): void {
  for (const [k, v] of Object.entries(summary)) {
    if (!ALLOWED_KEYS.has(k) || (FORBIDDEN_KEY.test(k) && k !== 'email_hash'))
      throw new AuditSummaryError(`audit summary key "${k}" is not allowed`);
    const values = Array.isArray(v) ? v : [v];
    for (const x of values) if (typeof x === 'string' && x.length > 200) throw new AuditSummaryError(`audit summary value of "${k}" is too long`);
  }
}

export async function recordAudit(deps: Deps, client: ClientInfo | null, input: AuditInput, db: Queryable = requireDb(deps)): Promise<void> {
  const summary = input.summary ?? {};
  checkSummary(summary);
  await db.insert(auditEvents).values({
    at: deps.now(),
    actorId: input.actorId ?? null,
    action: input.action,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    result: input.result,
    requestId: client?.requestId ?? null,
    ipHash: client?.ipHash ?? null,
    userAgent: client?.userAgent ?? null,
    summary,
  });
}
