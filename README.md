# Marketside — Jev intent classification demo

An online grocery demo (**Marketside**) that classifies *what kind of shopper is
in session, right now* using **Jev by TypeSafe AI** — a System One model that
returns typed judgments with probabilities rather than generated text.

Snowplow supplies the behavioural context; Jev interprets it; code owns the policy.

## The use case

Every re-evaluation answers three orthogonal questions about the live session:

| Axis | Primitive | Answers |
|---|---|---|
| **Stage** | Choice | How decided are they? `browsing → comparing → ready_to_buy` |
| **Occasion** | Choice | What is this shop *for*? `weekly_shop · single_meal · top_up · special_occasion · unclear` |
| **Persona** | 4 Nouls | Who are they? `budget_driven · health_conscious · convenience_seeking · foodie_explorer` |

**Persona is four independent Nouls, not one Choice** — the traits co-occur
(budget + health is one common shopper), so a Choice would split probability mass
and lose the second trait. The single headline persona (or `generalist`) is
derived **in code** from the trait probabilities, never asked of the model.

All six questions run in **one batched `systemOne` call** — answered in parallel,
far cheaper than separate round trips. Jev is never asked to count or do
arithmetic: every total is computed by Signals or in code.

## How context reaches Jev

Two complementary Snowplow Signals shapes feed the model state:

1. **Attribute group** (`demo_ecom_plugin_session`) — *aggregated* session facts:
   products viewed, searches, cart names, on-offer counts, categories. The "how
   many / which" profile.
2. **Agentic Context** (Event Log `grocery_agentic_context`) — the *ordered* raw
   event narrative (searches, views, adds/removes, checkout) with each product's
   `price` and `list_price`. The "what happened, in what order" feed, handed to
   Jev as `session_timeline` so `stage` can see intent shift and `is_budget_driven`
   can see a sequence of discounted picks — evidence aggregation flattens.

```
Snowplow tracking ─▶ Signals (attributes + agentic context) ─▶ Jev state
                                                                   │
                              typed judgments (stage/occasion/persona) ◀─┘
```

On-sale items are tracked via the ecommerce `list_price` field (original price)
alongside `price`, so a markdown is schema-native and drives the budget read.

## Key files

| File | Role |
|---|---|
| `src/app/api/intent/route.ts` | The Jev endpoint — questions, batched `systemOne` call, code-side persona derivation, graceful degradation. |
| `src/lib/signals-server.ts` | Server-only Signals retrieval: session attributes + `getAgenticContext()`. |
| `src/components/SignalsInspector.tsx` | Intent tab — renders stage, occasion, persona, and the agentic-context timeline. |
| `src/lib/tracking.ts` | Typed Snowplow wrappers (OOTB ecommerce + `com.demo` schemas only). |
| `src/lib/catalog.ts` | 138-SKU catalogue with own-brand value/premium lines and on-offer items. |
| `src/lib/config.ts` | Brand, Signals service/event-log/intervention names. |

## Schemas

Only out-of-the-box **ecommerce** schemas and the **`com.demo`** vendor — no
custom schemas. Events: `snowplow_ecommerce_action`, `cart`, `com.demo/login`,
`com.demo/search_performed`.

## Quickstart

```bash
npm install
cp .env.example .env    # Console API keys + Signals host + TYPESAFE_API_KEY
npm run dev
```

Browse, search, add items (some on offer), then open the Signals Inspector's
**Intent** tab and hit **re-evaluate**. The Agentic Context buffers events from
publish-time forward, so use a fresh session to see the timeline populate.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Snowplow
browser tracker 4.x + Signals · TypeSafe Jev (`@typesafe-ai/sdk`)**.
