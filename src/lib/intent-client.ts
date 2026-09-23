/**
 * Client-side intent store — the ONE place the browser calls /api/intent.
 *
 * Phase 2 ("acting on intent"): the Jev read is no longer presenter-only. The
 * shopper's own actions schedule a read, the result is shared by everything
 * that needs it, and each meaningful change is tracked to Snowplow:
 *
 *   add / remove / search  →  debounce 3s (let Signals catch up)  →  /api/intent
 *     → store the result (Signals Inspector + InterventionBanner read it)
 *     → track `classify_intent` if the (stage, occasion, persona_primary,
 *       plant_based_filter) tuple changed since the last one tracked this session
 *   Inspector refresh      →  /api/intent immediately, ALWAYS tracked
 *
 * Every read is gated on `isSignalsEnabled()` (the presenter's personalization
 * toggle) and `siteConfig.features.intent`. A non-`live` response (empty
 * session, unconfigured, error) is stored for the Inspector but never tracked.
 *
 * Framework-free module store + `useIntent()` (useSyncExternalStore), so the
 * ShopProvider, tracking.ts and components share one result without a context.
 */

import { useSyncExternalStore } from 'react';

import { siteConfig } from './config';
import { isSignalsEnabled } from './consent';
import { getSessionId } from './snowplow-config';
import { trackClassifyIntentEvent, type IntentTrigger } from './tracking';
import type {
  Occasion,
  PersonaPrimary,
  ShopperIntent,
  Stage,
} from '@/snowtype/snowplow';

export type { IntentTrigger };

/** Shape returned by /api/intent (see that route + src/lib/intent.ts). */
export interface IntentResult {
  configured: boolean;
  source?: 'signals';
  /**
   * Why the panel looks the way it does. `live` is a real classification;
   * `empty` means Signals answered but this session has no attributes yet
   * (normal for a new session, NOT an error); the others are genuine problems.
   */
  source_status?: 'live' | 'empty' | 'unconfigured' | 'unreachable' | 'error';
  service?: string;
  attribute_key?: string;
  session_id?: string | null;
  /** Human-readable explanation for the non-`live` statuses. */
  message?: string;
  attributes?: Record<string, unknown>;
  error?: string;
  model?: string;
  /** Derived in code from Signals (deriveStage) — no Jev, no confidence. */
  stage?: {
    label: string;
    /** The rule that fired, in words. */
    rule: string;
    enough_signal: boolean;
    action: string | null;
  };
  occasion?: {
    label: string;
    jev_choice: string;
    restock_split: 'weekly' | 'top_up' | null;
    confidence: number;
    probabilities: Record<string, number>;
    enough_signal: boolean;
    action: string | null;
  };
  persona?: {
    label: string;
    headline: string;
    confidence: number;
    traits: Record<string, number>;
    active: string[];
    plant_based: { probability: number; active: boolean };
    enough_signal: boolean;
    action: string | null;
    filter: string | null;
  };
  /** Counts / totals for display — never part of the Jev state. */
  metrics?: Record<string, number>;
  state?: unknown;
  /** Ordered session narrative from the Signals Event Log (Agentic Context)
   *  that Jev read as `session_timeline`. Absent when the buffer was empty. */
  session_timeline?: string;
  usage?: { input_tokens: number; output_tokens: number };
  evaluated_at?: string;
}

// ─── Result → shopper_intent entity ──────────────────────────────────────────

const STAGES: readonly Stage[] = [
  // 'comparing' stays in the schema enum but is never produced.
  'browsing', 'on_a_mission', 'ready_to_buy', 'hesitating',
  'checking_out', 'purchased', 'not_enough_signal',
];
const OCCASIONS: readonly Occasion[] = [
  'restock_weekly', 'restock_top_up', 'meal', 'event', 'unclear', 'not_enough_signal',
];
const PERSONAS: readonly PersonaPrimary[] = [
  // 'foodie_explorer' stays in the schema enum but is never produced.
  'budget_driven', 'health_conscious', 'convenience_seeking', 'generalist', 'not_enough_signal',
];

function oneOf<T extends string>(list: readonly T[], v: string | undefined): T {
  return list.includes(v as T) ? (v as T) : ('not_enough_signal' as T);
}

/** Clamp to the schema's 0–1 range; undefined → null. */
function prob(n: number | undefined): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

/**
 * The labels the UI acts on, AFTER code policy. A label whose evidence gate
 * failed is `not_enough_signal` — the same thing the Inspector shows.
 */
