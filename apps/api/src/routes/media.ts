/**
 * Media library (Phase J-1, docs/admin-media.md).
 *
 *   GET    /api/v1/media                      library: search, kind, used / unused           media.read
 *   GET    /api/v1/media/{id}                 one file + where it is used (ETag)             media.read
 *   GET    /api/v1/media/{id}/preview?w=      WebP preview for the admin (480 / 1200 px)     media.read
 *   POST   /api/v1/media?name=                upload (raw body, streamed, ≤ 20 / 200 MB)     media.upload
 *   POST   /api/v1/media/{id}/replace?name=   new file, same id and references (If-Match)    media.replace
 *   DELETE /api/v1/media/{id}                 only when unused (If-Match)                    media.delete
 *
 * Uploads are the raw file as `application/octet-stream` (no multipart parser, no extra
 * dependency): the type is decided from the bytes, never from the name or the declared type.
 */
import fs from 'node:fs';
import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { clientInfo } from '../deps.ts';
import { authOf } from '../auth/guard.ts';
import { etag, parseIfMatch } from '../content/cms/service.ts';
import { deleteMedia, getMedia, listMedia, PREVIEW_WIDTHS, previewOf, replaceMedia, uploadMedia } from '../media/service.ts';
import { Problem } from '../http/problem.ts';
import { NoContent, problems, Uuid } from './schemas.ts';

/** The raw body stream of an upload, or 415 when the request was not sent as a file. */
function fileBody(body: unknown): Readable {
  if (!body || typeof (body as Readable).pipe !== 'function') throw new Problem('unsupported_media_type', 'Отправьте файл как application/octet-stream.');
  return body as Readable;
}

const Kind = z.enum(['image', 'video']);
const IfMatch = z.object({ 'if-match': z.string().optional().describe('Required. Version the change is based on (the ETag of GET), e.g. "3"') });

const MediaFile = z
  .object({
    id: Uuid,
    key: z.string(),
    kind: Kind,
    src: z.string().describe('Public path on the site'),
    source: z.enum(['legacy', 'upload']).describe('legacy = imported as is (URL unchanged); upload = media library'),
    fileName: z.string(),
    mime: z.string().nullable(),
    bytes: z.number().int().nullable(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    alt: z.string().nullable().describe('Default alternative text (source language)'),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    updatedBy: z.object({ id: Uuid, name: z.string() }).nullable(),
    usageCount: z.number().int(),
    warnings: z.array(z.enum(['large_file', 'hero_too_narrow'])),
  })
  .meta({ id: 'MediaFile' });

const Usage = z
  .object({
    type: z.string(),
    id: Uuid.nullable(),
    key: z.string(),
    title: z.string(),
    status: z.string().nullable(),
    field: z.string(),
  })
  .meta({ id: 'MediaUsage' });

const MediaDetail = MediaFile.extend({ usages: z.array(Usage), publicUrl: z.string() }).meta({ id: 'MediaDetail' });
const NameQuery = z.object({ name: z.string().trim().min(1).max(255).describe('File name as the user had it (kept for display only)') });

export async function mediaRoutes(app: FastifyInstance, deps: Deps) {
  // Raw uploads: the body stays a stream; size and type are enforced while it is read.
  app.addContentTypeParser('application/octet-stream', (_req, payload, done) => done(null, payload));
  const r = app.withTypeProvider<ZodTypeProvider>();
  const tags = ['media'];
  const read = { level: 'full', permission: 'media.read' } as const;

  r.get(
    '/api/v1/media',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'Media library',
        querystring: z.object({
          q: z.string().trim().max(100).optional().describe('Search in the file name, path and key'),
          kind: Kind.optional(),
          usage: z.enum(['used', 'unused']).optional(),
        }),
        response: { 200: z.object({ items: z.array(MediaFile), total: z.number().int() }), ...problems(400, 401, 403) },
      },
    },
    async (req) => listMedia(deps, req.query)
  );

  r.get(
    '/api/v1/media/:id',
    { config: { access: read }, schema: { tags, summary: 'One media file and where it is used', params: z.object({ id: Uuid }), response: { 200: MediaDetail, ...problems(401, 403, 404) } } },
    async (req, reply) => {
      const v = await getMedia(deps, req.params.id);
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.get(
    '/api/v1/media/:id/preview',
    {
      config: { access: read },
      schema: {
        tags,
        summary: 'Preview of an image for the admin (WebP)',
        params: z.object({ id: Uuid }),
        querystring: z.object({ w: z.coerce.number().int().pipe(z.union([z.literal(PREVIEW_WIDTHS[0]), z.literal(PREVIEW_WIDTHS[1])])).default(PREVIEW_WIDTHS[0]), v: z.coerce.number().int().optional().describe('Version (cache key)') }),
        response: { 200: z.string().describe('The image (image/webp, binary)'), ...problems(401, 403, 404) },
      },
    },
    async (req, reply) => {
      const file = await previewOf(deps, req.params.id, req.query.w);
      if (!file) throw new Problem('not_found', 'Для этого файла нет превью.');
      return reply.header('content-type', 'image/webp').header('cache-control', 'private, max-age=86400').send(fs.createReadStream(file) as never);
    }
  );

  r.post(
    '/api/v1/media',
    {
      config: { access: { level: 'full', permission: 'media.upload' } },
      schema: {
        tags,
        summary: 'Upload a file',
        description:
          'Body: the file itself (`Content-Type: application/octet-stream`). Allowed: JPEG, PNG, WebP, AVIF (≤ 20 MB) and MP4 (≤ 200 MB), recognised by content; SVG is refused. Images are re-encoded without metadata (EXIF/GPS). 409 media_duplicate when the same file exists (errors[0].message = its id).',
        querystring: NameQuery,
        response: { 201: MediaDetail, ...problems(400, 401, 403, 409, 413, 415, 422) },
      },
    },
    async (req, reply) => {
      const v = await uploadMedia(deps, authOf(req).user, fileBody(req.body), req.query.name, clientInfo(deps, req));
      reply.code(201).header('etag', etag(v.version));
      return v;
    }
  );

  r.post(
    '/api/v1/media/:id/replace',
    {
      config: { access: { level: 'full', permission: 'media.replace' } },
      schema: {
        tags,
        summary: 'Replace the file (same id, every reference keeps working)',
        description: 'The new file must be of the same kind. The previous file is kept (immutable storage); the site shows the new one from the next release.',
        params: z.object({ id: Uuid }),
        headers: IfMatch,
        querystring: NameQuery,
        response: { 200: MediaDetail, ...problems(400, 401, 403, 404, 409, 413, 415, 422, 428) },
      },
    },
    async (req, reply) => {
      const v = await replaceMedia(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), fileBody(req.body), req.query.name, clientInfo(deps, req));
      reply.header('etag', etag(v.version));
      return v;
    }
  );

  r.delete(
    '/api/v1/media/:id',
    {
      config: { access: { level: 'full', permission: 'media.delete' } },
      schema: { tags, summary: 'Delete an unused file', params: z.object({ id: Uuid }), headers: IfMatch, response: { 204: NoContent, ...problems(401, 403, 404, 409, 428) } },
    },
    async (req, reply) => {
      await deleteMedia(deps, authOf(req).user, req.params.id, parseIfMatch(req.headers['if-match']), clientInfo(deps, req));
      return reply.code(204).send(null);
    }
  );
}
