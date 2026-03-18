# getPersonalProductRecommendations Flow

This document explains how `getPersonalProductRecommendations` works, with emphasis on `cohortEvents` and newer additions in the response shape.

## Goal

Return products "for you" using a 2-hop collaborative signal:

1. Learn this actor's own product history and interest strengths.
2. Find other actors who overlap with that history (`cohortEvents`).
3. Recommend products those cohort actors engaged with, excluding already-seen products.
4. Backfill with popular products if personalized candidates are not enough.

## Inputs and Defaults

- `userId?`
- `sessionId?`
- `limit?` default 6, clamped to [1, 24]
- `lookbackDays?` default 120, clamped to [14, 365]

Actor resolution prefers `userId` over `sessionId`.

## Step-by-Step

### Step 0: Resolve actor

- If neither `userId` nor `sessionId` exists, return only fallback popular products.

### Step 1: Build actor history

Query all events for the exact actor in lookback window, then build:

- `actorHistory: Map<productId, weightSum>`
- `historyProductIds = keys(actorHistory)`
- `seedProductIds = top 5 by actorHistory weight`

Weight source is `EVENT_WEIGHTS`:

- view=1
- click=2
- wishlist_add=3
- cart_add=4
- rating=5
- review=5
- purchase=6

So a purchase contributes much more than a view.

### Step 2: Build cohortEvents ("people like me")

`cohortEvents` query returns events where:

- `productId` is in `historyProductIds`
- event is within lookback window
- actor is NOT the current actor

In simple terms:

- all interactions from other actors on products this actor has interacted with.

This overlap is used to discover a similarity cohort.

### Step 3: Convert overlap to cohortScores

`buildCohortActorScores(cohortEvents, actorHistory)` computes per-actor similarity:

- For each overlap event:
  - `anchorWeight = actorHistory[event.productId]`
  - `eventWeight = EVENT_WEIGHTS[event.eventType]`
  - add `anchorWeight * eventWeight` to that cohort actor score

Interpretation:

- if someone strongly engages on products that are also strong in your history, they become a stronger cohort actor.

### Step 4: Fetch candidate events from cohort actors

Query events from cohort actors (user/session keys) in the same lookback window, but exclude products in `historyProductIds`.

This prevents recommending products already in actor history.

### Step 5: Rank candidate products

`scoreRelatedProducts(candidateEvents, cohortScores)` aggregates by product:

- contribution per event = `cohortActorScore * candidateEventWeight`
- track `supportingSignals`
- track strongest event type for explainability

Sort order:

1. score desc
2. supportingSignals desc
3. productId asc

### Step 6: Fallback if needed

If personalized list length is less than `limit`, call `getPopularProductFallback` and fill the remainder.

Fallback excludes:

- actor history products
- already-picked recommendations

## "New additions" called out

These are the additions commonly noticed in this flow:

- `seedProductIds` in response for transparency/debugging.
- `cohortEvents` + `cohortScores` two-hop personalized ranking.
- explicit exclusion of already-seen products from personalized candidates.
- fallback merge to guarantee enough items.

## Mini Example

Actor history:

- P1 purchase (6)
- P1 click (2)
- P2 view (1)

Then:

- `actorHistory[P1] = 8`
- `actorHistory[P2] = 1`

Cohort actor U2 overlap events:

- U2 purchase P1 (6) => `8 * 6 = 48`
- U2 click P2 (2) => `1 * 2 = 2`

`cohortScores[U2] = 50`

If U2 cart_adds P9 (4), candidate P9 gains:

- `50 * 4 = 200`

Products with higher summed contributions are ranked first.
