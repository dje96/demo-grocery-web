# How intent classification works

A plain-English guide to what the Intent tab in the Signals Inspector is doing.

## The short version

Snowplow watches what a shopper does and keeps a running summary of their
session — what they added, removed, searched for and looked at. From that
summary we answer three questions: **when** to step in, **what** to show, and
**how** to talk to them. *When* is decided by plain rules in code; *what* and
*how* are handed to a model called Jev, which reads the products the way a shop
assistant would.

- **Stage** = when — how ready this shopper is right now, and how hard to
  intervene.
- **Occasion** = what — what this shop is for, which decides what to show.
- **Persona** = how — how to frame it (or, for one trait, what to filter out).

## Why the work is split in two

**Snowplow does the counting.** It keeps the tally: what's in the basket, what
was removed, what was searched, which aisles were browsed. Machines are
reliable at this; a language model is not.

**Jev does the reading.** It looks at the actual words and products —
"aged ribeye", "Sauvignon Blanc", "dark chocolate" — and judges what they mean
together. Counting cannot tell you that's a dinner for two; reading it can.

So counts, splits and thresholds are decided in ordinary code, and Jev is only
ever asked to read meaning from names and words. Stage turned out to be a
counting question too (what's in the basket, what came out, did they search
first), so it is decided in code as well.

## Stage: rules. Occasion: a Choice. Persona: Nouls

Stage is a set of **ordered rules** over Signals facts — no model involved,
so it has no confidence score, just the rule that fired.

Occasion is a **Choice** — Jev picks exactly one option, because a shop has
one purpose at a time.

Persona is **Nouls** — several traits that can all be true at once, each
scored independently. A shopper can be budget-driven and health-conscious in
the same basket; forcing that into a single label would lose the truth.

## Stage — when, and how hard to step in

Code checks these rules in order; the first that matches wins.

| Label | Rule (Signals facts) | Suggested action |
|---|---|---|
| purchased | Purchase counter set | Order confirmation, rebook next slot |
| checking_out | Checkout counter set | Keep checkout frictionless — no interruptions |
| hesitating | An item was removed and not added back | Reassurance or an offer |
| ready_to_buy | 3+ items in the basket, nothing left out | Get out of the way, nudge to checkout |
| on_a_mission | Searched, then added — basket still small | Speed them up: direct links, "did you mean" |
| browsing | Anything else (views or searches, little or nothing added) | Show inspiration / recipes |

The Inspector shows the rule that fired, e.g. *hesitating — Chopped Tomatoes
removed, not re-added*. The 3-item bar is `intentPolicy.stage.readyMinItems`.

**Telling a removal from a correction.** Signals keeps a list of everything
ever added and everything ever removed, so an item taken out and put straight
back sits in both. The session timeline settles it: an item counts as back in
the basket when, across the timeline, more units were added than removed.
This is an approximation in two cases: with no timeline at all, or when that
item's rows have aged out of the timeline window, every removal counts as
still outstanding.

**comparing is gone.** Weighing near-substitutes (three coffees, back and
forth) is a reading of intent that no honest rule captures, so the stage no
longer offers it. That session now reads as browsing.

## Occasion — what this shop is for

| Label | Meaning | Action |
|---|---|---|
| restock | Replenishing everyday household items — the default when it's ambiguous | Weekly shop → favourites / delivery slot. Top-up → fast checkout + free-delivery nudge |
| meal | Building one specific dish or dinner you could name | Complete the recipe |
| event | Feeding a group or celebrating | Bundles + quantity prompts |
| unclear | Enough evidence, but it doesn't add up to one purpose | Generic |

Jev judges the whole set of items together, not any one product on its own.
Searches naming an event or dish ("bbq", "birthday cake") are strong evidence.

**Meal needs a dish, not just food that could go together.** It takes a dish
search ("lasagne", "curry") or an ingredient that only makes sense for one
dish alongside its partners (lasagne sheets with mince and béchamel; steak
with wine and dessert for a dinner). Everyday staples that happen to combine —
pasta, tinned tomatoes, cheese, bread, milk — are restock. Restock is the
default when it's ambiguous.

**The weekly vs top-up split happens in code, not in Jev's judgment.** Once
Jev says "restock", code checks the basket: added items spanning three or
more aisles (including household), or eight or more items, counts as a
weekly shop; anything smaller is a top-up. That's a hard rule, and hard rules
belong in code, where they can be tuned without asking the model anything.

## Persona — how to frame it

| Trait | Meaning | Action |
|---|---|---|
| budget_driven | Price is steering choices — own-brand over premium, picks on offer | Lead with offers, own-brand swaps, price-per-unit |
| health_conscious | Leans fresh, wholegrain, low-sugar, high-protein, organic | Healthier swaps, nutrition badges |
| convenience_seeking | Ready-to-eat, minimal prep | Ready-made alternatives, one-click bundles |
| plant_based | Chose plant alternatives, and nothing added contains meat, fish or dairy | **Filter**: exclude meat, fish and dairy from suggestions |

Every trait Jev marks `false` means "no evidence of this" — not "the
opposite is true". A shopper who hasn't shown price sensitivity isn't
necessarily a big spender; we just haven't seen it yet.

Code then applies the headline policy: the first three traits (the "framing"
traits) count as active above a threshold, and the strongest one drives how
the page is framed. It's entirely possible for two to be active together — a
shopper can be both budget-driven and health-conscious.

