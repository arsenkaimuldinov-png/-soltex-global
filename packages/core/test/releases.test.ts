/**
 * Release state machine (Phase G, docs/admin-publishing.md §3): every allowed transition, nothing
 * else; preview builds never become active; final states stay final.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransition, isReleaseStatus, liveState, RELEASE_IN_PROGRESS, RELEASE_STATUSES, RELEASE_TRANSITIONS, RELEASE_WITH_ARTIFACT, REVISION_KIND_SCOPE, REVISION_KINDS } from '../src/domain/index.ts';

test('release transitions: exactly the documented edges', () => {
  const edges = RELEASE_STATUSES.flatMap((from) => RELEASE_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`));
  assert.deepEqual(edges.sort(), [
    'active→retired',
    'building→failed',
    'building→validating',
    'queued→building',
    'queued→failed',
    'queued→superseded',
    'ready→active',
    'ready→superseded',
    'retired→active',
    'validating→failed',
    'validating→ready',
  ]);
  for (const s of ['failed', 'superseded'] as const) assert.deepEqual(RELEASE_TRANSITIONS[s], [], `${s} is final`);
  assert.ok(!canTransition('queued', 'active'), 'no activation without build and checks');
  assert.ok(!canTransition('failed', 'ready'));
});

test('preview builds can never become active', () => {
  assert.ok(!canTransition('ready', 'active', 'preview'));
  assert.ok(!canTransition('retired', 'active', 'preview'));
  assert.ok(canTransition('validating', 'ready', 'preview'));
});

test('status groups, revision kinds and live state', () => {
  assert.deepEqual([...RELEASE_IN_PROGRESS], ['building', 'validating']);
  assert.deepEqual([...RELEASE_WITH_ARTIFACT], ['ready', 'active', 'retired']);
  assert.ok(isReleaseStatus('ready'));
  assert.ok(!isReleaseStatus('published'));
  for (const k of REVISION_KINDS) assert.ok(REVISION_KIND_SCOPE[k], k);
  assert.equal(liveState(3, null), 'not_live');
  assert.equal(liveState(3, 3), 'live');
  assert.equal(liveState(4, 3), 'live_with_changes');
});
