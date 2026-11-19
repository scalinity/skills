# Code craft

A separate, **unscored** reading of the code that answers "who wrote the best, most intricate, top-tier code?". It never changes a rubric score: rubric category E deliberately rewards maintainability, not ambition, and a brilliant but over-built solution can lose points there while topping this lens. Report both, and say which question each answers.

## When to gather it

Collect observations during the source review (step 7), while the code is in front of you, in a separate section of `source-review.md` per submission. Write `craft.json` after scores are frozen, because the payoff column uses time and cost.

## Dimensions

Judge each from the code itself and cite `file:line` for every claim.

- **Ambition** — the hardest problem the code takes on, beyond what the brief demanded (e.g. solving the exact equation instead of an approximation; a precomputed solver; a multi-pass architecture).
- **Algorithmic depth** — numerical methods, data structures, precomputation, inversion, error control; is the hard part actually correct, not just present?
- **Architecture** — decomposition and data flow: do the parts have clear responsibilities, and does one design idea make several requirements fall out at once?
- **Elegance** — capability per line: the least machinery that achieves the result; no incidental complexity.
- **Craftsmanship** — naming, comments that explain *why*, units and constants derived rather than tuned, edge cases, failure handling.
- **Payoff** — does the complexity show up in the running result, and what did it cost (elapsed time, session cost)? Filled in after stats.

## Output

`evidence/craft.json`:

```json
{
  "question": "Who wrote the most intricate, top-tier code?",
  "superlatives": [
    {"title": "Most intricate", "id": "S9", "why": "CPU RK4 solution of the exact orbit equation inverted into two lookup textures… (index.html:410-520)"},
    {"title": "Most elegant", "id": "S4", "why": "…"},
    {"title": "Cleverest design idea", "id": "S5", "why": "…"},
    {"title": "Best documented", "id": "S9", "why": "…"}
  ],
  "tiers": [
    {"tier": "Top tier", "ids": ["S9","S5","S4"], "note": "…"},
    {"tier": "Strong", "ids": ["S6","S8"], "note": "…"},
    {"tier": "Standard", "ids": ["S1","S2","S3"], "note": "…"},
    {"tier": "Weaker", "ids": ["S7"], "note": "…"}
  ],
  "runs": {"S9": {"summary": "two to four sentences with file:line evidence", "payoff": "highest ambition; slowest (49 min) and costliest run"}}
}
```

Every run appears in exactly one tier and has a `runs` entry. Superlatives may repeat a run. Keep claims to what the code shows — no reputation, no guesses about intent.

## How to say it

Lead with the superlatives, then the tiers, then one line on the trade-off: the most intricate code is not automatically the best result, and the cheapest correct solution is often the most elegant. Name the rubric category E score beside each run so the reader sees both questions answered.
