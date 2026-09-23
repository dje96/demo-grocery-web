'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { SPPromotion } from '@snowplow/browser-plugin-snowplow-ecommerce';

import {
  INTERVENTION_EVENT,
  INTERVENTION_CLEARED_EVENT,
  getFiredInterventions,
  type FiredIntervention,
} from '@/lib/snowplow-config';
import { siteConfig, interventionContent } from '@/lib/config';
import { formatGBP, productBySku, products, type Product } from '@/lib/catalog';
import { useIntent } from '@/lib/intent-client';
import { trackInterventionInteractionEvent } from '@/lib/tracking';
import { useShop } from '@/contexts/shop-context';
import AddToBasket from '@/components/AddToBasket';

/**
 * Signals intervention surface (phase 2 — acting on intent).
 *
 *  PUSH: the Signals plugin handler in snowplow-config.ts records a received
 *    `grocery_complete_recipe` / `grocery_hesitation_rescue` and dispatches
 *    INTERVENTION_EVENT. Signals decides WHEN (its rule on the
 *    `grocery_shopper_intent` attributes).
 *  PRESENTER: the Signals Inspector trigger buttons use the same contract.
 *
 * This component decides HOW, from the intent labels: the pushed payload's
 * `intent_*` attributes when present, else the latest client-side Jev read
 * (src/lib/intent-client.ts). Persona picks the framing; the plant-based
 * filter swaps/drops non-vegan recipe items.
 *
 * Once per session per intervention: a dismissed (or completed) banner never
 * returns, and `view` is tracked once. Every view / click / dismiss is tracked
 * as `intervention_interaction` with the `intervention_instance` (pushes only)
 * and ecommerce `promotion` entities.
 */

const STATE_KEY = 'demo-intervention-state';
type BannerEntry = { viewed?: boolean; done?: boolean; kind?: string };
type BannerState = Record<string, BannerEntry>;

function readState(): BannerState {
  try {
    return JSON.parse(window.sessionStorage.getItem(STATE_KEY) ?? '{}') as BannerState;
  } catch {
    return {};
  }
}

