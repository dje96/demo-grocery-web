'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronRight,
  Database,
  Fingerprint,
  Gauge,
  Lock,
  RefreshCw,
  Wifi,
  X,
  Zap,
} from 'lucide-react';

import {
  getFiredInterventions,
  getSessionId,
  getUserId,
  triggerIntervention,
  clearIntervention,
  INTERVENTION_EVENT,
  INTERVENTION_CLEARED_EVENT,
  type FiredIntervention,
} from '@/lib/snowplow-config';
import { intentPolicy, siteConfig } from '@/lib/config';
import { classifyIntent, useIntent, type IntentResult } from '@/lib/intent-client';
import { useUser } from '@/contexts/user-context';

/* ---------------------------------------------------------------------------
 * Presenter-only panel that visualizes the live Snowplow Signals state for the
 * current session. Layout, top → bottom:
 *
 *   • Identities   — snowplow_id / domain_userid / user_id (persists across tabs)
 *   • Stream | Warehouse tabs:
 *       - Stream    — real-time attributes from the session service
 *       - Warehouse — batch attributes. Two sources (siteConfig.warehouse):
 *           · "service" → a real Signals batch service (always clickable)
 *           · "mock"    → siteConfig.warehouse.mockAttributes. When
 *             warehouse.identityGate is true the tab stays greyed/locked until
 *             the resolved snowplow_id equals NEXT_PUBLIC_WAREHOUSE_UNLOCK_SNOWPLOW_ID,
 *             mimicking "batch attrs appear once Snowplow Identity resolves".
 *   • Intent (3rd tab) — a purchase-intent read from TypeSafe's Jev model,
 *     served by /api/intent, whose state is built server-side from the LIVE
 *     Signals `demo_grocery` service. The read is SHARED with the site
 *     (src/lib/intent-client.ts): shopper actions schedule debounced reads,
 *     and this tab shows the latest one — fetching only when there is none
 *     yet, or on an explicit "re-evaluate" (trigger `inspector`, always
 *     tracked as classify_intent). Never polled: each call costs tokens.
 *   • Interventions — the two phase-2 interventions (siteConfig.snowplow.interventions)
 *     with their Signals rule, whether each fired this session, and a manual
 *     trigger per intervention (persists across tabs)
 *
 * Visible to demo presenters only — polls /api/signals every few seconds while
 * open.
 * ------------------------------------------------------------------------- */

const POLL_MS = 4000;

// Mock-mode identity gate: the snowplow_id that unlocks the Warehouse tab. See
// .env.example / siteConfig.warehouse. Empty ⇒ tab stays locked in gated mode.
const WAREHOUSE_UNLOCK_ID =
  process.env.NEXT_PUBLIC_WAREHOUSE_UNLOCK_SNOWPLOW_ID ?? '';

type SignalsAttributes = Record<string, unknown>;
type WarehouseTab = 'stream' | 'warehouse' | 'intent';

const pct = (n: number): string => `${Math.round(n * 100)}%`;

// ─── Value formatting ─────────────────────────────────────────────────────────

function fmtList(v: unknown[]): string {
  if (v.length === 0) return '—';
  return v.length <= 3 ? v.map(String).join(', ') : `${v.length} items`;
}

function fmtDict(v: Record<string, unknown>): string {
  const entries = Object.entries(v);
  if (entries.length === 0) return '—';
  return entries.map(([k, n]) => `${k}: ${n}`).join(', ');
}

function fmtValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return fmtList(v);
  if (typeof v === 'object') return fmtDict(v as Record<string, unknown>);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

/** Fired-this-session map, kept live via the intervention CustomEvents. */
function useFiredInterventions(): Record<string, FiredIntervention> {
  const [fired, setFired] = useState<Record<string, FiredIntervention>>({});
  useEffect(() => {
    const sync = () => setFired(getFiredInterventions());
    sync();
    window.addEventListener(INTERVENTION_EVENT, sync);
    window.addEventListener(INTERVENTION_CLEARED_EVENT, sync);
    return () => {
      window.removeEventListener(INTERVENTION_EVENT, sync);
      window.removeEventListener(INTERVENTION_CLEARED_EVENT, sync);
    };
  }, []);
  return fired;
}

