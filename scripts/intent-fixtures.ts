/**
 * Signals-shaped intent fixtures (12 from the spec + foodie traps) for scripts/eval-intent.ts.
 *
 * Each fixture is written as a JOURNEY — an ordered list of the ecommerce
 * events the site would send — and compiled here into exactly what the route
 * receives from Signals:
 *
 *   • `attributes` — the `demo_grocery` service response for attribute group
 *     `demo_ecom_plugin_session` v8, WITH Signals' serving quirks: every value
 *     wrapped in a single-element array (`[3]`), lists wrapped one level deeper
 *     (`[["a", "b"]]`), unset attributes as `[null]`. That is what
 *     src/lib/intent.ts's asList/asNumber unwrap.
 *   • `timeline`  — the Event Log (`grocery_agentic_context`) narrative.
 *
 * Product names, brands, aisles (as the tracked `product.category`, i.e. the
 * aisle NAME), prices and list prices all come from src/lib/catalog.ts, so a
 * fixture can't drift from what tracking would really send.
 *
 * NARRATIVE FORMAT — matched to a live `grocery_agentic_context` narrative:
 * the Event Log's descriptive prompt, a [START CONTEXT] block with Signals'
 * recency line, then one CSV-ish row per event —
 *   `seconds, event, url, {action: '…', brand: '…', category: '…', …}`
 * (search rows as `search_performed, url, {search: '…'}`, logged twice as the
 * live site does). Timings and the recency line are synthetic.
 */

import { aisles, products, type Product } from '@/lib/catalog';

export type JourneyEvent =
  | { type: 'search'; query: string }
  | { type: 'view'; name: string }
  | { type: 'add'; name: string; qty?: number }
  | { type: 'remove'; name: string; qty?: number }
  | { type: 'checkout' }
  | { type: 'purchase' };

export interface Expectation {
  /** One label, or several acceptable ones (any of them may win). */
  stage?: string | string[];
  /** Jev's occasion; for restock use `restock:weekly` / `restock:top_up`. */
  occasion?: string;
  /** Traits expected at/above their threshold (plant_based uses the filter bar). */
  traitsHigh?: string[];
  /** Traits expected to stay BELOW threshold (traps). */
  traitsLow?: string[];
  /** Trait that must NOT be the persona headline (or the gate stays closed). */
  notHeadline?: string;
}

export interface Fixture {
  /** Display id; also what `npm run eval:intent -- <id…>` filters on. */
  id: number | string;
  name: string;
  journey: JourneyEvent[];
  expect: Expectation;
}

export interface CompiledFixture extends Fixture {
  attributes: Record<string, unknown>;
  timeline: string;
}

// ─── The journeys ──────────────────────────────────────────────────────

