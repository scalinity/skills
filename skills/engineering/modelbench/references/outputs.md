# Outputs

## Contents
- Files
- notes.json
- pricing.json
- Generated files
- Final reply

## Files

All under OUT (`<root>/benchmark-results/`):

| Path | Written by | Contents |
|---|---|---|
| `brief.md` | you | the brief, verbatim |
| `manifest/` | inventory, anonymize | hashes before and after, inventory, anonymization seed |
| `evidence/environment.json` | env_probe | machine, browser, renderer, refresh rate |
| `evidence/session-config.json` | discover_sessions | session attribution |
| `evidence/rubric.json`, `plan.json` | you | rubric and runtime plan |
| `evidence/source-review.md` | you | per-submission source notes |
| `evidence/runtime/` | run_plan, perf_trial | per-run results, `shots/`, `perf.json` |
| `evidence/scores.json` → `scores-frozen.json` | you → freeze_scores | scores with evidence; frozen copy and SHA-256 |
| `evidence/session-stats.json` | session_stats | time, tokens, requests, tools, delivery |
| `evidence/pricing.json` | you | official prices |
| `evidence/artifacts.json` | artifact_metrics | size of the graded files |
| `evidence/craft.json` | you | code craft, format in [code-craft](code-craft.md) |
| `evidence/notes.json` | you | findings and presentation text |
| `metrics.json` | assemble_metrics | everything joined; never edit by hand |
| `report.md`, `leaderboard.csv` | build_report | |
| `dashboard.html` | build_dashboard | self-contained, images embedded |
| `evidence/verify.json` | verify_outputs | every check and its result |

`OUT/.cache/` holds copies of harness databases, browser profiles and verification screenshots. It can contain unrelated conversation text, so delete it when verification passes.

## notes.json

Everything a human writes about the runs, keyed by anonymous ID. Write it after scores are frozen.

```json
{
  "meta": { "title": "Nine black holes, one brief", "lede": "One sentence on what was compared and how.",
            "subject": "Interactive 3D black hole in one index.html", "reportedEffort": "xhigh", "timezone": "America/New_York" },
  "expectedModels": ["GPT-6.2 Sol", "Claude Opus 5.5"],
  "missingModels": [], "additionalModels": [],
  "firstDeliveryPolicy": "How the graded file was established as the first completed delivery.",
  "views": [ { "key": "default", "label": "Desktop", "caption": "Default camera, 5 s after load, 1440×900." } ],
  "showcaseView": "default",
  "runs": { "S1": { "display": "Claude Opus 5.5", "keyFinding": "One line for the leaderboard.",
                    "strengths": ["…"], "findings": ["Defect with repro and evidence path."],
                    "defects": { "belowPlane": "Shown under that view's plate." },
                    "runtimeHighlights": [["Differential rotation", "inner 1.5× outer"]] } },
  "confounders": ["…"], "limitations": ["…"],
  "method": [ { "title": "Runtime checks", "text": "…" } ],
  "costNote": "Optional sentence after the cost totals."
}
```

A filled example: [notes.example.json](../assets/notes.example.json).

- `reportedEffort` is the setting the user says they used; recorded effort is compared against it per request.
- `views[].key` matches the shot name in the plan (`shot: "default"` → key `default`); add `shot` when they differ. `showcaseView` picks the image for the two-column showcase.
- `keyFinding` is the leaderboard's last column: what distinguishes the run, in under 15 words.

## pricing.json

```json
{ "retrievedUtc": "2026-11-19T17:00:00Z",
  "models": { "gpt-6.2-sol": { "input": 2, "cachedInput": 0.1, "output": 10, "longContextThreshold": 272000,
                               "tier": "Standard, short context", "date": "2026-11-19", "source": "https://…" },
              "claude-opus-5-5": { "input": 4, "cacheRead": 0.2, "cacheWrite1h": 8, "cacheWrite5m": 5, "output": 20, "tier": "…", "date": "…", "source": "…" } } }
```

USD per million tokens, keyed by the exact model ID the session recorded, including auxiliary models (title generators, summarizers). Fill it from the official pages on the day; record source, tier and date. A missing model makes that run's API-equivalent cost N/A with a reason, which is correct. [pricing.example.json](../assets/pricing.example.json) holds the November 2026 values for reference only.

## Generated files

**report.md** sections, in order: verdict, inventory and attribution, method, quality scores (with deductions), per-submission findings, code craft, runtime and performance, session statistics (timing, tokens, costs, artifact size), confounders and limitations, integrity, final leaderboard.

**dashboard.html** sections: verdict, sortable and filterable leaderboard, quality matrix with evidence on hover, code craft, timing strips and the TTFT table grouped by definition, token composition, session cost by basis, artifact size, quality against time and cost, two-column showcase, side-by-side plates per view, per-run evidence, method. Every image opens full size in a lightbox. Theme follows the system with a manual toggle; CSV and JSON exports.

## Final reply

Short: where the outputs are, the verdict in three or four lines (quality tie or leader, fastest, cost by basis with coverage, coverage counts), the code-craft answer in two lines, anything that did not verify. End with the complete leaderboard, copied from the end of `report.md`:

| Quality rank | Model/run | Quality score/status | Elapsed duration | TTFT | Total session cost and basis | Input/output/reasoning tokens | Entry KiB / lines | Key finding |

One row per run plus the missing-models row. Nothing after the table.
