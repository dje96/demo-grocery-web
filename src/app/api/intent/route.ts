/**
 * Presenter-only purchase-intent endpoint — TypeSafe (Jev).
 *
 * The Signals Inspector's "Intent" tab asks for a semantic read on what the
 * shopper is doing. The principle:
 *
 *     Signals serves facts · code applies policy · Jev reads meaning.
 *
 * and each label drives an action — stage = when / how hard to intervene,
 * occasion = what to show, persona = how to frame it (or filter).
 *
 * The state is built HERE, on the server, from real Snowplow Signals data:
 *
 *     service `demo_grocery` → attribute group `demo_ecom_plugin_session`
 *     (v7; v8 adds cart_brands / cart_categories / cart_removed_names), plus
 *     the Event Log `grocery_agentic_context` narrative — keyed on
 *     domain_sessionid (siteConfig.snowplow).
 *
 * Questions, the state builder and the policy (gates, overrides, headline,
 * suggested actions) live in src/lib/intent.ts so scripts/eval-intent.ts runs
 * the SAME code over fixtures. This route only fetches, calls and responds.
 *
 * The client posts its `sessionId` plus two counters Signals does not carry
 * (page count, session start). Those, and every Signals count/total, go back
 * as `metrics` for the panel — they are NEVER in the Jev state.
 *
 * GRACEFUL DEGRADATION — distinguishable, non-error states:
 *   • `configured: false`             → no TypeSafe key.
 *   • `source_status: "unconfigured"` → Signals credentials / host missing.
 *   • `source_status: "unreachable"`  → Signals errored or timed out.
 *   • `source_status: "empty"`        → Signals answered but this session has
 *                                       nothing to read yet (brand-new session,
 *                                       or only page views/pings). NOT an error;
 *                                       Jev is not called.
 *   • `source_status: "live"`         → a real classification.
 *   • `source_status: "error"`        → the TypeSafe call itself failed.
 *
 * Credentials stay server-side. The TypeSafe key is read from TYPESAFE_API_KEY
 * and passed explicitly to the client.
 */

import { NextRequest } from 'next/server';
import { TypeSafeClient } from '@typesafe-ai/sdk';

import {
  getSessionAttributesForIntent,
  getAgenticContext,
} from '@/lib/signals-server';
import {
  buildIntentInputs,
  evaluateIntent,
  hasAnyEvidence,
  type IntentMetrics,
  type IntentPolicyResult,
  type JevState,
} from '@/lib/intent';

export const dynamic = 'force-dynamic';

interface IntentSuccess extends IntentPolicyResult {
  configured: true;
  source: 'signals';
  source_status: 'live';
  /** The Signals service the state was read from. */
  service: string;
  /** The raw Signals attributes the state was built from, for the presenter. */
  attributes: Record<string, unknown>;
  model: string;
  /** Counts, totals, delivery maths — panel display only, never sent to Jev. */
  metrics: IntentMetrics;
  /** Echoed back so the panel can show exactly what Jev saw. */
  state: JevState;
  /** The Agentic Context narrative Jev read, when the buffer had events. */
  session_timeline?: string;
  usage: { input_tokens: number; output_tokens: number };
  evaluated_at: string;
}

export async function POST(request: NextRequest) {
  // TYPESAFE_API_KEY is the @typesafe-ai/sdk's own default env name. The key is
  // resolved here and handed to the client explicitly, so the route never
  // depends on the SDK's env lookup. A placeholder value (the `[YOUR-…]` in
  // .env.example) counts as unset, so a freshly cloned demo degrades to "not
  // configured" rather than failing with a 401 from TypeSafe.
  const apiKey = (process.env.TYPESAFE_API_KEY ?? '').trim();
  if (!apiKey || apiKey.startsWith('[')) {
    return Response.json({
      configured: false,
      error:
        'TYPESAFE_API_KEY is not set. Add it to .env to enable the Intent tab.',
    });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: string;
    pageCount?: number;
    sessionStartedAt?: number;
  } | null;

  if (!body || typeof body !== 'object') {
    return Response.json(
      { configured: true, error: 'Expected a JSON request body.' },
      { status: 400 }
    );
  }

  const source = 'signals' as const;
  const sessionId = body.sessionId ?? '';

  // Client counters Signals does not carry — display-only metrics.
  const pageCount = Number.isFinite(body.pageCount) ? Number(body.pageCount) : 0;
  const durationMinutes = body.sessionStartedAt
    ? Math.max(0, Math.round((Date.now() - Number(body.sessionStartedAt)) / 60000))
    : 0;

  const result = await getSessionAttributesForIntent(sessionId);

  if (result.status === 'unconfigured') {
    return Response.json({
      configured: true,
      source,
      source_status: 'unconfigured',
      message:
        'Signals is not configured on the server (SIGNALS_API_URL + Console API key).',
    });
  }

  if (result.status === 'unreachable') {
    return Response.json({
      configured: true,
      source,
      source_status: 'unreachable',
      message: `Could not read the Signals service: ${result.message}`,
    });
  }

  const emptyResponse = () =>
    Response.json({
      configured: true,
      source,
      source_status: 'empty',
      service: result.service,
      attribute_key: result.attributeKey,
      session_id: sessionId || null,
      message:
        'No session data yet. Signals answered for this domain_sessionid but there is nothing to read — browse a product, search, or add something to the basket, then re-evaluate.',
    });

  // A brand-new session legitimately has nothing in the profile store yet.
  if (result.isEmpty) return emptyResponse();

  // Additive temporal evidence: the Agentic Context narrative. Null when the
  // buffer is empty or the Event Log is unpublished — the read then falls
  // back to attributes alone, so this can never break the classification.
  const timeline = await getAgenticContext(sessionId);
  const inputs = buildIntentInputs(result.attributes, timeline, {
    pageCount,
    durationMinutes,
  });

  // Attributes present but no views, searches or adds (only page pings, say):
  // nothing semantic for Jev to read, so don't spend tokens.
  if (!hasAnyEvidence(inputs.evidence)) return emptyResponse();

  try {
    const client = new TypeSafeClient({ apiKey });
    const evaluation = await evaluateIntent(client, inputs, { timeout: 25_000 });

    const payload: IntentSuccess = {
      configured: true,
      source,
      source_status: 'live',
      service: result.service,
      attributes: result.attributes,
      ...evaluation,
      metrics: inputs.metrics,
      state: inputs.state,
      ...(inputs.state.session_timeline
        ? { session_timeline: inputs.state.session_timeline }
        : {}),
      evaluated_at: new Date().toISOString(),
    };

    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown TypeSafe error.';
    console.error('TypeSafe intent evaluation failed', error);
    return Response.json(
      { configured: true, source, source_status: 'error', error: message },
      { status: 502 }
    );
  }
}
