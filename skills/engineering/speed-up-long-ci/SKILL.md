---
name: speed-up-long-ci
description: Measure and cut pull-request CI wall-clock time by baselining ~150 recent PR runs with gh, splitting every job into waiting, setup, and running at p50/p90, finding the critical path, then applying fixes in impact order (queue time, setup and caching, parallel jobs, sharding, worker counts, per-file startup, affected-only runs, pre-push hooks) one commit at a time with before/after numbers on a branch, never the default branch — GitHub Actions first, adaptable to GitLab CI, CircleCI, and Buildkite — use when the user says CI is slow, PR checks take 10+ minutes, an agent's push-wait-fix loop is stuck waiting on CI, or asks to speed up, profile, audit, or cut the cost of a CI pipeline, reduce runner queue time, fix CI cache misses, shard a slow test suite, or invokes /speed-up-long-ci.
---

# Speed up long CI

Cuts the time from `git push` to the last PR check finishing. Every push-wait-fix loop pays that wait, whether the pusher is a person or an agent, so it is the target metric. Total CPU minutes is not. The PR waits on its slowest chain of jobs. In practice the wins come from queueing, setup, and parallelism, and rarely from deleting tests.

The skill measures first, ranks fixes by seconds removed from the critical path, applies them one at a time on a branch, and re-measures each one with the same script.

---

## When to use

Trigger when any of these apply:

- The user says CI or PR checks are slow, or names a duration ("checks take 25 minutes").
- An agent loop is spending most of its time waiting on CI after each push.
- The user asks to audit, profile, or cut the cost of CI, reduce queue time, fix cache misses, or shard tests.
- The user invokes `/speed-up-long-ci`.

Do **not** trigger for: a single red build (debug the failure), setting up CI from scratch, or a slow local test run with no CI in the loop.

---

## Rules

- **No number, no claim.** Measure before changing anything. Re-measure after each change with the same command.
- **Never touch the default branch.** Work on a branch (`git switch -c ci/speedup`). `pull_request` runs need an open PR, so ask before opening a **draft** PR. Never merge it; the user does.
- **Ask before spending money.** Paid or larger runners, more shards, and remote caches all cost money. State the expected monthly change: billable minutes/run × PR runs/month × rate.
- **One change per commit.** Measure each commit before stacking the next, so every win or regression can be traced to one change. If you batch measurements to save runs, say so in the log.
- **Keep `ci-speedup-log.md` on the branch.** Record the baseline, then one row per change: what, why, before, after, n, cost delta. Format is below.

---

## Phase 1 — Measure the baseline

1. **Pick the workflow.** Choose the one whose checks finish last on PRs. If the user didn't name one, rank by median run time. This figure counts reruns, so use it only to rank:

   ```bash
   gh run list --event pull_request --status success -L 300 --json workflowName,createdAt,updatedAt \
     --jq 'group_by(.workflowName)[] | {workflow: .[0].workflowName, runs: length,
           p50_min: (map((.updatedAt|fromdateiso8601) - (.createdAt|fromdateiso8601)) | sort | .[length/2|floor] / 60 | floor)}'
   ```

   For reusable workflows, measure the caller (the workflow with `on: pull_request`).

2. **Pull ~150 completed PR runs.** Run this from the target repo root. The script path is relative to this skill's directory:

   ```bash
   bash <skill-dir>/scripts/ci_timing.sh -w ci.yml -L 150 > /tmp/ci-baseline.md
   ```

   The script makes one `gh run list` call plus one jobs call per run, so about 150 API calls. Raw data is saved under `$TMPDIR`; stderr prints the path. It times successful runs only (add `--include-failed` to time failed runs too). It reports reruns (`attempt > 1`) and conclusion counts across all runs. Use `--event any` if PR CI runs on `push` or `merge_group`.

3. **Read the three phases per job, at p50 and p90.** Never use the mean: one stuck runner drags it.

   | Phase | Definition |
   |---|---|
   | waiting | `started_at − created_at`: queued for a machine |
   | setup | job time not in a running step: set up job, checkout, toolchain, cache restore, dependency install, DB/service start, post steps |
   | running | steps doing the work: lint, typecheck, build, test |

