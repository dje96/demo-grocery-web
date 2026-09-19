'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import {
  INTERVENTION_EVENT,
  INTERVENTION_CLEARED_EVENT,
  hasInterventionTriggered,
  getSessionId,
  getUserId,
} from '@/lib/snowplow-config';
import { isInterventionEligible } from '@/lib/nudge';
import { isSignalsEnabled } from '@/lib/consent';
import { siteConfig } from '@/lib/config';

/**
 * Signals intervention surface — the reusable dual-path banner.
 *
 *  PUSH (primary): the Signals plugin handler in snowplow-config.ts persists a
 *    received intervention and dispatches INTERVENTION_EVENT. We listen for it.
 *  PULL (fallback): while not yet triggered, poll /api/signals and re-derive
 *    eligibility from the same clauses (lib/nudge.ts) in case the SSE lags.
 *  PRESENTER: the Signals Inspector "trigger" button uses the same
 *    INTERVENTION_EVENT contract, so it surfaces here too.
 *
 * Replace the copy/CTA with the demo's actual offer. This is deliberately plain.
 */

const POLL_MS = 5000;
const DISMISS_KEY = 'demo-intervention-dismissed';

export default function InterventionBanner() {
  const [visible, setVisible] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const show = useCallback(() => {
    if (typeof window === 'undefined') return;
    // A discrete trigger resets any prior dismissal — handled by clearing it here.
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
  }, []);

  const dismissed = useCallback(() => {
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  // Push path + presenter trigger.
  useEffect(() => {
    if (!siteConfig.features.signals) return;
    const onEvent = () => {
      // Explicit trigger clears a prior dismissal.
      try {
        window.sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      show();
    };
    const onCleared = () => setVisible(false);
    window.addEventListener(INTERVENTION_EVENT, onEvent);
    window.addEventListener(INTERVENTION_CLEARED_EVENT, onCleared);
    // Already triggered earlier this session?
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasInterventionTriggered() && !dismissed()) show();
    return () => {
      window.removeEventListener(INTERVENTION_EVENT, onEvent);
      window.removeEventListener(INTERVENTION_CLEARED_EVENT, onCleared);
    };
  }, [show, dismissed]);

  // Pull fallback: poll until eligible (or already visible).
  useEffect(() => {
    if (!siteConfig.features.signals) return;
    if (visible) return;

    async function poll() {
      if (!isSignalsEnabled() || dismissed()) return;
      const sessionId = getSessionId();
      if (!sessionId) return;
      try {
        const res = await fetch('/api/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, domainUserid: getUserId() ?? null }),
        });
        const data = await res.json();
        if (data?.success && isInterventionEligible(data.attributes)) {
          show();
        }
      } catch {
        /* network hiccup — try again next tick */
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visible, show, dismissed]);

  if (!visible) return null;

  // Citrus ground — the ONE place #D9F154 fills a large area, so an
  // intervention is unmistakable against an otherwise monochrome palette.
  return (
    <div className="w-full bg-highlight text-primary">
      <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-6 py-2.5 text-small">
        <p className="font-medium">
          Your basket is close to the free-delivery threshold —{' '}
          <span className="font-heading font-bold">
            we&apos;re holding your <span className="num">18:00–19:00</span> slot for{' '}
            <span className="num">10</span> minutes
          </span>
          .
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-sm p-1 transition-colors hover:bg-primary/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
