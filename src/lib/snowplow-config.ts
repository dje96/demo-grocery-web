/**
 * Snowplow Tracker Configuration — reusable baseline.
 *
 * Initializes the Snowplow browser tracker with the standard plugin set and
 * exposes every tracking function the app uses. NOTHING here is demo-specific:
 * appId, collector/Signals endpoints, and the intervention names are all read
 * from `siteConfig.snowplow`. Point that config block at the resources you
 * published in Console and this file works unchanged.
 *
 * Carries two hard-won fixes worth keeping:
 *   • sessionOnlyFetcher      — avoids Signals API 400s from a non-UUID
 *                               domain_userid (see below).
 *   • suppressBenignTrackerNoise — keeps the Next dev overlay from going red on
 *                               benign SSE reconnects.
 */

import {
  newTracker,
  enableActivityTracking,
  crossDomainLinker,
  trackPageView,
  setUserId,
  newSession,
  enableAnonymousTracking,
  disableAnonymousTracking,
  getDomainSessionId,
  clearUserData,
} from '@snowplow/browser-tracker';
import type { BrowserTracker } from '@snowplow/browser-tracker';
import {
  LinkClickTrackingPlugin,
  enableLinkClickTracking,
} from '@snowplow/browser-plugin-link-click-tracking';
import {
  EnhancedConsentPlugin,
  trackConsentAllow,
  trackConsentDeny,
  trackConsentSelected,
  trackCmpVisible,
} from '@snowplow/browser-plugin-enhanced-consent';
import { SnowplowMediaPlugin } from '@snowplow/browser-plugin-media';
import {
  YouTubeTrackingPlugin,
  startYouTubeTracking,
  endYouTubeTracking,
} from '@snowplow/browser-plugin-youtube-tracking';
import { SnowplowEcommercePlugin } from '@snowplow/browser-plugin-snowplow-ecommerce';
import {
  SignalsPlugin,
  subscribeToInterventions,
  addInterventionHandlers,
} from '@snowplow/signals-browser-plugin';
import type {
  Intervention,
  Fetcher,
  FetcherFactory,
  SignalsInterventionConfiguration,
} from '@snowplow/signals-browser-plugin';

import { siteConfig } from './config';
import { getConsentPreferences, isSignalsEnabled } from './consent';

// ─── Constants (from config) ─────────────────────────────────────────────────

const { snowplow } = siteConfig;
const COLLECTOR_ENDPOINT = snowplow.collectorEndpoint;
const TRACKER_NAMESPACE = snowplow.namespace;

// Signals interventions SSE host. NOTE: this is NOT the collector — the browser
// plugin fetches interventions from the org's Signals API host, so a wrong host
// fails with "Error fetching interventions". Prefer the public env var.
const SIGNALS_ENDPOINT =
  process.env.NEXT_PUBLIC_SNOWPLOW_SIGNALS_API_URL ?? snowplow.signalsApiUrl;

/** Names of the published interventions this demo surfaces. */
export const INTERVENTION_NAMES: readonly string[] =
  snowplow.interventions.map((i) => i.name);

/**
 * Window CustomEvent fired when an intervention should surface. Two producers
 * converge on it — the Signals plugin handler (real push delivery) and the
 * presenter-only Signals Inspector "trigger" buttons — so the surface has a
 * single integration seam. `detail` is a `FiredIntervention`.
 */
export const INTERVENTION_EVENT = 'sp:intervention';

/** Window CustomEvent fired to clear/hide the intervention surface. */
export const INTERVENTION_CLEARED_EVENT = 'sp:intervention-cleared';

/** sessionStorage key recording which interventions fired this session. */
const INTERVENTION_STORAGE_KEY = 'demo-interventions';

/** An intervention that fired this session, by whatever route. */
export interface FiredIntervention {
  name: string;
  /** `signals` = real SSE push; `inspector` = presenter manual trigger. */
  source: 'signals' | 'inspector';
  /** The pushed payload (attributes, intervention_id) — signals only. */
  intervention?: Intervention;
  at: number;
}