**plant_based is stricter and works differently.** It never competes to be
the headline framing, and it needs a higher threshold to switch on, because
its job is riskier than the others: it filters meat, fish and dairy out of
what the shopper sees next. Getting a framing trait wrong costs a slightly
worse suggestion; getting this one wrong means recommending food a shopper
can't eat. So it demands stronger evidence — genuine plant-based choices,
*and* nothing animal-derived in what they added — before it's trusted to act.

## Who does what

- **Signals** serves facts: what was added and removed this session, brands,
  categories, on-offer items, search terms, products viewed, aisles visited,
  and — when available — a timeline of the session's events.
- **Code** applies policy: it derives the stage from ordered rules, splits
  restock into weekly vs top-up, sets the evidence thresholds, decides which
  persona traits are "active", and builds the headline shown on screen.
- **Jev** reads meaning: given the facts above, it judges purpose (occasion)
  and framing (persona) from the words and products themselves.

## Why no numbers go to Jev

Jev is handed names and lists — product names, search terms, brands,
categories — never counts, ratios, durations, or totals. Numbers are exactly
what ordinary code is reliable at; asking a language model to do arithmetic
on a shopper's behalf just adds a place for it to get things wrong. Those
numbers still exist and are shown in the Inspector panel — they're just kept
out of what Jev is asked to reason over.

## Evidence gates

Jev always runs if there's any evidence at all, but the Inspector only trusts
what it says once a minimum bar is met. Below that bar, the panel shows
**"Not enough signal"** instead of a label — the honest answer when there
simply isn't enough to go on yet. For persona the bar is at least two items
added to the basket — views don't count, because persona is judged only on
what the shopper actually chose.

That's different from **unclear**, which is Jev's own answer when there's
*plenty* of evidence but it doesn't add up to one clean purpose (for example,
a basket of unrelated items). "Not enough signal" is a code decision made
before Jev's answer is trusted; "unclear" is Jev's answer once there's enough
to judge.

A brand-new, empty session is its own case: no evidence exists yet, so
nothing is scored at all.

## A few things folded together

- **"Treat" was folded into meal.** A one-off indulgent dinner is still just
  a meal.
- **foodie_explorer was retired.** In a catalogue full of premium-range
  items and evocative names it fired too easily to trust, and a premium
  dinner is already captured by occasion = meal.
- **Stage moved out of Jev and into code.** Every stage boundary is a fact
  about the basket and its order of events — a removal that stayed out, a
  search before an add, a basket size — so it belongs with the other rules.
- **The weekly/top-up split moved out of Jev and into code.** It's a
  threshold on aisle count and item count — a hard rule with no reading
  involved, so it belongs where hard rules belong.

## Acting on intent (phase 2)

The read now drives the site, through a loop that goes back via Snowplow:

1. **Read.** After an add, remove or search, the browser waits ~3s (so
   Signals has the event), then asks `/api/intent`. Bursts collapse into one
   read. Skipped when the presenter has Signals turned off.
2. **Track.** If the acted-on labels changed — the tuple (stage, occasion,
   persona, plant filter) — a `classify_intent` event is sent with a
   `shopper_intent` entity (labels after policy; a gated label is
   `not_enough_signal`; restock carries its weekly/top-up split) and an
   `agent` entity (Jev model, `typesafe`, a fresh invocation id,
   `intent-v2`). An unchanged read isn't re-tracked; an Inspector refresh
   always is.
3. **Decide when — Signals.** The `grocery_shopper_intent` attribute group
   keeps the latest labels for the session, and two interventions fire off it:
   - `grocery_complete_recipe` — stage on_a_mission or ready_to_buy, AND
     occasion meal.
   - `grocery_hesitation_rescue` — stage hesitating.
4. **Decide how — the banner.** The pushed labels (falling back to the
   latest browser read) shape the copy:
   - *Complete the recipe* shows the recipe items not yet in the basket, with
     add buttons, framed by persona (budget: price and offers; health:
     wholesome; convenience: ready in 20 min; otherwise neutral). With the plant filter on, non-vegan items are
     swapped for a plant alternative or dropped. The recipe is a hard-coded
     placeholder for now.
   - *Hesitation rescue* offers FRESH10 to budget-driven shoppers; everyone
     else sees "your basket is saved" and how far they are from free
     delivery.
5. **Measure.** Each banner is shown at most once per session per
   intervention. Its view, click and dismiss are tracked as
   `intervention_interaction`, with the Signals `intervention_instance` (for
   real pushes) and an ecommerce `promotion` entity.

## How accuracy is checked

A set of golden fixtures — journeys built from the real catalogue, shaped the
way Signals would actually serve them — is run through the same pipeline Jev
uses. Each fixture has an expected label, plus a couple of deliberate "trap"
cases designed to look like a trait but fall just short of it (for example, a
plant-based-looking basket that still has bacon in it). Passing means the
expected label wins clearly, and the traps stay below threshold. This is how
the classification is checked, not guessed at.

## Honest limits

- **No real outcome data yet.** Thresholds and splits were chosen by hand and
  should be tuned against real shopper behaviour before anyone relies on them
  for a business decision.
- **Names, not quantities.** What's handed to Jev is what was added, removed
  and searched — not how many of each. Quantity-sensitive judgments (a single
  dinner vs. a party) rely on the words and the timeline, not a count.
- **The session's memory is limited.** The event timeline holds at most 50
  events from the last 60 minutes. Older activity simply isn't there to read.
- **It answers with probabilities, not certainties.** A low-confidence answer
  is a signal to act gently, not a failure.
- **Two actions, not all of them.** Phase 2 wires up two interventions
  (below); the other suggested actions are still display-only.
