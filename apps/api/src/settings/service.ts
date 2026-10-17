/**
 * Site settings (Phase N-0, docs/admin-settings.md): contacts, headquarters, footer texts, default
 * SEO texts, the homepage metrics and the regional offices — edited in all six languages at once.
 *
 * Scope is deliberately small: the existing records are edited, never created, deleted or
 * reordered (the site layout is built for them); logos and the footer image are brand assets and
 * stay with the developer. Settings have no draft state: a saved change goes live with the next
 * publication. Because every language is edited on the same screen, the editor is responsible for
 * all of them — approved translations stay approved and their source hash is renewed on save.
 *
 * One version (settings.version, If-Match) guards the whole form; every save is audited with the
 * names of the changed fields (never the values).
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { CONTENT_LOCALES, type Locale } from '@soltex/core/domain';
import { z } from 'zod';
import type { Queryable } from '../db/client.ts';
import * as s from '../db/schema.ts';
import type { ClientInfo, Deps } from '../deps.ts';
import { requireDb } from '../deps.ts';
import { recordAudit } from '../audit/audit.ts';
import { Problem, type FieldError } from '../http/problem.ts';
import type { UserRow } from '../auth/sessions.ts';
import { exportStore } from '../content/export.ts';
import { legacySourceHash } from '../content/legacy-source-hash.ts';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const req = (max: number) => z.string().trim().min(1).max(max);
/** Optional text: "" is stored as null (normalized in updateSettings; no transform, so the
 *  same schema also describes the response). */
const opt = (max: number) => z.string().trim().max(max).nullable();
const email = z.string().trim().email().max(254);

export const SETTINGS_TEXT_FIELDS = [
  'footerTagline',
  'footerLocation',
  'copyright',
  'hqName',
  'hqAddressLine1',
  'hqAddressLine2',
  'hqShortAddress',
  'hqJurisdiction',
  'hqHours',
  'defaultSiteTitle',
  'defaultSiteDescription',
] as const;

const SettingsTexts = z
  .object({
    footerTagline: req(400),
    footerLocation: req(200),
    copyright: req(200),
    hqName: req(200),
    hqAddressLine1: req(200),
    hqAddressLine2: req(200),
    hqShortAddress: req(200),
    hqJurisdiction: req(200),
    hqHours: req(200),
    defaultSiteTitle: req(200),
    defaultSiteDescription: req(400),
  })
  .strict();

const MetricTexts = z.object({ label: req(200), highlight: opt(100) }).strict();
const OfficeTexts = z.object({ region: req(200), title: req(200), country: req(200), address: opt(400), representative: opt(200) }).strict();

/** One value per content language (all six required). */
const byLocale = <T extends z.ZodType>(t: T) => z.record(z.enum(CONTENT_LOCALES), t);

export const SettingsInput = z
  .object({
    primaryEmail: email,
    hqEmail: email,
    texts: byLocale(SettingsTexts),
    metrics: z.array(z.object({ id: z.string().uuid(), value: opt(20), texts: byLocale(MetricTexts) }).strict()).max(20),
    offices: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            phone: opt(40),
            email,
            whatsapp: opt(40),
            texts: byLocale(OfficeTexts),
          })
          .strict()
      )
      .max(20),
  })
  .strict();
export type SettingsInput = z.infer<typeof SettingsInput>;

export interface SettingsView extends SettingsInput {
  version: number;
  siteName: string;
  metrics: Array<SettingsInput['metrics'][number] & { key: string; position: number }>;
  offices: Array<SettingsInput['offices'][number] & { key: string; position: number }>;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function group<R extends { locale: string }, T>(rows: R[], owner: (r: R) => string, pick: (r: R) => T): Map<string, Record<Locale, T>> {
  const map = new Map<string, Record<Locale, T>>();
  for (const r of rows) {
    const g = map.get(owner(r)) ?? ({} as Record<Locale, T>);
    g[r.locale as Locale] = pick(r);
    map.set(owner(r), g);
  }
  return map;
}

async function read(db: Queryable): Promise<SettingsView> {
  const [st] = await db.select().from(s.settings);
  if (!st) throw new Problem('not_found', 'Настройки сайта ещё не импортированы');
  const texts = group(
    await db.select().from(s.settingsTranslations).where(eq(s.settingsTranslations.settingsId, st.id)),
    (r) => r.settingsId,
    (r) => Object.fromEntries(SETTINGS_TEXT_FIELDS.map((f) => [f, r[f]])) as z.infer<typeof SettingsTexts>
  ).get(st.id)!;
  const metricRows = await db.select().from(s.metrics).orderBy(asc(s.metrics.position));
  const metricTr = group(await db.select().from(s.metricTranslations), (r) => r.metricId, (r) => ({ label: r.label, highlight: r.highlight }));
  const officeRows = await db.select().from(s.offices).orderBy(asc(s.offices.position), asc(s.offices.key));
  const officeTr = group(await db.select().from(s.officeTranslations), (r) => r.officeId, (r) => ({ region: r.region, title: r.title, country: r.country, address: r.address, representative: r.representative }));
  const [by] = st.updatedBy ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.id, st.updatedBy)) : [];
  return {
    version: st.version,
    siteName: st.siteName,
    primaryEmail: st.primaryEmail,
    hqEmail: st.hqEmail,
    texts,
    metrics: metricRows.map((m) => ({ id: m.id, key: m.key, position: m.position, value: m.value, texts: metricTr.get(m.id)! })),
    offices: officeRows.map((o) => ({ id: o.id, key: o.key, position: o.position, phone: o.phone, email: o.email, whatsapp: o.whatsapp, texts: officeTr.get(o.id)! })),
    updatedAt: st.updatedAt.toISOString(),
    updatedBy: by ?? null,
  };
}

