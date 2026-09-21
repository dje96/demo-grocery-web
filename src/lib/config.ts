/**
 * Site configuration — the single source of truth for per-demo values.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT TO CHANGE PER DEMO
 *   • `siteConfig.brand` / `navigation` / `marketing` / `seo` — the demo's
 *     identity, nav, UTM campaign values, metadata.
 *   • `siteConfig.snowplow` — appId + the Signals service/intervention names
 *     you published in Console for THIS demo. All the tracking plumbing
 *     (snowplow-config.ts, signals-server.ts, api/signals, SignalsInspector)
 *     reads these from here — there are no hard-coded demo identifiers in the
 *     plumbing.
 *   • `categories` / `titles` / `plans` — the content catalog. Left EMPTY;
 *     the Content phase fills them using the interfaces below. Never hardcode
 *     catalog content in components — always read from config.
 * ────────────────────────────────────────────────────────────────────────
 */

// ─── Content catalog interfaces (shared contract) ──────────────────────────
// Generic content shapes. Rename/extend per vertical, but keep components
// reading from these types rather than inlining data.

/** A single episode / chapter / part within an Item. */
export interface Episode {
  id: string;
  title: string;
  durationLabel: string; // e.g. "42 min"
  description: string;
}

/** A catalog item (product, title, show, listing, …). */
export interface Item {
  id: string;
  slug: string;
  title: string;
  /** Author / creator / brand. */
  author: string;
  /** Category slug this item primarily belongs to. */
  category: string;
  /** Series / collection this item belongs to, if any. Powers same-series
   *  personalization and any homepage series experiment. */
  series?: string;
  /** Image path, e.g. `/images/covers/{slug}.jpg`. */
  coverImage: string;
  description: string;
  /** Average rating, 0–5. */
  rating: number;
  /** Number of ratings. */
  ratingsCount: number;
  /** Human-readable size/duration, e.g. "12 hrs 30 mins". */
  durationLabel: string;
  episodes?: Episode[];
  /** Marketing badges, e.g. ["New", "Editor's Pick"]. */
  badges?: string[];
  /** True for first-party / original content. */
  isOriginal?: boolean;
  [key: string]: unknown;
}

/** A browse category / genre. */
export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
}

/** A membership / subscription plan. */
export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  highlighted?: boolean;
}

// ─── SiteConfig interfaces ──────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

/**
 * A published Signals intervention clause, mirrored in the Signals Inspector so
 * presenters can watch each eligibility criterion tick from unmet → met.
 * Keep in lock-step with the intervention recipe you built in Console.
 */
export interface InterventionClause {
  /** Stream attribute name returned by the session service. */
  attribute: string;
  /** Human label shown in the inspector, e.g. "sample_play_count ≥ 2". */
  label: string;
  /** Comparison operator against `threshold`. */
  operator: "gte" | "gt" | "lte" | "lt" | "eq";
  threshold: number;
}

export interface SnowplowConfig {
  /** appId sent on every event (from demo-spec.json). */
  appId: string;
  /** Collector endpoint. Default is the Snowplow sales pipeline. */
  collectorEndpoint: string;
  /** Tracker namespace. */
  namespace: string;
  /**
   * Signals interventions SSE host (browser plugin). Usually supplied via
   * NEXT_PUBLIC_SNOWPLOW_SIGNALS_API_URL; this is the fallback.
   */
  signalsApiUrl: string;
  /** Signals session service name (server retrieval, keyed on session). */
  signalsService: string;
  /** Attribute key the session service is keyed on. */
  signalsAttributeKey: string;
  /**
   * Signals Event Log (Agentic Context) name — a rolling, ordered buffer of the
   * session's raw events. Read server-side and handed to Jev as `session_timeline`
   * narrative, giving the intent read temporal evidence the aggregated attributes
   * flatten (intent shift, sequence of discounted vs premium picks). Keyed on the
   * same domain_sessionid. See src/lib/signals-server.ts:getAgenticContext.
   */
  signalsEventLog: string;
  /**
   * Shared, cross-demo service that resolves snowplow_id from domain_userid.
   * Default `snowplow_id_retrieval` is a real published service on the sales
   * pipeline (bundles the `last_snowplow_id` attribute group) — every demo reuses
   * it as-is; do NOT rename per demo. It reads the `snowplow_id` from the
   * pipeline's identity entity, so it only populates once the Identity enrichment
   * is attaching that entity to events.
   */
  idService: string;
  /** Attribute key the id service is keyed on. Always `domain_userid`. */
  idAttributeKey: string;
  /** Name of the published intervention the demo surfaces. */
  interventionName: string;
  /** Eligibility clauses mirrored in the Signals Inspector. */
  interventionClauses: InterventionClause[];
}