export default function SignalsInspector() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WarehouseTab>('stream');
  const [attrs, setAttrs] = useState<SignalsAttributes | null>(null);
  const [warehouseAttrs, setWarehouseAttrs] =
    useState<SignalsAttributes | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [domainUserid, setDomainUserid] = useState<string | null>(null);
  const [snowplowId, setSnowplowId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [configured, setConfigured] = useState<boolean>(true);
  const { result: intent, loading: intentLoading } = useIntent();
  const [stateOpen, setStateOpen] = useState(false);
  const intentFetchedRef = useRef(false);
  const fired = useFiredInterventions();

  const { user } = useUser();
  const currentEmail = user?.email ?? null;

  const fetchAttributes = useCallback(async () => {
    const sid = getSessionId();
    if (!sid) return;
    setSessionId(sid);
    const duid = getUserId() ?? null;
    setDomainUserid(duid);

    // Mirror the live login state — user_id clears the moment the user logs out.
    setUserId(currentEmail);

    try {
      setLoading(true);
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          domainUserid: duid,
          userId: currentEmail,
        }),
      });
      const data = await res.json();
      if (typeof data?.meta?.signals_configured === 'boolean') {
        setConfigured(data.meta.signals_configured);
      }
      setSnowplowId(
        typeof data?.snowplow_id === 'string' ? data.snowplow_id : null
      );
      setWarehouseAttrs(
        data?.warehouse_attributes && typeof data.warehouse_attributes === 'object'
          ? data.warehouse_attributes
          : null
      );
      if (data.success && data.attributes) {
        setAttrs(data.attributes);
        setSyncedAt(Date.now());
      }
    } catch (e) {
      console.error('Signals inspector fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [currentEmail]);

  /** Presenter refresh — an immediate read, always tracked (`inspector`). */
  const fetchIntent = useCallback(() => {
    void classifyIntent('inspector');
  }, []);

  // Poll only while open.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAttributes();
    const id = setInterval(fetchAttributes, POLL_MS);
    return () => clearInterval(id);
  }, [open, fetchAttributes]);

  // Keep the "synced Ns ago" badge ticking while open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const rows = attrs ? Object.entries(attrs) : [];
  const hasData = rows.length > 0 || !!sessionId;
  const interventions = siteConfig.snowplow.interventions;
  const intentAttrKeys = siteConfig.snowplow.intentAttributes;

  // ─── Warehouse (batch) tab gating ─────────────────────────────────────────
  const warehouse = siteConfig.warehouse;
  const warehouseEnabled = siteConfig.features.warehouse;
  // Real service ⇒ always clickable (gate ignored). Mock ⇒ honor identityGate:
  // unlock only when the resolved snowplow_id exactly matches the env value.
  const warehouseUnlocked =
    warehouse.source === 'service'
      ? true
      : !warehouse.identityGate
        ? true
        : !!WAREHOUSE_UNLOCK_ID && snowplowId === WAREHOUSE_UNLOCK_ID;
  const intentEnabled = siteConfig.features.intent;
  // Fall back to Stream if the warehouse tab is selected but (re)locked, or if
  // the intent tab is selected but the feature has been turned off.
  const effectiveTab: WarehouseTab =
    activeTab === 'warehouse' && warehouseUnlocked
      ? 'warehouse'
      : activeTab === 'intent' && intentEnabled
        ? 'intent'
        : 'stream';
  // On tab open, read only if nothing has been read yet — the site's own
  // debounced reads keep the shared result fresh. Then only via "re-evaluate".
  useEffect(() => {
    if (!open || effectiveTab !== 'intent') {
      if (effectiveTab !== 'intent') intentFetchedRef.current = false;
      return;
    }
    if (intentFetchedRef.current || intent || intentLoading) return;
    intentFetchedRef.current = true;
    fetchIntent();
  }, [open, effectiveTab, fetchIntent, intent, intentLoading]);

  const warehouseRows =
    warehouse.source === 'service'
      ? warehouseAttrs
        ? Object.entries(warehouseAttrs)
        : []
      : Object.entries(warehouse.mockAttributes);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 left-6 z-[60] flex max-h-[80vh] w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg sm:w-96">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-raised px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-h4 font-bold text-heading">
                Signals Live
              </h3>
              <span className="relative flex h-2.5 w-2.5">
                {configured && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    configured ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <Wifi size={12} />
              {syncedAt
                ? `synced ${Math.max(0, Math.round((now - syncedAt) / 1000))}s ago`
                : 'syncing…'}
              <button
                onClick={() => setOpen(false)}
                className="ml-2 cursor-pointer p-0.5 text-muted hover:text-heading"
                aria-label="close signals panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
            {!configured && !siteConfig.features.intent ? (
              <div className="flex flex-col items-center py-8 text-muted">
                <Activity className="mb-3 h-10 w-10 opacity-50" />
                <p className="font-bold text-body">Signals not configured</p>
                <p className="mt-1 text-center text-xs">
                  Set SIGNALS_API_URL and the SNOWPLOW_CONSOLE_API_KEY* vars in
                  your environment.
                </p>
              </div>
            ) : loading && !hasData ? (
              <div className="animate-pulse space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-4 rounded bg-surface-raised" />
                ))}
              </div>
            ) : !hasData ? (
              <div className="flex flex-col items-center py-8 text-muted">
                <Activity className="mb-3 h-10 w-10 opacity-50" />
                <p className="font-bold text-body">no data yet</p>
                <p className="mt-1 text-center text-xs">
                  Interact with the app and Signals attributes will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* Identities */}
                <div>
                  <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading">
                    <Fingerprint className="h-3 w-3" /> identities
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <code className="shrink-0 font-mono text-xs font-bold text-primary">
                        snowplow_id
                      </code>
                      <span
                        className="truncate text-right font-mono text-xs font-bold text-heading"
                        title={snowplowId ?? undefined}
                      >
                        {snowplowId ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <code className="shrink-0 font-mono text-xs font-normal text-primary">
                        domain_userid
                      </code>
                      <span
                        className="truncate text-right font-mono text-xs font-normal text-body"
                        title={domainUserid ?? undefined}
                      >
                        {domainUserid ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <code className="shrink-0 font-mono text-xs font-normal text-primary">
                        user_id
                      </code>
                      <span
                        className="truncate text-right font-mono text-xs font-normal text-body"
                        title={userId ?? undefined}
                      >
                        {userId ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-border" />

                {/* Stream / Warehouse tabs (Identities above + Interventions
                    below persist across both). */}
                {(warehouseEnabled || intentEnabled) && (
                  <div className="flex gap-1 rounded-md bg-surface-raised p-1">
                    <button
                      onClick={() => setActiveTab('stream')}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                        effectiveTab === 'stream'
                          ? 'bg-surface text-heading shadow-sm'
                          : 'text-muted hover:text-heading'
                      }`}
                    >
                      <Zap className="h-3 w-3" /> Stream
                    </button>
                    {warehouseEnabled && (
                      <button
                        onClick={() =>
                          warehouseUnlocked && setActiveTab('warehouse')
                        }
                        disabled={!warehouseUnlocked}
                        title={
                          warehouseUnlocked
                            ? undefined
                            : 'Unlocks once Snowplow Identity resolves the ID'
                        }
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                          !warehouseUnlocked
                            ? 'cursor-not-allowed text-muted/50'
                            : effectiveTab === 'warehouse'
                              ? 'bg-surface text-heading shadow-sm'
                              : 'text-muted hover:text-heading'
                        }`}
                      >
                        {warehouseUnlocked ? (
                          <Database className="h-3 w-3" />
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}{' '}
                        Warehouse
                      </button>
                    )}
                    {intentEnabled && (
                      <button
                        onClick={() => setActiveTab('intent')}
                        title="Purchase intent from TypeSafe's Jev model"
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                          effectiveTab === 'intent'
                            ? 'bg-surface text-heading shadow-sm'
                            : 'text-muted hover:text-heading'
                        }`}
                      >
                        <Gauge className="h-3 w-3" /> Intent
                      </button>
                    )}
                  </div>
                )}

                {effectiveTab === 'intent' ? (
                  <IntentPanel
                    result={intent}
                    loading={intentLoading}
                    onRefresh={fetchIntent}
                    stateOpen={stateOpen}
                    onToggleState={() => setStateOpen((o) => !o)}
                  />
                ) : effectiveTab === 'warehouse' ? (
                  /* Warehouse (batch) attributes */
                  <section>
                    <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading">
                      <Database className="h-3 w-3" /> warehouse attributes
                    </h4>
                    {warehouseRows.length > 0 ? (
                      <div className="space-y-2.5">
                        {warehouseRows.map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-3"
                          >
                            <code className="break-all font-mono text-xs text-muted">
                              {key}
                            </code>
                            <span className="break-words text-right font-bold text-heading">
                              {fmtValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        {warehouse.source === 'service'
                          ? 'No batch attributes yet for this identifier.'
                          : 'No mock attributes configured.'}
                      </p>
                    )}
                    {warehouse.source === 'mock' && (
                      <p className="mt-3 text-[10px] uppercase tracking-wider text-muted/70">
                        mock data
                      </p>
                    )}
                  </section>
                ) : (
                  /* Stream attributes */
                  <section>
                    {intentAttrKeys.length > 0 && (
                      <div className="mb-4">
                        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading">
                          <Gauge className="h-3 w-3" /> shopper intent
                        </h4>
                        <div className="space-y-2">
                          {intentAttrKeys.map((key) => (
                            <div
                              key={key}
                              className="flex items-start justify-between gap-3"
                            >
                              <code className="break-all font-mono text-xs text-muted">
                                {key}
                              </code>
                              <span className="break-words text-right font-bold text-heading">
                                {fmtValue(attrs?.[key])}
                              </span>
                            </div>
                          ))}
                        </div>
                        {intentAttrKeys.every((k) => attrs?.[k] == null) && (
                          <p className="mt-2 font-mono text-[9.5px] text-muted/70">
                            grocery_shopper_intent · not served yet
                          </p>
                        )}
                      </div>
                    )}
                    <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading">
                      <Zap className="h-3 w-3" /> stream attributes
                    </h4>
                    {rows.length > 0 ? (
                      <div className="space-y-2.5">
                        {rows
                          .filter(([key]) => !intentAttrKeys.includes(key))
                          .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start justify-between gap-3"
                          >
                            <code className="break-all font-mono text-xs text-muted">
                              {key}
                            </code>
                            <span className="break-words text-right font-bold text-heading">
                              {fmtValue(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        No attributes yet — interact with the app to populate them.
                      </p>
                    )}
                  </section>
                )}

                {interventions.length > 0 && (
                  <>
                    <hr className="border-border" />

                    {/* Interventions — Signals owns the rule; presenter can
                        fire either on demand (copy uses the latest read). */}
                    <section>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-heading">
                          <Activity className="h-3 w-3" /> interventions
                        </h4>
                        <button
                          onClick={() => clearIntervention()}
                          className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-heading"
                        >
                          clear
                        </button>
                      </div>
                      <ul className="space-y-3">
                        {interventions.map((iv) => {
                          const hit = fired[iv.name];
                          return (
                            <li key={iv.name} className="space-y-1">
                              <div className="flex items-start justify-between gap-3">
                                <span className="flex min-w-0 items-start gap-2">
                                  <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                      hit
                                        ? 'border-transparent bg-primary'
                                        : 'border-muted bg-transparent'
                                    }`}
                                  >
                                    {hit && (
                                      <Check
                                        className="h-3 w-3 text-inverse"
                                        strokeWidth={3}
                                      />
                                    )}
                                  </span>
                                  <code
                                    className="break-all font-mono text-xs text-heading"
                                    title={iv.name}
                                  >
                                    {iv.name}
                                  </code>
                                </span>
                                <button
                                  onClick={() => triggerIntervention(iv.name)}
                                  className="shrink-0 cursor-pointer rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-inverse transition-colors hover:bg-highlight"
                                >
                                  trigger
                                </button>
                              </div>
                              <p className="pl-6 font-mono text-[10px] leading-snug text-muted">
                                {iv.rule}
                              </p>
                              <p className="pl-6 font-mono text-[9.5px] text-muted/70">
                                {hit
                                  ? `fired this session · ${hit.source === 'signals' ? 'signals push' : 'manual'} · ${new Date(hit.at).toLocaleTimeString()}`
                                  : 'not fired this session'}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  </>
                )}
              </>
            )}
            <p className="pt-2 text-center text-[10px] text-muted/70">
              this panel is visible to demo presenters only
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 left-6 z-[60] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-raised text-primary shadow-lg transition-transform hover:scale-105"
        aria-label={open ? 'close signals panel' : 'open signals panel'}
      >
        {open ? <X className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
      </button>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Intent panel — TypeSafe (Jev)
 *
 * Shows the code-derived stage (and the rule that fired), the occasion choice
 * with its full distribution, the persona trait nouls, and the exact state that was posted — so a presenter
 * can show what Jev actually saw.
 * ------------------------------------------------------------------------- */

function Bar({ value, accent }: { value: number; accent?: boolean }) {
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-surface-raised">
      <span
        className={`block h-full rounded-full ${accent ? 'bg-primary' : 'bg-muted'}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </span>
  );
}

function DistRow({
  label,
  value,
  selected,
}: {
  label: string;
  value: number;
  selected?: boolean;
}) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <code
          className={`break-all font-mono text-[11px] ${
            selected ? 'font-bold text-heading' : 'text-muted'
          }`}
        >
          {label}
        </code>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            selected ? 'font-bold text-heading' : 'text-body'
          }`}
        >
          {pct(value)}
        </span>
      </div>
      <Bar value={value} accent={selected} />
    </li>
  );
}

