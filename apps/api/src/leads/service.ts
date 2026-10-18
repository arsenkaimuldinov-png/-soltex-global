/**
 * Leads (Phase K-1, docs/admin-leads.md; approved §13, review §K).
 *
 *  - Intake: validation, spam verdict (stored as status `spam`, never silently dropped), per-column
 *    encryption of e-mail / phone / message, HMAC blind indexes, IP as a keyed hash, consent record
 *    `notice_only` (no checkbox in the forms yet), and a `lead.created` outbox event in the same
 *    transaction. The visitor gets the reference SOL-<year>-<number>.
 *  - Admin: list / detail (decrypted only here), status, assignee, encrypted notes, history,
 *    soft delete and restore, CSV export (formula-safe, audited, owners notified).
 *  - Anonymization: 30 days after deletion and after the retention period every personal field is
 *    cleared (name, company, contacts, message, notes, IP hash, attribution); date, form, language,
 *    page, topic and status remain.
 * Personal data never reaches logs, the audit log, the outbox or lead events in plain text.
 */
import crypto from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  csvCell,
  hasPermission,
  LEAD_DELETE_GRACE_DAYS,
  LEAD_REQUIRED_FIELDS,
  leadReference,
  normalizeEmail,
  normalizePhone,
  spamVerdict,
  touchSummary,
  type LeadAttribution,
  type LeadForm,
  type LeadStatus,
  type Locale,
} from '@soltex/core/domain';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import * as s from '../db/schema.ts';
import type { Queryable } from '../db/client.ts';
import type { UserRow } from '../auth/sessions.ts';
import { decryptSecret, encryptSecret, keyedHash } from '../auth/crypto.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem, type FieldError } from '../http/problem.ts';
import { EmailError, type EmailProvider } from '../notify/email.ts';

type LeadRow = typeof s.leads.$inferSelect;

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const enc = (deps: Deps, leadId: string, field: string, value: string | null | undefined): string | null =>
  value ? encryptSecret(value, deps.config.encryption.keys, deps.config.encryption.currentKeyId, `lead:${leadId}:${field}`) : null;

const dec = (deps: Deps, leadId: string, field: string, value: string | null): string | null => (value ? decryptSecret(value, deps.config.encryption.keys, `lead:${leadId}:${field}`) : null);

/** Blind index: HMAC of the normalized value, domain-separated per kind. */
export const blindIndex = (deps: Deps, kind: 'email' | 'phone', value: string): string =>
  keyedHash(deps.config.hashSecret, `lead-${kind}:${kind === 'email' ? normalizeEmail(value) : normalizePhone(value)}`);

// ---------------------------------------------------------------------------
// Intake (public)
// ---------------------------------------------------------------------------

export interface LeadInput {
  formType: LeadForm;
  fields: { name: string; phone?: string; email?: string; company?: string; message?: string };
  topic: string | null;
  locale: Locale;
  pagePath: string;
  hp?: string;
  fillMs?: number;
  attribution?: LeadAttribution;
  /** The consent box was ticked (Phase N-0). */
  consent?: true;
}