/**
 * Warehouse (batch) attributes shown in the Signals Inspector's "Warehouse" tab,
 * alongside the real-time "Stream" tab. Two ways to populate it:
 *
 *   • source: "service" — read a REAL Signals batch service. `service` +
 *     `attributeKey` name it; the tab is always clickable and the identity gate
 *     is ignored (real data speaks for itself).
 *   • source: "mock" — render `mockAttributes`. Honors `identityGate`: when true,
 *     the tab stays greyed/unclickable until the snowplow_id resolved in the
 *     Identities section exactly equals NEXT_PUBLIC_WAREHOUSE_UNLOCK_SNOWPLOW_ID
 *     (from .env). This mimics "batch attributes appear once Snowplow Identity
 *     resolves the ID" for demos that don't have a real batch service wired.
 */
export interface WarehouseConfig {
  source: "service" | "mock";
  /** Signals batch service name (source === "service"). */
  service: string;
  /** Attribute key the batch service is keyed on (source === "service"). */
  attributeKey: "domain_userid" | "domain_sessionid" | "snowplow_id" | "user_id";
  /** Mock-only gate: grey the tab until the resolved snowplow_id matches env. */
  identityGate: boolean;
  /** Attributes rendered when source === "mock" (and unlocked, if gated). */
  mockAttributes: Record<string, unknown>;
}

export interface SiteConfig {
  brand: {
    name: string;
    tagline: string;
  };
  snowplow: SnowplowConfig;
  warehouse: WarehouseConfig;
  navigation: {
    mainMenu: NavItem[];
    footerLinks: NavItem[];
  };
  features: {
    utmParameters: boolean;
    signals: boolean;
    video: boolean;
    consent: boolean;
    /** Show the "Warehouse" (batch) tab in the Signals Inspector. */
    warehouse: boolean;
    /**
     * Show the "Intent" tab in the Signals Inspector — a purchase-intent
     * classification from TypeSafe's Jev model, served by /api/intent.
     * Degrades gracefully when TYPESAFE_API_KEY is absent.
     */
    intent: boolean;
  };
  marketing: {
    utmParameters: {
      sources: string[];
      mediums: string[];
      campaigns: string[];
    };
  };
  business: {
    contact: {
      email: string;
      phone: string;
      address: string;
    };
    social: {
      twitter?: string;
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      youtube?: string;
    };
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
    url: string;
    ogImage: string;
  };
}

// ─── Site configuration — Marketside (demo-grocery-web) ──────────────────────