function IntentSection({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-heading">
          {title}
        </h4>
        {right}
      </div>
      {children}
    </section>
  );
}

/** The claimed label, or "Not enough signal" when its evidence gate fails.
 *  Jev still answered — the distribution below stays visible — but the panel
 *  does not claim a label the evidence can't support. */
function LabelLine({
  label,
  enough,
  gate,
}: {
  label: string;
  enough: boolean;
  gate: string;
}) {
  if (!enough) {
    return (
      <p className="mb-2">
        <span className="font-mono text-xs font-bold text-muted">
          Not enough signal
        </span>
        <span className="ml-2 font-mono text-[9.5px] text-muted/70">
          needs {gate}
        </span>
      </p>
    );
  }
  return (
    <code className="mb-2 block font-mono text-xs font-bold text-heading">
      {label}
    </code>
  );
}

/** Suggested action for a label — show-only, nothing fires on the site. */
function ActionLine({
  action,
  filter,
}: {
  action: string | null;
  filter?: boolean;
}) {
  if (!action) return null;
  return (
    <p className="mb-2 flex items-start gap-1.5 text-[10.5px] leading-snug text-body">
      <ChevronRight
        className={`mt-0.5 h-3 w-3 shrink-0 ${filter ? 'text-error' : 'text-primary'}`}
      />
      <span>
        {filter ? action : `Suggested: ${action}`}
      </span>
    </p>
  );
}