export async function createLead(deps: Deps, input: LeadInput, ipHash: string): Promise<{ reference: string; spam: boolean }> {
  const db = requireDb(deps);
  const f = Object.fromEntries(Object.entries(input.fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as LeadInput['fields'];
  const errors: FieldError[] = [];
  for (const k of LEAD_REQUIRED_FIELDS[input.formType]) if (!f[k]) errors.push({ field: `fields.${k}`, message: 'required' });
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) errors.push({ field: 'fields.email', message: 'invalid' });
  if (f.phone && normalizePhone(f.phone).length < 5) errors.push({ field: 'fields.phone', message: 'invalid' });
  // Phase N-0: once a privacy notice is published (PRIVACY_NOTICE_VERSION), the forms ask for
  // consent with a required checkbox; a lead without it is refused (Kazakhstan, Law 94-V art. 8).
  const notice = deps.config.leads.privacyNoticeVersion;
  if (notice && input.consent !== true) errors.push({ field: 'consent', message: 'required' });
  if (errors.length) throw new Problem('validation_failed', undefined, { errors });

  const verdict = spamVerdict({ honeypot: input.hp, fillMs: input.fillMs, name: f.name, message: f.message });
  const now = deps.now();
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(sql`SELECT nextval('lead_number_seq') AS n`);
    const number = Number((rows[0] as { n: string }).n);
    const id = crypto.randomUUID();
    const reference = leadReference(now.getUTCFullYear(), number);
    await tx.insert(s.leads).values({
      id,
      reference,
      number,
      formType: input.formType,
      locale: input.locale,
      pagePath: input.pagePath || null,
      topic: input.topic?.trim() || null,
      name: f.name,
      company: f.company || null,
      emailEnc: enc(deps, id, 'email', f.email),
      phoneEnc: enc(deps, id, 'phone', f.phone),
      messageEnc: enc(deps, id, 'message', f.message),
      emailBidx: f.email ? blindIndex(deps, 'email', f.email) : null,
      phoneBidx: f.phone ? blindIndex(deps, 'phone', f.phone) : null,
      ipHash,
      status: verdict.spam ? 'spam' : 'new',
      spamScore: verdict.score,
      spamReasons: verdict.reasons,
      consentBasis: input.consent ? 'checkbox' : 'notice_only',
      privacyNoticeVersion: notice,
      consentTextVersion: input.consent ? notice : null,
      consentAt: input.consent ? now : null,
      // Approved §13.3: kept only while attribution is switched on; otherwise ignored.
      attribution: deps.config.site.attributionEnabled && (input.attribution?.first || input.attribution?.last) ? input.attribution : null,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(s.leadEvents).values({ leadId: id, at: now, kind: 'created', data: { form: input.formType, spam: verdict.spam } });
    if (!verdict.spam) await tx.insert(s.outbox).values({ kind: 'lead.created', payload: { leadId: id }, createdAt: now, nextAttemptAt: now });
    return { reference, spam: verdict.spam };
  });
}

// ---------------------------------------------------------------------------
// Admin: reading
// ---------------------------------------------------------------------------

export interface LeadListQuery {
  q?: string;
  status?: LeadStatus;
  form?: LeadForm;
  from?: string;
  to?: string;
  deleted?: boolean;
  assignee?: string;
  limit: number;
  offset: number;
}

async function users(db: Queryable, ids: Array<string | null>) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map<string, { id: string; name: string }>();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

function whereOf(deps: Deps, q: Omit<LeadListQuery, 'limit' | 'offset'>): SQL | undefined {
  const parts: Array<SQL | undefined> = [q.deleted ? isNotNull(s.leads.deletedAt) : isNull(s.leads.deletedAt)];
  if (q.status) parts.push(eq(s.leads.status, q.status));
  if (q.form) parts.push(eq(s.leads.formType, q.form));
  if (q.assignee) parts.push(q.assignee === 'none' ? isNull(s.leads.assigneeId) : eq(s.leads.assigneeId, q.assignee));
  if (q.from) parts.push(gte(s.leads.createdAt, new Date(`${q.from}T00:00:00Z`)));
  if (q.to) parts.push(lte(s.leads.createdAt, new Date(`${q.to}T23:59:59.999Z`)));
  const text = q.q?.trim();
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const alts: SQL[] = [ilike(s.leads.name, like), ilike(s.leads.company, like), ilike(s.leads.reference, like)];
    // E-mail and phone are encrypted: exact match through the blind index only.
    if (text.includes('@')) alts.push(eq(s.leads.emailBidx, blindIndex(deps, 'email', text)));
    if (normalizePhone(text).length >= 5 && /^[\d\s()+-]+$/.test(text)) alts.push(eq(s.leads.phoneBidx, blindIndex(deps, 'phone', text)));
    parts.push(or(...alts));
  }
  return and(...parts);
}

export interface LeadView {
  id: string;
  reference: string;
  formType: LeadForm;
  locale: string;
  pagePath: string | null;
  topic: string | null;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  assignee: { id: string; name: string } | null;
  spamScore: number;
  spamReasons: string[];
  consentBasis: 'notice_only' | 'checkbox';
  privacyNoticeVersion: string | null;
  attribution: LeadAttribution | null;
  notification: 'sent' | 'pending' | 'failed' | 'not_needed';
  duplicates: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  anonymizedAt: string | null;
}

