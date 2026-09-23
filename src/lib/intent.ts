/**
 * Purchase intent — the shared core behind /api/intent AND scripts/eval-intent.ts.
 *
 *   Signals serves facts · code applies policy · Jev (TypeSafe System One) reads meaning.
 *
 * Each label drives an action:
 *   stage    = WHEN / how hard to intervene
 *   occasion = WHAT to show
 *   persona  = HOW to frame it (or, for plant_based, what to FILTER out)
 *
 * This module owns three things, all pure (no Next, no `server-only`, no
 * credentials) so the eval script runs exactly the same code as the route:
 *
 *   1. QUESTIONS            — stage (Choice, 5), occasion (Choice, 4), five
 *                             persona Nouls. Structured criteria: means / signs /
 *                             not_this_if, so neighbouring options contrast.
 *   2. buildIntentInputs()  — Signals attributes (+ Event Log narrative) → the
 *                             Jev state (lists and words ONLY — no counts,
 *                             ratios, totals or delivery maths) plus the panel
 *                             metrics and evidence counts, returned separately.
 *   3. applyIntentPolicy()  — Jev's raw answers → what the panel claims:
 *                             checkout/purchased stage override, evidence gates,
 *                             restock weekly/top_up split, persona headline +
 *                             plant_based filter, and a suggested action per label.
 *
 * Thresholds live in `intentPolicy` (src/lib/config.ts).
 */

import {
  choice,
  noul,
  type EntryType,
  type SystemOneResult,
  type TypeSafeClient,
} from '@typesafe-ai/sdk';

import { FREE_DELIVERY_THRESHOLD } from './catalog';
import { intentPolicy } from './config';

/* ---------------------------------------------------------------------------
 * Questions
 * ------------------------------------------------------------------------- */

/**
 * How to read removals — shared by every question. `removed_this_session` is
 * a unique list of everything taken out at SOME point, so an item removed and
 * then added back sits in BOTH lists. Code never subtracts one from the other
 * (that would drop a re-added item from the basket); the timeline decides.
 */
const REMOVAL_RULE =
  'An item in `removed_this_session` counts as removed only if `session_timeline` shows it was NOT added back afterwards. An item removed and then re-added is still in the basket. With no timeline, an item in both `added_this_session` and `removed_this_session` may have been re-added — treat it as uncertain, not as removed.';

/** Shared note on every persona Noul: a "no" means ABSENCE of evidence. */
const NO_EVIDENCE_IS_NO =
  'Answer no when there is simply no evidence of this trait. "No" does NOT mean the shopper is the opposite of it.';

/**
 * The persona evidence fields, named once so every Noul reads the same state.
 * ADDED items only: a view shows curiosity, not preference — and the catalogue
 * is full of Select-range, evocative names a shopper merely passes by.
 */
const PERSONA_EVIDENCE = {
  primary:
    '`added_this_session`, `cart_brands` and `cart_categories` — what they put in the basket, its brands or ranges, and its aisles',
  offers: '`on_offer_added` — added items that were marked down',
  timeline:
    'In `session_timeline`, use only the add_to_cart and remove_from_cart rows, and only for their order and price vs list_price.',
  removals:
    'An item removed and later added back still counts as added; one removed and never added back does not.',
  ignore: 'Ignore browsing, product views and searches — curiosity, not preference.',
};

