'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';

import {
  type ConsentPreferences,
  DEFAULT_CONSENT,
  getConsentPreferences,
  saveConsentPreferences,
  grantedScopes,
} from '@/lib/consent';
import {
  trackConsentAllowEvent,
  trackConsentDenyEvent,
  trackConsentSelectedEvent,
  trackCmpVisibleEvent,
  enableAnonymousMode,
  disableAnonymousMode,
} from '@/lib/snowplow-config';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

interface CategoryDef {
  key: keyof ConsentPreferences;
  label: string;
  description: string;
  locked?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    description:
      'Required for the site to function, including security and core features. Always on.',
    locked: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Helps us understand behavior so we can improve the experience. Powers full Snowplow tracking.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Lets us measure campaigns and show you relevant offers.',
  },
  {
    key: 'preferences',
    label: 'Preferences',
    description:
      'Remembers choices like language and layout for a tailored experience.',
  },
];

export default function ConsentManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPreferences>(DEFAULT_CONSENT);

  const open = useCallback(() => {
    const stored = getConsentPreferences();
    setPrefs(stored ?? DEFAULT_CONSENT);
    setIsOpen(true);
    try {
      trackCmpVisibleEvent();
    } catch {
      // tracker may not be ready in edge cases; ignore.
    }
  }, []);

  // The modal is NOT shown on mount. It's opened via a custom DOM event
  // dispatched from the footer's "Manage Consent" control.
  useEffect(() => {
    const handler = () => open();
    window.addEventListener('showConsentManager', handler);
    return () => window.removeEventListener('showConsentManager', handler);
  }, [open]);

  const close = () => setIsOpen(false);

  const handleAcceptAll = () => {
    const next: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    };
    saveConsentPreferences(next);
    disableAnonymousMode();
    trackConsentAllowEvent(grantedScopes(next));
    close();
  };

  const handleRejectAll = () => {
    const next: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    };
    saveConsentPreferences(next);
    enableAnonymousMode();
    trackConsentDenyEvent(['necessary']);
    close();
  };

  const handleSave = () => {
    const next: ConsentPreferences = { ...prefs, necessary: true };
    saveConsentPreferences(next);
    if (next.analytics) {
      disableAnonymousMode();
    } else {
      enableAnonymousMode();
    }
    trackConsentSelectedEvent(grantedScopes(next));
    close();
  };

  const toggle = (key: keyof ConsentPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="relative w-full max-w-[42rem] rounded-md border border-border bg-surface shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border p-lg">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h2
                id="consent-title"
                className="font-heading text-h4 font-bold text-heading"
              >
                Your privacy choices
              </h2>
              <p className="mt-1 text-small text-body">
                Manage how {siteConfig.brand.name} uses behavioral data. Powered
                by Snowplow&apos;s privacy-first tracking.
              </p>
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-full p-1 text-muted transition-colors hover:bg-surface-raised hover:text-heading"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto p-lg">
          {CATEGORIES.map((cat) => {
            const checked = prefs[cat.key];
            return (
              <div
                key={cat.key}
                className="flex items-start justify-between gap-4 rounded-md border border-border bg-surface-raised p-md"
              >
                <div className="flex-1">
                  <h3 className="font-heading text-h5 font-semibold text-heading">
                    {cat.label}
                  </h3>
                  <p className="mt-1 text-small text-body">{cat.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={cat.label}
                  disabled={cat.locked}
                  onClick={() => !cat.locked && toggle(cat.key)}
                  className={cn(
                    'relative mt-1 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
                    checked ? 'bg-primary' : 'bg-border',
                    cat.locked && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      checked ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-lg sm:flex-row sm:justify-end">
          <button
            onClick={handleRejectAll}
            className="rounded-full border border-border px-5 py-2 text-small font-semibold text-heading transition-colors hover:bg-surface-raised"
          >
            Reject all
          </button>
          <button
            onClick={handleSave}
            className="rounded-full border border-border px-5 py-2 text-small font-semibold text-heading transition-colors hover:bg-surface-raised"
          >
            Save preferences
          </button>
          <button
            onClick={handleAcceptAll}
            className="rounded-full bg-primary px-5 py-2 text-small font-bold text-inverse transition-colors hover:bg-highlight"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