async function notificationStates(db: Queryable, ids: string[]): Promise<Map<string, { sent: boolean; error: string | null }>> {
  if (!ids.length) return new Map();
  const { rows } = await db.execute(
    sql`SELECT payload->>'leadId' AS lead_id, sent_at, last_error FROM outbox WHERE kind = 'lead.created' AND payload->>'leadId' IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`
  );
  return new Map((rows as Array<{ lead_id: string; sent_at: Date | null; last_error: string | null }>).map((r) => [r.lead_id, { sent: !!r.sent_at, error: r.last_error }]));
}

async function duplicateCounts(db: Queryable, rows: LeadRow[]): Promise<Map<string, number>> {
  const emails = [...new Set(rows.map((r) => r.emailBidx).filter((x): x is string => !!x))];
  const phones = [...new Set(rows.map((r) => r.phoneBidx).filter((x): x is string => !!x))];
  if (!emails.length && !phones.length) return new Map();
  const others = await db
    .select({ id: s.leads.id, e: s.leads.emailBidx, p: s.leads.phoneBidx })
    .from(s.leads)
    .where(and(isNull(s.leads.anonymizedAt), or(emails.length ? inArray(s.leads.emailBidx, emails) : undefined, phones.length ? inArray(s.leads.phoneBidx, phones) : undefined)));
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.id, others.filter((o) => o.id !== r.id && ((r.emailBidx && o.e === r.emailBidx) || (r.phoneBidx && o.p === r.phoneBidx))).length);
  return out;
}

function toView(deps: Deps, r: LeadRow, u: Map<string, { id: string; name: string }>, n: Map<string, { sent: boolean; error: string | null }>, dup: Map<string, number>): LeadView {
  const state = n.get(r.id);
  return {
    id: r.id,
    reference: r.reference,
    formType: r.formType,
    locale: r.locale,
    pagePath: r.pagePath,
    topic: r.topic,
    name: r.name,
    company: r.company,
    email: dec(deps, r.id, 'email', r.emailEnc),
    phone: dec(deps, r.id, 'phone', r.phoneEnc),
    status: r.status,
    assignee: r.assigneeId ? u.get(r.assigneeId) ?? null : null,
    spamScore: r.spamScore,
    spamReasons: r.spamReasons,
    consentBasis: r.consentBasis,
    privacyNoticeVersion: r.privacyNoticeVersion,
    attribution: (r.attribution as LeadAttribution | null) ?? null,
    notification: r.notifiedAt || state?.sent ? 'sent' : !state ? 'not_needed' : state.error ? 'failed' : 'pending',
    duplicates: dup.get(r.id) ?? 0,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    anonymizedAt: r.anonymizedAt ? r.anonymizedAt.toISOString() : null,
  };
}

export async function listLeads(deps: Deps, q: LeadListQuery) {
  const db = requireDb(deps);
  const where = whereOf(deps, q);
  const [{ total }] = (await db.select({ total: sql<number>`count(*)::int` }).from(s.leads).where(where)) as [{ total: number }];
  const rows = await db.select().from(s.leads).where(where).orderBy(desc(s.leads.createdAt), desc(s.leads.number)).limit(q.limit).offset(q.offset);
  const [u, n, dup] = await Promise.all([users(db, rows.map((r) => r.assigneeId)), notificationStates(db, rows.map((r) => r.id)), duplicateCounts(db, rows)]);
  const counts = await db
    .select({ status: s.leads.status, n: sql<number>`count(*)::int` })
    .from(s.leads)
    .where(isNull(s.leads.deletedAt))
    .groupBy(s.leads.status);
  return {
    items: rows.map((r) => toView(deps, r, u, n, dup)),
    total: Number(total),
    byStatus: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    // Phase K-2: whether the site's forms send here (applies from the next site build).
    site: { formsLive: deps.config.site.leadsEnabled, attribution: deps.config.site.attributionEnabled },
  };
}

