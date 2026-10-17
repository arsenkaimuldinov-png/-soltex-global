# Media library (Phase J)

Status: **Phase J-1** implemented (2026-10-17): upload, library, usages, replace, delete, admin
previews. **Phase J-2** (next): responsive variants (`srcset`, AVIF/WebP at 480/960/1600/2400 px)
on the site, alt texts and the image checks of the SEO block. Implements review §I and approved
§4.3 / §12.2 (media outside releases, immutable files).

## 1. Model

| Column | Meaning |
|---|---|
| `src` | Public path on the site. Legacy: `/images/…`, `/videos/…` (unchanged). Upload: `/media/originals/<yyyy>/<uuid>.<ext>` |
| `source` | `legacy` (imported as is from the current site) or `upload` (media library) |
| `storage_path` | Upload only: `originals/<yyyy>/<uuid>.<ext>` under `MEDIA_DIR` |
| `original_name` | The file name the user had. Shown only; never used as a path |
| `mime`, `bytes`, `width`, `height` | From the processed file (legacy: size read from the site files) |
| `sha256` | Of the uploaded bytes, for duplicate detection |
| `version` | Raised by «Заменить» (optimistic lock) |

**Migration `0007`:**
- the columns above, plus the enum `media_source` and an index on `sha256`;
- a CHECK: an `upload` row must live at a UUID path under `originals/`, and its `src` must be `/media/` + that path. A path outside the layout is impossible at the database level.

The content export (`media.json`) is unchanged: `id`, `kind`, `src`, `width`, `height`, `alt`. The library metadata stays in the database. A DB → export → import round trip keeps it, because import upserts by key.

## 2. Storage

`MEDIA_DIR` (production: `/srv/soltex/media`; development: `<repo>/.media`), behind a `MediaStorage` interface (local disk now; S3-compatible later):

```
originals/<yyyy>/<uuid>.<ext>        uploaded files, read-only (0444)
previews/<id>-v<version>-<w>.webp    admin previews (cache, safe to delete)
tmp/                                 uploads in progress
```

- **Files are immutable** (approved §12.2):
  - an upload or a replacement is always a new UUID file;
  - nothing is overwritten;
  - «Удалить» removes the database row only.
  Unreferenced files are removed later by a garbage collection that respects the backup retention (Phase N), never by the admin.
- **Public serving:** nginx serves `/media/originals/` from `MEDIA_DIR/originals/` (`deploy/nginx/soltexglobal.conf`), cached for a year (`immutable`), with `nosniff`. Nothing else under `MEDIA_DIR` is public.
- **Releases:** files are **not copied** into releases (approved §4.3).
  - The build validator (`validate-site.ts`) checks a `/media/…` reference against `MEDIA_ROOT`, which the publishing worker sets to `MEDIA_DIR`.
  - A reference to a missing library file fails the build.
  - The preview server serves `/media/originals/` the same way.
- **Legacy files:** admin previews of `/images/…` read the files from `MEDIA_LEGACY_DIR`. The default is `RELEASES_DIR/current` (development: `apps/web/public`).

## 3. Upload pipeline

The body is the file itself (`application/octet-stream`, `POST /media?name=`). There is no multipart parser and no extra dependency.

1. **Streamed** to `tmp/` with a hard size limit:
   - the stream is cut at 200 MB before the type is known;
   - images are limited to 20 MB, MP4 to 200 MB (`MEDIA_MAX_BYTES`).
2. **Type from the first bytes** (`sniffMediaType`, allowlist): JPEG, PNG, WebP, AVIF, MP4.
   - SVG, HTML, PDF, GIF, executables and archives are refused (415 `media_type_rejected`), whatever the name says.
   - PDF waits for a document entity.
3. **Images through sharp:**
   - pixel limit of 100 MP (decompression bombs);
   - the EXIF orientation is applied;
   - **all metadata is dropped** (EXIF, GPS, camera);
   - re-encoded in the same format: JPEG q90 mozjpeg, PNG level 9, WebP q90, AVIF q70.
   - A file that does not decode → 422 `media_invalid`.
   - Videos are stored as uploaded (no ffprobe on the server; dimensions unknown).
4. **Duplicates:** sha256 of the uploaded bytes. The same file again → 409 `media_duplicate`, with the existing id (the admin offers «Открыть существующий»).
5. **Storage:**
   - the file is moved to `originals/<yyyy>/<uuid>.<ext>` and made read-only;
   - the row is inserted with key `media-<name>-<random>`;
   - audit `media.upload` (kind, size).

Refused uploads leave nothing behind in `tmp/`. This is tested.

## 4. Usages, replace, delete

- **Usages** are computed from one export of the working copy (every status), by walking every `{ mediaId }` reference:
  - fields, galleries, OG images, page slots, list items, global settings;
  - each usage gives the section, the record with a link to its editor, and the field («основное изображение», «первый экран», …).
