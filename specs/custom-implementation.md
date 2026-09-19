# Basket — Custom Implementation Brief (Phase 4)

**App:** `demo-grocery-web` · **Pipeline:** `86a67f91-19ce-4e38-ae44-4c4fadbf73b4` (sales prod1, Signals host `7f9742b834d7`)
**Scope:** CDI + Signals · **No intervention** — the profile store exists to provide context to Jev.

---

## 1. Use cases

**Reactive / pull (the only use case).** The app pulls live session attributes from the Signals profile store and hands them to TypeSafe's Jev model, which returns a typed purchase-intent classification with calibrated probabilities. This renders in the Signals Inspector's **Intent** tab, already built in Phase 3 against client session state — Phase 4 swaps the state source for real Signals attributes. The question set, the composite scoring and the panel stay exactly as they are.

**Proactive / push.** Explicitly out of scope at the user's direction. No intervention is created.

The point of the demo: Signals does the counting and aggregation it is good at; Jev does the semantic judgment that counting cannot produce. Neither layer is doing the other's job.

---

## 2. Signals attributes

### Reuse: `demo_ecom_plugin_session` → **new version 5**

v4 is a published, shared group (keyed `domain_sessionid`, TTL P1D) computed from the standard Snowplow ecommerce plugin plus `page_view`/`page_ping`. It already provides every numeric Jev must never compute for itself:

`cart_value` · `cart_add_count` · `cart_product_ids` · `products_viewed` · `product_view_count` · `categories_viewed` · `checkout_started` · `checkout_ping_count` · `recent_checkout_activity` · `purchase_completed` · `last_page_path` · `product_heartbeat_count` · `dog_food_view_count`

**The gap.** Every product attribute in v4 extracts the product entity's `id`, not its `name`. `products_viewed: ["SKU-1042","SKU-3390"]` is semantically empty — Jev's documented weakness is exactly this kind of opaque/numeric representation, and its strength is natural language. v4 also has no search attribute at all, and search queries are the single most intent-revealing field available.

**v5 adds three attributes** (all `unique_list`, all keyed `domain_sessionid`):

| Attribute | Source event | Property | Filter |
|---|---|---|---|
| `search_terms` | `com.demo/search_performed` 1-0-0 | event `term` | — |
| `product_names_viewed` | `com.snowplowanalytics.snowplow.ecommerce/snowplow_ecommerce_action` 1-0-2 | `product` entity → `name` | `type = product_view` |
| `cart_product_names` | same | `product` entity → `name` | `type = add_to_cart` |

v5 is **additive**: v4 stays published and every service pins an explicit version (`music_ecom_personalization` → v4), so the music and pets demos are unaffected. Verified against the live service list, not assumed.

### Service

New service **`demo_grocery`**, bundling `demo_ecom_plugin_session (v5)`. Read by `/api/signals` and `/api/intent` via `domain_sessionid`.

---

## 3. CDI tracking design

Driven backwards from the attributes above. The reused group reads the **standard Snowplow ecommerce plugin**, so the app implements that rather than custom grocery schemas.

### Reuse search evidence (`com.demo*` vendors, per the governance guardrail)

- `list_schemas vendor=com.demo` → 28 schemas. **`com.demo/search_performed` 1-0-0** matches exactly (`term`, `search_type`, `total_results`). **Reused.**
- `list_schemas vendor=com.demo.ecommerce` → 7 schemas (`product_interaction`, `cart_interaction`, `checkout_workflow`, `purchase`, `product`, `cart`, `cart_abandonment_interaction`). Inspected `product_interaction`, `cart_interaction` and `product`. **Not used** — they are real and reusable, but they do not feed `demo_ecom_plugin_session`, which reads the standard ecommerce plugin. Using them would mean rebuilding every numeric attribute we just reused. Recorded as a deliberate trade-off, not an oversight.

### Events

| # | Event | Schema | New or reused |
|---|---|---|---|
| 1 | Product view | `com.snowplowanalytics.snowplow.ecommerce/snowplow_ecommerce_action` 1-0-2, `type=product_view` + `product` entity | OOTB plugin |
| 2 | Add to basket | same, `type=add_to_cart` + `product` + `cart` entities | OOTB plugin |
| 3 | Remove from basket | same, `type=remove_from_cart` + `product` + `cart` entities | OOTB plugin |
| 4 | Checkout step | same, `type=checkout_step` | OOTB plugin |
| 5 | Transaction | same, `type=transaction` | OOTB plugin |
| 6 | Search performed | `com.demo/search_performed` 1-0-0 | **Reused** |

**Net new schemas: zero.** Five OOTB ecommerce actions plus one existing `com.demo` schema.

`product` entity mapping from `src/lib/catalog.ts`: `product_id` ← sku, `name` ← name, `category` ← aisle, `price` ← price, `brand` ← brand, `quantity` ← basket quantity. `category` must be the aisle name so the reused `categories_viewed` stays meaningful.