/**
 * The Signals browser plugin logs benign, self-recovering SSE reconnect noise
 * via console.error ("Error fetching interventions", "Request timed out").
 * Under Next.js dev + Turbopack these get promoted to the fatal red error
 * overlay, which covers the page and blocks interaction. Swallow just those two
 * messages so the overlay stays clear; everything else logs normally.
 */
let noiseSuppressed = false;
function suppressBenignTrackerNoise(): void {
  if (noiseSuppressed || typeof window === 'undefined') return;
  noiseSuppressed = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === 'string' &&
      (first.includes('Error fetching interventions') ||
        first.includes('Request timed out'))
    ) {
      return;
    }
    original.apply(console, args as []);
  };
}

// ─── Session-scoped intervention fetcher (custom) ─────────────────────────────

const DEFAULT_INTERVENTIONS_PATH = '/api/v1/interventions';

/**
 * The stock fetcher in @snowplow/signals-browser-plugin seeds BOTH
 * domain_userid AND domain_sessionid from the tracker cookie at construction
 * time, and no public config can un-seed a key. When domain_userid isn't a
 * valid UUID (anonymous state, or a hand-edited `_sp_id` cookie), the Signals
 * API rejects the WHOLE request with 400 "only UUIDs allowed as attribute key
 * values", the SSE never opens, and NO interventions arrive.
 *
 * Session-keyed interventions target domain_sessionid only, so this fetcher
 * subscribes with exactly that one key and never sends domain_userid. It
 * implements the minimal interface the plugin drives — configure() on
 * subscribe, update() after every tracked event — and re-opens the SSE whenever
 * the session id changes. Received interventions are handed to the plugin's
 * `dispatch`, preserving handler routing and the built-in measurement events.
 *
 * NOTE: if your intervention is keyed on domain_userid (a known/warehouse
 * identity) rather than the session, drop this custom fetcher and use the
 * plugin default.
 */
const sessionOnlyFetcher: FetcherFactory = (tracker, dispatch): Fetcher => {
  let endpoint = '';
  let sessionId = '';
  let source: EventSource | null = null;

  const openStream = (): void => {
    if (!endpoint || !sessionId || typeof EventSource === 'undefined') return;
    source?.close();
    const url = `${endpoint}?domain_sessionid=${encodeURIComponent(sessionId)}`;
    const stream = new EventSource(url);
    stream.addEventListener('message', (ev: MessageEvent) => {
      try {
        dispatch(JSON.parse(ev.data) as Intervention, tracker);
      } catch {
        /* ignore a malformed SSE frame */
      }
    });
    source = stream;
  };

  const syncSession = (): void => {
    const sid = getDomainSessionId(TRACKER_NAMESPACE);
    if (sid && sid !== sessionId) {
      sessionId = sid;
      openStream();
    }
  };

  return {
    configure({ endpoint: ep, apiPath }: SignalsInterventionConfiguration): void {
      const base = /\/\//.test(ep) ? ep : `https://${ep}`;
      endpoint = `${base}${apiPath ?? DEFAULT_INTERVENTIONS_PATH}`;
      sessionId = ''; // force a fresh connection against this endpoint
      syncSession();
    },
    update(): void {
      syncSession();
    },
  };
};

// ─── Tracker initialization ─────────────────────────────────────────────────

let isInitialized = false;
// Held so we can read identity off the tracker instance (getDomainUserId is an
// instance method in this browser-tracker version, not a top-level export).
let tracker: BrowserTracker | null | undefined;