export interface LeadEventView {
  id: string;
  at: string;
  actor: { id: string; name: string } | null;
  kind: string;
  data: Record<string, unknown>;
  note: string | null;
}

export async function getLead(deps: Deps, id: string) {
  const db = requireDb(deps);
  const [r] = await db.select().from(s.leads).where(eq(s.leads.id, id));
  if (!r) throw new Problem('not_found');
  const events = await db.select().from(s.leadEvents).where(eq(s.leadEvents.leadId, id)).orderBy(desc(s.leadEvents.at), desc(s.leadEvents.id));
  const [u, n, dup] = await Promise.all([users(db, [r.assigneeId, ...events.map((e) => e.actorId)]), notificationStates(db, [r.id]), duplicateCounts(db, [r])]);
  return {
    ...toView(deps, r, u, n, dup),
    message: dec(deps, r.id, 'message', r.messageEnc),
    notificationError: n.get(r.id)?.error ?? null,
    events: events.map(
      (e): LeadEventView => ({
        id: e.id,
        at: e.at.toISOString(),
        actor: e.actorId ? u.get(e.actorId) ?? null : null,
        kind: e.kind,
        data: e.data as Record<string, unknown>,
        note: dec(deps, r.id, `note:${e.id}`, e.noteEnc),
      })
    ),
  };
}

/** People a lead can be assigned to: active users whose role may read leads. */
export async function assignees(deps: Deps) {
  const db = requireDb(deps);
  const rows = await db.select({ id: s.users.id, name: s.users.name, role: s.users.role, status: s.users.status }).from(s.users).orderBy(s.users.name);
  return rows.filter((u) => u.status === 'active' && hasPermission(u.role, 'leads.read')).map((u) => ({ id: u.id, name: u.name }));
}

// ---------------------------------------------------------------------------
// Admin: changes
// ---------------------------------------------------------------------------

async function lockLead(tx: Queryable, id: string, expectedVersion: number): Promise<LeadRow> {
  const [r] = await tx.select().from(s.leads).where(eq(s.leads.id, id)).for('update');
  if (!r) throw new Problem('not_found');
  if (r.version !== expectedVersion) throw new Problem('edit_conflict');
  if (r.anonymizedAt) throw new Problem('invalid_transition', 'Заявка обезличена и не изменяется.');
  return r;
}

export async function updateLead(deps: Deps, actor: UserRow, id: string, expectedVersion: number, patch: { status?: LeadStatus; assigneeId?: string | null }, client: ClientInfo) {
  const db = requireDb(deps);
  await db.transaction(async (tx) => {
    const r = await lockLead(tx, id, expectedVersion);
    if (r.deletedAt) throw new Problem('invalid_transition', 'Заявка в корзине. Восстановите её, чтобы изменить.');
    const now = deps.now();
    const set: Partial<typeof s.leads.$inferInsert> = {};
    const fields: string[] = [];
    if (patch.status !== undefined && patch.status !== r.status) {
      set.status = patch.status;
      fields.push('status');
      await tx.insert(s.leadEvents).values({ leadId: id, at: now, actorId: actor.id, kind: 'status', data: { from: r.status, to: patch.status } });
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== r.assigneeId) {
      if (patch.assigneeId && !(await assignees(deps)).some((a) => a.id === patch.assigneeId))
        throw new Problem('validation_failed', undefined, { errors: [{ field: 'assigneeId', message: 'not_allowed' }] });
      set.assigneeId = patch.assigneeId;
      fields.push('assignee');
      await tx.insert(s.leadEvents).values({ leadId: id, at: now, actorId: actor.id, kind: 'assignee', data: { from: r.assigneeId, to: patch.assigneeId } });
    }
    if (!fields.length) return;
    await tx
      .update(s.leads)
      .set({ ...set, version: sql`${s.leads.version} + 1`, updatedAt: now, updatedBy: actor.id })
      .where(eq(s.leads.id, id));
    await recordAudit(deps, client, { action: 'lead.update', result: 'success', actorId: actor.id, resourceType: 'lead', resourceId: id, summary: { fields, ...(set.status ? { status: set.status } : {}) } }, tx);
  });
  return getLead(deps, id);
}

