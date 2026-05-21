# Portfolio README — Section Inventory

A scope and structure template for a portfolio-quality README. The frame transfers across domains — AI products, infra tools, dev tooling, mobile apps. Swap the content, keep the section order, table density, and voice.

The skill loads this file on every invocation and follows it as the structural source of truth.

## Section inventory

```
# <Project Name>

### <Short subtitle — sentence-case, one line of what the thing is>

<6–8 shields.io badges: language, platform, stack, AI provider, backend,
payments, specialty — keep density consistent with neighbouring badges>

<Lead paragraph — 4–5 sentences naming: product, user, technical thesis,
approach, and the differentiating engineering choice. This is the
paragraph skimmers read. Don't waste it.>

<Optional second paragraph — 1–2 sentences on positioning / philosophy.>

---

## Table of Contents

- [Motivation](#motivation)
- [<Domain-specific Systems>](#...)   # e.g., "AI & Machine Learning Systems"
- [<Foundations>](#...)                 # optional: Design Principles, Clinical Foundations
- [Safety & <Crisis Intervention | Correctness>](#...)
- [Architecture](#architecture)
- [Technical Highlights](#technical-highlights)
- [Tech Stack](#tech-stack)
- [Project Scale](#project-scale)
- [Roadmap](#roadmap)

---

## Motivation

<2–3 paragraphs. First: the user pain / problem space, often with a
statistic or concrete framing. Second: the technical thesis — why is
THIS approach the right one NOW? Third (optional): the ethical /
philosophical frame if the domain warrants it.>

---

## <Domain-specific Systems>  (the biggest section — 5–10 subsystems)

### <Subsystem 1>

<1–2 sentence framing of what this subsystem does.>

<Optional table mapping states / modalities / types to domain concepts.>

<Bullet list of technical choices + rationale:>
- **Model / Library:** ...
- **Transport / Protocol:** ...
- **Cost / Performance:** ... (with actual numbers)
- **Failure mitigation:** ...

### <Subsystem 2>

<Same pattern.>

### <...>

---

## <Foundations>  (optional)

<Two-column table mapping frameworks to their application in the project.>

| Framework | Application |
|---|---|
| ... | ... |

<Optional: "forbidden moves" bullet list of things the project deliberately avoids.>

---

## Safety & <Crisis Intervention | Correctness>

<Even for projects that aren't safety-critical, this section sets the
engineering-rigor bar. Rename to "Security" or "Reliability" if the
domain fits better. Typical subsections: detection, alerts,
prompt-injection prevention, privacy architecture, validators,
idempotency, rate limits, webhook verification, vendor posture.>

### <Subsection 1>

### <Subsection 2>

---

## Architecture

```
┌──────────────────────────────────────┐
│         <Client tier>                 │
│  <3–5 bullets of in-client systems>   │
└────────────────┬─────────────────────┘
                 │
         <Protocol / transport>
                 │
┌────────────────▼─────────────────────┐
│         <Backend / platform tier>     │
│  <3–5 bullets of platform services>   │
└────────────────┬─────────────────────┘
                 │
┌────────────────▼─────────────────────┐
│         <External / integration tier> │
│  <3–5 bullets of third-party services>│
└──────────────────────────────────────┘
```

<Hybrid data-ownership explanation, DI / state-architecture notes, deploy workflow.>

---

## Technical Highlights

<10–18 punchy bullets. Each names a specific engineering win:>

- **<Short phrase naming the win>** — <one sentence with enough detail
  that the reader thinks "huh, that's non-obvious" or "that's a sharp
  decision.">

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Client** | ... |
| **Backend** | ... |
| **Data** | ... |
| **AI** | ... |
| **Payments** | ... |
| **Monitoring** | ... |
| **Architecture Decisions** | ADRs with typed status |

---

## Project Scale

| Metric | Count |
|---|---|
| Source files | N |
| Test files | N |
| Modules / features | N |
| Migrations / schema revisions | N |
| Endpoints / functions | N |
| Database tables | N |
| ADRs | N |

<Numbers must match reality. Run `scripts/detect_scale.sh` to generate.>

---

## Roadmap

| Direction | Description |
|---|---|
| **<Direction 1>** | <Short explanation.> |
| ... | ... |

<Pull from spec's "Deferred" / "v2 backlog" / CLAUDE.md §Deferred rather than inventing.>

---

## License

<Proprietary / MIT / Apache 2.0 / etc.>

---

<p align="center">
  <em><One-line italic tagline that restates the thesis poetically.></em>
</p>
```

## Voice patterns to preserve

- Open with the product thesis, not the tech.
- Prefer concrete numbers over adjectives.
- Every technical-highlight bullet should make the reader think "that's non-obvious."
- Name the hard problem before the solution.
- Tables when data is tabular; prose when it's narrative.
- Backticks for file paths, function names, type names, commands.
- No "revolutionary" / "cutting-edge" / "seamless" / "best-in-class".
- Paragraphs are 3–5 sentences. Lead, then evidence.
- Closing italic tagline, centered, one line, thesis-restating.