export function initializeSnowplow(): void {
  if (isInitialized || typeof window === 'undefined') return;

  tracker = newTracker(TRACKER_NAMESPACE, COLLECTOR_ENDPOINT, {
    appId: snowplow.appId, // From config.ts (demo-spec.json)
    appVersion: '1.0.0',
    cookieSameSite: 'Lax',
    eventMethod: 'post',
    bufferSize: 1, // Send immediately (demo, not production)
    contexts: { webPage: true }, // Required for event-to-page-view joins
    plugins: [
      LinkClickTrackingPlugin(),
      EnhancedConsentPlugin(),
      SnowplowMediaPlugin(),
      YouTubeTrackingPlugin(),
      // Standard Snowplow ecommerce plugin — the five CDI ecommerce events in
      // the "Grocery Shopping Journey" tracking plan run through it (see
      // src/lib/tracking.ts and the Snowtype output in src/snowtype/).
      SnowplowEcommercePlugin(),
      SignalsPlugin({ fetcher: sessionOnlyFetcher }),
    ],
    crossDomainLinker: function (
      linkElement: HTMLAnchorElement | HTMLAreaElement
    ) {
      return linkElement.hostname === 'snowplow.io';
    },
  });

  // Activity tracking MUST be enabled before the first trackPageView().
  enableActivityTracking({ minimumVisitLength: 20, heartbeatDelay: 10 });
  enableLinkClickTracking({ trackContent: true });
  // Enable cross-domain linking for dynamically added links (same criterion
  // as the newTracker config): decorate snowplow.io links with the _sp param.
  crossDomainLinker((linkElement) => linkElement.hostname === 'snowplow.io');

  // Check initial consent state — default to anonymous if analytics not granted.
  const preferences = getConsentPreferences();
  if (!preferences || !preferences.analytics) {
    enableAnonymousTracking({
      options: { withServerAnonymisation: true, withSessionTracking: true },
    });
  }

  // Register Signals intervention handlers at init. The actual subscription is
  // deferred to connectToSignals() (called after the first page view, once
  // domain_sessionid exists) — see trackPageViewEvent.
  suppressBenignTrackerNoise();
  registerSignalsHandlers();

  isInitialized = true;
}

// ─── Signals interventions (push handler + presenter trigger) ────────────────

let signalsConnected = false;

type FiredStore = { sid: string; fired: Record<string, FiredIntervention> };

/** This session's fired interventions (a record from an older domain session
 *  in the same tab is ignored). */
function readFired(): Record<string, FiredIntervention> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(INTERVENTION_STORAGE_KEY);
    const store = raw ? (JSON.parse(raw) as FiredStore) : null;
    const sid = getDomainSessionId(TRACKER_NAMESPACE) ?? '';
    return store && (!sid || store.sid === sid) ? store.fired ?? {} : {};
  } catch {
    return {};
  }
}

function recordFired(entry: FiredIntervention): void {
  const fired = { ...readFired(), [entry.name]: entry };
  try {
    window.sessionStorage.setItem(
      INTERVENTION_STORAGE_KEY,
      JSON.stringify({ sid: getDomainSessionId(TRACKER_NAMESPACE) ?? '', fired })
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(INTERVENTION_EVENT, { detail: entry }));
}

/**
 * Register the intervention handler. The plugin calls EVERY registered handler
 * for EVERY received intervention, so we filter on the configured names.
 * Signals has no once-per-session setting, so the app dedupes: an
 * intervention name that already fired this session (or a repeat
 * `intervention_id`) is ignored.
 */
function registerSignalsHandlers(): void {
  if (!(siteConfig.features.signals && isSignalsEnabled())) return;
  try {
    addInterventionHandlers({
      intervention(intervention: Intervention) {
        if (typeof window === 'undefined') return;
        if (!siteConfig.features.interventions) return; // WIP — disabled
        if (!INTERVENTION_NAMES.includes(intervention.name)) return;
        const prior = readFired()[intervention.name];
        if (prior) return; // once per session per intervention
        recordFired({
          name: intervention.name,
          source: 'signals',
          intervention,
          at: Date.now(),
        });
      },
    });
  } catch {
    /* Signals plugin may be unavailable — tracking continues regardless. */
  }
}

/**
 * Subscribe to the intervention SSE, scoped to `domain_sessionid` only via the
 * `sessionOnlyFetcher`.
 */
export function connectToSignals(): void {
  if (signalsConnected) return;
  if (!(siteConfig.features.signals && isSignalsEnabled() && SIGNALS_ENDPOINT)) {
    return;
  }
  signalsConnected = true;
  try {
    subscribeToInterventions({ endpoint: SIGNALS_ENDPOINT });
  } catch {
    /* Signals endpoint may be unreachable in a local demo — tracking continues. */
  }
}

/** Interventions that fired this session, keyed by name. */
export function getFiredInterventions(): Record<string, FiredIntervention> {
  if (!isSignalsEnabled()) return {};
  return readFired();
}

/**
 * Presenter override: fire an intervention on demand (Inspector button),
 * through the same sessionStorage + CustomEvent contract as the push handler.
 * An explicit trigger overrides once-per-session.
 */
export function triggerIntervention(name: string): void {
  if (typeof window === 'undefined') return;
  if (!siteConfig.features.interventions) return;
  recordFired({ name, source: 'inspector', at: Date.now() });
}

/** Clear every recorded intervention and notify listeners (presenter Clear). */
export function clearIntervention(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(INTERVENTION_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(INTERVENTION_CLEARED_EVENT));
}

// ─── Page view tracking ─────────────────────────────────────────────────────

export function trackPageViewEvent(): void {
  trackPageView();
  cleanUpSpParam();
  // Subscribe to interventions after the first page view, so domain_sessionid
  // is populated before the SSE opens (guarded to run once).
  connectToSignals();
}

/**
 * Remove the _sp cross-domain parameter from the URL after tracking.
 * Prevents accidental sharing of domain_userid via copied URLs.
 */
function cleanUpSpParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.has('_sp')) {
    url.searchParams.delete('_sp');
    window.history.replaceState({}, '', url.toString());
  }
}

