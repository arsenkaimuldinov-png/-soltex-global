/**
 * E-mail delivery (Phase K, approved §19: outbox → NotificationService → EmailProvider).
 *
 *  - SmtpEmailProvider: nodemailer with SMTP_URL / MAIL_FROM (production);
 *  - UnconfiguredEmailProvider: no SMTP yet — every send fails with `mail_not_configured`, so the
 *    outbox keeps the message and retries later (client decision B5 is still open);
 *  - FakeEmailProvider: tests.
 * Providers never log addresses, subjects or bodies.
 */
import nodemailer from 'nodemailer';
import type { ApiConfig } from '../config.ts';

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
}

export class EmailError extends Error {
  /** Short code stored in the outbox (never a message with addresses or content). */
  constructor(readonly code: 'mail_not_configured' | 'no_recipients' | 'smtp_rejected' | 'smtp_unavailable') {
    super(code);
  }
}

export interface EmailProvider {
  readonly configured: boolean;
  send(message: EmailMessage): Promise<void>;
}

export class UnconfiguredEmailProvider implements EmailProvider {
  readonly configured = false;
  async send(): Promise<void> {
    throw new EmailError('mail_not_configured');
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly configured = true;
  private readonly transport;
  constructor(
    url: string,
    private readonly from: string
  ) {
    // nodemailer logs nothing unless asked (no logger option): addresses and content never reach the logs.
    this.transport = nodemailer.createTransport(url);
  }
  async send(m: EmailMessage): Promise<void> {
    if (!m.to.length) throw new EmailError('no_recipients');
    try {
      await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text });
    } catch (e) {
      const code = (e as { responseCode?: number }).responseCode;
      throw new EmailError(code && code >= 500 ? 'smtp_rejected' : 'smtp_unavailable');
    }
  }
}

/** Test double: records messages; can be told to fail. */
export class FakeEmailProvider implements EmailProvider {
  readonly configured = true;
  sent: EmailMessage[] = [];
  failWith: EmailError['code'] | null = null;
  async send(m: EmailMessage): Promise<void> {
    if (this.failWith) throw new EmailError(this.failWith);
    if (!m.to.length) throw new EmailError('no_recipients');
    this.sent.push(m);
  }
}

export function emailProviderFor(config: ApiConfig): EmailProvider {
  return config.mail ? new SmtpEmailProvider(config.mail.smtpUrl, config.mail.from) : new UnconfiguredEmailProvider();
}
