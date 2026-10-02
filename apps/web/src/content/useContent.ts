/**
 * React access to content. Components read content ONLY through these hooks; they never
 * import seed files, snapshots or a backend client.
 */
import { useI18n } from '../i18n/I18nProvider';
import type { ContentApi, PageAccessor } from './getters';
import type { PageKey } from './types';

/** Content of the current language. */
export function useContent(): ContentApi {
  return useI18n().content;
}

/** One page (or template) of the current language: header, text slots, lists, images. */
export function usePage(key: PageKey): PageAccessor {
  return useI18n().content.page(key);
}
