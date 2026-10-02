/**
 * Inquiry topics are stored as language-independent descriptors (stable UI keys, page-copy
 * keys and entity IDs) and resolved to text at render time in the CURRENT language. Switching
 * language therefore re-translates an already selected topic instead of leaving it in the
 * language it was picked in.
 */
import type { UiKey } from '../../i18n/bundles';
import type { ContentApi } from '../../content/getters';
import type { PageKey } from '../../content/types';

/** Reference to a text field of a content record, by stable ID. */
export interface TopicRef {
  entity: 'project' | 'technology' | 'product' | 'epcmStage' | 'patent' | 'office' | 'keyDirection';
  id: string;
  field: string;
}

/** A placeholder value: structural text/number, or a content field resolved per language. */
export type TopicParam = string | number | TopicRef;

export type InquiryTopic =
  | { ui: UiKey; params?: Record<string, TopicParam> }
  | { page: PageKey; copy: string; params?: Record<string, TopicParam> }
  | { ref: TopicRef };

export const topicUi = (ui: UiKey, params?: Record<string, TopicParam>): InquiryTopic => ({ ui, params });
export const topicCopy = (page: PageKey, copy: string, params?: Record<string, TopicParam>): InquiryTopic => ({ page, copy, params });
export const topicRef = (entity: TopicRef['entity'], id: string, field = 'title'): TopicRef => ({ entity, id, field });

function findRecord(ref: TopicRef, content: ContentApi): object | undefined {
  switch (ref.entity) {
    case 'project':
      return content.projectById(ref.id);
    case 'technology':
      return content.technologyById(ref.id);
    case 'product':
      return content.productById(ref.id);
    case 'epcmStage':
      return content.epcmStages.find((s) => s.id === ref.id);
    case 'patent':
      return content.snapshot.patents.find((p) => p.id === ref.id);
    case 'office':
      return content.settings.offices.find((o) => o.id === ref.id);
    case 'keyDirection':
      return content.page('home').list<{ id: string }>('keyDirections').find((d) => d.id === ref.id);
  }
}

function resolveRef(ref: TopicRef, content: ContentApi): string {
  const value = (findRecord(ref, content) as Record<string, unknown> | undefined)?.[ref.field];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** Resolve a topic to text in the language of `t` / `content`. */
export function resolveInquiryTopic(
  topic: InquiryTopic,
  t: (key: UiKey, params?: Record<string, string | number>) => string,
  content: ContentApi
): string {
  if ('ref' in topic) return resolveRef(topic.ref, content);
  const params = Object.fromEntries(
    Object.entries(topic.params ?? {}).map(([k, v]) => [k, typeof v === 'object' ? resolveRef(v, content) : v])
  );
  return 'ui' in topic ? t(topic.ui, params) : content.page(topic.page).c(topic.copy, params);
}
