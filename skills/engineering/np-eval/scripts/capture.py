"""Opt-in cost notes for noninteractive commands; never submits or retries on its own."""
import argparse
import fcntl
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

PHASES = {"preparation", "dispatch", "collection", "integration", "wait"}
KINDS = {"command", "worker", "effort", "intervention"}
IDS = {"request_id", "client_request_id", "group_id", "task_id", "worker_id",
       "native_session_id", "incarnation_id", "phase"}


def encode(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False) + "\n"


def read(path):
    rows = [json.loads(line) for line in Path(path).read_text(encoding="utf-8").split("\n") if line]
    if not rows or rows[0].get("schema_version") != 1 or rows[0].get("kind") != "start":
        raise ValueError("Not a capture ledger")
    return rows


def start(path, session, scope, exclusions, clock=time):
    row = {"schema_version": 1, "kind": "start", "session_id": session,
           "scope": scope, "exclusions": exclusions, "wall_start": clock.time()}
    with Path(path).open("x", encoding="utf-8") as stream:
        os.chmod(path, 0o600)
        stream.write(encode(row))


def number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def record(path, event):
    if event.get("kind") not in KINDS or event.get("phase") not in PHASES:
        raise ValueError("Use a documented event kind and phase")
    if not isinstance(event.get("source"), str) or not event["source"].strip():
        raise ValueError("Every event needs its exact source/coverage reference")
    for key in ("offset_seconds", "duration_seconds", "stdout_bytes", "stderr_bytes", "native_rounds"):
        if event.get(key) is not None and not number(event[key]):
            raise ValueError("Invalid nonnegative measurement: " + key)
    if event.get("duration_seconds") is not None and event.get("offset_seconds") is None:
        raise ValueError("A measured interval needs its start offset")
    if event["kind"] == "worker" and not event.get("task_id"):
        raise ValueError("Worker measurements need the exact task ID; keep phases/attempts separate")
    if event["kind"] == "command" and any(not number(event.get(k)) for k in ("stdout_bytes", "stderr_bytes")):
        raise ValueError("Command measurements need observed stdout/stderr bytes")
    encode(event)
    with Path(path).open("r+", encoding="utf-8") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        rows = read(path)
        if event["kind"] == "worker":
            identity = ("task_id", "phase_id", "attempt_index")
            prior = [r for r in rows[1:] if r.get("kind") == "worker" and
                     all(r.get(key) == event.get(key) for key in identity)]
            if prior:
                if prior == [event]:
                    return  # Re-reading the same result does not add worker cost again.
                raise ValueError("Conflicting worker measurement; retain the exact original source")
        stream.seek(0, 2)
        stream.write(encode(event))
        stream.flush()


def identifiers(value):
    result = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in IDS and isinstance(item, (str, int)):
                result.append({key: item})
            elif isinstance(item, (dict, list)):
                result.extend(identifiers(item))
    elif isinstance(value, list):
        for item in value:
            result.extend(identifiers(item))
    return result


def run(path, phase, command, excluded=False, clock=time):
    meta = read(path)[0]  # Refuse a missing/broken ledger before executing anything.
    if phase not in PHASES:
        raise ValueError("Unknown phase")
    begin = clock.monotonic()
    event = {"kind": "command", "phase": phase, "source": "CLI subprocess stdout/stderr bytes",
             "transport": "cli", "argv": command, "cwd": os.getcwd(), "excluded": excluded,
             "offset_seconds": clock.time() - meta["wall_start"]}
    try:
        result = subprocess.run(command, capture_output=True)
        stdout, stderr, code = result.stdout, result.stderr, result.returncode
    except OSError as error:
        stdout, stderr, code = b"", (str(error) + "\n").encode(), 127
        event["launch_error"] = type(error).__name__
    event.update(duration_seconds=clock.monotonic() - begin, exit_code=code,
                 stdout_bytes=len(stdout), stderr_bytes=len(stderr))
    try:
        event["ids"] = identifiers(json.loads(stdout))
    except (ValueError, UnicodeError):
        event["ids"] = []
    try:
        record(path, event)
    except (OSError, ValueError) as error:
        # Execution already happened. Preserve its exit/result; never suggest replay.
        print("Capture failed after command execution; retain this result: " + str(error), file=sys.stderr)
    sys.stdout.buffer.write(stdout)
    sys.stdout.buffer.flush()
    sys.stderr.buffer.write(stderr)
    sys.stderr.buffer.flush()
    return code