export const FIXTURES: Fixture[] = [
  {
    id: 1,
    name: 'views across 4 aisles, no search, nothing added',
    journey: [
      { type: 'view', name: 'Organic Blueberries' },
      { type: 'view', name: 'Sourdough Bloomer' },
      { type: 'view', name: 'Vanilla Bean Ice Cream' },
      { type: 'view', name: 'Kombucha' },
      { type: 'view', name: 'Pain Au Chocolat' },
    ],
    expect: { stage: 'browsing' },
  },
  {
    id: 2,
    name: 'searches spaghetti + chopped tomatoes, views matches, 1 added',
    journey: [
      { type: 'search', query: 'spaghetti' },
      { type: 'view', name: 'Bronze Die Spaghetti' },
      { type: 'add', name: 'Bronze Die Spaghetti' },
      { type: 'search', query: 'chopped tomatoes' },
      { type: 'view', name: 'Italian Chopped Tomatoes' },
    ],
    expect: { stage: 'on_a_mission', occasion: 'meal' },
  },
  {
    id: 3,
    // Spec says olive oil too, but the catalogue has only one olive oil —
    // coffee has three ranges (Basics / Select ground / Select beans).
    name: 'coffee: Basics vs Select ground vs Select beans, back and forth',
    journey: [
      { type: 'search', query: 'coffee' },
      { type: 'view', name: 'Instant Coffee' },
      { type: 'view', name: 'Colombian Ground Coffee' },
      { type: 'view', name: 'Single-Origin Coffee Beans' },
      { type: 'view', name: 'Instant Coffee' },
      { type: 'view', name: 'Colombian Ground Coffee' },
    ],
    expect: { stage: 'comparing' },
  },
  {
    id: 4,
    name: 'spaghetti + tomatoes + mozzarella added, re-checks basket',
    journey: [
      { type: 'view', name: 'Bronze Die Spaghetti' },
      { type: 'add', name: 'Bronze Die Spaghetti' },
      { type: 'view', name: 'Italian Chopped Tomatoes' },
      { type: 'add', name: 'Italian Chopped Tomatoes' },
      { type: 'view', name: 'Mozzarella Ball' },
      { type: 'add', name: 'Mozzarella Ball' },
      { type: 'view', name: 'Bronze Die Spaghetti' },
      { type: 'view', name: 'Mozzarella Ball' },
    ],
    expect: { stage: 'ready_to_buy', occasion: 'meal' },
  },
  {
    id: 5,
    name: 'basket built, removes ribeye + wine, swaps to value chicken',
    journey: [
      { type: 'view', name: '28-Day Aged Ribeye Steak' },
      { type: 'add', name: '28-Day Aged Ribeye Steak' },
      { type: 'add', name: 'Marlborough Sauvignon Blanc' },
      { type: 'add', name: 'Tenderstem Broccoli' },
      { type: 'add', name: 'British Maris Piper Potatoes' },
      { type: 'remove', name: '28-Day Aged Ribeye Steak' },
      { type: 'view', name: 'Marlborough Sauvignon Blanc' },
      { type: 'remove', name: 'Marlborough Sauvignon Blanc' },
      { type: 'view', name: 'Value Chicken Portions' },
      { type: 'add', name: 'Value Chicken Portions' },
      { type: 'view', name: 'Tenderstem Broccoli' },
    ],
    expect: { stage: 'hesitating', traitsHigh: ['budget_driven'] },
  },
  {
    id: 6,
    name: 'milk, bread, eggs only',
    journey: [
      { type: 'view', name: 'Semi-Skimmed Milk' },
      { type: 'add', name: 'Semi-Skimmed Milk' },
      { type: 'view', name: 'Soft White Rolls' },
      { type: 'add', name: 'Soft White Rolls' },
      { type: 'view', name: 'Free-Range Large Eggs' },
      { type: 'add', name: 'Free-Range Large Eggs' },
    ],
    expect: { stage: 'ready_to_buy', occasion: 'restock:top_up' },
  },
  {
    id: 7,
    name: '12 adds across produce, pantry, dairy, household',
    journey: [
      'Bananas',
      'Chantenay Carrots',
      'Baby Leaf Spinach',
      'Basmati Rice',
      'Rolled Porridge Oats',
      'Baked Beans',
      'Semi-Skimmed Milk',
      'Mature Cheddar',
      'Greek Style Natural Yoghurt',
      'Kitchen Roll',
      'Washing Up Liquid, Lemon',
      'Non-Bio Laundry Liquid',
    ].map((name) => ({ type: 'add' as const, name })),
    expect: { occasion: 'restock:weekly' },
  },
  {
    id: 8,
    name: 'search bbq → buns, sausages ×3, IPA ×2, spring rolls',
    journey: [
      { type: 'search', query: 'bbq' },
      { type: 'view', name: 'Brioche Burger Buns' },
      { type: 'add', name: 'Brioche Burger Buns', qty: 2 },
      { type: 'view', name: 'Cumberland Sausages' },
      { type: 'add', name: 'Cumberland Sausages', qty: 3 },
      { type: 'view', name: 'Craft Session IPA' },
      { type: 'add', name: 'Craft Session IPA', qty: 2 },
      { type: 'add', name: 'Vegetable Spring Rolls' },
    ],
    expect: { occasion: 'event' },
  },
  {
    id: 9,
    name: 'aged ribeye + Sauvignon Blanc + dark chocolate, qty 1',
    journey: [
      { type: 'view', name: '28-Day Aged Ribeye Steak' },
      { type: 'add', name: '28-Day Aged Ribeye Steak' },
      { type: 'view', name: 'Marlborough Sauvignon Blanc' },
      { type: 'add', name: 'Marlborough Sauvignon Blanc' },
      { type: 'view', name: 'Dark Chocolate 70%' },
      { type: 'add', name: 'Dark Chocolate 70%' },
    ],
    expect: { occasion: 'meal', traitsHigh: ['foodie_explorer'] },
  },
  {
    id: 10,
    // Only two catalogue items carry the `Marketside Plant` brand (mince, oat
    // drink), so "mostly Plant" isn't possible — the rest are vegan staples.
    name: 'plant-based: "vegan" search, Plant range + pulses/veg, no meat/dairy',
    journey: [
      { type: 'search', query: 'vegan' },
      { type: 'view', name: 'Plant Based Mince' },
      { type: 'add', name: 'Plant Based Mince' },
      { type: 'view', name: 'Oat Drink Barista' },
      { type: 'add', name: 'Oat Drink Barista' },
      { type: 'add', name: 'Chickpeas' },
      { type: 'add', name: 'Quinoa' },
      { type: 'add', name: 'Organic Kale' },
      { type: 'add', name: 'Pre-Chopped Stir Fry Vegetables' },
    ],
    expect: { traitsHigh: ['plant_based'] },
  },
  {
    id: '10b',
    name: 'plant-based THIN: plant mince, oat drink, chickpeas only',
    journey: [
      { type: 'add', name: 'Plant Based Mince' },
      { type: 'add', name: 'Oat Drink Barista' },
      { type: 'add', name: 'Chickpeas' },
    ],
    // Intended: the filter hides whole aisles, so it needs solid evidence.
    expect: { traitsLow: ['plant_based'] },
  },
  {
    id: 11,
    name: 'TRAP: oat drink + bacon + cheddar',
    journey: [
      { type: 'view', name: 'Oat Drink Barista' },
      { type: 'add', name: 'Oat Drink Barista' },
      { type: 'view', name: 'Dry-Cure Smoked Back Bacon' },
      { type: 'add', name: 'Dry-Cure Smoked Back Bacon' },
      { type: 'add', name: 'Mature Cheddar' },
    ],
    expect: { traitsLow: ['plant_based'] },
  },
  {
    id: 12,
    name: 'premium picks, but only the marked-down ones',
    journey: [
      { type: 'view', name: 'Champagne Brut' },
      { type: 'view', name: 'Marlborough Sauvignon Blanc' },
      { type: 'add', name: 'Marlborough Sauvignon Blanc' },
      { type: 'view', name: 'Beef Wellington' },
      { type: 'view', name: '28-Day Aged Ribeye Steak' },
      { type: 'add', name: '28-Day Aged Ribeye Steak' },
      { type: 'add', name: 'All-Butter Croissants' },
      { type: 'add', name: 'Organic Hass Avocados' },
    ],
    expect: { traitsHigh: ['budget_driven', 'foodie_explorer'] },
  },
  {
    id: 13,
    name: 'TRAP: plain everyday basket + one Select item',
    journey: [
      'Semi-Skimmed Milk',
      'Free-Range Large Eggs',
      'Bananas',
      'Baked Beans',
      'Soft White Rolls',
      'Colombian Ground Coffee',
    ].map((name) => ({ type: 'add' as const, name })),
    expect: { traitsLow: ['foodie_explorer'] },
  },
  {
    id: 14,
    name: 'TRAP: browse-only, viewing Select items, nothing added',
    journey: [
      { type: 'view', name: 'Aged Parmigiano Reggiano' },
      { type: 'view', name: 'White Truffle Oil' },
      { type: 'view', name: 'Champagne Brut' },
      { type: 'view', name: 'Luxury Belgian Chocolates' },
    ],
    expect: { notHeadline: 'foodie_explorer' },
  },
  {
    id: 15,
    // Reproduces a live session: Mozzarella removed then straight back in —
    // a correction, not doubt. Tomatoes added as two separate adds, as the
    // live narrative shows.
    name: 'LIVE: pasta basket, mozzarella removed then re-added',
    journey: [
      { type: 'search', query: 'spaghetti' },
      { type: 'view', name: 'Bronze Die Spaghetti' },
      { type: 'add', name: 'Bronze Die Spaghetti' },
      { type: 'view', name: 'Italian Chopped Tomatoes' },
      { type: 'add', name: 'Italian Chopped Tomatoes' },
      { type: 'add', name: 'Italian Chopped Tomatoes' },
      { type: 'view', name: 'Mozzarella Ball' },
      { type: 'add', name: 'Mozzarella Ball' },
      { type: 'remove', name: 'Mozzarella Ball' },
      { type: 'view', name: 'Mozzarella Ball' },
      { type: 'add', name: 'Mozzarella Ball' },
    ],
    expect: { stage: ['ready_to_buy', 'on_a_mission'], occasion: 'meal' },
  },
];