/** Non-error, non-classification states: no session data yet, Signals not
 *  configured, Signals unreachable. Each reads differently on purpose. */
function IntentNotice({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = 'muted',
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  tone?: 'muted' | 'error';
}) {
  return (
    <div className="flex flex-col items-center py-7 text-muted">
      {icon}
      <p className={`font-bold ${tone === 'error' ? 'text-error' : 'text-body'}`}>
        {title}
      </p>
      <p className="mt-1 text-center text-xs leading-relaxed">{body}</p>
      <button
        onClick={onAction}
        className="mt-3 cursor-pointer rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-inverse"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function IntentPanel({
  result,
  loading,
  onRefresh,
  stateOpen,
  onToggleState,
}: {
  result: IntentResult | null;
  loading: boolean;
  onRefresh: () => void;
  stateOpen: boolean;
  onToggleState: () => void;
}) {

  if (loading && !result) {
    return (
      <div className="animate-pulse space-y-3 py-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (result && result.configured === false) {
    return (
      <div className="flex flex-col items-center py-8 text-muted">
        <Gauge className="mb-3 h-10 w-10 opacity-50" />
        <p className="font-bold text-body">TypeSafe not configured</p>
        <p className="mt-1 text-center text-xs">
          Add <code className="font-mono">TYPESAFE_API_KEY</code> to .env to enable
          the Intent tab.
        </p>
      </div>
    );
  }

  // (b) Signals answered, but nothing has landed for this session yet. This is
  // the normal state for a brand-new session and must NOT read as an error.
  if (result?.source_status === 'empty') {
    return (
      <div>
        <IntentNotice
          icon={<Wifi className="mb-3 h-10 w-10 opacity-50" />}
          title="no session data yet"
          body={
            result.message ??
            'Signals answered for this session but the attribute group is still empty.'
          }
          actionLabel="re-evaluate"
          onAction={onRefresh}
        />
        <p className="text-center font-mono text-[9.5px] text-muted/70">
          {result.service ?? siteConfig.snowplow.signalsService} ·{' '}
          {result.attribute_key ?? siteConfig.snowplow.signalsAttributeKey}
        </p>
      </div>
    );
  }

  if (
    result?.source_status === 'unconfigured' ||
    result?.source_status === 'unreachable'
  ) {
    return (
      <div>
        <IntentNotice
          icon={<Wifi className="mb-3 h-10 w-10 opacity-50" />}
          title={
            result.source_status === 'unconfigured'
              ? 'signals not configured'
              : 'signals unreachable'
          }
          body={result.message ?? 'The Signals service could not be read.'}
          actionLabel="retry"
          onAction={onRefresh}
          tone={result.source_status === 'unreachable' ? 'error' : 'muted'}
        />
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="space-y-3 py-4">
        <p className="text-center text-xs text-error">{result.error}</p>
        <button
          onClick={onRefresh}
          className="mx-auto block cursor-pointer rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-inverse"
        >
          retry
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <div className="flex flex-col items-center py-8 text-muted">
          <Gauge className="mb-3 h-10 w-10 opacity-50" />
          <p className="font-bold text-body">no evaluation yet</p>
          <button
            onClick={onRefresh}
            className="mt-3 cursor-pointer rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-inverse"
          >
            evaluate
          </button>
        </div>
      </div>
    );
  }

  const stage = result.stage;
  const occasion = result.occasion;
  const persona = result.persona;
  const metrics = result.metrics;

  return (
    <div className="space-y-5">
      {/* Provenance — the classification is always built from Signals */}
      <p className="font-mono text-[9.5px] text-muted/70">
        {`built from Signals · ${result.service ?? siteConfig.snowplow.signalsService} · ${siteConfig.snowplow.signalsAttributeKey}`}
      </p>
      {/* What each label is FOR — the one-line legend for the presenter */}
      <p className="-mt-3 text-[10px] leading-relaxed text-body">
        Stage = when &amp; how hard · Occasion = what to show · Persona = how to
        frame it
      </p>
      {/* Header — model + re-evaluate */}
      <div className="flex items-center justify-between gap-3">
        <code className="font-mono text-[10px] text-muted">
          {result.model ?? 'jev'}
        </code>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-inverse disabled:opacity-60"
        >
          <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
          re-evaluate
        </button>
      </div>

      <hr className="border-border" />

      {/* Stage — ordered rules over Signals facts, not a Jev read */}
      {stage && (
        <IntentSection
          title="stage · rules (signals)"
          right={
            <span className="font-mono text-[10px] tabular-nums text-muted">
              code
            </span>
          }
        >
          <LabelLine
            label={stage.enough_signal ? `${stage.label} — ${stage.rule}` : stage.label}
            enough={stage.enough_signal}
            gate="≥2 views/searches or ≥1 add"
          />
          <ActionLine action={stage.action} />
          <p className="font-mono text-[9.5px] leading-relaxed text-muted">
            first match: purchased / checking_out (counters) → hesitating
            (removed, not re-added) → ready_to_buy (≥
            {intentPolicy.stage.readyMinItems} items) → on_a_mission (searched,
            then added) → browsing
          </p>
        </IntentSection>
      )}

      {/* Occasion — restock split weekly / top_up in code */}
      {occasion && (
        <IntentSection
          title="occasion · choice"
          right={
            <span className="font-mono text-[10px] tabular-nums text-muted">
              conf {pct(occasion.confidence)}
            </span>
          }
        >
          <LabelLine
            label={occasion.label}
            enough={occasion.enough_signal}
            gate="≥2 adds or any search"
          />
          <ActionLine action={occasion.action} />
          <ul className="space-y-2">
            {Object.entries(occasion.probabilities)
              .sort((a, b) => b[1] - a[1])
              .map(([label, p]) => (
                <DistRow
                  key={label}
                  label={label}
                  value={p}
                  selected={occasion.enough_signal && label === occasion.jev_choice}
                />
              ))}
          </ul>
          {occasion.restock_split && (
            <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-muted">
              weekly = ≥3 aisles incl. Household, or ≥8 adds — else top_up ·
              split in code
            </p>
          )}
        </IntentSection>
      )}

      {/* Persona — code-derived headline + five independent trait nouls */}
      {persona && (
        <IntentSection
          title="persona · nouls"
          right={
            <span className="font-mono text-[10px] tabular-nums text-muted">
              conf {pct(persona.confidence)}
            </span>
          }
        >
          <LabelLine
            label={persona.headline}
            enough={persona.enough_signal}
            gate="≥2 adds"
          />
          <ActionLine action={persona.action} />
          {persona.filter && <ActionLine action={persona.filter} filter />}
          <ul className="space-y-2">
            {Object.entries(persona.traits)
              .sort((a, b) => b[1] - a[1])
              .map(([label, p]) => (
                <DistRow
                  key={label}
                  label={label}
                  value={p}
                  selected={
                    persona.enough_signal &&
                    (label === 'plant_based'
                      ? persona.plant_based.active
                      : persona.active.includes(label))
                  }
                />
              ))}
          </ul>
          <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-muted">
            framing traits active ≥ 60%, strongest headlines, else “generalist”
            · plant_based is a filter at ≥ 80% · derived in code, not asked of
            the model
          </p>
        </IntentSection>
      )}

      {/* Signals facts — the numbers kept OUT of the Jev state */}
      {metrics && (
        <IntentSection title="signals facts · not sent to jev">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2">
                <code className="truncate font-mono text-[9.5px] text-muted">
                  {key}
                </code>
                <span className="font-mono text-[10px] tabular-nums text-heading">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </IntentSection>
      )}

      {result.session_timeline && (
        <IntentSection
          title="agentic context · timeline"
          right={
            <span className="font-mono text-[10px] tabular-nums text-muted">
              event log
            </span>
          }
        >
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-border bg-surface-raised p-2 font-mono text-[9.5px] leading-relaxed text-body">
            {result.session_timeline}
          </pre>
          <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-muted">
            ordered session events from Signals (grocery_agentic_context) —
            temporal evidence for stage &amp; budget, read alongside the
            aggregated attributes
          </p>
        </IntentSection>
      )}

      {/* The exact state posted */}
      <section>
        <button
          onClick={onToggleState}
          className="flex w-full cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-heading"
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform ${stateOpen ? 'rotate-90' : ''}`}
          />
          state sent to jev
        </button>
        {stateOpen && (
          <pre className="mt-2 max-h-64 overflow-auto rounded border border-border bg-surface-raised p-2 font-mono text-[9.5px] leading-relaxed text-body">
            {JSON.stringify(result.state ?? {}, null, 2)}
          </pre>
        )}
        {result.usage && (
          <p className="mt-2 font-mono text-[9.5px] tabular-nums text-muted/70">
            {result.usage.input_tokens} in · {result.usage.output_tokens} out
            {result.evaluated_at
              ? ` · ${new Date(result.evaluated_at).toLocaleTimeString()}`
              : ''}
          </p>
        )}
      </section>
    </div>
  );
}
