/**
 * Presenter-only purchase-intent endpoint — TypeSafe (Jev).
 *
 * The Signals Inspector's "Intent" tab asks for a semantic read on what the
 * shopper is actually trying to buy. Since Phase 4 the state handed to Jev is
 * built HERE, on the server, from real Snowplow Signals attributes:
 *
 *     service `demo_grocery` → attribute group `demo_ecom_plugin_session` v5,
 *     keyed on domain_sessionid (siteConfig.snowplow).
 *
 * The client posts only its `sessionId` plus two counters Signals does not
 * carry (page count, session start); everything semantic comes from the
 * profile store. Signals credentials never leave the server — see
 * src/lib/signals-server.ts.
 *
 * SIGNALS → JEV STATE
 *   search_terms          → browsing.search_queries
 *   product_names_viewed  → browsing.products_viewed[].name
 *   cart_product_names    → basket.items[].name
 *   categories_viewed     → browsing.aisles_visited
 *   cart_value            → basket.subtotal_gbp
 *   list lengths, product_view_count, cart_add_count, checkout_started,
 *   purchase_completed, session duration → the numeric fields, COMPUTED IN CODE
 *
 * TWO RULES this route is built around:
 *
 *  1. Jev is unreliable at counting and arithmetic, so it is NEVER asked to
 *     tally anything. Every count and total in the posted state is computed by
 *     Signals or here in code, and the composite intent score below is computed
 *     HERE, in code — not by a question. The model only ever makes semantic
 *     judgments.
 *
 *  2. All four questions go in ONE `systemOne` call. They are answered in
 *     parallel and batching is far cheaper than four round trips.
 *
 * GRACEFUL DEGRADATION — three distinguishable, non-error states:
 *   • `configured: false`          → no TypeSafe key.
 *   • `source_status: "empty"`     → Signals answered, but this session has no
 *                                    attributes yet. Normal for a brand-new
 *                                    session; NOT an error.
 *   • `source_status: "live"`      → a real classification built from Signals.
 * Plus `source_status: "unconfigured" | "unreachable"` for Signals itself.
 *
 * FALLBACK: post `source: "local"` and a `localState` body and the route
 * classifies that client-side session state instead — the pre-Phase-4 path,
 * kept behind an explicit toggle in the Inspector so the tab still demos on a
 * pipeline where Signals has no data.
 *
 * Credentials stay server-side. The TypeSafe key is read from TYPESAFE_API_KEY
 * and passed explicitly to the client.
 */

import { NextRequest } from 'next/server';
import { choice, noul, TypeSafeClient } from '@typesafe-ai/sdk';