export async function getSettings(deps: Deps): Promise<SettingsView> {
  return read(requireDb(deps));
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** "" → null in every optional field (texts keep their required values). */
function normalize(input: SettingsInput): SettingsInput {
  const n = (v: string | null) => (v ? v : null);
  const loc = <T>(texts: Record<Locale, T>, f: (t: T) => T) => Object.fromEntries(CONTENT_LOCALES.map((l) => [l, f(texts[l])])) as Record<Locale, T>;
  return {
    ...input,
    metrics: input.metrics.map((m) => ({ ...m, value: n(m.value), texts: loc(m.texts, (t) => ({ ...t, highlight: n(t.highlight) })) })),
    offices: input.offices.map((o) => ({ ...o, phone: n(o.phone), whatsapp: n(o.whatsapp), texts: loc(o.texts, (t) => ({ ...t, address: n(t.address), representative: n(t.representative) })) })),
  };
}

export async function updateSettings(deps: Deps, actor: UserRow, expectedVersion: number, raw: SettingsInput, client: ClientInfo): Promise<SettingsView> {
  const db = requireDb(deps);
  const input = normalize(raw);
  const now = deps.now();
  await db.transaction(async (tx) => {
    const [st] = await tx.select().from(s.settings).for('update');
    if (!st) throw new Problem('not_found');
    if (st.version !== expectedVersion) throw new Problem('edit_conflict');
    const current = await read(tx);

    // The same records, no more and no fewer (nothing is created or deleted here).
    const errors: FieldError[] = [];
    const sameSet = (a: { id: string }[], b: { id: string }[]) => a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));
    if (!sameSet(input.metrics, current.metrics)) errors.push({ field: 'metrics', message: 'records_mismatch' });
    if (!sameSet(input.offices, current.offices)) errors.push({ field: 'offices', message: 'records_mismatch' });
    if (errors.length) throw new Problem('validation_failed', undefined, { errors });

    const changed: string[] = [];
    if (input.primaryEmail !== current.primaryEmail || input.hqEmail !== current.hqEmail) {
      changed.push('contacts');
    }
    for (const l of CONTENT_LOCALES)
      if (!same(input.texts[l], current.texts[l])) {
        changed.push(`texts.${l}`);
        await tx
          .update(s.settingsTranslations)
          .set({ ...input.texts[l], updatedAt: now, updatedBy: actor.id })
          .where(and(eq(s.settingsTranslations.settingsId, st.id), eq(s.settingsTranslations.locale, l)));
      }

    for (const m of input.metrics) {
      const was = current.metrics.find((x) => x.id === m.id)!;
      if (m.value === was.value && same(m.texts, was.texts)) continue;
      changed.push(`metric.${was.key}`);
      await tx.update(s.metrics).set({ value: m.value, version: sql`${s.metrics.version} + 1`, updatedAt: now, updatedBy: actor.id }).where(eq(s.metrics.id, m.id));
      for (const l of CONTENT_LOCALES)
        if (!same(m.texts[l], was.texts[l]))
          await tx
            .update(s.metricTranslations)
            .set({ ...m.texts[l], updatedAt: now, updatedBy: actor.id })
            .where(and(eq(s.metricTranslations.metricId, m.id), eq(s.metricTranslations.locale, l)));
    }

    for (const o of input.offices) {
      const was = current.offices.find((x) => x.id === o.id)!;
      if (o.phone === was.phone && o.email === was.email && o.whatsapp === was.whatsapp && same(o.texts, was.texts)) continue;
      changed.push(`office.${was.key}`);
      await tx
        .update(s.offices)
        .set({ phone: o.phone, email: o.email, whatsapp: o.whatsapp, version: sql`${s.offices.version} + 1`, updatedAt: now, updatedBy: actor.id })
        .where(eq(s.offices.id, o.id));
      for (const l of CONTENT_LOCALES)
        if (!same(o.texts[l], was.texts[l]))
          await tx
            .update(s.officeTranslations)
            .set({ ...o.texts[l], updatedAt: now, updatedBy: actor.id })
            .where(and(eq(s.officeTranslations.officeId, o.id), eq(s.officeTranslations.locale, l)));
    }

    if (!changed.length) return;
    await tx
      .update(s.settings)
      .set({ primaryEmail: input.primaryEmail, hqEmail: input.hqEmail, version: st.version + 1, updatedAt: now, updatedBy: actor.id })
      .where(eq(s.settings.id, st.id));

    // Every language was in front of the editor: approved translations stay current.
    const hash = legacySourceHash((await exportStore(tx)).settings);
    await tx
      .update(s.settingsTranslations)
      .set({ approvedSourceHash: hash })
      .where(and(eq(s.settingsTranslations.settingsId, st.id), eq(s.settingsTranslations.trStatus, 'approved')));

    await recordAudit(deps, client, { action: 'settings.update', result: 'success', actorId: actor.id, resourceType: 'settings', resourceId: st.id, summary: { fields: changed.slice(0, 40) } }, tx);
  });
  return getSettings(deps);
}
