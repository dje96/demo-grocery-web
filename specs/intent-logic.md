# How the intent score works

A plain-English guide to what the Intent tab in the Signals Inspector is doing.

## The short version

Snowplow watches what a shopper does and keeps a running summary of their
session. That summary — what they searched for, what they looked at, what is in
their basket — is handed to a model called Jev, which reads it the way a shop
assistant would and says how close this person looks to buying.

The result is a single number between 0% and 100%, plus the reasoning behind it.

## Why the work is split in two

Two very different jobs are involved, and neither system is good at both.

**Snowplow does the counting.** It keeps the tally: how many products were
viewed, what the basket is worth, which aisles were visited. Machines are
reliable at this; a language model is not.

**Jev does the reading.** It looks at the actual words — "bronze die spaghetti",
"parmesan", "Scottish salmon fillets" — and judges what they mean together.
Counting cannot tell you that salmon, lemons and butter are one dinner. Reading
them can.

So the counts are calculated in ordinary code, and Jev is explicitly told to
ignore them when making its main judgment. It is asked to go on the words alone.
This matters: a shopper with thirty scattered items is less ready to buy than one
with four items that add up to a meal, and only the words reveal that.

## The four questions

Jev is asked all four at once, over the same session summary.

**1. How decided is this shopper?** A single line with three points on it:

- *Browsing* — looking around, no settled goal. Scattered products, broad
  searches like "cheese", an empty or near-empty basket.
- *Comparing* — weighing alternatives of the same thing. Several near-identical
  products viewed; searches name a kind of product, not a specific one.
- *Ready to buy* — decided. The basket holds what they came for, and any
  searches name specific products rather than categories. Someone restocking
  milk, bread and bin bags counts here too: they already know what they want.

Everything on this line answers one question — how made-up is their mind. What
*kind* of shop it is gets asked separately, below.

**2. Are they searching for something specific?** Yes for "yeo valley butter";
no for "cheese". Someone naming a brand has already made their choice.

**3. Are they stuck on something?** Searches about delivery slots, charges,
substitutions or returns mean they are asking about the service, not choosing
food. That is a different problem and often a reason a sale does not happen.

**4. What kind of shop is this?** A weekly shop, a top-up, a single meal, or a
special occasion. Useful context rather than a purchase signal on its own.

## Turning that into one number

Two of the four answers combine into the headline score:

| Ingredient | Weight | Why |
|---|---|---|
| How likely they are "ready to buy" | 70% | The most direct signal |
| Whether searches name specific products | 30% | Naming a brand means the choice is made |

The other two answers — *stuck on service questions* and *kind of shop* — are
shown but not scored. They explain the situation rather than measure intent, and
mixing them into one number would blur what it means.

**When the shopper never searched**, the second ingredient is left out
altogether and the first carries the whole score. Plenty of people navigate by
aisle and never type anything; they have simply told us nothing on that point,
and "told us nothing" is not the same as "no". Scoring it as a no used to cap
those shoppers at 70% no matter how obviously decided their basket was.

A note on why the search question does not also read the names of products the
shopper looked at: every name in the catalogue is already specific — "Organic
Hass Avocados", "British Maris Piper Potatoes". Feeding those in would make the
answer yes for anyone who looked at anything, and the signal would stop telling
us apart one shopper from another. What the shopper *typed* is evidence because
they chose the words. What the shop calls its products is not.

The weights live in ordinary code, so they can be changed without asking the
model anything again.

## What it looks like in practice

Two real sessions from this demo. The percentages below predate the current
weighting, so treat the columns as a comparison rather than as exact figures:

| | Salmon, lemons and butter viewed; searched "sea bass fillets", "lemons" | Empty basket; searched "delivery slots", "snacks" |
|---|---|---|
| **Score** | **high** | **very low** |
| Stage | Ready to buy | Browsing |
| Kind of shop | Single meal | Weekly shop |
| Specific search? | Likely yes | No |
| Stuck on service? | No | **Yes** |

The first shopper never said they were making dinner. The model read three
ingredients and worked it out — which is the whole point of the exercise.

## Honest limits

- **It answers with probabilities, not certainties.** Every answer carries a
  confidence figure, and a low one is a signal to act gently rather than a
  failure.
- **A brand-new session has nothing to read.** No searches and no views means no
  meaningful judgment. That is expected, not an error.
- **The weights are a starting point.** They were chosen by hand and should be
  tuned against real outcomes before anyone trusts the number for a business
  decision.
- **Scores are for ranking, not arithmetic.** A high score means this shopper
  ranks above others, not that that percentage of such shoppers will check out.