import { getSessionAttributesForIntent } from '@/lib/signals-server';
import { FREE_DELIVERY_THRESHOLD } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const QUESTIONS = {
  /**
   * Judged from the WORDS in the state — the search queries, the names of the
   * products viewed and the names of the items in the basket. The numeric
   * fields are there for the panel, not for this judgment.
   *
   * THREE options, not four: they are one axis — how decided the shopper
   * sounds — running browsing → comparing → ready_to_buy. A fourth option,
   * `topping_up`, used to sit here and was removed. It described WHAT KIND of
   * shop this is, not how decided the shopper is, so it competed for
   * probability mass with `ready_to_buy` when both were true at once (a
   * shopper grabbing milk and bread is topping up AND completely decided).
   * Because the composite reads P(ready_to_buy), that split silently halved
   * the score of decided staples shoppers. `shop_type` already reports the
   * kind of shop, including `top_up`, so nothing was lost by removing it.
   */
  stage: choice(
    [
      'A shopper is using an online grocery site. Read their search queries, the names of the products they have looked at, and the names of the items in their basket, and decide which description of their shopping behaviour fits best.',
      'Judge this from the words alone: the search queries in `browsing.search_queries`, the product names in `browsing.products_viewed[].name`, and the item names in `basket.items[].name`.',
      'Do NOT base this on any of the numeric fields. Ignore `session.page_count`, `session.duration_minutes`, `session.products_viewed_count`, `session.search_query_count`, `basket.item_count` and `basket.subtotal_gbp` entirely when choosing.',
    ],
    {
      browsing:
        'The shopper is looking around without a settled goal. The products viewed are scattered across unrelated aisles, the searches are broad category words like "cheese" or "snacks" if there are any at all, and the basket is empty or holds one or two incidental things.',
      comparing:
        'The shopper is weighing alternatives within a single kind of product. Several of the products viewed are near-substitutes for one another — different brands, sizes or variants of the same thing — and the searches name that kind of product rather than a specific item.',
      ready_to_buy:
        'The shopper has decided. The basket holds the things they came for, recent views are of items already in the basket or of last additions to complete it, and any searches name specific products they are going to buy rather than categories to explore. A basket of routine staples — milk, bread, eggs, bin bags, washing-up liquid — counts as decided: someone restocking what has run out already knows what they want, even though the items share no theme.',
    }
  ),

  specific_product: noul(
    [
      'A shopper typed the search queries in `browsing.search_queries` into an online grocery site.',
      'Answer yes if those queries name a specific product or a specific brand, such as "hass avocado", "yeo valley butter" or "tenderstem broccoli".',
      'Answer no if the queries name only a broad category or a kind of food, such as "cheese", "snacks", "vegetables" or "wine".',
      'If there are no search queries at all, answer no.',
    ],
    {
      true: 'The searches name a particular product or a particular brand.',
      false:
        'The searches name only a broad category, or there were no searches.',
    }
  ),

  blocker: noul(
    [
      'A shopper is on an online grocery site. Read their search queries in `browsing.search_queries` and the pages implied by `browsing.aisles_visited`.',
      'Answer yes if they appear to be looking for information about the service rather than for food: delivery slots or delivery times, delivery charges or minimum spend, what happens when an item is substituted or unavailable, or how to return or refund something.',
      'Answer no if everything they are doing is about choosing groceries.',
    ],
    {
      true: 'They are seeking delivery, cost, substitution or returns information.',
      false: 'They are simply shopping for groceries.',
    }
  ),

  shop_type: choice(
    'Read the item names in `basket.items[].name` and the product names in `browsing.products_viewed[].name`, and decide what kind of grocery shop this is.',
    {
      weekly_shop:
        'A broad household shop covering many parts of the kitchen at once — fresh food, cupboard staples, and household or cleaning items together. The kind of shop that stocks a home for the week.',
      top_up:
        'A small handful of everyday essentials that have run out — milk, bread, eggs, butter — with nothing else alongside them.',
      single_meal:
        'The ingredients for one meal. The items fit together as a dish or a dinner, such as pasta with a sauce and cheese, or fish with vegetables and a lemon.',
      special_occasion:
        'A shop for an event or a treat rather than ordinary eating: celebration food, wine or spirits, desserts, party items, or notably premium cuts and ingredients.',
    }
  ),
} as const;


/* ---------------------------------------------------------------------------
 * Signals → Jev state
 * ------------------------------------------------------------------------- */

/** Signals may serve a scalar wrapped in a single-element array. */
function unwrap(v: unknown): unknown {
  return Array.isArray(v) && v.length === 1 ? v[0] : v;
}

/**
 * Signals serves list attributes wrapped one level deeper than they read —
 * `cart_product_names` arrives as `[["Sourdough Bloomer", …]]`, and an empty
 * attribute arrives as `[null]`. Unwrap before flattening.
 */
