#!/usr/bin/env bash
# ci_timing.sh
#
# Baseline (and re-measure) GitHub Actions wall-clock for one workflow.
# Pulls the last N completed runs with `gh`, fetches every job's timestamps,
# splits each job into waiting / setup / running, and prints markdown tables
# ready to paste into ci-speedup-log.md:
#
#   1. Runs:  wall-clock, pre-job hold, billable job-minutes (p50 / p90 / max),
#             conclusion counts, rerun rate (attempt > 1)
#   2. Jobs:  queued-at and done-at offsets from run start, waiting / setup /
#             running p50 / p90, share of runs the job finished last, runner
#   3. Steps: slowest steps by p50 with p90, tagged setup or running
#
# Same script, same classification for baseline and after-change numbers.
# Raw data (runs.json, jobs.jsonl, meta.json) goes to -o DIR, default under
# $TMPDIR, so it never lands in the repo. Progress -> stderr, tables -> stdout.
#
# Requires gh (authenticated, read access to Actions) and jq >= 1.6.
# Network: only `gh repo view`, `gh run list`, `gh api .../runs/{id}/jobs`.
# Works with the bash 3.2 that ships on macOS.

set -euo pipefail

DEFAULT_SETUP_RE='^(set up job|complete job|post |initialize containers|stop containers|checkout|set ?up |setup |install|restore|cache|log ?in|docker login|pull |wait for|start (db|database|postgres|mysql|redis|services))|^run [^ ]*(checkout|setup|cache|login)|^run (npm (ci|install)|pnpm (i|install)|yarn( install)?$|bun install|uv sync|pip install|poetry install|bundle install|go mod download|cargo fetch)'

WORKFLOW="" LIMIT=150 EVENT="pull_request" BRANCH="" COMMIT="" CREATED="" REPO=""
INCLUDE_FAILED=false SETUP_RE="$DEFAULT_SETUP_RE" TOP=25 OUT="" FROM=""

usage() {
  cat <<'EOF'
Usage:
  ci_timing.sh -w WORKFLOW [options]     fetch runs with gh, then analyse
  ci_timing.sh --from DIR [options]      re-analyse saved data, no network

Fetch options:
  -w, --workflow WF      workflow file (ci.yml), name, or ID   (required)
  -L, --limit N          completed runs to list                (default 150)
  -e, --event EVENT      trigger event filter, or "any"        (default pull_request)
  -b, --branch BRANCH    only runs whose head branch is BRANCH (after-change runs)
  -c, --commit SHA       only runs for this commit
      --created RANGE    gh date filter, e.g. ">=2026-10-01"
  -R, --repo OWNER/REPO  default: the repo in the current directory
  -o, --out DIR          where raw data goes (default: $TMPDIR/ci-timing.<wf>.<time>)
      --include-failed   time failed runs too (default: successful runs only;
                         also applies with --from)

Analysis options:
      --setup-regex RE   case-insensitive step-name regex counted as setup
                         (everything else in a job counts as running)
      --top N            rows in the slowest-steps table       (default 25)
  -h, --help

Percentiles are nearest-rank. Wall-clock runs from the first job queued to the
last job done (latest attempt). Billable minutes round each job up to a whole
minute, then sum per run; multiply by your runner's per-minute rate for cost.
EOF
}

die() { printf 'ci_timing.sh: %s\n' "$*" >&2; exit 1; }
need_val() { [[ $# -ge 2 && -n "$2" ]] || die "$1 needs a value"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -w|--workflow)    need_val "$@"; WORKFLOW="$2"; shift 2 ;;
    -L|--limit)       need_val "$@"; LIMIT="$2"; shift 2 ;;
    -e|--event)       need_val "$@"; EVENT="$2"; shift 2 ;;
    -b|--branch)      need_val "$@"; BRANCH="$2"; shift 2 ;;
    -c|--commit)      need_val "$@"; COMMIT="$2"; shift 2 ;;
    --created)        need_val "$@"; CREATED="$2"; shift 2 ;;
    -R|--repo)        need_val "$@"; REPO="$2"; shift 2 ;;
    -o|--out)         need_val "$@"; OUT="$2"; shift 2 ;;
    --from)           need_val "$@"; FROM="$2"; shift 2 ;;
    --include-failed) INCLUDE_FAILED=true; shift ;;
    --setup-regex)    need_val "$@"; SETUP_RE="$2"; shift 2 ;;
    --top)            need_val "$@"; TOP="$2"; shift 2 ;;
    -h|--help)        usage; exit 0 ;;
    *)                die "unknown argument: $1 (see --help)" ;;
  esac