export async function addNote(deps: Deps, actor: UserRow, id: string, text: string, client: ClientInfo) {
  const db = requireDb(deps);
  const note = text.trim();
  if (!note) throw new Problem('validation_failed', undefined, { errors: [{ field: 'text', message: 'required' }] });
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(s.leads).where(eq(s.leads.id, id));
    if (!r) throw new Problem('not_found');
    if (r.anonymizedAt || r.deletedAt) throw new Problem('invalid_transition', 'Заметки добавляются только к действующей заявке.');
    const eventId = uuidv7(); // time-ordered like every other event id
    await tx.insert(s.leadEvents).values({ id: eventId, leadId: id, at: deps.now(), actorId: actor.id, kind: 'note', noteEnc: enc(deps, id, `note:${eventId}`, note) });
    await recordAudit(deps, client, { action: 'lead.note', result: 'success', actorId: actor.id, resourceType: 'lead', resourceId: id }, tx);
  });
  return getLead(deps, id);
}

export async function setDeleted(deps: Deps, actor: UserRow, id: string, expectedVersion: number, deleted: boolean, client: ClientInfo) {
  const db = requireDb(deps);
  await db.transaction(async (tx) => {
    const r = await lockLead(tx, id, expectedVersion);
    if (!!r.deletedAt === deleted) throw new Problem('invalid_transition', deleted ? 'Заявка уже в корзине.' : 'Заявка не в корзине.');
    const now = deps.now();
    await tx
      .update(s.leads)
      .set({ deletedAt: deleted ? now : null, deletedBy: deleted ? actor.id : null, version: sql`${s.leads.version} + 1`, updatedAt: now, updatedBy: actor.id })
      .where(eq(s.leads.id, id));
    await tx.insert(s.leadEvents).values({ leadId: id, at: now, actorId: actor.id, kind: deleted ? 'deleted' : 'restored' });
    await recordAudit(deps, client, { action: deleted ? 'lead.delete' : 'lead.restore', result: 'success', actorId: actor.id, resourceType: 'lead', resourceId: id }, tx);
  });
  return getLead(deps, id);
}

// ---------------------------------------------------------------------------
// Export (CSV)
// ---------------------------------------------------------------------------

const FORM_RU: Record<LeadForm, string> = { cta_section: 'Блок «Связаться»', inquiry_modal: 'Окно запроса', contact_page: 'Страница «Контакты»' };
const STATUS_RU: Record<LeadStatus, string> = { new: 'Новый', in_progress: 'В работе', qualified: 'Квалифицирован', won: 'Успешно', lost: 'Отказ', spam: 'Спам' };

export async function exportLeads(deps: Deps, actor: UserRow, q: Omit<LeadListQuery, 'limit' | 'offset'>, client: ClientInfo): Promise<{ csv: string; count: number }> {
  const db = requireDb(deps);
  const rows = await db.select().from(s.leads).where(whereOf(deps, { ...q, deleted: false })).orderBy(desc(s.leads.createdAt)).limit(50_000);
  const u = await users(db, rows.map((r) => r.assigneeId));
  const header = ['Номер', 'Дата (UTC)', 'Статус', 'Форма', 'Язык', 'Страница', 'Тема', 'Имя', 'Компания', 'Телефон', 'E-mail', 'Сообщение', 'Ответственный', 'Источник: первый визит', 'Источник: последний'];
  const lines = [header.map(csvCell).join(';')];
  for (const r of rows)
    lines.push(
      [
        r.reference,
        r.createdAt.toISOString().slice(0, 16).replace('T', ' '),
        STATUS_RU[r.status],
        FORM_RU[r.formType],
        r.locale,
        r.pagePath,
        r.topic,
        r.name,
        r.company,
        dec(deps, r.id, 'phone', r.phoneEnc),
        dec(deps, r.id, 'email', r.emailEnc),
        dec(deps, r.id, 'message', r.messageEnc),
        r.assigneeId ? u.get(r.assigneeId)?.name ?? '' : '',
        touchSummary((r.attribution as LeadAttribution | null)?.first),
        touchSummary((r.attribution as LeadAttribution | null)?.last),
      ]
        .map(csvCell)
        .join(';')
    );
  const filter = [q.status && `status=${q.status}`, q.form && `form=${q.form}`, q.from && `from=${q.from}`, q.to && `to=${q.to}`, q.q && 'search', q.assignee && 'assignee'].filter(Boolean).join(',') || 'all';
  await db.transaction(async (tx) => {
    await recordAudit(deps, client, { action: 'lead.export', result: 'success', actorId: actor.id, resourceType: 'lead', summary: { count: rows.length, reason: filter.slice(0, 200) } }, tx);
    await tx.insert(s.outbox).values({ kind: 'leads.exported', payload: { actorId: actor.id, count: rows.length }, createdAt: deps.now(), nextAttemptAt: deps.now() });
  });
  // UTF-8 BOM so spreadsheet programs read Cyrillic correctly; CRLF line ends.
  return { csv: `﻿${lines.join('\r\n')}\r\n`, count: rows.length };
}

