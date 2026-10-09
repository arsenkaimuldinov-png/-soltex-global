/** Content editors without a browser: form ↔ API, patches, validation, permissions, page forms, labels. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionsOf, type Role } from '@soltex/core/domain';
import { PAGE_REGISTRY } from '@soltex/core/content';
import { buildPatch, move, toApiValue, toForm, validateAll, validateField } from '../src/features/content/form.ts';
import { COLLECTION_UI, COLLECTIONS, fieldPermission, FIELD_ERROR_LABELS } from '../src/features/content/model.ts';
import { buildPagePatch, toPageForm, validatePage } from '../src/features/content/page-form.ts';
import { PAGE_NAMES, slotLabel } from '../src/features/content/page-labels.ts';
import { ApiError } from '../src/lib/api/client.ts';
import { apiFieldErrors as apiFieldErrorsOf } from '../src/features/content/field-errors.ts';

const project = COLLECTION_UI.projects;
const record = {
  title: 'SOLBAR NINGBO',
  category: 'DEEP SOY PROCESSING',
  categoryNumber: '01',
  country: 'China',
  years: '2006–2008',
  capacity: null,
  type: 'Turnkey',
  position: 2,
  overview: 'Overview',
  scope: ['A', 'B', 'C'],
  technology: 'Soy',
  results: null,
  specs: [{ label: 'Location', value: 'Ningbo' }],
  image: 'img-1',
  imagePosition: 'center top',
  gallery: ['img-1'],
  relatedTechnology: 'tech-1',
  slug: 'solbar-ningbo',
  seoMetaTitle: null,
  seoMetaDescription: null,
  ogImage: null,
  noindex: false,
};

test('every collection editor shows exactly the fields of the API model, each once, in a known section', () => {
  const api: Record<string, string[]> = {
    projects: ['slug', 'categoryNumber', 'image', 'imagePosition', 'gallery', 'relatedTechnology', 'ogImage', 'noindex', 'title', 'category', 'country', 'years', 'capacity', 'type', 'overview', 'scope', 'technology', 'results', 'specs', 'seoMetaTitle', 'seoMetaDescription', 'position'],
    technologies: ['slug', 'categoryNumber', 'image', 'relatedProjects', 'ogImage', 'noindex', 'title', 'categoryTitle', 'subtitle', 'overview', 'patentInfo', 'rawMaterials', 'processPrinciples', 'keyAdvantages', 'applications', 'productsProduced', 'seoMetaTitle', 'seoMetaDescription', 'position'],
    products: ['slug', 'categoryNumber', 'image', 'relatedTechnology', 'relatedProject', 'ogImage', 'noindex', 'title', 'categoryTitle', 'description', 'rawMaterials', 'productionTechnology', 'applications', 'characteristics', 'seoMetaTitle', 'seoMetaDescription', 'position'],
    'epcm-stages': ['number', 'image', 'title', 'focus', 'description', 'deliverables', 'position'],
    patents: ['placements', 'patentNo', 'legalStatus', 'registryNumber', 'image', 'title', 'statusLabel', 'patentLabel', 'jurisdiction', 'abstract', 'claimsSummary', 'code', 'location', 'overview', 'keyPillars', 'industrialImplementation', 'imageCaption', 'position'],
    videos: ['number', 'video', 'poster', 'title', 'category', 'headline', 'description', 'position'],
  };
  for (const c of COLLECTIONS) {
    const names = COLLECTION_UI[c].fields.map((f) => f.name);
    assert.equal(new Set(names).size, names.length, `${c}: duplicates`);
    assert.deepEqual([...names].sort(), [...api[c]!].sort(), c);
    for (const n of COLLECTION_UI[c].createFields) assert.ok(names.includes(n), `${c}.${n}`);
  }
});

test('form ↔ API: lists remember their origin, empty optional texts become null, untouched fields are not sent', () => {
  const form = toForm(project.fields, record);
  assert.deepEqual(form.scope, [
    { value: 'A', from: 0 },
    { value: 'B', from: 1 },
    { value: 'C', from: 2 },
  ]);
  assert.equal(form.capacity, '');
  assert.equal(form.results, null);
  assert.deepEqual(buildPatch(project.fields, form, form), {}, 'nothing changed');
  const edited = { ...form, title: ' SOLBAR NINGBO II ', capacity: '  ', scope: move(form.scope as never[], 2, -1), results: [{ value: 'New', from: null }], position: '5' };
  assert.deepEqual(buildPatch(project.fields, form, edited), {
    title: 'SOLBAR NINGBO II',
    capacity: null,
    scope: [
      { value: 'A', from: 0 },
      { value: 'C', from: 2 },
      { value: 'B', from: 1 },
    ],
    results: [{ value: 'New', from: null }],
    position: 5,
  });
  assert.equal(toApiValue('mediaNull', ''), null);
  assert.equal(toApiValue('enumNull', 'granted'), 'granted');
  assert.deepEqual(move([1, 2], 0, -1), [1, 2], 'cannot move past the start');
});

test('validation: required, limits, slugs, list items, references', () => {
  const by = (name: string) => project.fields.find((f) => f.name === name)!;
  assert.equal(validateField(by('title'), '  '), 'Заполните поле.');
  assert.equal(validateField(by('title'), 'x'.repeat(301)), 'Не больше 300 символов.');
  assert.equal(validateField(by('capacity'), ''), null, 'optional');
  assert.match(validateField(by('slug'), 'Solbar Ningbo')!, /латинские/);
  assert.equal(validateField(by('slug'), 'solbar-ningbo'), null);
  assert.match(validateField(by('scope'), [{ value: ' ', from: null }])!, /пустые/);
  assert.match(validateField(by('specs'), [{ label: 'A', value: '', from: 0 }])!, /пустые/);
  assert.equal(validateField(by('relatedTechnology'), ''), 'Выберите значение.');
  assert.equal(validateField(by('position'), 'x'), 'Целое число от 0.');
  assert.deepEqual(Object.keys(validateAll(project.fields, { ...toForm(project.fields, record), title: '' })), ['title']);
  const patents = COLLECTION_UI.patents.fields;
  assert.equal(validateField(patents.find((f) => f.name === 'placements')!, []), 'Выберите хотя бы одно место.');
});

test('field permissions follow the core SEO field list: the same rule as the API', () => {
  const editable = (role: Role, name: string) => (permissionsOf(role) as readonly string[]).includes(fieldPermission(name));
  for (const f of ['slug', 'seoMetaTitle', 'seoMetaDescription', 'ogImage', 'noindex']) {
    assert.equal(fieldPermission(f), 'seo.edit', f);
    assert.ok(editable('seo_specialist', f) && !editable('editor', f), f);
  }
  for (const f of ['title', 'overview', 'scope', 'image', 'position']) {
    assert.equal(fieldPermission(f), 'content.edit', f);
    assert.ok(editable('editor', f) && !editable('seo_specialist', f) && !editable('marketer', f), f);
  }
  assert.ok(editable('content_manager', 'slug') && editable('content_manager', 'title'));
});

test('API field errors land on their fields with Russian texts', () => {
  const e = new ApiError(409, { code: 'slug_taken', title: 'T', errors: [{ field: 'slug', message: 'taken' }] }, 'r', null);
  assert.deepEqual(apiFieldErrorsOf(e), { slug: FIELD_ERROR_LABELS.taken });
  const z = new ApiError(400, { code: 'validation_failed', title: 'T', errors: [{ field: 'scope.0.value', message: 'Too small' }, { field: 'copy.heroTitle', message: 'placeholders' }] }, 'r', null);
  assert.deepEqual(apiFieldErrorsOf(z), { scope: 'Проверьте значение поля.', 'copy.heroTitle': FIELD_ERROR_LABELS.placeholders });
  const f = new ApiError(403, { code: 'forbidden', title: 'T', errors: [{ field: 'seoMetaTitle', message: 'not_allowed' }] }, 'r', null);
  assert.equal(apiFieldErrorsOf(f).seoMetaTitle, 'У вашей роли нет права менять это поле.');
});

const pageFields = {
  header: { badgeNumber: '01', badgeLabel: 'CORPORATE', title: 'Title', subtitle: 'Sub', description: null, meta: [{ label: 'A', value: 'B' }], actionLabel: null },
  copy: { ctaTitle: 'Inquire about {title}', ctaBadge: 'Badge' },
  lists: { timeline: [{ year: '1999', title: 'Start', description: 'Text' }] },
  media: { heroImage: 'img-1' },
  body: null,
  seoMetaTitle: null,
  seoMetaDescription: 'Desc',
  ogImage: null,
  noindex: false,
};

test('page form: only changed parts are sent, with the names used for permissions and the audit log', () => {
  const initial = toPageForm(pageFields);
  assert.deepEqual(buildPagePatch(initial, initial), { patch: {}, changed: [] });
  const current = structuredClone(initial);
  current.header!.title = ' New title ';
  current.header!.subtitle = '';
  current.copy.ctaBadge = 'New badge';
  current.lists.timeline![0]!.title = 'Founded';
  current.media.heroImage = 'img-2';
  current.seoMetaTitle = 'SEO';
  current.noindex = true;
  const { patch, changed } = buildPagePatch(initial, current);
  assert.deepEqual(changed, ['header.title', 'header.subtitle', 'copy.ctaBadge', 'lists.timeline', 'media.heroImage', 'seoMetaTitle', 'noindex']);
  assert.deepEqual(patch, {
    header: { title: 'New title', subtitle: null },
    copy: { ctaBadge: 'New badge' },
    lists: { timeline: [{ year: '1999', title: 'Founded', description: 'Text' }] },
    media: { heroImage: 'img-2' },
    seoMetaTitle: 'SEO',
    noindex: true,
  });
});

test('page validation: required texts and the placeholders the site fills in', () => {
  const def = PAGE_REGISTRY.projectDetail;
  const copy = Object.fromEntries(def.slots.map((s) => [s.key, s.placeholders.length ? s.placeholders.map((p) => `{${p}}`).join(' ') : 'Text']));
  const form = toPageForm({ ...pageFields, header: null, lists: {}, copy });
  assert.deepEqual(validatePage(def, form), {});
  const broken = { ...form, copy: { ...copy, ctaTitle: 'Inquire about a plant', ctaBadge: ' ' } };
  const errs = validatePage(def, broken);
  assert.match(errs['copy.ctaTitle']!, /\{title\}/);
  assert.equal(errs['copy.ctaBadge'], 'Заполните поле.');
});

test('page names and slot labels are Russian', () => {
  for (const key of Object.keys(PAGE_REGISTRY)) assert.ok(PAGE_NAMES[key as keyof typeof PAGE_NAMES], key);
  assert.equal(slotLabel('heroHeadlineLine1'), 'Первый экран · заголовок · строка 1');
  assert.equal(slotLabel('site2Region'), 'Площадка 2 · регион');
  assert.equal(slotLabel('ctaTitle'), 'Призыв к действию · заголовок');
  // Every slot word of every page has a Russian translation (no raw English words in labels).
  const words = new Set(Object.values(PAGE_REGISTRY).flatMap((d) => d.slots.flatMap((s) => slotLabel(s.key).split(/[ ·]+/))));
  const latin = [...words].filter((w) => /^[a-z]+$/.test(w));
  assert.deepEqual(latin, [], `untranslated: ${latin.join(', ')}`);
});