function asList(v: unknown): string[] {
  const raw = unwrap(v);
  if (Array.isArray(raw)) {
    return raw
      .flat()
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  if (typeof raw === 'string' && raw.trim() !== '') return [raw];
  return [];
}

function asNumber(v: unknown): number {
  const raw = unwrap(v);
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The exact JSON shape the questions above read. */
interface JevState {
  basket: {
    item_count: number;
    distinct_products: number;
    subtotal_gbp: number;
    items: { name: string; aisle?: string; quantity?: number; price_gbp?: number }[];
  };
  browsing: {
    products_viewed: { name: string; aisle?: string }[];
    search_queries: string[];
    aisles_visited: string[];
  };
  session: {
    page_count: number;
    duration_minutes: number;
    distinct_aisles_visited: number;
    products_viewed_count: number;
    search_query_count: number;
    checkout_steps_completed: number;
    purchases_completed: number;
  };
  delivery: {
    free_delivery_threshold_gbp: number;
    amount_to_free_delivery_gbp: number;
    qualifies_for_free_delivery: boolean;
  };
}

/**
 * Build the Jev state from the `demo_grocery` service's attributes.
 *
 * The four list attributes carry the semantics; every number is either served
 * pre-computed by Signals or derived here from a list length. Nothing is
 * inferred and nothing is asked of the model.
 *
 * `aisle` is deliberately absent from the per-item objects: Signals aggregates
 * `categories_viewed` at session level, not per product, so there is no honest
 * per-item aisle to report. Every question reads the item NAMES instead.
 */
function stateFromSignals(
  attributes: Record<string, unknown>,
  meta: { pageCount: number; durationMinutes: number }
): JevState {
  const searchTerms = asList(attributes.search_terms);
  const productNamesViewed = asList(attributes.product_names_viewed);
  const cartProductNames = asList(attributes.cart_product_names);
  const categoriesViewed = asList(attributes.categories_viewed);

  const cartValue = round2(asNumber(attributes.cart_value));
  const cartAddCount = asNumber(attributes.cart_add_count);
  const productViewCount = asNumber(attributes.product_view_count);
  const checkoutStarted = asNumber(attributes.checkout_started);
  const purchaseCompleted = asNumber(attributes.purchase_completed);

  const amountToFreeDelivery = round2(
    Math.max(0, FREE_DELIVERY_THRESHOLD - cartValue)
  );

  return {
    basket: {
      item_count: cartAddCount,
      distinct_products: cartProductNames.length,
      subtotal_gbp: cartValue,
      items: cartProductNames.map((name) => ({ name })),
    },
    browsing: {
      products_viewed: productNamesViewed.map((name) => ({ name })),
      search_queries: searchTerms,
      aisles_visited: categoriesViewed,
    },
    session: {
      page_count: meta.pageCount,
      duration_minutes: meta.durationMinutes,
      distinct_aisles_visited: categoriesViewed.length,
      products_viewed_count: productViewCount || productNamesViewed.length,
      search_query_count: searchTerms.length,
      checkout_steps_completed: checkoutStarted,
      purchases_completed: purchaseCompleted,
    },
    delivery: {
      free_delivery_threshold_gbp: FREE_DELIVERY_THRESHOLD,
      amount_to_free_delivery_gbp: amountToFreeDelivery,
      qualifies_for_free_delivery: amountToFreeDelivery === 0 && cartValue > 0,
    },
  };
}

/**
 * Did this shopper actually search? The `specific_product` question answers NO
 * when `browsing.search_queries` is empty — correctly, since there are no
 * queries to be specific — but an absent search box is absence of EVIDENCE,
 * not evidence the shopper is vague. Scoring that as a hard zero punished
 * anyone who navigated by aisle instead of typing.
 *
 * Note this reads the state rather than the answer: only the state can tell
 * the two cases apart, because "searched for a category" and "did not search"
 * both come back as a low noul.
 */
function hasSearchQueries(state: unknown): boolean {
  const queries = (state as { browsing?: { search_queries?: unknown } })
    ?.browsing?.search_queries;
  return Array.isArray(queries) && queries.length > 0;
}

interface IntentSuccess {
  configured: true;
  /** Where the classified state came from — shown in the panel. */
  source: 'signals' | 'local';
  source_status: 'live';
  /** The Signals service the state was read from (source === 'signals'). */
  service?: string;
  /** The raw Signals attributes the state was built from, for the presenter. */
  attributes?: Record<string, unknown>;
  model: string;
  /** 0–1 composite, computed in code from the three judgments below. */
  intent_score: number;
  stage: {
    choice: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  shop_type: {
    choice: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  specific_product: {
    noul: number;
    /** False when the shopper never searched, so the term was dropped. */
    applied: boolean;
  };
  blocker: { noul: number };
  /** Echoed back so the panel can show exactly what Jev saw. */
  state: unknown;
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
    source?: 'signals' | 'local';
    localState?: unknown;
  } | null;

  if (!body || typeof body !== 'object') {
    return Response.json(
      { configured: true, error: 'Expected a JSON request body.' },
      { status: 400 }
    );
  }

  const source: 'signals' | 'local' = body.source === 'local' ? 'local' : 'signals';

  // Counters Signals does not carry, computed in the client and passed through
  // untouched. They are display-only: the `stage` question is explicitly told
  // to ignore every numeric field.
  const pageCount = Number.isFinite(body.pageCount) ? Number(body.pageCount) : 0;
  const durationMinutes = body.sessionStartedAt
    ? Math.max(0, Math.round((Date.now() - Number(body.sessionStartedAt)) / 60000))
    : 0;

  // The SDK's `state` accepts any JSON object; typed loosely here and narrowed
  // by the two builders above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let state: any;
  let attributes: Record<string, unknown> | undefined;
  let service: string | undefined;

  if (source === 'local') {
    // Explicitly-requested fallback: classify the client's own session state.
    if (!body.localState || typeof body.localState !== 'object') {
      return Response.json(
        {
          configured: true,
          source,
          source_status: 'error',
          error: 'source "local" requires a localState object.',
        },
        { status: 400 }
      );
    }
    state = body.localState;
  } else {
    const result = await getSessionAttributesForIntent(body.sessionId ?? '');

    if (result.status === 'unconfigured') {
      return Response.json({
        configured: true,
        source,
        source_status: 'unconfigured',
        message:
          'Signals is not configured on the server (SIGNALS_API_URL + Console API key). Switch the source to Local to classify the browser session state instead.',
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

    if (result.isEmpty) {
      // A brand-new session legitimately has nothing in the profile store yet.
      // This is a normal state, not an error — the panel says so.
      return Response.json({
        configured: true,
        source,
        source_status: 'empty',
        service: result.service,
        attribute_key: result.attributeKey,
        session_id: body.sessionId ?? null,
        message:
          'No session data yet. Signals answered for this domain_sessionid but the attribute group is still empty — browse a product, search, or add something to the basket, then re-evaluate.',
      });
    }

    attributes = result.attributes;
    service = result.service;
    state = stateFromSignals(result.attributes, { pageCount, durationMinutes });
  }

  try {
    const client = new TypeSafeClient({ apiKey });
    const { model, answers, usage } = await client.systemOne(
      { state, questions: QUESTIONS },
      { timeout: 25_000 }
    );

    // ── Composite score, computed HERE — never asked of the model ──────────
    // With searches:     0.7 × P(ready_to_buy) + 0.3 × specific_product
    // Without searches:  P(ready_to_buy) alone
    //
    // The two weights keep the 0.5 : 0.2 ratio the three-term composite used
    // before the `converging` Score was dropped; only the normalization moved.
    //
    // A shopper who never searched gives us no evidence on the specific-product
    // axis, so that term is DROPPED and the remaining weight renormalizes to 1
    // rather than scoring the missing evidence as zero. Without this, browsing
    // purely by aisle capped the intent score at 0.7 no matter how obviously
    // decided the basket looked.
    //
    // Reading viewed product NAMES here instead would not work: every name in
    // the catalog is specific by construction ("Organic Hass Avocados"), so the
    // question would return yes for anyone who viewed anything and the signal
    // would saturate. Search wording is evidence because the SHOPPER chose it.
    const readyToBuy = answers.stage.probabilities.ready_to_buy ?? 0;
    const searched = hasSearchQueries(state);
    const intentScore = searched
      ? 0.7 * readyToBuy + 0.3 * answers.specific_product.noul
      : readyToBuy;

    const payload: IntentSuccess = {
      configured: true,
      source,
      source_status: 'live',
      ...(service ? { service } : {}),
      ...(attributes ? { attributes } : {}),
      model,
      intent_score: Math.round(intentScore * 1000) / 1000,
      stage: {
        choice: answers.stage.choice,
        confidence: answers.stage.confidence,
        probabilities: { ...answers.stage.probabilities },
      },
      shop_type: {
        choice: answers.shop_type.choice,
        confidence: answers.shop_type.confidence,
        probabilities: { ...answers.shop_type.probabilities },
      },
      specific_product: { noul: answers.specific_product.noul, applied: searched },
      blocker: { noul: answers.blocker.noul },
      state,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
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
