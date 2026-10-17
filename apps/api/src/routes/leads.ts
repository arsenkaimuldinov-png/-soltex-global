/**
 * Leads (Phase K-1, docs/admin-leads.md).
 *
 *   POST   /api/v1/public/leads                 a form of the site (no session; site origin;
 *                                               ≤ 20 KB; 5 per 10 min per IP)                   (public)
 *   GET    /api/v1/leads                        list: status, form, period, assignee, search     leads.read
 *   GET    /api/v1/leads/assignees              who a lead can be assigned to                    leads.read
 *   GET    /api/v1/leads/{id}                   one lead, decrypted, with its history (ETag)     leads.read
 *   PATCH  /api/v1/leads/{id}                   status / assignee (If-Match)                     leads.manage
 *   POST   /api/v1/leads/{id}/notes             add a note (encrypted)                           leads.manage
 *   POST   /api/v1/leads/{id}/delete|restore    bin (anonymized after 30 days) (If-Match)        leads.manage
 *   POST   /api/v1/leads/{id}/notify            retry the e-mail notice now                       leads.manage
 *   GET    /api/v1/leads/export                 CSV (formula-safe), audited, owners notified     leads.export + step-up
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CONTENT_LOCALES, LEAD_BODY_MAX_BYTES, LEAD_FORMS, LEAD_LIMITS, LEAD_STATUSES } from '@soltex/core/domain';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { etag, parseIfMatch } from '../content/cms/service.ts';
import { addNote, assignees, createLead, exportLeads, getLead, listLeads, retryNotice, setDeleted, updateLead } from '../leads/service.ts';
import { byIp } from './rate-limits.ts';
import { problems, Uuid } from './schemas.ts';

const Form = z.enum(LEAD_FORMS);
const Status = z.enum(LEAD_STATUSES);
const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the change is based on (the ETag of GET), e.g. "3"') });
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const LeadInput = z
  .object({
    formType: Form,
    fields: z
      .object({
        name: z.string().max(LEAD_LIMITS.name),
        phone: z.string().max(LEAD_LIMITS.phone).optional(),
        email: z.string().max(LEAD_LIMITS.email).optional(),
        company: z.string().max(LEAD_LIMITS.company).optional(),
        message: z.string().max(LEAD_LIMITS.message).optional(),
      })
      .strict(),
    topic: z.string().max(LEAD_LIMITS.topic).nullable(),
    locale: z.enum(CONTENT_LOCALES),
    pagePath: z.string().max(LEAD_LIMITS.pagePath).regex(/^\/[^\s]*$/),
    /** Honeypot: a hidden field; must stay empty. */
    hp: z.string().max(500).optional(),
    /** Milliseconds from showing the form to sending it. */
    fillMs: z.number().int().min(0).max(86_400_000).optional(),
  })
  .strict();

const User = z.object({ id: Uuid, name: z.string() });
const LeadItem = z
  .object({
    id: Uuid,
    reference: z.string(),
    formType: Form,
    locale: z.string(),
    pagePath: z.string().nullable(),
    topic: z.string().nullable(),
    name: z.string().nullable(),
    company: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    status: Status,
    assignee: User.nullable(),
    spamScore: z.number().int(),
    spamReasons: z.array(z.string()),
    consentBasis: z.enum(['notice_only', 'checkbox']),
    privacyNoticeVersion: z.string().nullable(),
    notification: z.enum(['sent', 'pending', 'failed', 'not_needed']),
    duplicates: z.number().int().describe('Other leads with the same e-mail or phone'),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
    anonymizedAt: z.string().nullable(),
  })
  .meta({ id: 'LeadItem' });
const LeadDetail = LeadItem.extend({
  message: z.string().nullable(),
  notificationError: z.string().nullable(),
  events: z.array(z.object({ id: Uuid, at: z.string(), actor: User.nullable(), kind: z.string(), data: z.record(z.string(), z.unknown()), note: z.string().nullable() })),
}).meta({ id: 'LeadDetail' });

const ListQuery = z.object({
  q: z.string().trim().max(200).optional().describe('Name, company or reference; an exact e-mail or phone (blind index)'),
  status: Status.optional(),
  form: Form.optional(),
  from: Day.optional(),
  to: Day.optional(),
  assignee: z.union([Uuid, z.literal('none')]).optional(),
  deleted: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true')
    .describe('The bin (deleted, not yet anonymized)'),
});

