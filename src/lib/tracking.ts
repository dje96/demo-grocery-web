/**
 * Typed Snowplow tracking wrappers.
 *
 * ─── Generated, not hand-authored ────────────────────────────────────────────
 * Every custom/CDI event in this app is funnelled through this module, and this
 * module calls the SNOWTYPE-GENERATED functions in `src/snowtype/snowplow.ts`.
 * Those are produced from the published Console tracking plan
 * "Grocery Shopping Journey" (9e64295e-1e49-40d3-81b3-71a9b1873e84) by:
 *
 *     npm run snowtype:generate      # regenerate from Console
 *     npm run snowtype:update        # check for newer schema/spec versions
 *
 * Config: `snowtype.config.json` · lock file: `.snowtype-lock.json`.
 * NEVER hand-write a `trackSelfDescribingEvent` payload for these events — add
 * the event spec in Console and regenerate.
 *
 * The five ecommerce events are the standard Snowplow ecommerce plugin
 * (`snowplow_ecommerce_action` 1-0-2 + product/cart/checkout_step/transaction
 * entities); search reuses `iglu:com.demo/search_performed/jsonschema/1-0-0`.
 *
 * ─── Contract notes carried from the event specs ─────────────────────────────
 *  • `product.name` is optional in the schema but REQUIRED here — Signals
 *    extracts it into `product_names_viewed` / `cart_product_names`, which is
 *    the semantic payload sent to TypeSafe Jev. IDs alone mean nothing to the
 *    model, so `productEntity()` always sets it.
 *  • `product.category` is the AISLE NAME as shown in navigation (Produce,
 *    Dairy & Eggs, …) — never the slug. `currency` is always GBP.
 *  • `cart.total_value` is the basket subtotal AFTER the action, on both add
 *    and remove. Signals reads `cart_value` with aggregation `last` across
 *    both, so a stale value corrupts the numeric intent state.
 *  • `product.quantity` is the units moved in THIS action, not the resulting
 *    line total.
 *  • Search `term` is the raw query as typed — trimmed only. Never lowercased,
 *    normalised or stemmed: "cheese" vs "Yeo Valley salted butter" is the
 *    whole intent signal.
 */

import { trackSelfDescribingEvent } from '@snowplow/browser-tracker';
import type {
  Cart,
  Product as EcomProduct,
  SPPromotion,
} from '@snowplow/browser-plugin-snowplow-ecommerce';
import type { Intervention } from '@snowplow/signals-browser-plugin';

import {
  createAgentClassifyShopperIntent,
  createShopperIntent,
  trackAddToBasketSpec,
  trackClassifyShopperIntentSpec,
  trackCompleteTransactionSpec,
  trackInterventionInteraction,
  trackPerformSearchSpec,
  trackProgressCheckoutStepSpec,
  trackRemoveFromBasketSpec,
  trackViewProductSpec,
  type AgentClassifyShopperIntent,
  type InterventionInteractionType,
  type SearchType,
  type ShopperIntent,
  type Trigger,
} from '@/snowtype/snowplow';
import { aisleName, type Product } from '@/lib/catalog';
import { initializeSnowplow } from '@/lib/snowplow-config';
import { scheduleIntentRead } from '@/lib/intent-client';

export const CURRENCY = 'GBP';

/**
 * Send an event, making sure the tracker exists first.
 *
 * React runs child effects before parent effects, so a page-level effect (the
 * product view, the first checkout step) can fire BEFORE `SnowplowInit`'s own
 * effect has called `initializeSnowplow()`. The tracker plugins silently drop
 * anything dispatched before then. `initializeSnowplow()` is guarded by a
 * module-level flag, so calling it here is a no-op once the tracker is up and a
 * just-in-time init otherwise — either way the event is never lost.
 */
function dispatch(send: () => void): void {
  if (typeof window === 'undefined') return;
  initializeSnowplow();
  send();
}

/** Iglu URI of the cart entity, as emitted by the ecommerce plugin itself. */
const CART_ENTITY_SCHEMA =
  'iglu:com.snowplowanalytics.snowplow.ecommerce/cart/jsonschema/1-0-0';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Entity mapping ──────────────────────────────────────────────────────────

/**
 * Map a catalog product onto the ecommerce `product` entity.
 * `quantity` is the units moved in THIS action — omit it for a product view.
 */