// ---------------------------------------------------------------------------
// Anonymization (approved §13.1)
// ---------------------------------------------------------------------------

/** Clear every personal field of leads deleted > 30 days ago or older than the retention period. */
export async function anonymizeDue(deps: Deps): Promise<number> {
  const db = requireDb(deps);
  const now = deps.now();
  const deletedBefore = new Date(now.getTime() - LEAD_DELETE_GRACE_DAYS * 86_400_000);
  const retainedAfter = new Date(now);
  retainedAfter.setUTCMonth(retainedAfter.getUTCMonth() - deps.config.leads.retentionMonths);
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: s.leads.id, deletedAt: s.leads.deletedAt })
      .from(s.leads)
      .where(and(isNull(s.leads.anonymizedAt), or(lt(s.leads.deletedAt, deletedBefore), lt(s.leads.createdAt, retainedAfter))))
      .for('update', { skipLocked: true })
      .limit(500);
    for (const d of due) {
      await tx
        .update(s.leads)
        .set({ name: null, company: null, emailEnc: null, phoneEnc: null, messageEnc: null, emailBidx: null, phoneBidx: null, ipHash: null, attribution: null, anonymizedAt: now, version: sql`${s.leads.version} + 1` })
        .where(eq(s.leads.id, d.id));
      await tx.update(s.leadEvents).set({ noteEnc: null }).where(eq(s.leadEvents.leadId, d.id));
      await tx.insert(s.leadEvents).values({ leadId: d.id, at: now, kind: 'anonymized', data: { reason: d.deletedAt && d.deletedAt < deletedBefore ? 'deleted' : 'retention' } });
    }
    if (due.length) await recordAudit(deps, null, { action: 'lead.anonymize', result: 'success', resourceType: 'lead', summary: { count: due.length } }, tx);
    return due.length;
  });
}

// ---------------------------------------------------------------------------
// Outbox: notifications
// ---------------------------------------------------------------------------

const BACKOFF_MIN = [1, 5, 15, 60, 180, 720];

/** Russian notice for the sales team (built when it is sent; nothing personal is queued). */
async function leadNotice(deps: Deps, tx: Queryable, leadId: string) {
  const [r] = await tx.select().from(s.leads).where(eq(s.leads.id, leadId));
  if (!r || r.status === 'spam' || r.anonymizedAt || r.deletedAt) return null;
  const line = (label: string, v: string | null) => (v ? `${label}: ${v}` : null);
  const text = [
    `Новая заявка ${r.reference} с сайта soltexglobal.co`,
    '',
    line('Форма', FORM_RU[r.formType]),
    line('Язык страницы', r.locale),
    line('Страница', r.pagePath),
    line('Тема', r.topic),
    '',
    line('Имя', r.name),
    line('Компания', r.company),
    line('Телефон', dec(deps, r.id, 'phone', r.phoneEnc)),
    line('E-mail', dec(deps, r.id, 'email', r.emailEnc)),
    line('Сообщение', dec(deps, r.id, 'message', r.messageEnc)),
    '',
    `Открыть в админке: ${deps.config.adminOrigin}/leads/${r.id}`,
  ]
    .filter((x) => x !== null)
    .join('\n');
  return { lead: r, message: { to: deps.config.leads.notifyTo, subject: `Новая заявка ${r.reference}${r.topic ? ` — ${r.topic.slice(0, 80)}` : ''}`, text } };
}

