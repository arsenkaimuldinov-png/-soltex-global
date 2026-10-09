/**
 * Release state machine and revision kinds (Phase G, docs/admin-publishing.md).
 * Pure rules shared by the API (which enforces them) and the admin (which only displays them).
 *
 *   queued ──► building ──► validating ──► ready ──► active ──► retired
 *     │           │             │            │          ▲          │
 *     │           ▼             ▼            ▼          └─rollback─┘
 *     ├──────► failed ◄─────────┘        superseded
 *     ▼
 *   superseded
 *
 *  - queued:     snapshot captured, waiting for the (single) build slot
 *  - building:   the site is being built from the snapshot in an isolated workspace
 *  - validating: content, site and artifact checks run on the finished build
 *  - ready:      validated, immutable artifact stored; can be previewed and activated
 *  - active:     the artifact the public site serves (exactly one at a time)
 *  - retired:    was active, replaced by a newer activation; kept for rollback
 *  - failed:     a step failed (or the worker was lost); never activated
 *  - superseded: a newer candidate made this one obsolete before activation
 *
 * Preview builds (kind `preview`) follow the same path but stop at `ready`: they can never become
 * active.
 */

export const RELEASE_STATUSES = ['queued', 'building', 'validating', 'ready', 'active', 'retired', 'failed', 'superseded'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_KINDS = ['release', 'preview'] as const;
export type ReleaseKind = (typeof RELEASE_KINDS)[number];

/** Allowed transitions; anything else is refused by the service (no generic status PATCH). */
export const RELEASE_TRANSITIONS: Readonly<Record<ReleaseStatus, readonly ReleaseStatus[]>> = {
  queued: ['building', 'failed', 'superseded'],
  building: ['validating', 'failed'],
  validating: ['ready', 'failed'],
  ready: ['active', 'superseded'],
  active: ['retired'],
  retired: ['active'],
  failed: [],
  superseded: [],
};

export function canTransition(from: ReleaseStatus, to: ReleaseStatus, kind: ReleaseKind = 'release'): boolean {
  if (kind === 'preview' && to === 'active') return false;
  return RELEASE_TRANSITIONS[from].includes(to);
}

/** States in which a worker owns the release (a lost worker leaves it here → recovered as failed). */
export const RELEASE_IN_PROGRESS: readonly ReleaseStatus[] = ['building', 'validating'];
/** States that hold a validated, immutable artifact. */
export const RELEASE_WITH_ARTIFACT: readonly ReleaseStatus[] = ['ready', 'active', 'retired'];

export const isReleaseStatus = (v: unknown): v is ReleaseStatus => typeof v === 'string' && (RELEASE_STATUSES as readonly string[]).includes(v);

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

/**
 * Why a revision was written. `source` kinds change the source-language content, `translation`
 * kinds one language, `state` kinds only the publication status.
 */
export const REVISION_KINDS = ['baseline', 'import', 'create', 'update', 'archive', 'unarchive', 'publish', 'unpublish', 'translation', 'approve', 'reopen', 'restore'] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export const REVISION_KIND_SCOPE: Readonly<Record<RevisionKind, 'source' | 'translation' | 'state' | 'system'>> = {
  baseline: 'system',
  import: 'system',
  create: 'source',
  update: 'source',
  restore: 'source',
  archive: 'state',
  unarchive: 'state',
  publish: 'state',
  unpublish: 'state',
  translation: 'translation',
  approve: 'translation',
  reopen: 'translation',
};

// ---------------------------------------------------------------------------
// Entity publication state (approved §3.2), as shown in the admin
// ---------------------------------------------------------------------------

export type LiveState = 'not_live' | 'live' | 'live_with_changes';

/**
 * Publication state of one entity: compares its latest revision with the revision the active
 * release contains. `live` = the active release has exactly this version.
 */
export function liveState(latestRevision: number | null, liveRevision: number | null): LiveState {
  if (liveRevision === null) return 'not_live';
  return latestRevision === liveRevision ? 'live' : 'live_with_changes';
}