export function productEntity(product: Product, quantity?: number): EcomProduct {
  return {
    id: product.sku,
    name: product.name, // REQUIRED here — feeds the Signals name attributes
    category: aisleName(product.aisle), // aisle NAME, not the slug
    price: product.price,
    // `list_price` is the ORIGINAL price — only present when the item is
    // genuinely marked down (catalog `wasPrice`). Signals keys the on-offer
    // attributes off `list_price is not null`, and it feeds the budget-driven
    // persona read: a shopper who fills the basket with discounted items is
    // price-sensitive even when the item names look premium.
    ...(product.wasPrice && product.wasPrice > product.price
      ? { list_price: product.wasPrice }
      : {}),
    brand: product.brand,
    currency: CURRENCY,
    inventory_status: product.inStock ? 'in stock' : 'out of stock',
    ...(quantity === undefined ? {} : { quantity }),
  };
}

/**
 * The cart entity as a self-describing JSON, for the events the plugin's own
 * helper does not attach one to (checkout steps).
 */
function cartEntity(totalValue: number) {
  const data: Cart = { total_value: round2(totalValue), currency: CURRENCY };
  return {
    schema: CART_ENTITY_SCHEMA,
    data: data as unknown as Record<string, unknown>,
  };
}

// ─── Ecommerce events ────────────────────────────────────────────────────────

/** View Product — `/product/[sku]`. */
export function trackProductViewEvent(product: Product): void {
  dispatch(() => trackViewProductSpec(productEntity(product)));
}

/**
 * Add To Basket.
 * @param quantity        units added in this action
 * @param subtotalAfter   basket subtotal AFTER the add
 */
export function trackAddToBasketEvent(
  product: Product,
  quantity: number,
  subtotalAfter: number
): void {
  dispatch(() =>
    trackAddToBasketSpec({
      total_value: round2(subtotalAfter),
      currency: CURRENCY,
      products: [productEntity(product, quantity)],
    })
  );
}

/**
 * Remove From Basket.
 * @param quantity        units removed in this action (positive)
 * @param subtotalAfter   basket subtotal AFTER the removal
 */
export function trackRemoveFromBasketEvent(
  product: Product,
  quantity: number,
  subtotalAfter: number
): void {
  dispatch(() =>
    trackRemoveFromBasketSpec({
      total_value: round2(subtotalAfter),
      currency: CURRENCY,
      products: [productEntity(product, quantity)],
    })
  );
}

/**
 * Progress Checkout Step — fired once on ENTRY to each of the four steps.
 *
 * NOTE: `checkout_step` 1-0-0 sets `additionalProperties: false` and has no
 * `step_name` property, and the plugin's `trackCheckoutStep` does not expose
 * the action's `name`. The human label therefore rides in the properties the
 * schema does have (`delivery_method`, `account_type`, `payment_method`)
 * alongside the 1-based step index the funnel is keyed on.
 */
export function trackCheckoutStepEvent(params: {
  step: number;
  subtotal: number;
  deliveryMethod?: string;
  paymentMethod?: string;
  accountType?: string;
  shippingPostcode?: string;
  couponCode?: string | null;
}): void {
  dispatch(() =>
    trackProgressCheckoutStepSpec({
      step: params.step,
      ...(params.deliveryMethod
        ? { delivery_method: params.deliveryMethod }
        : {}),
      ...(params.paymentMethod ? { payment_method: params.paymentMethod } : {}),
      ...(params.accountType ? { account_type: params.accountType } : {}),
      ...(params.shippingPostcode
        ? { shipping_postcode: params.shippingPostcode }
        : {}),
      ...(params.couponCode ? { coupon_code: params.couponCode } : {}),
      context: [cartEntity(params.subtotal)],
    })
  );
}

/**
 * Complete Transaction — fires EXACTLY ONCE, on the confirmation screen.
 * `revenue` includes the delivery fee where one is charged.
 */