// ─── User identity ──────────────────────────────────────────────────────────

export function setUserForTracking(email: string): void {
  setUserId(email);
}

export function clearUserForTracking(): void {
  setUserId(null as unknown as string);
}

// ─── Session management ─────────────────────────────────────────────────────

export function resetSession(): void {
  newSession();
}

/**
 * Wipe the visitor's identity from the tracker: clears both the
 * `domain_userid` and the `domain_sessionid` (and their cookies), forcing a
 * brand-new anonymous visitor on the next event.
 */
export function clearAllUserData(): void {
  clearUserData({ preserveSession: false, preserveUser: false });
}

// ─── Consent tracking ───────────────────────────────────────────────────────

const consentBasePayload = () => ({
  basisForProcessing: 'consent' as const,
  consentUrl: window.location.origin + '/privacy-policy',
  consentVersion: '1.0',
  domainsApplied: [window.location.hostname],
  gdprApplies: true,
});

export function trackConsentAllowEvent(scopes: string[]): void {
  trackConsentAllow({ ...consentBasePayload(), consentScopes: scopes });
}

export function trackConsentDenyEvent(scopes: string[]): void {
  trackConsentDeny({ ...consentBasePayload(), consentScopes: scopes });
}

export function trackConsentSelectedEvent(scopes: string[]): void {
  trackConsentSelected({ ...consentBasePayload(), consentScopes: scopes });
}

export function trackCmpVisibleEvent(): void {
  trackCmpVisible({ elapsedTime: performance.now() });
}

// ─── Anonymous tracking ─────────────────────────────────────────────────────

export function enableAnonymousMode(): void {
  enableAnonymousTracking({
    options: { withServerAnonymisation: true, withSessionTracking: true },
  });
}

export function disableAnonymousMode(): void {
  disableAnonymousTracking();
}

// ─── Video tracking ─────────────────────────────────────────────────────────

export { startYouTubeTracking, endYouTubeTracking };

// ─── Identity accessors (Signals Inspector) ──────────────────────────────────

/** Current domain_sessionid — the key the session Signals group is keyed on. */
export function getSessionId(): string | undefined {
  return getDomainSessionId(TRACKER_NAMESPACE);
}

/** Current domain_userid — used to key the (batch) user-scoped retrieval. */
export function getUserId(): string | undefined {
  return tracker?.getDomainUserId() || undefined;
}
