# demo-skeleton

Clone-and-build baseline for Snowplow demo web apps. Ships the **table-stakes
plumbing** every demo needs — tracker, consent/CMP, Signals (session interventions
+ inspector), the presenter footer, identity stitch, YouTube media tracking — so a
build starts from a working baseline instead of scaffolding from scratch.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Snowplow
browser tracker 4.x + Signals**.

## Quickstart

```bash
npx degit <org>/demo-skeleton demo-<name>-web   # or: git clone && rm -rf .git
cd demo-<name>-web
npm install
cp .env.example .env            # fill Console keys + Signals host
npm run dev
```

Then, per demo:
1. Fill **`src/lib/config.ts`** — `brand`, `navigation`, `seo`, `marketing`, and
   the **`snowplow`** block (`appId`, Signals service/intervention names you
   published in Console, and `interventionClauses`). All plumbing reads from here.
2. Overwrite **`tailwind.config.ts`** values + fonts in `src/app/layout.tsx` from
   the design phase (keep the semantic key names — components style against them).
3. Populate the content catalog (`categories`/`items`/`plans`) and build pages.

## What's reusable (don't rewrite — only theme)

| File | Role |
|---|---|
| `src/lib/snowplow-config.ts` | Tracker init, plugins, page views, consent/session/identity fns, Signals interventions. Carries the `sessionOnlyFetcher` (avoids Signals 400s on non-UUID `domain_userid`) and `suppressBenignTrackerNoise` fixes. |
| `src/lib/signals-server.ts` | Server-only Signals Node retrieval (session attrs + `snowplow_id`). |
| `src/lib/consent.ts` · `utils.ts` · `nudge.ts` | Consent/Signals prefs · `cn()`+UTM builder · pull-path intervention eligibility. |
| `src/hooks/use-snowplow-tracking.ts` | Page-view-on-route-change. |
| `src/contexts/user-context.tsx` | Demo auth + **anonymous→known identity stitch**. |
| `src/components/snowplow-init.tsx` | Provider nesting (`SnowplowInit > UserProvider`). |
| `src/components/ConsentManager.tsx` | 4-category CMP modal. |
| `src/components/DemoFooter.tsx` | Presenter toolkit — UTM reload, clear identity, consent, Signals toggle, video. |
| `src/components/SignalsInspector.tsx` | Live Signals attribute panel + intervention monitor + trigger. |
| `src/components/InterventionBanner.tsx` | Dual-path (push + pull) intervention surface. |
| `src/app/api/signals/route.ts` · `layout.tsx` · `video/page.tsx` · `globals.css` | Signals endpoint · shell · YouTube media page · Tailwind v4 `@config` bridge. |

## Replace per demo

`src/lib/config.ts` values · `tailwind.config.ts` palette/fonts · `globals.css` body
colors · a header (none shipped — build one, wire to `useUser()`) · `src/app/page.tsx` (stub) · all industry
pages, catalog data, images, and the intervention banner copy · `src/lib/tracking.ts`
(stub — regenerate with Snowtype from your data products).

Schemas/data products are built in **Console**, not here.