4. **Check the step classification.** In the Steps table, any step tagged with the wrong `Class` skews setup vs running. Re-analyse without refetching:
   `ci_timing.sh --from <raw-dir> --setup-regex '<regex>'`.

5. **Sanity-check `needs:` jobs.** A downstream job's `Queued at` should be at or after its upstream's `Done at`. If a downstream job shows `+0s` and large waiting, the API created it up front. For that job, use `started_at − upstream completed_at` as waiting.

6. **Find the critical path.** Take the job with the highest `Finished last` share. Walk its `needs:` back to a root in the workflow YAML; that chain is the critical path. Its `Done at` p50 should match the wall-clock p50. Shards show as separate rows (`test (2, 4)`), and the slowest shard is the one on the path.

7. **Check what the jobs API can't show:**
   - **Caches PRs can restore:** `gh cache list --ref refs/heads/<default-branch> -L 100 --json key,sizeInBytes,lastAccessedAt`. If there is no entry keyed on the current lockfile hash, every new PR misses.
   - **Miss rate:** for 10 recent runs, `gh run view <run-id> --log | grep -iE 'cache (not found|restored|hit)'`. Count misses per cache step.
   - **Variance:** steps with p90 above 2× p50 usually indicate cache misses, resource contention, or retries.
   - **Cores:** for each critical-path runner label, get the vCPU count from the runner docs, or add a temporary `run: nproc` step.

8. **Write the baseline to the log** before touching any config.

---

## Phase 2 — Rank

Map each signal to a fix. Then rank candidates by **seconds removed from the critical path**, not from total job time. A 5-minute job that is not on the path saves nothing.

| Signal in the tables | Likely cause | Fix |
|---|---|---|
| Waiting p50 more than a few seconds on most jobs | runner capacity, plan concurrency limit | 1 |
| Waiting high only on one runner label | that pool is small or slow to start | 1 |
| Pre-job hold above ~0 | `concurrency:` group queueing runs, or fork-PR approval | 1 |
| Setup ≥ running on a critical-path job | cache misses, dependency install, service start | 2 |
| Job B queued exactly at job A's done, but B doesn't use A's output | false `needs:` | 3 |
| One job finishes last in most runs and its running time dominates | one serial bottleneck | 3, then 4 |
| Shards differ by more than one setup's worth of time | split by file count, not timings | 4 + guards |
| Step p90 above 2× p50; rerun rate climbing | contention or test flakes | 5, guards |

---

## Phase 3 — Fix in this order

Stop when the critical path is short enough for the user's loop. Commit each item separately.

1. **Kill queue time.** If median waiting is more than a few seconds, move *every* job to faster-starting runners, including tiny ones. Options are third-party Actions runners, autoscaling self-hosted runners, or larger hosted runners. This is usually a one-line `runs-on:` change, and it costs money, so ask first. A 5-second job that waits 10 minutes is a 10-minute job. If pre-job hold is the problem, cancel superseded PR runs: `concurrency: { group: "${{ github.workflow }}-${{ github.head_ref || github.run_id }}", cancel-in-progress: true }`. This applies on PRs only; `run_id` keeps default-branch runs uncancelled.
2. **Fix setup.** Setup is paid again in every job and shard; the baseline shows how much.
   - **Cache scope:** a PR run can restore caches from its own merge ref, its base branch, and the default branch. Caches it writes are scoped to `refs/pull/N/merge`, so no other PR can use them. If nothing writes the cache on the default branch, every new PR misses. Seed it from a workflow on `push` to the default branch; key on lockfile hash + OS + toolchain version. Only trusted triggers (`push`, `schedule`, `workflow_dispatch`) write default-branch caches. The seeding workflow runs only after merge, so log it as "measure after merge".
   - **Cache the installed artifact,** not just the download cache, when restoring is faster than installing (`node_modules`, `.venv`, `~/.m2`, `~/.gradle`).
   - **Checkout:** keep the default `fetch-depth: 1` if nothing reads history. If anything does (affected-detection, changelog, versioning, `git describe`), use `fetch-depth: 0` with `filter: blob:none` (blobless) instead of a full clone. Never use shallow clones there.
   - **Services:** start the DB or Redis in parallel with install, or use service containers or prebuilt images.
