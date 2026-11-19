# Methodology

The rules every step applies. One source of truth: when a step says "per methodology", it means this file.

## Independence and blinding

- Assign anonymous IDs and a random review order (`anonymize.cjs`). Folder names usually reveal the model, so blinding is partial — say so.
- Freeze quality scores before computing any duration, token or cost figure. Reading session *structure* (model ID, effort, turns) to attribute runs is allowed; note any incidental exposure in the report.
- Model reputation and public rankings never feed a score.
- If the evaluator shares a vendor or model with a submission, disclose it.

## Submissions and first delivery

- A submission is the deliverable a model left in its folder. Account for every run and revision separately; consolidate only confirmed copies of the same run, keeping their paths.
- Grade the first completed delivery before user feedback. When a session has one task turn and no follow-ups, the folder file is that delivery if its modification time precedes the session's completion. Otherwise recover the first-delivery version from history, or grade what exists and label the limitation.
- Compare the code printed in the final chat message with the file. Archive differing chat copies in `evidence/chat-deliveries/`; grade the file. Chat formatting compliance is descriptive unless the rubric scores it.
- An implementation-specific failure to launch is DNF and ranks below runnable submissions. A shared CDN outage, blocked network or missing WebGL is an environmental block — prove which with a minimal independent control.

## Runtime evidence

- Same machine, browser version, graphics backend, flags and viewports for every submission (default 1440×900 and 390×844 at device pixel ratio 1). Record whether rendering is hardware or software.
- One project at a time, foreground window. Screenshots and heavy probes never run inside a timed window.
- Never mark a check passed because the code looks right. Distinguish observed behaviour from source-based inference in every finding.
- Controls must change the scene, not just a label: compare frames, not text.

## Performance

Three trials per runnable submission: fresh load, warm-up after the first observed draw call (default 5 s), measurement window (default 20 s), submission order rotated each trial. Report per trial and the median: FPS, p95 frame interval, share of intervals over 33.3 ms. The rAF monitor measures browser frame cadence — not GPU time and not necessarily the app's render rate; report observed draw-call activity alongside. Record canvas resolution and any adaptive-quality changes. A display cap (for example 120 Hz) that every submission saturates means the trials cannot rank GPU headroom — say so. Interaction stability is measured separately on the common interaction sequence. One memory reading never shows a leak.

## Scoring

- Fixed rubric, anchors 0/25/50/75/100% except explicit performance thresholds. Unavailable evidence is "not verified", not zero; if a category cannot be assessed, report confirmed points and the possible range.
- No undisclosed penalties; don't deduct twice for one consequence.
- Differences of 2 points or less are a practical tie.
- Visual points are structured judgments; explain them with screenshots and motion, never as measurements.

## Session accounting

Normalize only after verifying the source's semantics (see harness-telemetry).

- **I** total input including cached input once · **O** total generated output including reasoning once · **R** reasoning tokens where explicitly reported · **N** = O − R only when R is a confirmed subset of O · **T** = I + O.
- Report uncached input, cache read and cache write where separated. Shares: R/O, R/(I+O), cache read / I — each with its denominator named; N/A for zero or unknown denominators.
- Aggregate counts first, then compute percentages. Deduplicate per-request records; never sum cumulative counters. Repeated context across requests is legitimate usage.
- Missing reasoning telemetry is N/A, not zero; partial coverage is reported as coverage.
- Tokens across vendors are usage statistics, not equal units of compute.

## Durations and latency

- Elapsed = first completed delivery − that run's task submission, from the session record. File times and code length never establish duration. Runs overlap in wall time; never compare finishing order.
- Report model/API time and tool time only as the harness defines them; parallel durations are never summed into wall time.
- TTFT kinds are kept apart and never ranked across definitions: initial-request TTFT (dispatch → first non-empty content delta), time to first visible non-reasoning text, time to first write of the deliverable, per-request TTFT (median and p95 with sample count). A completed-message timestamp is not a first token. Preserve a harness's own TTFT definition when it supplies one.
- Workflow throughput = output tokens per elapsed second; never call it decoder speed.

## Cost

Report the **total originating-session cost** for every run, by basis, never mixing bases:

1. **Verified billed cost** — an actual bill.
2. **Client-reported estimate** — what the harness computed.
3. **API-equivalent estimate** — recorded usage × official list prices (source URL, date, tier, long-context thresholds, cache-write multipliers), with the formula shown.

Subscription usage is not $0 and not a dollar figure; report quota movement only if attributable. When a session continued past the scored delivery, report both the full session and the scored attempt. Include billed retries, subagents and auxiliary harness models exactly once. When input accounting cannot be reconstructed, the total is N/A; a partial lower bound may be shown separately, labelled, and never added to other bases. Combined totals are per basis with coverage ("7 of 9 sessions").

## Reporting

Quality, speed and cost stay separate — no blended score, no "score per dollar" winner. One generation per model is not a general ranking, and browser performance repetitions are not independent generation trials. Size is descriptive.