export const siteConfig: SiteConfig = {
  brand: {
    name: "Marketside",
    tagline: "Fresh food, sharp prices, delivered in under an hour.",
  },
  snowplow: {
    appId: "demo-grocery-web",
    collectorEndpoint:
      "https://com-snplow-sales-aws-prod1.collector.snplow.net",
    namespace: "sp1",
    // Prefer NEXT_PUBLIC_SNOWPLOW_SIGNALS_API_URL at runtime; this is the fallback.
    signalsApiUrl: "",
    // Published Signals pull service for this demo: bundles
    // `demo_ecom_plugin_session` v7, keyed on domain_sessionid. Read by
    // /api/signals (Inspector Stream tab) AND /api/intent (Jev state source).
    signalsService: "demo_grocery",
    signalsAttributeKey: "domain_sessionid",
    // Event Log / Agentic Context for this demo, keyed on domain_sessionid.
    signalsEventLog: "grocery_agentic_context",
    // Shared, cross-demo service — leave as-is.
    idService: "snowplow_id_retrieval",
    idAttributeKey: "domain_userid",
    interventionName: "demo_grocery_basket_nudge",
    interventionClauses: [
      {
        attribute: "product_view_count",
        label: "product_view_count ≥ 3",
        operator: "gte",
        threshold: 3,
      },
      {
        attribute: "add_to_basket_count",
        label: "add_to_basket_count ≥ 2",
        operator: "gte",
        threshold: 2,
      },
      {
        attribute: "page_ping_count",
        label: "page_ping_count ≥ 5",
        operator: "gte",
        threshold: 5,
      },
    ],
  },
  warehouse: {
    source: "mock",
    service: "",
    attributeKey: "domain_userid",
    identityGate: true,
    mockAttributes: {
      lifetime_orders: 34,
      lifetime_value: 1682.4,
      avg_basket_value: 49.48,
      preferred_slot: "18:00–19:00",
      top_aisle: "Produce",
      dietary_preference: "Vegetarian",
      substitutions_accepted_pct: 62,
    },
  },
  navigation: {
    mainMenu: [
      { label: "Produce", href: "/aisle/produce" },
      { label: "Dairy & Eggs", href: "/aisle/dairy-eggs" },
      { label: "Bakery", href: "/aisle/bakery" },
      { label: "Meat & Fish", href: "/aisle/meat-fish" },
      { label: "Pantry", href: "/aisle/pantry" },
      { label: "Frozen", href: "/aisle/frozen" },
      { label: "Drinks", href: "/aisle/drinks" },
      { label: "Household", href: "/aisle/household" },
    ],
    footerLinks: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Allergen information", href: "/allergens" },
      { label: "Delivery & slots", href: "/delivery" },
      { label: "Snowplow", href: "https://snowplow.io" },
    ],
  },
  features: {
    utmParameters: true,
    signals: true,
    video: true,
    consent: true,
    warehouse: true,
    intent: true,
  },
  marketing: {
    utmParameters: {
      sources: ["google", "facebook", "linkedin", "twitter", "email", "slack"],
      mediums: ["cpc", "social", "email", "referral"],
      campaigns: [
        "free-delivery-over-40",
        "weekly-shop-reminder",
        "midweek-meal-deal",
        "fresh-produce-launch",
        "basket-abandon-winback",
        "first-order-5-off",
      ],
    },
  },
  business: {
    contact: {
      email: "hello@marketside.example",
      phone: "0800 118 8118",
      address: "Unit 4, Cold Chain Park, London E9 5QB",
    },
    social: {
      twitter: "https://twitter.com",
      instagram: "https://instagram.com",
      linkedin: "https://linkedin.com",
    },
  },
  seo: {
    title: "Marketside — online grocery, delivered in under an hour",
    description:
      "Fresh produce, British butchery, bakery baked in store and a full store cupboard. Free delivery over £40.",
    keywords: [
      "online grocery",
      "food delivery",
      "supermarket",
      "fresh produce",
      "delivery slots",
    ],
    url: "https://marketside.example",
    ogImage: "/og.png",
  },
};

// ─── Content catalog ─────────────────────────────────────────────────────────
//
// The real catalogue lives in `src/lib/catalog.ts` (8 aisles, 75 SKUs). These
// exports satisfy the skeleton's generic content contract: `categories` mirrors
// the aisles, `items` mirrors the products. Pages import the richer grocery
// types straight from `@/lib/catalog`.

import { aisles, products } from "./catalog";

export const categories: Category[] = aisles.map((aisle) => ({
  id: aisle.slug,
  slug: aisle.slug,
  name: aisle.name,
  description: aisle.blurb,
}));

export const items: Item[] = products.map((product) => ({
  id: product.sku,
  slug: product.sku,
  title: product.name,
  author: product.brand,
  category: product.aisle,
  coverImage: "",
  description: product.description,
  rating: 4.6,
  ratingsCount: 128,
  durationLabel: product.pack,
  badges: product.badges,
  price: product.price,
  unitPrice: product.unitPrice,
}));

export const plans: Plan[] = [
  {
    id: "pay-as-you-go",
    name: "Pay as you go",
    priceMonthly: 0,
    priceAnnual: 0,
    features: [
      "Delivery from £3.95 a slot",
      "Free delivery over £40",
      "Slots up to 7 days ahead",
    ],
  },
  {
    id: "basket-plus",
    name: "Marketside Plus",
    priceMonthly: 6.99,
    priceAnnual: 69,
    features: [
      "Free delivery on every order",
      "Priority evening slots",
      "Slots up to 21 days ahead",
      "Double substitution credit",
    ],
    highlighted: true,
  },
];