export const QUESTIONS = {
  stage: choice(
    {
      question: "Decide the shopper's mindset RIGHT NOW on an online grocery site.",
      evidence: [
        '`browsing.search_queries` and `browsing.products_viewed`',
        '`added_this_session` and `removed_this_session`',
        '`session_timeline` when present — an oldest-to-newest account of what they did',
      ],
      weighting:
        'Weight the most recent activity most. Earlier activity only shows how they got here.',
      removals: REMOVAL_RULE,
      repeated_searches:
        'Identical search rows next to each other are ONE search (the site logs a quick search and the submitted search separately). Do not read them as searching around.',
    },
    {
      browsing: {
        means: 'No settled goal yet — looking for ideas.',
        signs: [
          'views spread across unrelated products and aisles',
          'broad searches, or none',
          'little or nothing added',
        ],
        not_this_if: 'They keep returning to one kind of product (that is comparing).',
      },
      on_a_mission: {
        means: 'Knows what they want and is still finding it.',
        signs: [
          'searches name specific items',
          'views go straight to the products matching those searches',
          'the basket is still being built',
        ],
        not_this_if: 'They already have what they came for (that is ready_to_buy).',
      },
      comparing: {
        means: 'Weighing near-substitutes of one thing and has not chosen.',
        signs: [
          'several brands, sizes or ranges of the SAME product viewed (e.g. Marketside vs Marketside Select vs Marketside Basics)',
          'going back and forth between those alternatives',
        ],
        not_this_if: 'The alternatives are different kinds of product (that is browsing).',
      },
      ready_to_buy: {
        means: 'Has what they came for and is finishing up.',
        signs: [
          'a coherent basket',
          'recent actions are last additions or re-checking items already added',
          'a basket of everyday staples being restocked counts as decided',
          'a removal undone by adding the same item back does not change this',
        ],
        not_this_if:
          'Items were recently removed and stayed out, or swapped for cheaper versions (that is hesitating).',
      },
      hesitating: {
        means: 'Had a basket and is now pulling back or stalling.',
        signs: [
          'an item was removed and STAYS out — not added back later in the timeline',
          'an item was swapped for a cheaper or plainer version',
          'stalling: re-viewing basket items again and again without adding or moving on',
        ],
        not_this_if:
          'An item was removed and then the same item was added back — that is a correction, not doubt. Likewise a removal replaced straight away while they carry on adding.',
      },
    }
  ),

  occasion: choice(
    {
      question:
        'Decide what this grocery shop is FOR, judging the whole set of items together — not any single one.',
      evidence: [
        '`added_this_session` and `removed_this_session`',
        '`cart_brands` and `cart_categories`',
        '`browsing.search_queries`',
        '`session_timeline` when present',
      ],
      removals: REMOVAL_RULE,
      strong_evidence:
        'Searches naming an event or a dish ("bbq", "birthday cake", "lasagne") are strong evidence.',
      quantity:
        'Quantities (shown in the timeline) separate a meal for a household from an event for a group.',
    },
    {
      restock: {
        means: 'Replenishing everyday household items — any size of shop, from a few essentials to a full weekly stock-up.',
        signs: [
          'staples such as milk, bread, eggs, fruit, cleaning or laundry items',
          'items that do not build one dish',
        ],
        not_this_if: 'The items combine into one dish or dinner (that is meal).',
      },
      meal: {
        means: 'Building one dish or one dinner.',
        signs: [
          'ingredients that fit together, e.g. pasta, tomatoes and mozzarella',
          'a premium dinner such as steak with wine and dessert counts',
          'ordinary quantities for one household',
        ],
        not_this_if: 'The food is for a group or a celebration (that is event).',
      },
      event: {
        means: 'Feeding a group or celebrating.',
        signs: [
          'bbq, party or guests',
          'sharing food such as buns, sausages, party snacks, spring rolls',
          'drinks or food in quantity',
        ],
        not_this_if: 'It is one dinner for the household (that is meal).',
      },
      unclear: {
        means:
          'There is evidence, but it does not cohere into any one of restock, meal or event.',
        not_this_if: 'The items clearly fit one purpose.',
      },
    }
  ),

  /* ── Persona — five Nouls ─────────────────────────────────────────────
   * Traits co-occur (budget + foodie is a real shopper), so each is its own
   * Noul with an independent probability. The headline and the plant_based
   * filter are policy, applied in code (applyIntentPolicy), never asked. */
  is_budget_driven: noul(
    {
      question: 'Is price steering this grocery shopper\'s choices?',
      evidence: PERSONA_EVIDENCE,
      rule:
        'If most of the items in `added_this_session` also appear in `on_offer_added`, that alone is a yes — whatever the range or brand, including Marketside Select and premium items. A deal-hunting foodie is budget-driven AND foodie.',
      note: NO_EVIDENCE_IS_NO,
    },
    {
      true: {
        means: 'Price steers what they pick.',
        signs: [
          'mostly plain Marketside or Marketside Basics chosen over Marketside Select',
          'most of the added items are on offer (`on_offer_added`), premium or not',
          'taking pricier items out and adding a cheaper or value version instead',
        ],
      },
      false: 'No evidence that price is driving the choices.',
    }
  ),

  is_health_conscious: noul(
    {
      question: 'Does this grocery shopper lean towards healthy food?',
      evidence: PERSONA_EVIDENCE,
      note: NO_EVIDENCE_IS_NO,
    },
    {
      true: {
        means: 'Choices lean fresh, wholegrain, low-sugar, high-protein or organic.',
        signs: [
          'fresh produce, organic ranges',
          'skyr, high-protein or low-fat dairy',
          'seeded wholemeal, oats, quinoa, chia',
          'zero-sugar drinks, vitamins',
        ],
      },
      false: 'No evidence of a health lean in the choices.',
    }
  ),

  is_convenience_seeking: noul(
    {
      question: 'Is this grocery shopper choosing ready-to-eat or minimal-prep food?',
      evidence: PERSONA_EVIDENCE,
      note: NO_EVIDENCE_IS_NO,
    },
    {
      true: {
        means: 'Choices favour food that is ready to eat or needs minimal preparation.',
        signs: [
          'pizza, ready meals, meal kits',
          'breaded fish, chips, spring rolls, goujons',
          'salad bowls, pre-chopped or ready-to-roast vegetables, cooked chicken',
        ],
      },
      false: 'No evidence of a lean towards ready-made food.',
    }
  ),

  is_foodie_explorer: noul(
    {
      question: 'Is this grocery shopper choosing quality, specialty or indulgence?',
      evidence: PERSONA_EVIDENCE,
      caution:
        'The catalogue is full of Marketside Select items and evocative product names. One such item, or a descriptive name, is NOT evidence on its own.',
      note: NO_EVIDENCE_IS_NO,
    },
    {
      true: {
        means:
          'Premium or specialty picks are the shopper\'s pattern — chosen over plainer options — or the added items are clearly indulgent.',
        signs: [
          'most of what they added is Marketside Select or specialty rather than the plain version',
          'wine or champagne, fine chocolate, desserts',
          'premium cuts such as aged steak',
        ],
      },
      false:
        'No such pattern: an ordinary everyday basket, even if it happens to include one Select item.',
    }
  ),

  is_plant_based: noul(
    {
      question:
        'Has this grocery shopper chosen plant-based alternatives AND added no meat, fish or dairy at all?',
      evidence: PERSONA_EVIDENCE,
    },
    {
      true: {
        means: 'BOTH: they chose plant alternatives AND nothing they added is meat, fish or dairy.',
        signs: [
          'Marketside Plant range, oat drink, plant-based mince, chickpeas',
          'no meat, fish, milk, cheese, butter, cream or yoghurt anywhere in `added_this_session`',
        ],
      },
      false:
        'Any meat, fish or dairy was added (e.g. bacon, cheddar), or no plant alternatives were chosen.',
    }
  ),
} as const;

