/**
 * UTM attribution (Phase K-2, approved §13.3). Shipped only when ATTRIBUTION_ENABLED.
 *
 * - Allowlist: utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid; the
 *   landing path (no query); the referrer ORIGIN only. Every value ≤ 200 characters.
 * - First touch: localStorage, set once, kept 90 days, never overwritten before it expires; a visit
 *   without campaign parameters or external referrer is recorded as `direct` only then.
 * - Last touch: sessionStorage, overwritten only by campaign parameters or an external referrer
 *   (last non-direct click). Direct visits and internal navigation never overwrite it.
 * - No cookies. Both are cleared after a lead is sent.
 * Storage may be unavailable (private mode, blocked): every access is guarded, and the form works
 * without attribution.
 */
import {
  LEAD_ATTRIBUTION_MAX as MAX,
  LEAD_ATTRIBUTION_PARAMS as ATTRIBUTION_PARAMS,
  LEAD_FIRST_TOUCH_DAYS as FIRST_TOUCH_DAYS,
  type LeadAttribution as Attribution,
  type LeadAttributionParam as AttributionParam,
  type LeadTouch as Touch,
} from '@soltex/core/domain';

export type { Attribution, Touch };
export const FIRST_TOUCH_KEY = 'soltex.attribution.first';
export const LAST_TOUCH_KEY = 'soltex.attribution.last';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface AttributionStores {
  local: StorageLike | null;
  session: StorageLike | null;
}

const clip = (s: string) => s.trim().slice(0, MAX);

/** The touch this page view carries, or null for a direct visit / internal navigation. */
export function touchOf(href: string, referrer: string, now: Date): Touch | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params: Partial<Record<AttributionParam, string>> = {};
  for (const k of ATTRIBUTION_PARAMS) {
    const v = clip(url.searchParams.get(k) ?? '');
    if (v) params[k] = v;
  }
  let ref = '';
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && /^https?:$/.test(r.protocol) && r.origin !== url.origin) ref = clip(r.origin);
  } catch {
    ref = '';
  }
  if (!Object.keys(params).length && !ref) return null;
  return { at: now.toISOString(), landing: clip(url.pathname), ...(ref ? { referrer: ref } : {}), ...params };
}

function read(store: StorageLike | null, key: string): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(store: StorageLike | null, key: string, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: attribution is optional */
  }
}

const isTouch = (v: unknown): v is Touch => typeof v === 'object' && v !== null && typeof (v as Touch).at === 'string' && typeof (v as Touch).landing === 'string';

function storedFirst(stores: AttributionStores, now: Date): Touch | null {
  const v = read(stores.local, FIRST_TOUCH_KEY) as { touch?: unknown; expires?: unknown } | null;
  if (!v || !isTouch(v.touch) || typeof v.expires !== 'string' || Date.parse(v.expires) <= now.getTime()) return null;
  return v.touch;
}

/** Record this page view (call once per page load). */
export function recordVisit(stores: AttributionStores, href: string, referrer: string, now = new Date()): void {
  const touch = touchOf(href, referrer, now);
  if (!storedFirst(stores, now)) {
    let landing = '/';
    try {
      landing = clip(new URL(href).pathname);
    } catch {
      /* keep "/" */
    }
    const first: Touch = touch ?? { at: now.toISOString(), landing, direct: true };
    write(stores.local, FIRST_TOUCH_KEY, { touch: first, expires: new Date(now.getTime() + FIRST_TOUCH_DAYS * 86_400_000).toISOString() });
  }
  if (touch) write(stores.session, LAST_TOUCH_KEY, touch);
}

/** What is sent with a lead; null when nothing is stored. */
export function currentAttribution(stores: AttributionStores, now = new Date()): Attribution | null {
  const first = storedFirst(stores, now);
  const lastRaw = read(stores.session, LAST_TOUCH_KEY);
  const last = isTouch(lastRaw) ? lastRaw : null;
  if (!first && !last) return null;
  return { ...(first ? { first } : {}), ...(last ? { last } : {}) };
}

export function clearAttribution(stores: AttributionStores): void {
  for (const [store, key] of [
    [stores.local, FIRST_TOUCH_KEY],
    [stores.session, LAST_TOUCH_KEY],
  ] as const) {
    try {
      store?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** The browser's storages, or null where access throws. */
export function browserStores(): AttributionStores {
  const get = (name: 'localStorage' | 'sessionStorage'): StorageLike | null => {
    try {
      return window[name];
    } catch {
      return null;
    }
  };
  return { local: get('localStorage'), session: get('sessionStorage') };
}