def intervals(rows):
    return [(r["offset_seconds"], r["offset_seconds"] + r["duration_seconds"])
            for r in rows if r.get("duration_seconds") is not None]


def union_seconds(spans):
    end, total = 0, 0
    for begin, stop in sorted(spans):
        total += max(0, stop - max(begin, end))
        end = max(end, stop)
    return total


def summary(path, clock=time):
    rows = read(path)
    meta, events = rows[0], rows[1:]
    for event in events:
        if event.get("kind") not in KINDS:
            raise ValueError("Unknown event kind")
    included = [r for r in events if not r.get("excluded")]
    commands = [r for r in included if r["kind"] == "command"]
    active = [r for r in commands if r["phase"] != "wait"]
    waits = [r for r in commands if r["phase"] == "wait"]
    workers = [r for r in included if r["kind"] == "worker"]
    effort = [r for r in included if r["kind"] == "effort"]
    return {
        "schema_version": 1, "session_id": meta["session_id"], "scope": meta["scope"],
        "metrics": {"setup_tool_calls": sum(r["phase"] == "preparation" for r in commands),
                    "result_bytes": sum(r["stdout_bytes"] + r["stderr_bytes"] for r in commands),
                    "orchestration_seconds": union_seconds(intervals(active)),
                    "native_rounds": sum(r["native_rounds"] for r in workers) if workers and all(r.get("native_rounds") is not None for r in workers) else None},
        "measurements": {"observation_window_seconds": clock.time() - meta["wall_start"],
                         "command_calls": len(commands),
                         "command_interval_union_seconds": union_seconds(intervals(commands)),
                         "wait_interval_union_seconds": union_seconds(intervals(waits)),
                         "worker_duration_sum_seconds": sum(r["duration_seconds"] for r in workers) if workers and all(r.get("duration_seconds") is not None for r in workers) else None,
                         "worker_interval_union_seconds": union_seconds(intervals(workers)) if workers and all(r.get("duration_seconds") is not None for r in workers) else None,
                         "observed_parent_effort_seconds": union_seconds(intervals(effort)) if effort else None,
                         "interventions": sum(r["kind"] == "intervention" for r in included),
                         "excluded_events": len(events) - len(included)},
        "events": events,
        "limitations": meta["exclusions"] + [
            "Only opt-in events are covered. Unobserved parent effort/thinking, billing, tokens, transport framing and net time saved are unknown.",
            "orchestration_seconds is the union of recorded non-wait CLI command intervals, not total parent effort. Wait and worker intervals may overlap; do not add these totals.",
            "Event offsets/window use the host wall clock across processes; command durations use monotonic time. Wall-clock adjustments can affect interval placement.",
            "CLI byte counts cover stdout plus stderr, not MCP or wire bytes. Explicit MCP events need their own source and coverage; no MCP success is inferred.",
            "Commands run once, without a shell, in the inherited environment and caller directory. Output is buffered; use only noninteractive commands. No transcript or provider-home ingestion."]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("start"); p.add_argument("ledger"); p.add_argument("--session", required=True)
    p.add_argument("--scope", required=True); p.add_argument("--exclude", action="append", default=[])
    p = sub.add_parser("run"); p.add_argument("ledger"); p.add_argument("--phase", choices=sorted(PHASES), required=True)
    p.add_argument("--excluded", action="store_true"); p.add_argument("argv", nargs=argparse.REMAINDER)
    p = sub.add_parser("record"); p.add_argument("ledger"); p.add_argument("event", type=Path)
    p = sub.add_parser("summary"); p.add_argument("ledger")
    args = parser.parse_args()
    if args.action == "start":
        start(args.ledger, args.session, args.scope, args.exclude)
    elif args.action == "run":
        command = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
        if not command: parser.error("Supply a noninteractive command after --")
        # A signal return remains a signal to the invoking shell.
        code = run(args.ledger, args.phase, command, args.excluded)
        if code < 0:
            import signal
            signal.signal(-code, signal.SIG_DFL)
            os.kill(os.getpid(), -code)
        return code
    elif args.action == "record":
        record(args.ledger, json.loads(args.event.read_text()))
    else:
        print(json.dumps(summary(args.ledger), indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError) as error:
        print("Invalid capture: " + str(error), file=sys.stderr)
        sys.exit(2)