export async function leadRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['leads'];
  const read = { level: 'full', permission: 'leads.read' } as const;
  const manage = { level: 'full', permission: 'leads.manage' } as const;

  r.post(
    '/api/v1/public/leads',
    {
      bodyLimit: LEAD_BODY_MAX_BYTES,
      config: { access: { level: 'public' }, rateLimit: byIp(5, 10 * 60_000) },
      schema: {
        tags,
        summary: 'Send a form of the site',
        description:
          'Called by the public site (header `X-Requested-With: soltex-site`; Origin, when sent, must be the site). Validation errors name fields only. Spam is stored with status spam and answered like any lead.',
        body: LeadInput,
        response: { 201: z.object({ reference: z.string() }).meta({ id: 'LeadReceipt' }), ...problems(400, 403, 413, 429) },
      },
    },
    async (req, reply) => {
      const { reference, spam } = await createLead(deps, req.body, clientInfo(deps, req).ipHash);
      req.log.info({ lead_spam: spam }, 'lead received');
      return reply.code(201).send({ reference });
    }
  );

  r.get(
    '/api/v1/leads',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'List leads',
        querystring: ListQuery.extend({ limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0) }),
        response: { 200: z.object({ items: z.array(LeadItem), total: z.number().int(), byStatus: z.record(z.string(), z.number().int()) }), ...problems(400, 401, 403) },
      },
    },
    async (req) => listLeads(deps, req.query)
  );

  r.get(
    '/api/v1/leads/assignees',
    { config: { access: read }, schema: { tags, summary: 'People a lead can be assigned to', response: { 200: z.object({ items: z.array(User) }), ...problems(401, 403) } } },
    async () => ({ items: await assignees(deps) })
  );

  r.get(
    '/api/v1/leads/export',
    {
      config: { access: { level: 'full', permission: 'leads.export', stepUp: true } },
      schema: {
        tags,
        summary: 'Export leads as CSV',
        description: 'Same filters as the list (not the bin). Needs a fresh second factor. Recorded in the audit log; the Owners get an e-mail notice.',
        querystring: ListQuery.omit({ deleted: true }),
        response: { 200: z.string().describe('text/csv; charset=utf-8'), ...problems(400, 401, 403) },
      },
    },
    async (req, reply) => {
      const { csv } = await exportLeads(deps, authOf(req).user, req.query, clientInfo(deps, req));
      const day = deps.now().toISOString().slice(0, 10);
      return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="soltex-leads-${day}.csv"`).send(csv);
    }
  );

  r.get(
    '/api/v1/leads/:id',
    { config: { access: read }, schema: { tags, summary: 'One lead with its history', params: z.object({ id: Uuid }), response: { 200: LeadDetail, ...problems(401, 403, 404) } } },
    async (req, reply) => {
      const v = await getLead(deps, req.params.id);
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.patch(
    '/api/v1/leads/:id',
    {
      config: { access: manage },
      schema: {
        tags,
        summary: 'Change status or assignee',
        params: z.object({ id: Uuid }),
        headers: IfMatch,
        body: z.object({ status: Status.optional(), assigneeId: Uuid.nullable().optional() }).strict(),
        response: { 200: LeadDetail, ...problems(400, 401, 403, 404, 409, 428) },
      },
    },
    async (req, reply) => {
      const v = await updateLead(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), req.body, clientInfo(deps, req));
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.post(
    '/api/v1/leads/:id/notes',
    {
      config: { access: manage },
      schema: { tags, summary: 'Add a note', params: z.object({ id: Uuid }), body: z.object({ text: z.string().max(LEAD_LIMITS.note) }).strict(), response: { 200: LeadDetail, ...problems(400, 401, 403, 404, 409) } },
    },
    async (req) => addNote(deps, authOf(req).user, req.params.id, req.body.text, clientInfo(deps, req))
  );

  for (const action of ['delete', 'restore'] as const)
    r.post(
      `/api/v1/leads/:id/${action}`,
      {
        config: { access: manage },
        schema: {
          tags,
          summary: action === 'delete' ? 'Move to the bin (anonymized after 30 days)' : 'Restore from the bin',
          params: z.object({ id: Uuid }),
          headers: IfMatch,
          response: { 200: LeadDetail, ...problems(401, 403, 404, 409, 428) },
        },
      },
      async (req, reply) => {
        const v = await setDeleted(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), action === 'delete', clientInfo(deps, req));
        reply.header('etag', etag(v.version));
        return v;
      }
    );

  r.post(
    '/api/v1/leads/:id/notify',
    { config: { access: manage }, schema: { tags, summary: 'Retry the e-mail notice now', params: z.object({ id: Uuid }), response: { 200: LeadDetail, ...problems(401, 403, 404, 409) } } },
    async (req) => retryNotice(deps, authOf(req).user, req.params.id, clientInfo(deps, req))
  );
}
