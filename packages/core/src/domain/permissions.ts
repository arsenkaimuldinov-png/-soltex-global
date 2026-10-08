/**
 * Roles and permissions (approved architecture §8). Defined in code, never edited in the admin
 * (custom roles are DEFERRED). Shared by the API (the security boundary) and, later, the admin
 * UI (which only hides what the API would refuse anyway).
 *
 * Rules:
 *  - Every role is an explicit, finite list of permissions. There is no wildcard and no
 *    "is admin" shortcut anywhere: Owner simply lists every permission.
 *  - Authorization chain: user → permissions → endpoint → resource → field (§8.3).
 */

export const ROLES = ['owner', 'admin', 'content_manager', 'editor', 'seo_specialist', 'marketer'] as const;
export type Role = (typeof ROLES)[number];

/** Russian labels for the admin UI (§X of the review). */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  content_manager: 'Контент-менеджер',
  editor: 'Редактор',
  seo_specialist: 'SEO-специалист',
  marketer: 'Маркетолог',
};

export const PERMISSIONS = [
  'content.read',
  'content.edit',
  'content.publish',
  'seo.read',
  'seo.edit',
  'seo.publish',
  'redirects.read',
  'redirects.manage',
  'media.read',
  'media.upload',
  'media.replace',
  'media.delete',
  'leads.read',
  'leads.manage',
  'leads.export',
  'users.manage',
  'settings.manage',
  'system.read',
  'system.deploy',
  'system.rollback',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** The role × permission matrix of approved architecture §8.2, written out in full. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'content.read', 'content.edit', 'content.publish',
    'seo.read', 'seo.edit', 'seo.publish',
    'redirects.read', 'redirects.manage',
    'media.read', 'media.upload', 'media.replace', 'media.delete',
    'leads.read', 'leads.manage', 'leads.export',
    'users.manage', 'settings.manage',
    'system.read', 'system.deploy', 'system.rollback',
    'audit.read',
  ],
  admin: [
    'content.read', 'content.edit', 'content.publish',
    'seo.read', 'seo.edit', 'seo.publish',
    'redirects.read', 'redirects.manage',
    'media.read', 'media.upload', 'media.replace', 'media.delete',
    'leads.read', 'leads.manage', 'leads.export',
    'users.manage', 'settings.manage',
    'system.read', 'system.deploy', 'system.rollback',
    'audit.read',
  ],
  content_manager: [
    'content.read', 'content.edit', 'content.publish',
    'seo.read', 'seo.edit',
    'redirects.read',
    'media.read', 'media.upload', 'media.replace',
    'system.read', 'system.deploy',
  ],
  editor: ['content.read', 'content.edit', 'seo.read', 'media.read', 'media.upload'],
  seo_specialist: ['content.read', 'seo.read', 'seo.edit', 'seo.publish', 'redirects.read', 'redirects.manage', 'media.read', 'system.read'],
  marketer: ['content.read', 'seo.read', 'media.read', 'leads.read', 'leads.manage', 'leads.export'],
};

const ROLE_SETS = new Map<Role, ReadonlySet<Permission>>(ROLES.map((r) => [r, new Set(ROLE_PERMISSIONS[r])]));

export const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);
export const isPermission = (v: unknown): v is Permission =>
  typeof v === 'string' && (PERMISSIONS as readonly string[]).includes(v);

/** The only permission check. Unknown roles or permissions are always denied. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_SETS.get(role)?.has(permission) ?? false;
}

export function permissionsOf(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

// ---------------------------------------------------------------------------
// MFA requirements (§7)
// ---------------------------------------------------------------------------

/** Holding any of these makes MFA mandatory before the account can do anything else. */
export const MFA_REQUIRED_PERMISSIONS: readonly Permission[] = [
  'content.publish',
  'seo.publish',
  'redirects.manage',
  'users.manage',
  'settings.manage',
  'leads.read',
  'leads.manage',
  'leads.export',
  'system.deploy',
  'system.rollback',
];

/** Roles whose second factor must include a passkey (WebAuthn); TOTP may be added as a backup. */
export const PASSKEY_REQUIRED_ROLES: readonly Role[] = ['owner', 'admin'];

export type MfaRequirement = 'passkey' | 'any' | 'none';

/**
 * What second factor the role must have enrolled.
 * `mfaForAllRoles` is the client decision on MFA for roles without sensitive permissions
 * (currently only Editor; approved §22 item 7, recommended "yes").
 */
export function mfaRequirement(role: Role, opts: { mfaForAllRoles?: boolean } = {}): MfaRequirement {
  if (PASSKEY_REQUIRED_ROLES.includes(role)) return 'passkey';
  if (permissionsOf(role).some((p) => MFA_REQUIRED_PERMISSIONS.includes(p))) return 'any';
  return opts.mfaForAllRoles ? 'any' : 'none';
}

// ---------------------------------------------------------------------------
// User management rules (§7 "privilege escalation", §8.2 "Admin cannot touch Owners")
// ---------------------------------------------------------------------------

export type UserChange = 'create' | 'update_profile' | 'change_role' | 'change_status' | 'reset_mfa' | 'revoke_sessions';

/**
 * May `actor` perform `change` on a user whose role is `targetRole` (and, for create/role
 * changes, give them `newRole`)? Requires `users.manage`; only an Owner may act on or create
 * Owners; nobody changes their own role or status or resets their own MFA through user management.
 */
export function canManageUser(args: {
  actorRole: Role;
  actorId: string;
  targetId: string | null;
  targetRole: Role | null;
  newRole?: Role | null;
  change: UserChange;
}): boolean {
  const { actorRole, actorId, targetId, targetRole, newRole, change } = args;
  if (!hasPermission(actorRole, 'users.manage')) return false;
  const self = targetId !== null && targetId === actorId;
  if (self && change !== 'update_profile') return false;
  const ownerOnly = (r: Role | null | undefined) => r === 'owner' && actorRole !== 'owner';
  if (ownerOnly(targetRole) || ownerOnly(newRole)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Field-level authorization (§8.3: … → resource → field)
// ---------------------------------------------------------------------------

/** Content fields an SEO-only role may change: SEO fields and alt texts (§8.3). */
export const SEO_FIELDS: readonly string[] = [
  'slug',
  'seoMetaTitle',
  'seoMetaDescription',
  'ogImage',
  'noindex',
  'inSitemap',
  'canonicalOverride',
  'altText',
];

/** Fields of a user record and the permission that changes them (§8.3). */
export const USER_FIELD_PERMISSIONS: Record<'name' | 'role' | 'status', Permission> = {
  name: 'users.manage',
  role: 'users.manage',
  status: 'users.manage',
};

/**
 * Fields of `fields` that `role` may NOT change on a content entity.
 * SEO fields need `seo.edit`; every other field needs `content.edit`.
 */
export function deniedContentFields(role: Role, fields: readonly string[]): string[] {
  return fields.filter((f) => !hasPermission(role, SEO_FIELDS.includes(f) ? 'seo.edit' : 'content.edit'));
}