// ─── Compile a journey into what Signals serves ──────────────────────────────

const aisleNameBySlug = new Map(aisles.map((a) => [a.slug, a.name]));

function product(name: string): Product {
  const p = products.find((x) => x.name === name);
  if (!p) throw new Error(`Fixture product not in catalogue: ${name}`);
  return p;
}

function onOffer(p: Product): boolean {
  return !!p.wasPrice && p.wasPrice > p.price;
}

/** The Event Log's descriptive prompt, verbatim from a live narrative. */
const NARRATIVE_PROMPT =
  "This is an online grocery shopper's activity this session, ordered oldest to newest. Each row is one action. `search` is a search term exactly as the shopper typed it. `action` is the ecommerce action type: product_view = looked at a product; add_to_cart = put it in the basket; remove_from_cart = took it out of the basket; checkout_step = moved through checkout; transaction = completed a purchase. `product`, `brand` and `category` are the item's name, its brand or range, and its aisle. `quantity` is the number of units added or removed in that action. `price` is the unit price; when `list_price` is present and higher than `price`, the item was on offer and `list_price` is its original price.";

/** Signals serving shape: scalar → [v], list → [[…]], empty → [null]. */
const served = {
  num: (n: number) => [n],
  list: (xs: string[]) => (xs.length ? [xs] : [null]),
};

