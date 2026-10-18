/**
 * What every lead form shares (Phase K-2): sending through the lead service with the spam signals
 * the server checks (hidden honeypot field, time to fill the form), and the error message when a
 * lead could not be sent. With the demo service (no SOLTEX_LEADS_ENDPOINT) neither the field nor the
 * message is rendered and nothing extra is sent: the forms look and behave exactly as before.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Link } from '../i18n/Link';
import { useContent } from '../content/useContent';
import { LEADS_ENDPOINT, leadService, type LeadPayload, type LeadSubmissionResult } from '../services/leads';

type LeadError = Extract<LeadSubmissionResult, { ok: false }>['error'];

/** `shown`: whether the form is on screen (a dialog passes its open state; the fill time starts then). */
export function useLeadSubmission(shown = true) {
  // Phase N-0: with a published Privacy Policy every form has a required consent box, so a sent
  // form always carries the visitor's consent.
  const consentAsked = useContent().hasPage('privacy');
  const shownAt = useRef(0);
  const trapRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LeadError | null>(null);
  useEffect(() => {
    if (!shown) return;
    shownAt.current = Date.now();
    setError(null);
  }, [shown]);

  const submit = useCallback(async (payload: Omit<LeadPayload, 'hp' | 'fillMs'>): Promise<LeadSubmissionResult> => {
    setSubmitting(true);
    setError(null);
    const signals = LEADS_ENDPOINT ? { hp: trapRef.current?.value || undefined, fillMs: Math.max(0, Date.now() - shownAt.current) } : {};
    const result = await leadService.submitLead({ ...payload, ...signals, ...(consentAsked ? { consent: true as const } : {}) });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
    return result;
  }, [consentAsked]);

  return { submit, submitting, error, trapRef, consentAsked };
}

/** Honeypot: invisible, out of the tab order and hidden from assistive technology; people never fill it. */
export function LeadTrap({ trapRef }: { trapRef: React.RefObject<HTMLInputElement | null> }) {
  if (!LEADS_ENDPOINT) return null;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
      <label>
        Leave this field empty
        <input ref={trapRef} type="text" name="soltex_ref" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/**
 * Consent to the processing of personal data (Phase N-0; required in Kazakhstan, Law No. 94-V
 * art. 8): a required checkbox linking to the Privacy Policy. Rendered only once the policy is
 * published; until then `fallback` (the approved note) is shown.
 */
export function LeadConsent({ tone, fallback }: { tone: 'light' | 'dark'; fallback?: React.ReactNode }) {
  const { tr, t } = useI18n();
  const { hasPage } = useContent();
  if (!hasPage('privacy')) return <>{fallback ?? null}</>;
  const text = tone === 'dark' ? 'text-[#FBFBF8]/80' : 'text-[#334439]';
  const link = tone === 'dark' ? 'text-[#BA9B60] hover:text-white' : 'text-[#0E482C] hover:text-[#0A3620]';
  return (
    <label data-lead-consent className={`flex items-start gap-2.5 text-xs leading-relaxed cursor-pointer ${text}`}>
      <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#0E482C] cursor-pointer" />
      <span>
        {tr('consent.label', {
          link: (
            <Link to="/privacy" target="_blank" rel="noopener" className={`underline underline-offset-2 ${link}`}>
              {t('consent.link')}
            </Link>
          ),
        })}
      </span>
    </label>
  );
}

const MESSAGE = { validation: 'leadForm.errorInvalid', rate_limited: 'leadForm.errorRateLimited', network: 'leadForm.errorSend', server: 'leadForm.errorSend' } as const;

/** Why the lead was not sent; the entered values stay in the form. */
export function LeadErrorMessage({ error, tone }: { error: LeadError | null; tone: 'light' | 'dark' }) {
  const { t } = useI18n();
  if (!LEADS_ENDPOINT || !error) return null;
  const look = tone === 'dark' ? 'text-[#FBFBF8]' : 'text-[#121815]';
  return (
    <p role="alert" data-lead-error={error} className={`border border-[#BA9B60]/30 bg-[#BA9B60]/10 px-3.5 py-2.5 text-xs leading-relaxed ${look}`}>
      {t(MESSAGE[error])}
    </p>
  );
}