async function exportNotice(tx: Queryable, payload: { actorId: string; count: number }) {
  const owners = await tx.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.role, 'owner'), eq(s.users.status, 'active')));
  const [actor] = await tx.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, payload.actorId));
  return {
    to: owners.map((o) => o.email),
    subject: 'Выгрузка заявок из админки Soltex Global',
    text: `Пользователь ${actor?.name ?? '—'} выгрузил заявки: ${payload.count} шт.\nПодробности — в журнале действий админки.`,
  };
}

/**
 * Deliver the next due outbox message. Returns 'done' when one was handled (sent, skipped or
 * rescheduled), 'idle' when nothing is due. Safe with several workers (SKIP LOCKED).
 */
export async function processNextOutbox(deps: Deps, email: EmailProvider): Promise<'done' | 'idle'> {
  const db = requireDb(deps);
  return db.transaction(async (tx) => {
    const now = deps.now();
    const [m] = await tx
      .select()
      .from(s.outbox)
      .where(and(isNull(s.outbox.sentAt), lte(s.outbox.nextAttemptAt, now)))
      .orderBy(s.outbox.nextAttemptAt)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!m) return 'idle';
    const payload = m.payload as Record<string, unknown>;
    try {
      if (m.kind === 'lead.created') {
        const notice = await leadNotice(deps, tx, String(payload.leadId));
        if (notice) {
          // Missing SMTP is the first thing to fix, so it is reported before missing recipients.
          if (!email.configured) throw new EmailError('mail_not_configured');
          if (!notice.message.to.length) throw new EmailError('no_recipients');
          await email.send(notice.message);
          await tx.update(s.leads).set({ notifiedAt: now }).where(eq(s.leads.id, notice.lead.id));
          await tx.insert(s.leadEvents).values({ leadId: notice.lead.id, at: now, kind: 'notified', data: { recipients: notice.message.to.length } });
        }
      } else if (m.kind === 'leads.exported') {
        const notice = await exportNotice(tx, payload as { actorId: string; count: number });
        if (notice.to.length) await email.send(notice);
      }
      await tx.update(s.outbox).set({ sentAt: now, attempts: m.attempts + 1, lastError: null }).where(eq(s.outbox.id, m.id));
    } catch (e) {
      const code = e instanceof EmailError ? e.code : 'internal';
      const attempts = m.attempts + 1;
      const minutes = code === 'mail_not_configured' || code === 'no_recipients' ? 15 : BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)]!;
      await tx
        .update(s.outbox)
        .set({ attempts, lastError: code, nextAttemptAt: new Date(now.getTime() + minutes * 60_000) })
        .where(eq(s.outbox.id, m.id));
      if (m.kind === 'lead.created' && m.lastError !== code)
        await tx.insert(s.leadEvents).values({ leadId: String(payload.leadId), at: now, kind: 'notify_failed', data: { code } });
    }
    return 'done';
  });
}

/** Retry a lead's notice now («Отправить уведомление ещё раз»). */
export async function retryNotice(deps: Deps, actor: UserRow, id: string, client: ClientInfo) {
  const db = requireDb(deps);
  const res = await db
    .update(s.outbox)
    .set({ nextAttemptAt: deps.now() })
    .where(and(eq(s.outbox.kind, 'lead.created'), isNull(s.outbox.sentAt), sql`${s.outbox.payload}->>'leadId' = ${id}`))
    .returning({ id: s.outbox.id });
  if (!res.length) throw new Problem('invalid_transition', 'Уведомление уже отправлено или не требуется.');
  await recordAudit(deps, client, { action: 'lead.notify_retry', result: 'success', actorId: actor.id, resourceType: 'lead', resourceId: id });
  return getLead(deps, id);
}