export function trackTransactionEvent(params: {
  transactionId: string;
  revenue: number;
  totalQuantity: number;
  shipping: number;
  paymentMethod: string;
  discountCode?: string | null;
  discountAmount?: number;
  lines: { product: Product; qty: number }[];
}): void {
  dispatch(() =>
    trackCompleteTransactionSpec({
      transaction_id: params.transactionId,
      revenue: round2(params.revenue),
      currency: CURRENCY,
      payment_method: params.paymentMethod,
      total_quantity: params.totalQuantity,
      shipping: round2(params.shipping),
      ...(params.discountCode ? { discount_code: params.discountCode } : {}),
      ...(params.discountAmount
        ? { discount_amount: round2(params.discountAmount) }
        : {}),
      products: params.lines.map((l) => productEntity(l.product, l.qty)),
    })
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Perform Search. `term` must be the RAW query, trimmed only.
 *
 * De-duplicated on (type, term) so a debounced "quick" search and the "full"
 * search that follows it never double-fire the identical query, and so the
 * in-aisle input's submit + blur handlers collapse to one event.
 */
let lastSearch = '';

export function trackSearchEvent(params: {
  term: string;
  searchType: SearchType;
  totalResults: number;
}): void {
  const term = params.term.trim(); // trimmed ONLY — no normalisation
  if (!term) return;
  const key = `${params.searchType}:${term}`;
  if (key === lastSearch) return;
  lastSearch = key;
  dispatch(() =>
    trackPerformSearchSpec({
      term,
      search_type: params.searchType,
      total_results: params.totalResults,
    })
  );
  // Phase 2: a new query is new intent evidence — schedule a (debounced) read.
  scheduleIntentRead('search');
}

// ─── Intent (phase 2) ────────────────────────────────────────────────────────

export type IntentTrigger = Trigger;

/**
 * Classify Shopper Intent — one live Jev read the UI acts on. Carries exactly
 * one `shopper_intent` (labels AFTER code policy + raw probabilities) and one
 * `agent` entity. Dedupe / trigger policy lives in src/lib/intent-client.ts.
 */
export function trackClassifyIntentEvent(params: {
  trigger: IntentTrigger;
  latencyMs: number;
  intent: ShopperIntent;
  agent: AgentClassifyShopperIntent;
}): void {
  dispatch(() =>
    trackClassifyShopperIntentSpec({
      trigger: params.trigger,
      latency_ms: Math.max(0, Math.round(params.latencyMs)),
      context: [
        createShopperIntent(params.intent),
        createAgentClassifyShopperIntent(params.agent),
      ],
    })
  );
}

// ─── Interventions (phase 2) ─────────────────────────────────────────────────

const INTERVENTION_INSTANCE_SCHEMA =
  'iglu:com.snowplowanalytics.signals/intervention_instance/jsonschema/1-0-0';
const PROMOTION_SCHEMA =
  'iglu:com.snowplowanalytics.snowplow.ecommerce/promotion/jsonschema/1-0-0';

/**
 * The `intervention_instance` entity, built exactly as the Signals plugin
 * builds it for its own receive/handle events (the plugin does not expose the
 * entity on the delivered intervention, so it is rebuilt from the payload).
 */
function interventionInstanceEntity(i: Intervention) {
  return {
    schema: INTERVENTION_INSTANCE_SCHEMA,
    data: {
      intervention_id: i.intervention_id,
      name: i.name,
      version: i.version,
      attributeKey: i.target_attribute_key,
      attributes: Object.entries(i.attributes ?? {}).map(([attribute, value]) => ({
        attribute,
        value,
      })),
    } as Record<string, unknown>,
  };
}

/**
 * Intervention banner view / click / dismiss.
 *  • `intervention` — the Signals push that surfaced it (absent for the
 *    presenter's manual trigger) → `intervention_instance` entity, 0..1.
 *  • `promotion` — what the banner offered → ecommerce `promotion`, 0..1.
 * Hand-assembled context because the draft View/Click/Dismiss Intervention
 * specs can't be generated yet (intervention_instance isn't in DEV Iglu);
 * the event itself is Snowtype-generated from the PROD data structure.
 */
export function trackInterventionInteractionEvent(params: {
  name: string;
  type: InterventionInteractionType;
  intervention?: Intervention | null;
  promotion?: SPPromotion;
}): void {
  const context = [
    ...(params.intervention?.intervention_id
      ? [interventionInstanceEntity(params.intervention)]
      : []),
    ...(params.promotion
      ? [
          {
            schema: PROMOTION_SCHEMA,
            data: params.promotion as unknown as Record<string, unknown>,
          },
        ]
      : []),
  ];
  dispatch(() =>
    trackInterventionInteraction({
      name: params.name,
      type: params.type,
      ...(context.length ? { context } : {}),
    })
  );
}

// ─── Login (baseline — identity stitch) ──────────────────────────────────────

const SCHEMAS = {
  login: 'iglu:com.demo/login/jsonschema/1-0-0',
} as const;

export type LoginMethod = 'email' | 'google' | 'facebook' | 'apple';
export type LoginStatus = 'success' | 'failure';

/**
 * Login.
 * NOTE: the anonymous→known identity stitch (setUserId + disable anonymous
 * tracking) is performed by the CALLER before this fires — see user-context.tsx.
 */
export function trackLogin(params: {
  login_method?: LoginMethod | null;
  login_status?: LoginStatus | null;
  failure_reason?: string | null;
}): void {
  trackSelfDescribingEvent({
    event: {
      schema: SCHEMAS.login,
      data: {
        login_method: params.login_method ?? null,
        login_status: params.login_status ?? null,
        failure_reason: params.failure_reason ?? null,
      },
    },
  });
}