### Tracking plan, source app, event specs

- **Source application:** "Basket" — platform web, app_id `demo-grocery-web`.
- **Tracking plan:** one plan, the six event specifications above.
- Event specs are scoped by `type` on the shared `snowplow_ecommerce_action` structure, with the spec instructions pinning which action each represents — the grouped-schema pattern.

---

## 4. Implementation

Handed to a subagent using `/snowplow:implementation-guidance`, with Snowtype generating types from the published plan. Wiring points in the built app:

| Event | Where |
|---|---|
| Product view | `/product/[sku]` page |
| Add to basket | `AddToBasket.tsx`, `ProductCard.tsx`, home buy-again strip |
| Remove from basket | `/cart` line controls |
| Checkout step | each of the four `/checkout` steps |
| Transaction | `placeOrder()` on confirmation |
| Search performed | `SiteHeader.tsx` search, in-aisle search on `/aisle/[slug]` |

Then `/api/intent` switches its state source from `sessionStorage` to the `demo_grocery` service, mapping:

- `search_terms` → `browsing.search_queries`
- `product_names_viewed` → `browsing.products_viewed[].name`
- `cart_product_names` → `basket.items[].name`
- `categories_viewed` → `browsing.aisles_visited`
- `cart_value` → `basket.subtotal_gbp`
- list lengths and durations → the numeric fields, **computed in code**

The Jev question set, the `stage` instruction forbidding use of numeric fields, and the composite `0.5·P(ready_to_buy) + 0.3·(score/3) + 0.2·specific_product` are unchanged.

---

## 5. Open risk

Adding v5 alongside v4 means 16 attributes live in a second version of a shared group. At least one other group in this environment is described as trimmed "to fit the shared stream-attribute budget", so if that budget is per-environment this consumes headroom. Flagging it; not blocking.

---

## 6. Built in Console (2026-09-19)

**Pipeline:** `86a67f91-19ce-4e38-ae44-4c4fadbf73b4` · Signals host `https://7f9742b834d7.signals.snowplowanalytics.com`

### CDI
| Object | ID |
|---|---|
| Source app **Basket** (web, `demo-grocery-web`) | `5c1e749d-9a33-4016-83bf-381be9d21431` |
| Tracking plan **Grocery Shopping Journey** | `9e64295e-1e49-40d3-81b3-71a9b1873e84` |
| View Product | `16d74354-595f-4935-8423-fabf7bdd5be1` |
| Add To Basket | `9d06f6e1-b7e5-4f91-9383-de947a156f7d` |
| Remove From Basket | `059669a8-d667-4603-bd83-710994167c66` |
| Progress Checkout Step | `3e6d45e9-ce73-48ff-9fa8-7d1b69726f8a` |
| Complete Transaction | `a299714a-1bb7-4e20-92ce-4cd2ee454074` |
| Perform Search | `cb1e0fe4-d89b-4d80-abe0-83ca57949b30` |

Net new schemas: **zero**, as planned. Each ecommerce spec pins its action via event property instructions on `type`; `Perform Search` reuses `iglu:com.demo/search_performed/jsonschema/1-0-0`.

Entities used: `product` 1-0-0, `cart` 1-0-0, `checkout_step` 1-0-0, `transaction` 1-0-0 (all `com.snowplowanalytics.snowplow.ecommerce`).

### Signals — published
- **`demo_ecom_plugin_session` v5** — 16 attributes: all 13 from v4 unchanged, plus `search_terms`, `product_names_viewed`, `cart_product_names`. v4 remains published and untouched.
- **Service `demo_grocery`** — pins v5, keyed `domain_sessionid`.

Both confirmed `published`.

### Notes from the build
1. **Event property instructions must enumerate every property in the base schema and include a `required` array.** A partial instruction set, or one carrying only `description` overrides, is rejected as `SchemaIncompatible` even when every individual property reports compatible. Entity-level instructions were dropped for the same reason — that guidance now lives in each spec's description instead, where developers actually read it.
2. **Creating a new attribute-group version uses `create` with an explicit `version`, not `update`.** `update` requires the version in the URL and body to match, so it can only edit a version in place — it cannot fork a new one. Using `create` with `version: 5` is what leaves v4 genuinely untouched.
3. **The Signals API rewrote the descriptions on `product_names_viewed` and `cart_product_names`** to short generic strings ("Distinct product names viewed", "Product names added to basket"), while keeping the long description on `search_terms`. Cosmetic only — definitions, types, aggregations and criteria are all as submitted. Worth knowing if the Console UI text looks thinner than this brief.
4. The v4→v5 risk flagged in section 5 was checked rather than assumed: every service in the environment pins an explicit attribute-group version, so no other demo follows "latest" onto v5.