export function toShopperIntent(r: IntentResult): ShopperIntent | null {
  if (r.source_status !== 'live' || !r.stage || !r.occasion || !r.persona) return null;
  const { stage, occasion, persona } = r;
  const occasionLabel = !occasion.enough_signal
    ? 'not_enough_signal'
    : occasion.restock_split
      ? `restock_${occasion.restock_split}`
      : occasion.jev_choice;
  return {
    stage: oneOf(STAGES, stage.enough_signal ? stage.label : undefined),
    occasion: oneOf(OCCASIONS, occasionLabel),
    persona_primary: oneOf(PERSONAS, persona.enough_signal ? persona.label : undefined),
    // Stage is code rules now: no model pick, no confidence.
    stage_model_choice: null,
    stage_confidence: null,
    occasion_confidence: prob(occasion.confidence),
    plant_based_filter: persona.enough_signal && persona.plant_based.active,
    budget_driven_probability: prob(persona.traits.budget_driven),
    health_conscious_probability: prob(persona.traits.health_conscious),
    convenience_seeking_probability: prob(persona.traits.convenience_seeking),
    foodie_explorer_probability: null, // trait retired
    plant_based_probability: prob(persona.plant_based.probability),
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface IntentSnapshot {
  result: IntentResult | null;
  /** The acted-on labels of `result`, when it was a live read. */
  intent: ShopperIntent | null;
  loading: boolean;
}

let snapshot: IntentSnapshot = { result: null, intent: null, loading: false };
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT: IntentSnapshot = { result: null, intent: null, loading: false };

function set(next: Partial<IntentSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Latest intent read + loading flag, shared app-wide. */
export function useIntent(): IntentSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

/** Non-React accessor (the intervention handler's fallback for copy). */
export function getLatestIntent(): ShopperIntent | null {
  return snapshot.intent;
}

// ─── Activity counters (registered by ShopProvider) ──────────────────────────

type MetaSource = () => { pageCount: number; startedAt: number };
let metaSource: MetaSource | null = null;

/** ShopProvider hands over its page-count / session-start getter. */
export function setIntentMetaSource(source: MetaSource | null): void {
  metaSource = source;
}

// ─── Change dedupe (per session) ─────────────────────────────────────────────

const LAST_TRACKED_KEY = 'intent-last-tracked';

function tupleOf(i: ShopperIntent): string {
  return [i.stage, i.occasion, i.persona_primary, i.plant_based_filter ? 1 : 0].join('|');
}

/** Tuple last tracked, scoped to the current domain_sessionid. */
function lastTracked(sessionId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_TRACKED_KEY);
    const parsed = raw ? (JSON.parse(raw) as { sid: string; tuple: string }) : null;
    return parsed?.sid === sessionId ? parsed.tuple : null;
  } catch {
    return null;
  }
}

function rememberTracked(sessionId: string, tuple: string): void {
  try {
    window.sessionStorage.setItem(LAST_TRACKED_KEY, JSON.stringify({ sid: sessionId, tuple }));
  } catch {
    /* private mode — worst case we re-track an unchanged tuple */
  }
}

function newInvocationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC4122-ish v4 fallback for old browsers / insecure origins.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

function enabled(): boolean {
  return typeof window !== 'undefined' && siteConfig.features.intent && isSignalsEnabled();
}

/**
 * One /api/intent round trip, stored and (if warranted) tracked.
 * `inspector` reads always track; behavioural triggers track on change only.
 */
export async function classifyIntent(trigger: IntentTrigger): Promise<IntentResult | null> {
  if (!enabled()) return null;
  const sessionId = getSessionId() ?? '';
  const meta = metaSource?.() ?? { pageCount: 0, startedAt: Date.now() };
  set({ loading: true });
  const started = performance.now();
  let result: IntentResult;
  try {
    const res = await fetch('/api/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // The server reads everything semantic from Signals for this session.
        // Only the two counters Signals does not carry are sent from here.
        sessionId: sessionId || null,
        pageCount: meta.pageCount,
        sessionStartedAt: meta.startedAt,
      }),
    });
    result = (await res.json()) as IntentResult;
  } catch (e) {
    console.error('Intent evaluation failed', e);
    result = {
      configured: true,
      source: 'signals',
      source_status: 'error',
      error: 'Could not reach /api/intent.',
    };
  }
  const latencyMs = Math.round(performance.now() - started);
  const intent = toShopperIntent(result);
  set({ result, intent: intent ?? snapshot.intent, loading: false });

  if (intent && sessionId && isSignalsEnabled()) {
    const tuple = tupleOf(intent);
    if (trigger === 'inspector' || tuple !== lastTracked(sessionId)) {
      trackClassifyIntentEvent({
        trigger,
        latencyMs,
        intent,
        agent: {
          type: 'intent_classifier',
          model_name: result.model ?? 'jev',
          model_provider: 'typesafe',
          invocation_id: newInvocationId(),
          application_version: 'intent-v2',
        },
      });
      rememberTracked(sessionId, tuple);
    }
  }
  return result;
}

/** Debounce window: long enough for Signals to process the triggering event. */
const DEBOUNCE_MS = 3000;
let timer: ReturnType<typeof setTimeout> | null = null;
let pendingTrigger: IntentTrigger | null = null;

/**
 * Schedule a read after a shopper action. Bursts collapse into one call; the
 * LAST trigger in the burst is the one recorded.
 */
export function scheduleIntentRead(trigger: Exclude<IntentTrigger, 'inspector'>): void {
  if (!enabled()) return;
  pendingTrigger = trigger;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const t = pendingTrigger;
    pendingTrigger = null;
    if (t) void classifyIntent(t);
  }, DEBOUNCE_MS);
}