function patchState(name: string, patch: BannerEntry | null): void {
  const state = readState();
  if (patch === null) delete state[name];
  else state[name] = { ...state[name], ...patch };
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Most recent fired intervention that hasn't been dismissed / completed. */
function pendingIntervention(): FiredIntervention | null {
  const state = readState();
  return (
    Object.values(getFiredInterventions())
      .filter((f) => !state[f.name]?.done)
      .sort((a, b) => b.at - a.at)[0] ?? null
  );
}

// ─── Intent labels: pushed attributes first, client read as fallback ────────

/** Read an `intent_*` attribute defensively: exact key or any `…intent_x`
 *  suffix, single value or one-element array. */
function pushedAttr(f: FiredIntervention | null, key: string): unknown {
  const attrs = f?.intervention?.attributes;
  if (!attrs) return undefined;
  const hit = key in attrs ? attrs[key] : Object.entries(attrs).find(([k]) => k.endsWith(key))?.[1];
  return Array.isArray(hit) ? hit[0] : hit;
}

/** Raw list attribute (e.g. `cart_removed_names`): exact key or suffix. */
function pushedList(f: FiredIntervention | null, key: string): string[] | undefined {
  const attrs = f?.intervention?.attributes;
  if (!attrs) return undefined;
  const hit = key in attrs ? attrs[key] : Object.entries(attrs).find(([k]) => k.endsWith(key))?.[1];
  if (Array.isArray(hit)) return hit.map(String);
  return typeof hit === 'string' ? [hit] : undefined;
}

const MAX_ADD_BACK = 4;

function asBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

// ─── Copy ────────────────────────────────────────────────────────────────────

const FRAMING: Record<string, (recipe: string, items: Product[], total: number) => string> = {
  budget_driven: (recipe, items, total) => {
    const onOffer = items.filter((p) => p.wasPrice && p.wasPrice > p.price).length;
    return `Finish your ${recipe} for just ${formatGBP(total)}${onOffer ? ` — ${onOffer} on offer` : ''}.`;
  },
  health_conscious: (recipe) =>
    `A simple, wholesome ${recipe} — a handful of plain ingredients, nothing ultra-processed.`,
  convenience_seeking: (recipe) =>
    `${recipe}, ready in ${interventionContent.recipe.readyInMinutes} min — add what's missing in one tap.`,
};

const neutralFraming = (recipe: string, items: Product[]) =>
  `Cooking ${recipe}? You're ${items.length} ingredient${items.length === 1 ? '' : 's'} away.`;

export default function InterventionBanner() {
  const [active, setActive] = useState<FiredIntervention | null>(null);
  const { intent, result } = useIntent();
  const { qtyOf, addItem, applyPromo, amountToFreeDelivery, subtotal, hydrated } = useShop();
  const viewTracked = useRef<string | null>(null);

  // Push path + presenter trigger.
  useEffect(() => {
    if (!siteConfig.features.signals) return;
    const onEvent = (e: Event) => {
      const fired = (e as CustomEvent<FiredIntervention>).detail;
      if (!fired?.name) return;
      // A presenter trigger is explicit — it resets that banner's session state.
      if (fired.source === 'inspector') patchState(fired.name, null);
      if (readState()[fired.name]?.done) return;
      viewTracked.current = null;
      setActive(fired);
    };
    const onCleared = () => {
      try {
        window.sessionStorage.removeItem(STATE_KEY);
      } catch {
        /* ignore */
      }
      setActive(null);
    };
    window.addEventListener(INTERVENTION_EVENT, onEvent);
    window.addEventListener(INTERVENTION_CLEARED_EVENT, onCleared);
    // Fired earlier this session (e.g. before a navigation)?
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(pendingIntervention());
    return () => {
      window.removeEventListener(INTERVENTION_EVENT, onEvent);
      window.removeEventListener(INTERVENTION_CLEARED_EVENT, onCleared);
    };
  }, []);

  const persona = String(pushedAttr(active, 'intent_persona') ?? intent?.persona_primary ?? 'generalist');
  const plantFilter =
    asBool(pushedAttr(active, 'intent_plant_filter')) ?? intent?.plant_based_filter ?? false;

  const def = siteConfig.snowplow.interventions.find((i) => i.name === active?.name);

  // Recipe items still missing from the basket, after the plant filter.
  const recipeMissing = useMemo<Product[]>(() => {
    return interventionContent.recipe.items
      .map(({ sku, plantSwap }) => {
        const p = productBySku(sku);
        if (!p) return null;
        if (plantFilter && !p.badges.includes('Vegan')) {
          return plantSwap ? productBySku(plantSwap) ?? null : null;
        }
        return p;
      })
      .filter((p): p is Product => !!p && p.inStock && qtyOf(p.sku) === 0);
  }, [plantFilter, qtyOf]);

  // Hesitation with an empty basket: offer back what they took out. Names come
  // from Signals `cart_removed_names` (pushed payload first, else the latest
  // /api/intent state); only items still out of the basket are shown.
  const addBack = useMemo<Product[]>(() => {
    const state = result?.state as { removed_this_session?: string[] } | undefined;
    const names = pushedList(active, 'cart_removed_names') ?? state?.removed_this_session ?? [];
    return names
      .map((n) => products.find((p) => p.name === n))
      .filter((p): p is Product => !!p && p.inStock && qtyOf(p.sku) === 0)
      .slice(0, MAX_ADD_BACK);
  }, [active, result, qtyOf]);

  // ─── Content for the active intervention ─────────────────────────────────
  const content = useMemo(() => {
    if (!active || !def) return null;
    const creative = plantFilter ? `${persona}+plant_based_filtered` : persona;
    if (def.name === 'grocery_complete_recipe') {
      const recipe = interventionContent.recipe.name;
      const total = recipeMissing.reduce((s, p) => s + p.price, 0);
      const headline =
        recipeMissing.length === 0
          ? `Everything for your ${recipe} is in your basket.`
          : (FRAMING[persona] ?? neutralFraming)(recipe, recipeMissing, total);
      return {
        kind: 'recipe' as const,
        headline,
        total,
        promotion: {
          id: def.promotionId,
          name: headline,
          type: 'banner',
          slot: 'intervention_banner',
          creative_id: creative,
          product_ids: recipeMissing.map((p) => p.sku),
        } satisfies SPPromotion,
      };
    }
    const { code, pct } = interventionContent.hesitation;
    const budget = persona === 'budget_driven' && subtotal > 0;
    // Add-back sticks once shown: re-adding one item mustn't swap the offer for
    // the free-delivery copy while other removed items are still out.
    const shownAsAddBack = readState()[active.name]?.kind === 'addBack';
    const empty = shownAsAddBack ? addBack.length > 0 : subtotal === 0;
    const headline = budget
      ? `Still deciding? Take ${pct}% off your basket with code ${code}.`
      : empty
        ? 'Changed your mind? Add them back in one tap.'
        : amountToFreeDelivery > 0
        ? `Your basket is saved — you're ${formatGBP(amountToFreeDelivery)} from free delivery.`
        : 'Your basket is saved — free delivery unlocked.';
    return {
      kind: budget ? ('offer' as const) : empty ? ('addBack' as const) : ('saved' as const),
      headline,
      total: empty ? addBack.reduce((s, p) => s + p.price, 0) : 0,
      promotion: {
        id: def.promotionId,
        name: headline,
        type: 'banner',
        slot: 'intervention_banner',
        creative_id: empty ? `${creative}+add_back` : creative,
        ...(empty ? { product_ids: addBack.map((p) => p.sku) } : {}),
      } satisfies SPPromotion,
    };
  }, [active, def, persona, plantFilter, recipeMissing, addBack, subtotal, amountToFreeDelivery]);

  // Recipe already complete before the banner was ever seen → nothing to
  // offer, don't show. Completed AFTER it was seen → show the "all set" line.
  const seen = hydrated && !!active && !!readState()[active.name]?.viewed;
  const renderable =
    hydrated &&
    !!content &&
    !(content.kind === 'recipe' && recipeMissing.length === 0 && !seen) &&
    !(content.kind === 'addBack' && addBack.length === 0);

  const track = useCallback(
    (type: 'view' | 'click' | 'dismiss') => {
      if (!active || !content) return;
      trackInterventionInteractionEvent({
        name: active.name,
        type,
        intervention: active.intervention ?? null,
        promotion: content.promotion,
      });
    },
    [active, content]
  );

  // `view` once per intervention per session, when the banner really renders.
  useEffect(() => {
    if (!renderable || !active) return;
    if (viewTracked.current === active.name) return;
    viewTracked.current = active.name;
    if (readState()[active.name]?.viewed) return;
    patchState(active.name, { viewed: true, kind: content?.kind });
    track('view');
  }, [renderable, active, track, content?.kind]);

  const close = useCallback(
    (type: 'click' | 'dismiss') => {
      if (!active) return;
      track(type);
      patchState(active.name, { done: true });
      setActive(null);
    },
    [active, track]
  );

  if (!renderable || !content || !active) return null;

  // Citrus ground — the ONE place #D9F154 fills a large area, so an
  // intervention is unmistakable against an otherwise monochrome palette.
  return (
    <div className="w-full bg-highlight text-primary">
      <div className="mx-auto flex max-w-page items-start justify-between gap-4 px-6 py-2.5 text-small">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-heading font-bold">{content.headline}</p>

          {content.kind === 'recipe' && recipeMissing.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {recipeMissing.map((p) => (
                <div
                  key={p.sku}
                  className="flex items-center gap-2"
                  onClickCapture={() => track('click')}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="num">{formatGBP(p.price)}</span>
                  <div className="w-24">
                    <AddToBasket sku={p.sku} size="sm" label="Add" />
                  </div>
                </div>
              ))}
              {recipeMissing.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    recipeMissing.forEach((p) => addItem(p.sku, 1));
                    close('click');
                  }}
                  className="rounded-sm bg-primary px-3 py-1.5 text-[12px] font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
                >
                  Add all · <span className="num">{formatGBP(content.total)}</span>
                </button>
              )}
            </div>
          )}

          {content.kind === 'addBack' && (
            <div className="flex flex-wrap items-center gap-3">
              {addBack.map((p) => (
                <div
                  key={p.sku}
                  className="flex items-center gap-2"
                  onClickCapture={() => track('click')}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="num">{formatGBP(p.price)}</span>
                  <div className="w-24">
                    <AddToBasket sku={p.sku} size="sm" label="Add" />
                  </div>
                </div>
              ))}
              {addBack.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    addBack.forEach((p) => addItem(p.sku, 1));
                    close('click');
                  }}
                  className="rounded-sm bg-primary px-3 py-1.5 text-[12px] font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
                >
                  Add all back · <span className="num">{formatGBP(content.total)}</span>
                </button>
              )}
            </div>
          )}

          {content.kind === 'offer' && (
            <button
              type="button"
              onClick={() => {
                applyPromo(interventionContent.hesitation.code);
                close('click');
              }}
              className="rounded-sm bg-primary px-3 py-1.5 text-[12px] font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
            >
              Apply {interventionContent.hesitation.code}
            </button>
          )}

          {content.kind === 'saved' && subtotal > 0 && (
            <Link
              href="/cart"
              onClick={() => close('click')}
              className="inline-block rounded-sm bg-primary px-3 py-1.5 text-[12px] font-semibold text-highlight transition-colors hover:bg-[#1E221F]"
            >
              View basket
            </Link>
          )}
        </div>
        <button
          onClick={() => close('dismiss')}
          aria-label="Dismiss"
          className="rounded-sm p-1 transition-colors hover:bg-primary/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
