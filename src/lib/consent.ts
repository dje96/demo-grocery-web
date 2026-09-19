/**
 * Consent state + Signals preference helpers.
 *
 * Consent is persisted in localStorage and drives Snowplow's anonymous
 * tracking mode. Signals preference lets a presenter toggle personalization
 * on/off during a demo.
 */

// ─── Consent ────────────────────────────────────────────────────────────────

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const CONSENT_GIVEN_KEY = 'consent-given';
const CONSENT_PREFERENCES_KEY = 'consent-preferences';
const CONSENT_DATE_KEY = 'consent-date';

export const DEFAULT_CONSENT: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** True if the user has recorded any consent decision. */
export function hasConsentBeenGiven(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(CONSENT_GIVEN_KEY) === 'true';
}

/** Read the stored consent preferences, or null if none recorded. */
export function getConsentPreferences(): ConsentPreferences | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(CONSENT_PREFERENCES_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    return {
      necessary: true, // always on
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      preferences: Boolean(parsed.preferences),
    };
  } catch {
    return null;
  }
}

/** Persist a consent decision. */
export function saveConsentPreferences(preferences: ConsentPreferences): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(CONSENT_GIVEN_KEY, 'true');
  window.localStorage.setItem(
    CONSENT_PREFERENCES_KEY,
    JSON.stringify({ ...preferences, necessary: true })
  );
  window.localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
}

/** ISO timestamp of the last consent action, or null. */
export function getConsentDate(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(CONSENT_DATE_KEY);
}

/**
 * Given a consent preference set, return the list of granted scopes
 * (for consent event payloads).
 */
export function grantedScopes(preferences: ConsentPreferences): string[] {
  return (Object.keys(preferences) as (keyof ConsentPreferences)[]).filter(
    (key) => preferences[key]
  );
}

// ─── Signals preference ─────────────────────────────────────────────────────

const SIGNALS_ENABLED_KEY = 'signals-enabled';

/** True unless the presenter has explicitly disabled Signals. */
export function isSignalsEnabled(): boolean {
  if (!isBrowser()) return true;
  const stored = window.localStorage.getItem(SIGNALS_ENABLED_KEY);
  if (stored === null) return true; // default enabled
  return stored === 'true';
}

/** Set the Signals preference and notify listeners. */
export function setSignalsEnabled(enabled: boolean): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SIGNALS_ENABLED_KEY, String(enabled));
  window.dispatchEvent(
    new CustomEvent('signalsPreferenceChanged', { detail: { enabled } })
  );
}