export type IntentQuestions = typeof QUESTIONS;

/* ---------------------------------------------------------------------------
 * Suggested actions — one line per label, straight from the spec tables.
 * Show-only in the Inspector; nothing here drives the live site.
 * ------------------------------------------------------------------------- */

export const STAGE_ACTIONS: Record<string, string> = {
  browsing: 'Show inspiration / recipes',
  on_a_mission: 'Speed them up: direct links, “did you mean”',
  comparing: 'Comparison help, reviews, price-per-unit',
  ready_to_buy: 'Get out of the way, nudge to checkout',
  hesitating: 'Reassurance or an offer',
  checking_out: 'Keep checkout frictionless — no interruptions',
  purchased: 'Order confirmation, rebook next slot',
};

export const OCCASION_ACTIONS: Record<string, string> = {
  'restock:weekly': 'Favourites / book a delivery slot',
  'restock:top_up': 'Fast checkout + free-delivery nudge',
  meal: 'Complete the recipe',
  event: 'Bundles + quantity prompts',
  unclear: 'Generic merchandising',
};

export const PERSONA_ACTIONS: Record<string, string> = {
  budget_driven: 'Lead with offers, own-brand swaps, price-per-unit',
  health_conscious: 'Healthier swaps, nutrition badges',
  convenience_seeking: 'Ready-made alternatives, one-click bundles, “ready in X min”',
  foodie_explorer: 'Specialty / premium variants, pairing, recipe inspiration',
  generalist: 'Default framing',
};

