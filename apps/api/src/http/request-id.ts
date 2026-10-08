/**
 * Correlation ID (approved §19). A client- or nginx-supplied X-Request-ID is accepted only if
 * it is a UUID (no free text, so no PII or log injection); otherwise a UUIDv7 is generated.
 * The id is returned in every response, written to every log line and to every audit event.
 */
import type { IncomingMessage } from 'node:http';
import { v7 as uuidv7 } from 'uuid';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function genRequestId(req: IncomingMessage): string {
  const h = req.headers['x-request-id'];
  return typeof h === 'string' && UUID.test(h) ? h.toLowerCase() : uuidv7();
}
