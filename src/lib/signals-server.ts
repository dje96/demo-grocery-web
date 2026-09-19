/**
 * Server-only Snowplow Signals retrieval.
 *
 * Reads the current session's attributes from the Signals Profiles Store via
 * the session service (config: siteConfig.snowplow.signalsService), keyed by
 * domain_sessionid, and resolves snowplow_id via the shared id service. Powers
 * the presenter-only Signals Inspector (see src/components/SignalsInspector.tsx
 * and src/app/api/signals/route.ts). All credentials stay on the server — this
 * module must never be imported from client code.
 */

import 'server-only';
import { Signals } from '@snowplow/signals-node';

import { siteConfig } from './config';

const { snowplow } = siteConfig;

function readClient(): Signals | null {
  // Accept either env name — the tracker template uses SIGNALS_API_URL while
  // some server code expects SNOWPLOW_SIGNALS_API_URL.
  const baseUrl =
    process.env.SNOWPLOW_SIGNALS_API_URL ?? process.env.SIGNALS_API_URL;
  const apiKey = process.env.SNOWPLOW_CONSOLE_API_KEY;
  const apiKeyId = process.env.SNOWPLOW_CONSOLE_API_KEY_ID;
  const organizationId = process.env.SNOWPLOW_CONSOLE_ORG_ID;
  if (!baseUrl || !apiKey || !apiKeyId || !organizationId) return null;
  return new Signals({ baseUrl, apiKey, apiKeyId, organizationId });
}

/** True when all Signals credentials/URL are present in the environment. */
export function isSignalsConfigured(): boolean {
  return readClient() !== null;
}

/**
 * Fetch the full, un-normalized set of attributes the session service returns
 * for a session — every attribute in the group, exactly as served. The
 * inspector renders them generically. Returns null when Signals is unconfigured
 * or unreachable.
 */
export async function getRawSessionAttributes(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const client = readClient();
  if (!client) return null;
  try {
    return (await client.getServiceAttributes({
      name: snowplow.signalsService,
      attribute_key: snowplow.signalsAttributeKey,
      identifier: sessionId,
    })) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Fetch batch (warehouse) attributes from a real Signals batch service for the
 * Inspector's "Warehouse" tab. Only used when siteConfig.warehouse.source ===
 * "service"; the identifier is resolved from the configured attribute key by the
 * caller (api/signals). Returns null when Signals/the warehouse service is
 * unconfigured or unreachable.
 */
export async function getWarehouseAttributes(
  identifier: string
): Promise<Record<string, unknown> | null> {
  const client = readClient();
  const service = siteConfig.warehouse.service;
  if (!client || !service || !identifier) return null;
  try {
    return (await client.getServiceAttributes({
      name: service,
      attribute_key: siteConfig.warehouse.attributeKey,
      identifier,
    })) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the current snowplow_id for a browser via the shared `snowplow_id_retrieval`
 * service (attribute group `last_snowplow_id`), keyed by domain_userid. The service
 * serves a `snowplow_id` attribute derived from the pipeline's identity entity, so a
 * value only appears once that entity is on events. Returns null when Signals is
 * unconfigured, the identifier is missing, or no snowplow_id has been computed yet.
 */
export async function getSnowplowId(
  domainUserid: string
): Promise<string | null> {
  const client = readClient();
  if (!client || !domainUserid) return null;
  try {
    const attrs = (await client.getServiceAttributes({
      name: snowplow.idService,
      attribute_key: snowplow.idAttributeKey,
      identifier: domainUserid,
    })) as Record<string, unknown>;
    // The attribute may arrive wrapped in a single-element array.
    const raw = attrs?.snowplow_id;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value == null || value === '' ? null : String(value);
  } catch {
    return null;
  }
}

/**
 * Result of reading the session service for the Intent panel. The three cases
 * are deliberately distinguishable, because a brand-new session legitimately
 * has no attributes yet and that is NOT an error:
 *
 *   • `unconfigured` — Signals credentials / host missing from the environment.
 *   • `unreachable`  — the Signals API errored or timed out.
 *   • `ok`           — a response came back. `attributes` may still be empty
 *                      (or all-null) for a session that has not produced any
 *                      qualifying events yet; `isEmpty` says which.
 */
export type SessionAttributesResult =
  | { status: 'unconfigured' }
  | { status: 'unreachable'; message: string }
  | {
      status: 'ok';
      attributes: Record<string, unknown>;
      isEmpty: boolean;
      service: string;
      attributeKey: string;
    };

/** True when every attribute is null/undefined/empty-list — i.e. nothing has
 *  landed in the profile store for this session yet. */
function allEmpty(attributes: Record<string, unknown>): boolean {
  return Object.values(attributes).every((raw) => {
    // Signals wraps every served value in a single-element array — an unset
    // attribute arrives as `[null]`, a list as `[[...]]`. Unwrap before judging.
    const v = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    if (typeof v === 'string') return v.trim() === '';
    if (typeof v === 'number') return v === 0;
    return false;
  });
}

/**
 * Read the demo's session service (siteConfig.snowplow.signalsService —
 * `demo_grocery`, bundling `demo_ecom_plugin_session` v5) for one
 * domain_sessionid. This is the Jev state source for /api/intent.
 */
export async function getSessionAttributesForIntent(
  sessionId: string
): Promise<SessionAttributesResult> {
  const client = readClient();
  if (!client) return { status: 'unconfigured' };
  if (!sessionId) {
    return {
      status: 'ok',
      attributes: {},
      isEmpty: true,
      service: snowplow.signalsService,
      attributeKey: snowplow.signalsAttributeKey,
    };
  }
  try {
    const attributes = (await client.getServiceAttributes({
      name: snowplow.signalsService,
      attribute_key: snowplow.signalsAttributeKey,
      identifier: sessionId,
    })) as Record<string, unknown>;
    const attrs = attributes ?? {};
    return {
      status: 'ok',
      attributes: attrs,
      isEmpty: Object.keys(attrs).length === 0 || allEmpty(attrs),
      service: snowplow.signalsService,
      attributeKey: snowplow.signalsAttributeKey,
    };
  } catch (error) {
    return {
      status: 'unreachable',
      message: error instanceof Error ? error.message : 'Signals request failed.',
    };
  }
}
