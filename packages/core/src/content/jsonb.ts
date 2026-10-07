/**
 * Zod schemas of every JSONB column of the content database (approved architecture §17.4).
 *
 * JSONB is used only where the shape is deliberately a list or a code-defined slot map.
 * Each table that has JSONB columns also has `schema_version` (= JSONB_SCHEMA_VERSION when
 * written). Changing a shape means: a new schema version here, an upcaster for old rows and a
 * migration that rewrites the rows in the same release.
 *
 * All values here are ONE language (a translation row) unless stated otherwise.
 */
import { z } from 'zod';

export const JSONB_SCHEMA_VERSION = 1;

/** Ordered list of texts, e.g. project scope, technology advantages, stage deliverables. */
export const TextListV1 = z.array(z.string());

/** Ordered label/value pairs, e.g. project specs, page header meta. */
export const LabelValueListV1 = z.array(z.object({ label: z.string(), value: z.string() }).strict());

/** Ordered title/description pairs, e.g. technology process principles, patent key pillars. */
export const TitleDescriptionListV1 = z.array(z.object({ title: z.string(), description: z.string() }).strict());

/** Patent block of a technology page. */
export const PatentInfoV1 = z
  .object({ patentNumber: z.string(), location: z.string(), keyPoints: TextListV1 })
  .strict();

/**
 * Fixed, code-defined text slots of a page, in slot order: [{ slot, text }].
 * (An array, not an object: jsonb does not preserve object key order.)
 */
export const PageCopyV1 = z.array(z.object({ slot: z.string(), text: z.string() }).strict());

/** Body paragraphs of a legal page. */
export const PageBodyV1 = z.array(z.string());

/**
 * Structure of a page list item (language-independent): any JSON in which translatable texts
 * are replaced by `{ "$t": "<path>" }` slots (see splitText in ./localized.ts).
 */
export const ListItemStructureV1 = z.record(z.string(), z.json());

/** Texts of a page list item for one language: slot path → text. */
export const ListItemTextsV1 = z.record(z.string(), z.string());

export type TextList = z.infer<typeof TextListV1>;
export type LabelValueList = z.infer<typeof LabelValueListV1>;
export type TitleDescriptionList = z.infer<typeof TitleDescriptionListV1>;
export type PatentInfo = z.infer<typeof PatentInfoV1>;
export type PageCopy = z.infer<typeof PageCopyV1>;
