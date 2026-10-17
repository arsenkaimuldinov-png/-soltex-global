/**
 * What every lead form shares (Phase K-2): sending through the lead service with the spam signals
 * the server checks (hidden honeypot field, time to fill the form), and the error message when a
 * lead could not be sent. With the demo service (no SOLTEX_LEADS_ENDPOINT) neither the field nor the
 * message is rendered and nothing extra is sent: the forms look and behave exactly as before.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { LEADS_ENDPOINT, leadService, type LeadPayload, type LeadSubmissionResult } from '../services/leads';

type LeadError = Extract<LeadSubmissionResult, { ok: false }>['error'];

/** `shown`: whether the form is on screen (a dialog passes its open state; the fill time starts then). */
export function useLeadSubmission(shown = true) {
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
    const result = await leadService.submitLead({ ...payload, ...signals });
    setSubmitting(false);
    if (!result.ok) setError(result.error);
    return result;
  }, []);

  return { submit, submitting, error, trapRef };
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
