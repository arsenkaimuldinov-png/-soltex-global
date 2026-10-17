/**
 * Site settings (Phase N-0, docs/admin-settings.md).
 *
 *   GET  /api/v1/settings   contacts, headquarters, footer, default SEO texts, metrics, offices   settings.manage
 *   PUT  /api/v1/settings   save the whole form (If-Match = settings version; step-up)            settings.manage
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { etag, parseIfMatch } from '../content/cms/service.ts';
import { getSettings, SettingsInput, updateSettings } from '../settings/service.ts';
import { problems, Uuid } from './schemas.ts';

const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the change is based on (the ETag of GET), e.g. "3"') });

const Input = SettingsInput;
const View = z
  .object({
    version: z.number().int(),
    siteName: z.string().describe('Read-only: the brand name'),
    primaryEmail: z.string(),
    hqEmail: z.string(),
    texts: SettingsInput.shape.texts,
    metrics: z.array(SettingsInput.shape.metrics.element.extend({ key: z.string(), position: z.number().int() })),
    offices: z.array(SettingsInput.shape.offices.element.extend({ key: z.string(), position: z.number().int() })),
    updatedAt: z.string(),
    updatedBy: z.object({ id: Uuid, name: z.string() }).nullable(),
  })
  .meta({ id: 'Settings' });

export async function settingsRoutes(app: FastifyInstance, deps: Deps) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['settings'];
  r.get(
    '/api/v1/settings',
    { config: { access: { level: 'full', permission: 'settings.manage' } }, schema: { tags, summary: 'Read the site settings', response: { 200: View, ...problems(401, 403, 404) } } },
    async (_req, reply) => {
      const v = await getSettings(deps);
      reply.header('etag', etag(v.version));
      return v;
    }
  );
  r.put(
    '/api/v1/settings',
    {
      config: { access: { level: 'full', permission: 'settings.manage', stepUp: true } },
      schema: {
        tags,
        summary: 'Save the site settings',
        description:
          'All six languages at once. Metrics and offices: the same records as GET (they are edited, not created or deleted). The change reaches the site with the next publication.',
        headers: IfMatch,
        body: Input,
        response: { 200: View, ...problems(400, 401, 403, 404, 409, 428) },
      },
    },
    async (req, reply) => {
      const v = await updateSettings(deps, authOf(req).user, parseIfMatch(req.headers['if-match']), req.body as SettingsInput, clientInfo(deps, req));
      reply.header('etag', etag(v.version));
      return v;
    }
  );
}
