# How intent classification works

A plain-English guide to what the Intent tab in the Signals Inspector is doing.

## The short version

Snowplow watches what a shopper does and keeps a running summary of their
session — what they added, removed, searched for and looked at. That summary
is handed to a model called Jev, which reads it the way a shop assistant would
and answers three questions: **when** to step in, **what** to show, and **how**
to talk to them.

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
ever asked to read meaning from names and words.

## Stage, occasion: Choices. Persona: Nouls

Stage and occasion are each a **Choice** — Jev picks exactly one option,
because a shopper is in one mindset and on one kind of shop at a time.

Persona is **Nouls** — several traits that can all be true at once, each
scored independently. A shopper can be budget-driven and a foodie in the same
basket; forcing that into a single label would lose the truth.

## Stage — when, and how hard to step in

| Label | Meaning | Suggested action |
|---|---|---|
| browsing | No settled goal, looking for ideas | Show inspiration / recipes |
| on_a_mission | Knows what they want, still finding it | Speed them up: direct links, "did you mean" |
| comparing | Weighing near-substitutes of one thing, not yet chosen | Comparison help, reviews, price-per-unit |
| ready_to_buy | Has what they came for, finishing up | Get out of the way, nudge to checkout |
| hesitating | Had a basket, now pulling back or stalling | Reassurance or an offer |

Jev weighs the most recent activity most heavily — earlier browsing just shows
how the shopper got here, not where they are now.

Two further states are never Jev's call: **checking_out** and **purchased**
are set straight from Signals counters (whether checkout has started, whether
the order completed). Jev still runs underneath, but its stage is overridden
for display — code, not the model, owns that boundary.

## Occasion — what this shop is for

| Label | Meaning | Action |
|---|---|---|
| restock | Replenishing everyday household items | Weekly shop → favourites / delivery slot. Top-up → fast checkout + free-delivery nudge |
| meal | Building one dish or dinner | Complete the recipe |
| event | Feeding a group or celebrating | Bundles + quantity prompts |
| unclear | Enough evidence, but it doesn't add up to one purpose | Generic |

Jev judges the whole set of items together, not any one product on its own.
Searches naming an event or dish ("bbq", "birthday cake") are strong evidence.

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
| foodie_explorer | Quality and indulgence — specialty ranges, premium cuts, wine | Specialty/premium variants, pairing, recipe inspiration |
| plant_based | Chose plant alternatives, and nothing added contains meat, fish or dairy | **Filter**: exclude meat, fish and dairy from suggestions |

Every trait Jev marks `false` means "no evidence of this" — not "the
opposite is true". A shopper who hasn't shown price sensitivity isn't
necessarily a big spender; we just haven't seen it yet.

Code then applies the headline policy: the first four traits (the "framing"
traits) count as active above a threshold, and the strongest one drives how
the page is framed. It's entirely possible for two to be active together — a
shopper can be both budget-driven and a foodie.

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
- **Code** applies policy: it decides checkout/purchased overrides, splits
  restock into weekly vs top-up, sets the evidence thresholds, decides which
  persona traits are "active", and builds the headline shown on screen.
- **Jev** reads meaning: given the facts above, it judges mindset, purpose,
  and framing from the words and products themselves.

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

- **"Treat" was folded into meal and foodie_explorer.** A separate "treat"
  category didn't hold up as its own occasion or trait — premium ingredients
  and indulgence are what foodie_explorer already captures, and a one-off
  indulgent dinner is still just a meal.
- **The weekly/top-up split moved out of Jev and into code.** It's a
  threshold on aisle count and item count — a hard rule with no reading
  involved, so it belongs where hard rules belong.

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
- **Show-only for now.** Suggested actions are displayed in the Inspector;
  nothing here is wired up to actually change the live site yet.
