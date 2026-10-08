/**
 * Security notifications (approved §7, §19: … → NotificationService → EmailProvider).
 * E-mail delivery (SMTP, EmailProvider) arrives in Phase K. Until then the default notifier
 * only records THAT a notification was due — never the recipient, never a token.
 */
import type { FastifyBaseLogger } from 'fastify';

export type SecurityAlert =
  | 'account_locked'
  | 'recovery_code_used'
  | 'mfa_reset_by_admin'
  | 'password_changed'
  | 'password_reset'
  | 'passkey_added'
  | 'passkey_removed'
  | 'totp_disabled';

export interface NotifiedUser {
  id: string;
  email: string;
  name: string;
}

export interface Notifier {
  /** Deliver a password-reset link. The token must never be logged. */
  passwordReset(user: NotifiedUser, token: string, expiresAt: Date): Promise<void>;
  /** Tell the user (and later the Owners) about a security-relevant change. */
  securityAlert(user: NotifiedUser, alert: SecurityAlert): Promise<void>;
}

export class UnconfiguredNotifier implements Notifier {
  constructor(private readonly log: FastifyBaseLogger | Console) {}
  async passwordReset(user: NotifiedUser): Promise<void> {
    this.log.warn({ userId: user.id }, 'password reset requested, but e-mail delivery is not configured (Phase K)');
  }
  async securityAlert(user: NotifiedUser, alert: SecurityAlert): Promise<void> {
    this.log.info({ userId: user.id, alert }, 'security alert (e-mail delivery not configured, Phase K)');
  }
}
