import Fastify, { type FastifyInstance } from 'fastify';
import type { ApiConfig } from './config.ts';

/**
 * Builds the Fastify application. Phase A: only GET /api/v1/health.
 * Modules (auth, content, media, seo, leads, publishing, …) are registered here from Phase C on.
 */
export function buildApp(config: ApiConfig): FastifyInstance {
  const app = Fastify({
    logger: { level: config.logLevel },
    // Correlation ID (approved architecture §19): accept nginx's X-Request-ID, else generate one.
    requestIdHeader: 'x-request-id',
    disableRequestLogging: config.env === 'test',
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Public liveness probe: no details, never cached.
  app.get('/api/v1/health', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
    return { status: 'ok' };
  });

  return app;
}