3. **Parallelize everything.** Run lint, typecheck, build, and test as separate jobs with no false `needs:`. The PR is as slow as the slowest job, so audit that job next. Move unrelated work out of it: migration checks, other packages' tests, artifact uploads.
4. **Shard the slowest test target onto bigger machines.** Give each shard its own DB or schema. Prefer more cores per machine over more shards, because each shard pays setup and module loading again. Benchmark, for example, 4 shards × 8 vCPU against 8 × 4 vCPU, and pick by critical path and cost.
5. **Match in-job parallelism to cores.** More workers than vCPUs adds contention and flakiness. Try `workers = vCPUs` and `vCPUs / 2`, keep the faster, and log any flakes it removed.
6. **Stop paying per-test-file startup.** Reuse the process or module graph across test files where the runner allows it. Test state leaks start here, so do this only with the shared-process guard below.
7. **Swap slow tools for faster equivalents.** Benchmark in this repo before switching. Published speedups vary.
8. **Run only what the PR touches.** On PRs, use the build graph: Nx/Turborepo affected, Bazel, Pants, Gradle build cache, or path filters. Keep the full suite on the default branch, on merge or nightly.
9. **Shift checks left.** Add a pre-push hook that runs format, lint, and typecheck on changed files only, in under ~10 s. Make it a hook, not a sentence in `AGENTS.md`; agents skip prose steps.

Don't audit individual tests for deletion until steps 1–5 are done; the time is rarely there.

---

## Phase 4 — Verify each change

1. **Collect ≥10 runs of the changed commit** (5 if runs are expensive; say so in the log).
   - `gh run rerun` does **not** add samples. It creates a new attempt of the same run, and only the latest attempt is measured.
   - Instead, use `gh workflow run <wf> --ref ci/speedup` if the workflow has `workflow_dispatch`. Otherwise push commits.
   - Dispatch runs one after another when you are measuring waiting. Concurrent runs queue behind each other.
2. **Measure with the same script:**

   ```bash
   bash <skill-dir>/scripts/ci_timing.sh -w ci.yml --event any --branch ci/speedup --commit <sha>
   ```

3. **Compare critical-path p50 and p90 against the baseline.** With n < 20, report p50 and max; p90 of 10 samples is the max. The first run on a new cache key is a cold miss, so note it and don't count it against the change.
4. **Keep the change only if** it shortens the critical path or removes flakiness without a correctness regression. Otherwise revert the commit and log why.

---

## Phase 5 — Report

Final report to the user:

- **Baseline vs now:** PR wall-clock p50/p90, cache hit rate, rerun rate, billable job-minutes per run, and monthly cost.
- **Changes table,** in the order applied, each with its measured effect and n.
- **Guards added:** reset hook, skip-logic canary, pre-push hook.
- **Not yet measurable:** changes that act only after merge, such as cache seeding or the nightly full suite.
- **What's left:** the next bottleneck, often review and merge latency rather than CI.
- **The draft PR link,** unmerged, for the user to approve.

### `ci-speedup-log.md` format

```markdown
# CI speedup log: <owner/repo> / <workflow>

## Baseline (<date>, n=<runs>, `ci_timing.sh -w <wf> -L 150`)
<pasted tables>
Critical path: <job> -> <job> -> <job>   p50 <t> / p90 <t>
Default-branch cache for <key prefix>: <present | missing>   Miss rate: <x/10>
Reruns: <x%>   Billable job-min/run p50: <n>

## Changes
| # | Commit | Change | Signal it targets | Critical path p50 / p90 before -> after | n | Cost delta | Kept |
|---|---|---|---|---|---|---|---|
```

---

## Failure modes to guard against