- **Warnings:**
  - «Больше 2 МБ» (images);
  - «Уже 1600 px для первого экрана» (an image used in a `hero…` slot).
- **«Заменить файл»** (`POST /media/{id}/replace`, If-Match):
  - the new file must be of the same kind and differ from the current one;
  - the id and every reference stay; `src` moves to the new file and the version rises;
  - the previous file is kept;
  - the site shows the new file from the next release;
  - audit `media.replace`.
- **«Удалить»** (If-Match):
  - only when the file is not used: 409 `media_in_use` names the first records;
  - the foreign keys (RESTRICT) are the backstop;
  - audit `media.delete`.

## 5. API (API 0.10.0)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/media?q&kind&usage` | media.read |
| GET | `/api/v1/media/{id}` (ETag; usages, public URL) | media.read |
| GET | `/api/v1/media/{id}/preview?w=480\|1200&v=` (WebP, `private, max-age=86400`) | media.read |
| POST | `/api/v1/media?name=` | media.upload |
| POST | `/api/v1/media/{id}/replace?name=` | media.replace |
| DELETE | `/api/v1/media/{id}` | media.delete |

- **Picker:** `GET /content/media` now also returns `fileName` and `version`.
- **Permissions** (approved §8.2):

  | Role | Read | Upload | Replace | Delete |
  |---|---|---|---|---|
  | Owner, Admin | ✓ | ✓ | ✓ | ✓ |
  | Content manager | ✓ | ✓ | ✓ | — |
  | Editor | ✓ | ✓ | — | — |
  | SEO specialist, Marketer | ✓ | — | — | — |

- **Problems:** `media_type_rejected` (415), `media_invalid` (422), `media_duplicate` (409), `media_in_use` (409), `payload_too_large` (413).

## 6. Admin

- **«Контент → Медиатека»** (`/media`):
  - upload by button or drag and drop: several files, one at a time, each with its own result;
  - an early check by name and size (SVG explained);
  - a grid with preview, name, dimensions, size, «Используется: N» / «Не используется» and warnings;
  - search and filters (kind, used / unused) kept in the address.
- **File page** (`/media/:id`):
  - large preview and the warnings;
  - «Где используется», with links to the editors;
  - facts: kind, dimensions, size, format, origin, last change, public address with «Копировать адрес»;
  - «Заменить файл» and «Удалить» (disabled with the reason while the file is used).
- **Media picker in the editors:**
  - previews for every image (no `VITE_MEDIA_BASE_URL` needed any more);
  - «Выбрать файл» uploads a new file and picks it in one step;
  - the wrong kind is refused before the upload.
- **Previews** are served by the API (same origin), so the admin CSP stays `img-src 'self' data:`.

## 7. Tests

| Suite | What |
|---|---|
| `packages/core/test/media.test.ts` | type sniffing (allowed types; SVG, HTML, PDF, GIF, executables, archives, QuickTime/HEIC refused), file names, limits |
| `apps/api/test/media.db.test.ts` | upload (EXIF orientation applied, EXIF/GPS removed, UUID path, read-only file, audit); duplicates; refused types; broken image; empty; too large; JSON body; nothing left in `tmp/`; permission matrix; library (legacy URLs and sizes, filters, search); previews (upload, legacy, video → 404, bad width → 400); usages; delete guard; replace (kind, unchanged, conflict, same id, previous file kept); delete; the DB constraint |
| `apps/api/test/nginx.db.test.ts` | `/media/originals/` served with `immutable` and `nosniff`; nothing else under `/media` |
| Build | a store referencing `/media/…` fails without `MEDIA_ROOT` and builds with it (checked manually; the worker always sets it) |
| `apps/admin/test/media.test.ts` | sizes, early check, usages in words, refusal texts |
| `apps/admin/e2e/media.e2e.mjs` | library with previews and filters; upload with SVG / duplicate; upload from the picker; usages; replace by a content manager; role limits; mobile |

## 8. Deviations and limits (Phase J-1)

| # | Deviation | Reason / where it goes |
|---|---|---|
| J-1 | No variants and no `srcset` yet; the site uses the stored file | J-2 (a separate, visually verified step, approved §24) |
| J-2 | Alt texts are not edited in the library; the site uses the alt texts of the blocks | The site never reads the library alt today; J-2 decides it together with the image checks |
| J-3 | No PDF / documents | There is no document entity in the content model yet |
| J-4 | Videos: no dimensions, no poster extraction, no transcoding | No ffmpeg on the server; posters are chosen as images |
| J-5 | Deleted or replaced files stay on disk | Immutable storage + GC after the backup retention (approved §12.2, Phase N) |
| J-6 | Animated WebP keeps only its first frame | sharp re-encodes the first page; animations are not part of the design |
| J-7 | Keys of files with non-Latin names fall back to `media-file-…` / the Latin part | Keys are technical; the original name is kept for display |