export const PLANT_BASED_FILTER = 'Filter: exclude meat, fish & dairy from suggestions';

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
 * attribute arrives as `[null]`. An attribute the pinned group version does
 * not have (v8's cart_brands etc. on v7) is simply absent → `[]`.
 */
export function asList(v: unknown): string[] {
  const raw = unwrap(v);
  if (Array.isArray(raw)) {
    return raw
      .flat()
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  if (typeof raw === 'string' && raw.trim() !== '') return [raw];
  return [];
}

export function asNumber(v: unknown): number {
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

/**
 * The exact JSON Jev reads. Signals values passed through untouched —
 * lists and words only. No counts, durations, ratios, subtotal or delivery
 * maths: Jev is not asked to tally, and a number in the state is a number it
 * might anchor on. Those live in `IntentMetrics`, for the panel only.
 */
export interface JevState {
  /** Signals `cart_product_names` — every item ADDED this session. Named
   *  honestly: it is not the current basket (removals are not subtracted). */
  added_this_session: string[];
  /** Signals `cart_removed_names` (v8) — unique list; a re-added item is in
   *  BOTH lists. Deliberately NOT subtracted from `added_this_session`: the
   *  questions read the timeline to tell a correction from a real removal. */
  removed_this_session: string[];
  /** Signals `cart_on_offer_names` — raw list; no share/ratio computed. */
  on_offer_added: string[];
  /** Signals `cart_brands` (v8). */
  cart_brands: string[];
  /** Signals `cart_categories` (v8) — aisle names of the added items. */
  cart_categories: string[];
  browsing: {
    /** Signals `search_terms`. */
    search_queries: string[];
    /** Signals `product_names_viewed`. */
    products_viewed: string[];
    /** Signals `categories_viewed`. */
    aisles_visited: string[];
  };
  /** Signals Event Log (Agentic Context) narrative, oldest→newest. Absent
   *  for a brand-new session or when the Event Log is unavailable. */
  session_timeline?: string;
}

/** Numbers for the Inspector panel — never sent to Jev. */
export interface IntentMetrics {
  cart_add_count: number;
  cart_value_gbp: number;
  product_view_count: number;
  search_count: number;
  aisles_visited_count: number;
  cart_aisle_count: number;
  on_offer_count: number;
  removed_count: number;
  checkout_started: number;
  purchase_completed: number;
  amount_to_free_delivery_gbp: number;
  /** Client-side counters Signals does not carry (display only). */
  page_count: number;
  duration_minutes: number;
}

/** The counts the evidence gates read. */
export interface IntentEvidence {
  views: number;
  searches: number;
  adds: number;
}

export interface IntentInputs {
  state: JevState;
  metrics: IntentMetrics;
  evidence: IntentEvidence;
}

/**
 * Build the Jev state, the panel metrics and the gate evidence from the
 * `demo_grocery` service's attributes and (optionally) the Event Log narrative.
 * v8 attributes may be missing until that version is published — every read
 * degrades to an empty list / 0, never a crash.
 */
export function buildIntentInputs(
  attributes: Record<string, unknown>,
  timeline: string | null,
  meta: { pageCount?: number; durationMinutes?: number } = {}
): IntentInputs {
  const searchTerms = asList(attributes.search_terms);
  const productNamesViewed = asList(attributes.product_names_viewed);
  const categoriesViewed = asList(attributes.categories_viewed);
  const cartProductNames = asList(attributes.cart_product_names);
  const cartRemovedNames = asList(attributes.cart_removed_names);
  const onOfferNames = asList(attributes.cart_on_offer_names);
  const cartBrands = asList(attributes.cart_brands);
  const cartCategories = asList(attributes.cart_categories);

  const cartValue = round2(asNumber(attributes.cart_value));
  // Counters fall back to list lengths when a counter is absent.
  const adds = asNumber(attributes.cart_add_count) || cartProductNames.length;
  const views = asNumber(attributes.product_view_count) || productNamesViewed.length;

  const state: JevState = {
    added_this_session: cartProductNames,
    removed_this_session: cartRemovedNames,
    on_offer_added: onOfferNames,
    cart_brands: cartBrands,
    cart_categories: cartCategories,
    browsing: {
      search_queries: searchTerms,
      products_viewed: productNamesViewed,
      aisles_visited: categoriesViewed,
    },
    ...(timeline ? { session_timeline: timeline } : {}),
  };

  const metrics: IntentMetrics = {
    cart_add_count: adds,
    cart_value_gbp: cartValue,
    product_view_count: views,
    search_count: searchTerms.length,
    aisles_visited_count: categoriesViewed.length,
    cart_aisle_count: cartCategories.length,
    on_offer_count: asNumber(attributes.cart_on_offer_count) || onOfferNames.length,
    removed_count: cartRemovedNames.length,
    checkout_started: asNumber(attributes.checkout_started),
    purchase_completed: asNumber(attributes.purchase_completed),
    amount_to_free_delivery_gbp: round2(Math.max(0, FREE_DELIVERY_THRESHOLD - cartValue)),
    page_count: meta.pageCount ?? 0,
    duration_minutes: meta.durationMinutes ?? 0,
  };

  return { state, metrics, evidence: { views, searches: searchTerms.length, adds } };
}

/** True when there is anything at all for Jev to read. */
export function hasAnyEvidence(e: IntentEvidence): boolean {
  return e.views + e.searches + e.adds > 0;
}

/* ---------------------------------------------------------------------------
 * Policy — Jev's raw answers → what the panel claims
 * ------------------------------------------------------------------------- */

type Answers = SystemOneResult<IntentQuestions>['answers'];

interface RawChoice {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface StageResult {
  /** What the panel shows: Jev's choice, or `checking_out` / `purchased`
   *  when the Signals counters say so. */
  label: string;
  /** Jev's own choice — still reported when code overrides it. */
  jev_choice: string;
  /** Set when the label came from Signals counters, not Jev. */
  override: 'checking_out' | 'purchased' | null;
  confidence: number;
  probabilities: Record<string, number>;
  enough_signal: boolean;
  action: string | null;
}

export interface OccasionResult {
  /** Jev's choice; for restock, the display label carries the code split. */
  label: string;
  jev_choice: string;
  restock_split: 'weekly' | 'top_up' | null;
  confidence: number;
  probabilities: Record<string, number>;
  enough_signal: boolean;
  action: string | null;
}

export interface PersonaResult {
  /** Strongest framing trait ≥ threshold, else "generalist". */
  label: string;
  /** e.g. "Budget-driven · plant-based". */
  headline: string;
  confidence: number;
  /** All five raw Noul probabilities. */
  traits: Record<string, number>;
  /** Framing traits at or above threshold, strongest first. */
  active: string[];
  plant_based: { probability: number; active: boolean };
  enough_signal: boolean;
  action: string | null;
  /** The plant-based filter line, when active. */
  filter: string | null;
}

export interface IntentPolicyResult {
  stage: StageResult;
  occasion: OccasionResult;
  persona: PersonaResult;
}

const FRAMING_TRAITS = [
  'budget_driven',
  'health_conscious',
  'convenience_seeking',
  'foodie_explorer',
] as const;

function titleCase(trait: string): string {
  const s = trait.replace(/_/g, '-');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function copyChoice(a: RawChoice): RawChoice {
  return { choice: a.choice, confidence: a.confidence, probabilities: { ...a.probabilities } };
}

/**
 * Apply the code-side policy. Jev always answered every question; this decides
 * which answers the panel is allowed to claim, and what each one means.
 */
export function applyIntentPolicy(
  answers: Answers,
  inputs: IntentInputs
): IntentPolicyResult {
  const { metrics, evidence, state } = inputs;
  const g = intentPolicy.gates;

  // ── Stage: Signals counters beat Jev for checkout / purchase ──────────
  const stageRaw = copyChoice(answers.stage);
  const override: StageResult['override'] =
    metrics.purchase_completed > 0
      ? 'purchased'
      : metrics.checkout_started > 0
        ? 'checking_out'
        : null;
  const stageEnough =
    override !== null ||
    evidence.views + evidence.searches >= g.stageMinViewsOrSearches ||
    evidence.adds >= g.stageMinAdds;
  const stageLabel = override ?? stageRaw.choice;

  // ── Occasion + restock weekly / top_up split ──────────────────────────
  const occRaw = copyChoice(answers.occasion);
  const occEnough = evidence.adds >= g.occasionMinAdds || evidence.searches > 0;
  let restockSplit: OccasionResult['restock_split'] = null;
  if (occRaw.choice === 'restock') {
    const aisles = state.cart_categories;
    const broad =
      aisles.length >= intentPolicy.weeklyMinAisles &&
      aisles.includes(intentPolicy.weeklyRequiredAisle);
    restockSplit = broad || evidence.adds >= intentPolicy.weeklyMinAdds ? 'weekly' : 'top_up';
  }
  const occKey = restockSplit ? `restock:${restockSplit}` : occRaw.choice;

  // ── Persona: framing headline + plant_based filter ────────────────────
  const traits: Record<string, number> = {
    budget_driven: answers.is_budget_driven.noul,
    health_conscious: answers.is_health_conscious.noul,
    convenience_seeking: answers.is_convenience_seeking.noul,
    foodie_explorer: answers.is_foodie_explorer.noul,
    plant_based: answers.is_plant_based.noul,
  };
  const active = FRAMING_TRAITS.filter(
    (t) => traits[t] >= intentPolicy.personaFramingThreshold
  ).sort((a, b) => traits[b] - traits[a]);
  const label: string = active[0] ?? 'generalist';
  const plantP = traits.plant_based;
  const plantActive = plantP >= intentPolicy.plantBasedThreshold;
  const personaEnough = evidence.adds >= g.personaMinAdds;
  const topFraming = Math.max(...FRAMING_TRAITS.map((t) => traits[t]));

  return {
    stage: {
      label: stageLabel,
      jev_choice: stageRaw.choice,
      override,
      confidence: stageRaw.confidence,
      probabilities: stageRaw.probabilities,
      enough_signal: stageEnough,
      action: stageEnough ? STAGE_ACTIONS[stageLabel] ?? null : null,
    },
    occasion: {
      label: restockSplit ? `restock · ${restockSplit}` : occRaw.choice,
      jev_choice: occRaw.choice,
      restock_split: restockSplit,
      confidence: occRaw.confidence,
      probabilities: occRaw.probabilities,
      enough_signal: occEnough,
      action: occEnough ? OCCASION_ACTIONS[occKey] ?? null : null,
    },
    persona: {
      label,
      headline: [titleCase(label), ...(plantActive ? ['plant-based'] : [])].join(' · '),
      confidence: label === 'generalist' ? 1 - topFraming : traits[label],
      traits,
      active: [...active],
      plant_based: { probability: plantP, active: plantActive },
      enough_signal: personaEnough,
      action: personaEnough ? PERSONA_ACTIONS[label] ?? null : null,
      filter: personaEnough && plantActive ? PLANT_BASED_FILTER : null,
    },
  };
}

/* ---------------------------------------------------------------------------
 * One call: state → Jev → policy
 * ------------------------------------------------------------------------- */

export interface IntentEvaluation extends IntentPolicyResult {
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * All seven questions go in ONE `systemOne` call — answered in parallel, far
 * cheaper than seven round trips. Used by the route and the eval script alike.
 */
export async function evaluateIntent(
  client: TypeSafeClient,
  inputs: IntentInputs,
  options: { timeout?: number } = {}
): Promise<IntentEvaluation> {
  const { model, answers, usage } = await client.systemOne(
    // The SDK's EntryType wants an index-signature object; JevState is a
    // plain JSON shape, so widen it at the boundary.
    { state: inputs.state as unknown as EntryType, questions: QUESTIONS },
    { timeout: options.timeout ?? 25_000 }
  );
  return {
    model,
    ...applyIntentPolicy(answers, inputs),
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
  };
}
