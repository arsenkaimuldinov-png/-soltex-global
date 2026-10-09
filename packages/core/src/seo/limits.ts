/**
 * SEO text guidance (review §J). These are recommendations shown in the editor (WARNING level);
 * the blocking SEO checker arrives in Phase I. Empty SEO texts mean "frontend default template".
 */
export const SEO_TITLE_RECOMMENDED_MAX = 60;
export const SEO_DESCRIPTION_RECOMMENDED_MIN = 70;
export const SEO_DESCRIPTION_RECOMMENDED_MAX = 160;

export type SeoLengthNote = 'title_too_long' | 'description_too_short' | 'description_too_long';

export function seoTitleNote(title: string | null): SeoLengthNote | null {
  return title && title.length > SEO_TITLE_RECOMMENDED_MAX ? 'title_too_long' : null;
}

export function seoDescriptionNote(description: string | null): SeoLengthNote | null {
  if (!description) return null;
  if (description.length < SEO_DESCRIPTION_RECOMMENDED_MIN) return 'description_too_short';
  if (description.length > SEO_DESCRIPTION_RECOMMENDED_MAX) return 'description_too_long';
  return null;
}
