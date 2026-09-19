# Basket — Style Reference

**Demo:** `demo-grocery-web` · **Direction:** Cold Chain · **Source:** proposed (no reference site — Workflow C)

App-first grocery. Near-white surfaces, near-black type, one citrus signal colour reserved for state and personalization interventions. Mono for every numeric. Sharp radii, dense grids, minimal chrome. Grown-up Gorillas/Getir rather than supermarket-chain.

> All values below are **chosen, not extracted** — there was no reference site. Nothing here is approximate in the measurement sense; it is a designed system.

---

## Colour

| Token | Hex | Used for |
|---|---|---|
| `primary` | `#0C0E0D` | Headings, body-strong, primary button fill |
| `secondary` / `accent` | `#1B6B47` | Links, in-stock and success state, accent rules |
| `highlight` | `#D9F154` | **Citrus signal.** Primary-button label, offer badges, intervention ground. Nothing else. |
| `background` | `#FFFFFF` | Page |
| `surface` | `#F4F6F5` | Product image tiles, banded sections, filter rail |
| `surface-raised` | `#FFFFFF` | Cards, modals, sticky nav |
| `border` | `#E3E7E5` | Default 1px borders |
| `border-strong` | `#D5DAD8` | Secondary button, input borders |
| `heading` | `#0C0E0D` | Heading text |
| `body` | `#5B6260` | Body text |
| `muted` | `#8A918E` | Eyebrows, unit prices, metadata |
| `link` | `#1B6B47` | Inline links |

**Status:** success `#1B6B47` · warning `#B8761B` · error `#C0392B` · info `#1D5FA8`

The palette is deliberately monochrome apart from the green accent. That restraint is functional: when a personalization intervention fills with `#D9F154`, it is unmistakable without shouting.

---

## Typography

| Role | Face | Weight | Size |
|---|---|---|---|
| Display | Space Grotesk | 700 | 3rem / -0.04em |
| H1 | Space Grotesk | 700 | 2.5rem / -0.035em |
| H2 | Space Grotesk | 700 | 1.875rem / -0.03em |
| H3 | Space Grotesk | 700 | 1.375rem |
| H4 | Space Grotesk | 700 | 1.0625rem |
| Body | IBM Plex Sans | 400 | 0.9375rem / 1.55 |
| Small | IBM Plex Sans | 400 | 0.8125rem |
| Nav | IBM Plex Sans | 500 | 0.8125rem |
| **Numerics** | **IBM Plex Mono** | 500–700 | contextual, `tabular-nums` |

Body sits at 15px rather than 16px — a deliberate density choice for a catalogue with hundreds of items.

**The mono rule is the signature.** Prices, unit prices, quantity steppers, basket totals, delivery-threshold progress and slot times all render in IBM Plex Mono with tabular figures. Use the `.num` utility in `globals.css` or `font-mono tabular-nums`. This is what stops the design reading as a generic ecommerce template.

---

## Shape, space, depth

- **Radii:** sm `2px` · md `3px` · lg `6px` · full. Sharp throughout — no soft cards.
- **Spacing:** xs `4px` · sm `8px` · md `16px` · lg `24px` · xl `40px` · 2xl `64px` · section `72px`
- **Page width:** `max-w-page` = `1320px` (wider than the usual 1280 to fit a 5-up grid comfortably)
- **Shadows:** near-invisible. `sm` on card hover, `md` on dropdowns, `lg` on modals. Cards sit on borders, not shadows.

---

## Component patterns

**Nav** — Sticky white, 1px bottom border. Three zones: wordmark left, a wide search field taking the centre (search *is* grocery navigation), delivery-slot chip + account + basket-count pill right. A secondary aisle bar below on desktop: horizontally scrolling aisle names, nav-size with wide tracking, active aisle marked by a 2px `primary` underline.

**Product card** — 1px `border`, radius-md, no shadow at rest, `shadow-sm` on hover. Icon tile on `surface` at top. Then: eyebrow (aisle, mono uppercase, muted) → name (Space Grotesk 700, max 2 lines) → pack description (small, muted) → price row. Price row baseline-aligned: mono price left with mono unit price beside it, badge right. Add-to-basket is full-width at the foot, and becomes a mono quantity stepper once the item is in the basket.

**Buttons**
- *Primary* — `#0C0E0D` fill, `#D9F154` label, radius-sm, 9px/16px padding, 600 weight. Hover to `#1E221F`.
- *Secondary* — transparent, 1.5px `border-strong`, `primary` label. Hover darkens the border to `primary`.
- *Text* — `link` green, 500 weight, underline on hover.

**Grid** — 2 cols mobile → 3 md → 4 lg → 5 xl, gap `16px`. Tight on purpose: it should read as a catalogue, not a lookbook. Aisle pages use a sticky 240px filter rail against the grid (≈70/30 asymmetry), collapsing to a drawer below lg.

**Hero** — No marketing hero. The homepage opens on an asymmetric 65/35 band: delivery-slot prompt with a live next-slot time in mono and a primary CTA on the left; compact reorder-favourites strip on the right. The first product row must be visible above the fold on a laptop.

**Footer** — White, 1px top border, four link columns in small type under mono uppercase headings. Wordmark and delivery-area note on a closing row.

**Intervention slot** — Single-line banner or inline card on `#D9F154` ground with `#0C0E0D` text. The only large fill of the citrus anywhere in the app.

---

## Files changed

| File | Change |
|---|---|
| `specs/design-tokens.json` | Canonical tokens |
| `tailwind.config.ts` | Tokens mapped to the skeleton's semantic contract; `--font-heading` added |
| `src/app/globals.css` | `color-scheme: light`, white body, `.num` utility, heading face default |
| `src/app/layout.tsx` | Inter → Space Grotesk (heading) + IBM Plex Sans (body); Plex Mono retained |
| `specs/style-preview.html` | Rendered preview, now the single chosen direction |

The skeleton ships a **dark** theme; this demo is light. Components built in Phase 3 must style against the semantic names (`bg-background`, `text-heading`, `border-border`) rather than hardcoding hexes, or the light switch will leak.
