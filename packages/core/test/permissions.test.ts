import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  canManageUser,
  deniedContentFields,
  hasPermission,
  mfaRequirement,
  permissionsOf,
  type Permission,
  type Role,
} from '../src/domain/permissions.ts';

/** The approved matrix (§8.2), restated independently so a change to the code must change this test. */
const EXPECTED: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  content_manager: ['content.read', 'content.edit', 'content.publish', 'seo.read', 'seo.edit', 'redirects.read', 'media.read', 'media.upload', 'media.replace', 'system.read', 'system.deploy'],
  editor: ['content.read', 'content.edit', 'seo.read', 'media.read', 'media.upload'],
  seo_specialist: ['content.read', 'seo.read', 'seo.edit', 'seo.publish', 'redirects.read', 'redirects.manage', 'media.read', 'system.read'],
  marketer: ['content.read', 'seo.read', 'media.read', 'leads.read', 'leads.manage', 'leads.export'],
};

test('every role × every permission matches the approved matrix', () => {
  for (const role of ROLES)
    for (const p of PERMISSIONS) assert.equal(hasPermission(role, p), EXPECTED[role].includes(p), `${role} × ${p}`);
});

test('rollback is Owner and Admin only; users.manage and audit.read too', () => {
  for (const role of ROLES) {
    const privileged = role === 'owner' || role === 'admin';
    assert.equal(hasPermission(role, 'system.rollback'), privileged);
    assert.equal(hasPermission(role, 'users.manage'), privileged);
    assert.equal(hasPermission(role, 'audit.read'), privileged);
  }
});

test('no wildcard: unknown roles and permissions are denied, Owner is an explicit list', () => {
  assert.equal(hasPermission('owner', 'content.everything' as Permission), false);
  assert.equal(hasPermission('superuser' as Role, 'content.read'), false);
  assert.equal(hasPermission('admin' as Role, '*' as Permission), false);
  for (const role of ROLES) assert.ok(!(ROLE_PERMISSIONS[role] as readonly string[]).some((p) => p.includes('*')));
  assert.deepEqual(permissionsOf('owner'), [...PERMISSIONS]);
});

test('MFA requirement: passkey for Owner/Admin, any factor for sensitive roles, Editor configurable', () => {
  assert.equal(mfaRequirement('owner'), 'passkey');
  assert.equal(mfaRequirement('admin'), 'passkey');
  assert.equal(mfaRequirement('content_manager'), 'any');
  assert.equal(mfaRequirement('seo_specialist'), 'any');
  assert.equal(mfaRequirement('marketer'), 'any');
  assert.equal(mfaRequirement('editor'), 'none');
  assert.equal(mfaRequirement('editor', { mfaForAllRoles: true }), 'any');
});

test('field-level: SEO specialist edits SEO fields only, Editor content fields only', () => {
  assert.deepEqual(deniedContentFields('seo_specialist', ['slug', 'seoMetaTitle', 'altText']), []);
  assert.deepEqual(deniedContentFields('seo_specialist', ['title', 'slug']), ['title']);
  assert.deepEqual(deniedContentFields('editor', ['title', 'overview']), []);
  assert.deepEqual(deniedContentFields('editor', ['title', 'slug', 'noindex']), ['slug', 'noindex']);
  assert.deepEqual(deniedContentFields('marketer', ['title']), ['title']);
  assert.deepEqual(deniedContentFields('content_manager', ['title', 'slug']), []);
});

test('user management: only Owners touch Owners; no self-escalation', () => {
  const base = { actorId: 'a', targetId: 'b' };
  assert.equal(canManageUser({ ...base, actorRole: 'admin', targetRole: 'editor', newRole: 'content_manager', change: 'change_role' }), true);
  assert.equal(canManageUser({ ...base, actorRole: 'admin', targetRole: 'owner', change: 'change_status' }), false);
  assert.equal(canManageUser({ ...base, actorRole: 'admin', targetRole: 'editor', newRole: 'owner', change: 'change_role' }), false);
  assert.equal(canManageUser({ actorId: 'a', targetId: null, actorRole: 'admin', targetRole: null, newRole: 'owner', change: 'create' }), false);
  assert.equal(canManageUser({ actorId: 'a', targetId: null, actorRole: 'owner', targetRole: null, newRole: 'owner', change: 'create' }), true);
  assert.equal(canManageUser({ actorId: 'a', targetId: 'a', actorRole: 'owner', targetRole: 'owner', newRole: 'editor', change: 'change_role' }), false, 'self role change');
  assert.equal(canManageUser({ actorId: 'a', targetId: 'a', actorRole: 'admin', targetRole: 'admin', change: 'reset_mfa' }), false, 'self MFA reset');
  for (const role of ['content_manager', 'editor', 'seo_specialist', 'marketer'] as const)
    assert.equal(canManageUser({ ...base, actorRole: role, targetRole: 'editor', change: 'update_profile' }), false);
});
