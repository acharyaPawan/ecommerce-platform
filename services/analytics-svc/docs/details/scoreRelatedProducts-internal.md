# `scoreRelatedProducts` Logic Explained

## What Multiplication Achieves

The multiplication `actorWeight * eventWeight` combines **two signals** into one composite score:

```typescript
const nextScore = actorWeight * eventWeight;
```

### The Two Signals

| Signal | Meaning | Example |
|--------|---------|---------|
| `actorWeight` | How engaged was this user/session **with the anchor product**? | User purchased ProductX → weight = 6 |
| `eventWeight` | How strong is this **interaction type** on OTHER product? | User clicked ProductY → weight = 2 |
| **Product** | Combined intent | User who **bought X** is more likely to want **Y** if they **click** it |

---

## Real-World Example

**Scenario:** Finding products related to **ProductX** (a laptop)

### Step 1: Anchor Events (who viewed/bought ProductX?)

```
User A: viewed ProductX → weight = 1
User B: clicked ProductX → weight = 2
User C: purchased ProductX → weight = 6  ← strongest
```

### Step 2: What else did these users do?

```
User A → also viewed ProductY (monitor) 
User B → also clicked ProductY (monitor) + added ProductZ (mouse) to cart
User C → also rated ProductY (monitor)
```

### Step 3: Score Candidates (multiply)

**For ProductY (monitor):**

```
User A: 1 (anchor) × 1 (view) = 1
User B: 2 (anchor) × 2 (click) = 4
User C: 6 (anchor) × 5 (rating) = 30
─────────────────────────────────
Total Score: 35 | Signals: 3
```

**For ProductZ (mouse):**

```
User B: 2 (anchor) × 4 (cart_add) = 8
─────────────────────────────────
Total Score: 8 | Signals: 1
```

### Result

```
ProductY wins with score 35 (more likely related)
ProductZ has score 8 (lower intent)
```

---

## Why Multiply (Not Add)?

| Approach | Formula | Problem |
|----------|---------|---------|
| **Multiply** (current) | `6 × 5 = 30` | ✅ Reflects: "Power user bought anchor + rated candidate" |
| **Add** | `6 + 5 = 11` | ❌ Treats both equally; doesn't amplify strong signals |

**Multiplying amplifies:** A user who **bought** the anchor product clicking a candidate gets a **much higher score** than a user who just viewed it.

---

## The Full Algorithm in `scoreRelatedProducts`

````typescript
/**
 * Multiply actor weight × event weight for each candidate product.
 * 
 * Example:
 *   User A (viewed ProductX, weight=1) → clicked ProductY
 *     Score += 1 × 2 = 2
 *   
 *   User B (purchased ProductX, weight=6) → added ProductY to cart
 *     Score += 6 × 4 = 24
 *   
 *   ProductY total score: 26 (combining intent from weak + strong users)
 *
 * Aggregates scores across all events, tracks supporting signals and strongest event type.
 * Returns products sorted by score (desc), then supporting signals (desc), then productId (asc).
 */
function scoreRelatedProducts(
  events: InteractionRow[],
  actorWeights: Map<ActorKey, number>
): RelatedProductRecommendation[] {
  const scored = new Map<
    string,
    {
      score: number;
      supportingSignals: number;
      strongestEventType: InteractionEventType;
      strongestWeight: number;
    }
  >();

  for (const event of events) {
    const actorKey = toActorKey(event);
    if (!actorKey) {
      continue;
    }

    const actorWeight = actorWeights.get(actorKey);
    if (!actorWeight) {
      continue;
    }

    const eventType = event.eventType as InteractionEventType;
    const eventWeight = EVENT_WEIGHTS[eventType] ?? 1;
    const nextScore = actorWeight * eventWeight;  // ← Multiply: anchor intent × interaction type

    const existing = scored.get(event.productId);
    if (!existing) {
      scored.set(event.productId, {
        score: nextScore,
        supportingSignals: 1,
        strongestEventType: eventType,
        strongestWeight: eventWeight,
      });
      continue;
    }

    existing.score += nextScore;  // ← Accumulate across multiple actors/events
    existing.supportingSignals += 1;
    if (eventWeight > existing.strongestWeight) {
      existing.strongestWeight = eventWeight;
      existing.strongestEventType = eventType;
    }
  }

  return Array.from(scored.entries())
    .map(([productId, value]) => ({
      productId,
      score: roundScore(value.score),
      supportingSignals: value.supportingSignals,
      strongestEventType: value.strongestEventType,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.supportingSignals !== a.supportingSignals) {
        return b.supportingSignals - a.supportingSignals;
      }
      return a.productId.localeCompare(b.productId);
    });
}
// ...existing code...
````

**Key insight:** Multiplication ensures **power users** (who purchased/rated anchor) have disproportionate influence on recommendations, while casual browsers (who just viewed) contribute minimally.