function uniquePush(list: string[], v: string) {
  if (!list.includes(v)) list.push(v);
}

export function compileFixture(f: Fixture): CompiledFixture {
  const searchTerms: string[] = [];
  const viewed: string[] = [];
  const categoriesViewed: string[] = [];
  const cartNames: string[] = [];
  const cartBrands: string[] = [];
  const cartCategories: string[] = [];
  const removed: string[] = [];
  const onOfferNames: string[] = [];
  let viewCount = 0;
  let addCount = 0;
  let onOfferCount = 0;
  let checkout = 0;
  let purchase = 0;
  const qty = new Map<string, number>();
  const lines: string[] = [];

  const cartValue = () =>
    Math.round(
      [...qty.entries()].reduce((s, [n, q]) => s + product(n).price * q, 0) * 100
    ) / 100;

  // Rows mimic the Signals narrative: `seconds, event, url, {context}`, with
  // context keys in alphabetical order and numbers unformatted.
  const ctx = (o: Record<string, string | number | undefined>) =>
    `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) =>
        typeof o[k] === 'number' ? `${k}: ${o[k]}` : `${k}: '${String(o[k]).replace(/'/g, "\\'")}'`
      )
      .join(', ')}}`;
  let secs = 4;
  let lastUrl = '/';

  f.journey.forEach((e) => {
    secs += 6;
    if (e.type === 'search') {
      uniquePush(searchTerms, e.query);
      // The live site logs every search twice (quick-search debounce + the
      // submitted search), so the narrative carries two identical rows.
      const row = `${secs}, search_performed, ${lastUrl}, ${ctx({ search: e.query })}`;
      lines.push(row, row);
      return;
    }
    if (e.type === 'checkout' || e.type === 'purchase') {
      if (e.type === 'checkout') checkout += 1;
      else purchase += 1;
      lastUrl = '/checkout';
      lines.push(
        `${secs}, snowplow_ecommerce_action, ${lastUrl}, ${ctx({ action: e.type === 'checkout' ? 'checkout_step' : 'transaction' })}`
      );
      return;
    }
    const p = product(e.name);
    const category = aisleNameBySlug.get(p.aisle) ?? p.aisle;
    const base = {
      brand: p.brand,
      category,
      price: p.price,
      product: p.name,
      list_price: onOffer(p) ? p.wasPrice : undefined,
    };
    if (e.type === 'view') {
      viewCount += 1;
      uniquePush(viewed, p.name);
      uniquePush(categoriesViewed, category);
      lastUrl = `/product/${p.sku}`;
      lines.push(`${secs}, snowplow_ecommerce_action, ${lastUrl}, ${ctx({ action: 'product_view', ...base })}`);
      return;
    }
    const n = e.qty ?? 1;
    if (e.type === 'add') {
      addCount += 1;
      uniquePush(cartNames, p.name);
      uniquePush(cartBrands, p.brand);
      uniquePush(cartCategories, category);
      if (onOffer(p)) {
        onOfferCount += 1;
        uniquePush(onOfferNames, p.name);
      }
      qty.set(p.name, (qty.get(p.name) ?? 0) + n);
      if (!lastUrl.startsWith('/product/')) lastUrl = `/product/${p.sku}`;
      lines.push(`${secs}, snowplow_ecommerce_action, ${lastUrl}, ${ctx({ action: 'add_to_cart', ...base, quantity: n })}`);
      return;
    }
    // remove — done from the basket page
    uniquePush(removed, p.name);
    const left = (qty.get(p.name) ?? 0) - n;
    if (left > 0) qty.set(p.name, left);
    else qty.delete(p.name);
    lastUrl = '/cart';
    lines.push(`${secs}, snowplow_ecommerce_action, ${lastUrl}, ${ctx({ action: 'remove_from_cart', ...base, quantity: n })}`);
  });

  const attributes: Record<string, unknown> = {
    search_terms: served.list(searchTerms),
    product_names_viewed: served.list(viewed),
    categories_viewed: served.list(categoriesViewed),
    product_view_count: served.num(viewCount),
    cart_product_names: served.list(cartNames),
    cart_add_count: served.num(addCount),
    cart_value: served.num(cartValue()),
    cart_on_offer_names: served.list(onOfferNames),
    cart_on_offer_count: served.num(onOfferCount),
    checkout_started: served.num(checkout),
    purchase_completed: served.num(purchase),
    // v8
    cart_brands: served.list(cartBrands),
    cart_categories: served.list(cartCategories),
    cart_removed_names: served.list(removed),
  };

  // Header + framing copied from a live `grocery_agentic_context` narrative
  // (Event Log prompt, then the Signals context block).
  const lastActivity = 20;
  const timeline = [
    NARRATIVE_PROMPT,
    '[START CONTEXT]',
    `Last activity ${lastActivity} seconds ago, ${lastActivity + 8} seconds on the current page. Session started ${secs + lastActivity} seconds ago. Based on last 50 recorded events for the last 3600 seconds.`,
    '## Real-time user behaviour',
    'Events are ordered from oldest to most recent.',
    'seconds_since_start_of_session, event, url, event_context',
    ...lines,
    '[END CONTEXT]',
  ].join('\n');

  return { ...f, attributes, timeline };
}