done

[[ "$LIMIT" =~ ^[1-9][0-9]*$ ]] || die "--limit must be a positive integer"
[[ "$TOP" =~ ^[1-9][0-9]*$ ]] || die "--top must be a positive integer"
command -v jq >/dev/null 2>&1 || die "jq not found"
jq -n --arg re "$SETUP_RE" '"x" | test($re; "i")' >/dev/null 2>&1 || die "--setup-regex is not a valid regex"

if $INCLUDE_FAILED; then
  RUN_SELECT='.conclusion == "success" or .conclusion == "failure"'
else
  RUN_SELECT='.conclusion == "success"'
fi

# ---------------------------------------------------------------- fetch ----
fetch() {
  [[ -n "$WORKFLOW" ]] || die "--workflow is required (or use --from DIR)"
  command -v gh >/dev/null 2>&1 || die "gh not found"
  if [[ -z "$REPO" ]]; then
    REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner </dev/null) \
      || die "cannot resolve the current repo; pass -R OWNER/REPO"
  fi

  local wf_slug
  wf_slug=$(printf '%s' "$WORKFLOW" | tr -c 'A-Za-z0-9._-' '_')
  OUT=${OUT:-"${TMPDIR:-/tmp}/ci-timing.${wf_slug}.$(date +%Y%m%d-%H%M%S)"}
  mkdir -p "$OUT"

  local fields="databaseId,attempt,conclusion,createdAt,startedAt,event,headBranch,headSha"
  local -a list_args=(run list -R "$REPO" --workflow "$WORKFLOW" --status completed
    -L "$LIMIT" --json "$fields")
  if [[ "$EVENT" != "any" ]]; then list_args+=(--event "$EVENT"); fi
  if [[ -n "$BRANCH" ]]; then list_args+=(--branch "$BRANCH"); fi
  if [[ -n "$COMMIT" ]]; then list_args+=(--commit "$COMMIT"); fi
  if [[ -n "$CREATED" ]]; then list_args+=(--created "$CREATED"); fi

  printf 'listing runs: %s %s\n' "$REPO" "$WORKFLOW" >&2
  gh "${list_args[@]}" </dev/null > "$OUT/runs.json"

  jq -n --arg repo "$REPO" --arg workflow "$WORKFLOW" --arg event "$EVENT" \
    --arg branch "$BRANCH" --arg commit "$COMMIT" --arg created "$CREATED" \
    '{repo: $repo, workflow: $workflow, event: $event, branch: $branch,
      commit: $commit, created: $created, fetched_at: (now | todate)}' > "$OUT/meta.json"

  local job_filter='.jobs[] | {run_id, run_attempt, name, conclusion, created_at,
    started_at, completed_at, labels: (.labels // []),
    steps: [(.steps // [])[] | {name, conclusion, started_at, completed_at}]}'
  local total i=0 failed=0 id
  total=$(jq "[.[] | select($RUN_SELECT)] | length" "$OUT/runs.json")
  : > "$OUT/jobs.jsonl"
  : > "$OUT/errors.log"

  while IFS= read -r id; do
    i=$((i + 1))
    printf '\rfetching jobs %d/%d' "$i" "$total" >&2
    if gh api --paginate "repos/$REPO/actions/runs/$id/jobs?per_page=100" \
         </dev/null > "$OUT/.page.json" 2>>"$OUT/errors.log" \
       && jq -c "$job_filter" "$OUT/.page.json" > "$OUT/.jobs.tmp" 2>>"$OUT/errors.log"; then
      cat "$OUT/.jobs.tmp" >> "$OUT/jobs.jsonl"
    else
      failed=$((failed + 1))
    fi
  done < <(jq -r ".[] | select($RUN_SELECT) | .databaseId" "$OUT/runs.json")
  rm -f "$OUT/.page.json" "$OUT/.jobs.tmp"
  if [[ $total -gt 0 ]]; then printf '\n' >&2; fi
  if [[ $failed -gt 0 ]]; then
    printf 'warning: %d of %d job fetches failed; see %s/errors.log\n' "$failed" "$total" "$OUT" >&2
  fi
}

# -------------------------------------------------------------- analyse ----
analyse() {
  [[ -s "$OUT/jobs.jsonl" ]] || die "no job data in $OUT (no matching completed runs?)"
  [[ -f "$OUT/meta.json" ]] || printf '{}\n' > "$OUT/meta.json"

  jq -n -r \
    --slurpfile runs "$OUT/runs.json" \
    --slurpfile jobs "$OUT/jobs.jsonl" \
    --slurpfile meta "$OUT/meta.json" \
    --arg re "$SETUP_RE" \
    --arg re_label "$([[ "$SETUP_RE" == "$DEFAULT_SETUP_RE" ]] && echo default || echo custom)" \
    --argjson incl "$INCLUDE_FAILED" \
    --argjson top "$TOP" '
# GitHub timestamps: "2026-11-04T10:00:00Z", sometimes ".000Z" or "-07:00".
def ts:
  if . == null then null else
    (capture("^(?<d>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(\\.[0-9]+)?(?<z>Z|[+-][0-9]{2}:?[0-9]{2})?$")
      // error("unparseable timestamp: \(.)")) as $m
    | ($m.d + "Z" | fromdateiso8601)
      - (if ($m.z // "Z") == "Z" then 0
         else ($m.z | (if startswith("-") then -1 else 1 end)
                      * ((.[1:3] | tonumber) * 3600 + (.[-2:] | tonumber) * 60)) end)
  end;
def pct(p): sort | if length == 0 then null
                   else .[([((length * p) | ceil) - 1, 0] | max)] end;
def pad2: tostring | if length < 2 then "0" + . else . end;
def dur: if . == null then "-" else round as $s
  | if $s >= 3600 then "\($s / 3600 | floor)h\(($s % 3600) / 60 | floor | pad2)m"
    elif $s >= 60 then "\($s / 60 | floor)m\($s % 60 | pad2)s"
    else "\($s)s" end end;
def pair: "\(pct(0.5) | dur) / \(pct(0.9) | dur)";
def cell: tostring | gsub("\\|"; "\\|");
def mode: if length == 0 then "" else group_by(.) | max_by(length) | .[0] end;

$runs[0] as $all
| ($meta[0] // {}) as $m
| [$all[] | select(.conclusion == "success" or ($incl and .conclusion == "failure"))] as $used
| ($used | map({key: (.databaseId | tostring), value: .}) | from_entries) as $runmap

# One record per job that actually ran.
| [ $jobs[]
    | select(.conclusion != "skipped" and .started_at != null and .completed_at != null)
    | select($runmap[(.run_id | tostring)] != null)
    | (.created_at | ts) as $c | (.started_at | ts) as $s | (.completed_at | ts) as $e
    | [ .steps[]
        | select(.started_at != null and .completed_at != null and .conclusion != "skipped")
        | {name, d: ([(.completed_at | ts) - (.started_at | ts), 0] | max),
           setup: (.name | test($re; "i"))} ] as $steps
    | ([$steps[] | select(.setup | not) | .d] | add // 0) as $run_s
    | { run: (.run_id | tostring), name, created: ($c // $s), done: $e,
        waiting: ([$s - ($c // $s), 0] | max),
        running: ([$run_s, $e - $s] | min),
        setup: ([($e - $s) - $run_s, 0] | max),
        billed: ((([$e - $s, 0] | max) / 60) | ceil),
        runner: (.labels | join(",")),
        steps: $steps } ] as $J

# One record per run.
| [ $J | group_by(.run)[] | . as $js
    | ($js | min_by(.created) | .created) as $t0
    | ($js | max_by(.done)) as $last
    | $runmap[$js[0].run] as $r
    | { run: $js[0].run, t0: $t0, wall: ($last.done - $t0), last: $last.name,
        hold: ([$t0 - ((if ($r.attempt // 1) > 1 then $r.startedAt else $r.createdAt end) | ts), 0] | max),
        billed: ([$js[].billed] | add) } ] as $R
| ($R | map({key: .run, value: .t0}) | from_entries) as $t0map
| ($R | length) as $nr

| [ $J | group_by(.name)[] | . as $g
    | { name: $g[0].name, n: ($g | length),
        q_off: ([$g[] | .created - $t0map[.run]] | pct(0.5)),
        d_off: ([$g[] | .done - $t0map[.run]] | pct(0.5)),
        waiting: [$g[].waiting], setup: [$g[].setup], running: [$g[].running],
        last: (if $nr == 0 then 0 else ([$R[] | select(.last == $g[0].name)] | length) / $nr end),
        runner: ([$g[].runner] | mode) } ]
  | sort_by(-.d_off) as $jobrows

| [ $J[] as $j | $j.steps[] | {job: $j.name, step: .name, d, setup} ]
  | group_by([.job, .step])
  | map({ job: .[0].job, step: .[0].step,
          cls: (if .[0].setup then "setup" else "running" end), n: length,
          p50: ([.[].d] | pct(0.5)), p90: ([.[].d] | pct(0.9)) })
  | sort_by(-.p50) | .[:$top] as $steprows

| ($all | length) as $na
| ([$all[] | select((.attempt // 1) > 1)] | length) as $rerun
| ($all | group_by(.conclusion) | map("\(.[0].conclusion) \(length)") | join(", ")) as $concl
| ([$R[] | $runmap[.run].createdAt] | sort) as $dates

| "## CI timing: \($m.repo // "?") / \($m.workflow // "?")",
  "",
  "- Filter: event=\($m.event // "?")"
    + (if ($m.branch // "") != "" then ", branch=\($m.branch)" else "" end)
    + (if ($m.commit // "") != "" then ", commit=\($m.commit[:12])" else "" end)
    + (if ($m.created // "") != "" then ", created \($m.created)" else "" end)
    + "; fetched \($m.fetched_at // "?")",
  "- Completed runs listed: \($na) (\($concl)); timed: \($nr) "
    + (if $incl then "(success + failure)" else "(success only)" end)
    + (if $nr > 0 then ", \($dates[0][:10]) to \($dates[-1][:10])" else "" end),
  "- Reruns (attempt > 1): \($rerun) of \($na)"
    + (if $na > 0 then " (\(($rerun * 1000 / $na | round) / 10)%)" else "" end),
  "- Setup regex: \($re_label). Percentiles: nearest-rank.",
  "",
  "| Run metric | n | p50 | p90 | max |",
  "|---|---:|---:|---:|---:|",
  "| Wall-clock (first job queued to last job done) | \($nr) | \([$R[].wall] | pct(0.5) | dur) | \([$R[].wall] | pct(0.9) | dur) | \([$R[].wall] | max | dur) |",
  "| Pre-job hold (run created to first job queued) | \($nr) | \([$R[].hold] | pct(0.5) | dur) | \([$R[].hold] | pct(0.9) | dur) | \([$R[].hold] | max | dur) |",
  "| Billable job-minutes per run | \($nr) | \([$R[].billed] | pct(0.5) // "-") | \([$R[].billed] | pct(0.9) // "-") | \([$R[].billed] | max // "-") |",
  "",
  "Jobs, latest-finishing first. Offsets are p50 seconds from the run'"'"'s first job queued.",
  "",
  "| Job | n | Queued at | Done at | Waiting p50 / p90 | Setup p50 / p90 | Running p50 / p90 | Finished last | Runner |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---|",
  ( $jobrows[]
    | "| \(.name | cell) | \(.n) | +\(.q_off | dur) | +\(.d_off | dur) | \(.waiting | pair) | \(.setup | pair) | \(.running | pair) | \((.last * 100) | round)% | \(.runner | cell) |" ),
  "",
  "Slowest steps by p50 (top \($top)).",
  "",
  "| Job | Step | Class | n | p50 | p90 |",
  "|---|---|---|---:|---:|---:|",
  ( $steprows[]
    | "| \(.job | cell) | \(.step | cell) | \(.cls) | \(.n) | \(.p50 | dur) | \(.p90 | dur) |" )
'
}

if [[ -n "$FROM" ]]; then
  [[ -f "$FROM/runs.json" ]] || die "--from DIR must contain runs.json and jobs.jsonl"
  OUT="$FROM"
else
  fetch
fi
analyse
printf 'raw data: %s (re-analyse with --from %s)\n' "$OUT" "$OUT" >&2