| Risk | Guard |
|---|---|
| Shared-process tests leak state (globals, mocks, DB rows, timers) | Add a global reset hook after each file. Run the suite twice in random order and compare. Document in `AGENTS.md` what a test must clean up. |
| Affected-only logic skips a real change and reports green | Test the skip logic with a canary PR: change a file in a way the graph can't see; it must fail. Treat "zero targets ran" as a failure unless the diff only touches an explicit allowlist (docs, etc.). |
| Workflow-level `paths:` filter skips a required check | The PR waits on "Expected" forever and is blocked. Filter at job level instead (`if:` on a paths-filter output); a skipped job reports success. |
| Shallow clone breaks history readers | Use a blobless clone instead. Verify the affected-detection base SHA resolves. |
| Cache scoped to the PR branch, never seeded | Seed from the default branch and track hit rate in the log. |
| Cache key too broad; stale deps pass CI | Key on lockfile hash + OS + toolchain version. |
| Cache churn evicts the default-branch entry (repo limit, 10 GB by default) | Use restore-only caches in PR jobs (`actions/cache/restore`) and save only on the default branch. Re-check `gh cache list`. |
| Shards unbalanced; one shard becomes the new critical path | Split by recorded timings, not file count. Compare shard rows in the Jobs table. |
| Faster tool has different rules or semantics | Run old and new side by side for a few PRs. Diff findings before removing the old one. |
| Bill grows silently | Record billable job-minutes per run before and after, × runner rate. Standard hosted runners are free on public repos; larger runners are not. Report the monthly delta. |

---

## Stack notes

Candidates to benchmark, not defaults to apply.

- **JS/TS:**
  - Oxlint or Biome instead of ESLint.
  - TypeScript's native compiler (`tsgo` / TS 7) or another fast checker instead of `tsc`.
  - Vitest `isolate: false` with `maxWorkers`. Both are top-level in Vitest 4; `poolOptions` is the ≤3 form.
  - Vitest `--shard`; Jest `--shard`.
  - Nx or Turborepo affected.
  - Cache `node_modules` keyed on the lockfile.
- **Python:**
  - `uv` with the `astral-sh/setup-uv` cache, or cache `.venv` keyed on `uv.lock`.
  - Ruff instead of flake8, isort, and black.
  - pytest-xdist `-n auto`; the cores rule applies.
  - `pytest-split` (`--splits N --group i`, timings from `--store-durations`) for sharding.
  - Session-scoped fixtures with explicit teardown are Python's version of the isolation trade-off.
- **JVM (Gradle/Maven):**
  - `gradle/actions/setup-gradle` with build cache and configuration cache.
  - Gradle `--parallel`; `maxParallelForks` = cores.
  - Maven `-T 1C` with a `~/.m2` cache.
  - Develocity or a remote build cache for affected-style avoidance.
- **Docker:**
  - BuildKit with `cache-from` / `cache-to` `type=gha`, or a registry cache.
  - Order Dockerfile layers so dependency install comes before the source copy.
  - Build test images once and reuse them across shards.
- **Go/Rust:**
  - Cache module and build dirs (`~/go/pkg/mod`, `~/.cache/go-build`; `Swatinem/rust-cache`).
  - `cargo nextest` with `--partition`.
  - `sccache`.

### Other CI systems

Keep the three phases and swap the fetch. These timestamps map to waiting:

| CI | Job timestamps | waiting |
|---|---|---|
| GitLab | `GET /projects/:id/pipelines/:pipeline_id/jobs` → `created_at`, `started_at`, `finished_at`, `queued_duration` | `queued_duration` |
| Buildkite | build `jobs[]` → `runnable_at`, `started_at`, `finished_at` | `started_at − runnable_at` |
| CircleCI | `GET /project/{slug}/job/{number}` → `queued_at`, `started_at`, `stopped_at` | `started_at − queued_at` |

Step-level setup vs running usually requires the job log on these systems. Start from job-level phases.

---

## Files in this skill

- `SKILL.md` (this file): workflow, rules, guards, stack notes.
- `scripts/ci_timing.sh`: fetches runs and jobs via `gh` and prints the baseline tables (runs, jobs with waiting/setup/running p50/p90 and finished-last share, slowest steps). `--from DIR` re-analyses saved data offline. Needs `gh` and `jq`.
