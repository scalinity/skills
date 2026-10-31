#!/usr/bin/env python3
"""Validate and append NativePeers session evaluations; rebuild shared reports."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime
import fcntl
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"session_observation", "native_result", "source_test", "source_inspection", "historical_assessment"}


def read_json(path):
    def invalid(value):
        raise ValueError("Non-finite JSON value: " + value)
    return json.loads(Path(path).read_text(), parse_constant=invalid)


def encoded(value):
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False) + "\n"


def validate(record, root=ROOT):
    rubric = read_json(root / "references/rubric.json")
    if record.get("schema_version") != 1 or record.get("rubric_version") != rubric["version"]:
        raise ValueError("Unsupported record or rubric version")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,127}", record.get("evaluation_id", "")):
        raise ValueError("Use a stable lowercase evaluation ID without path separators")
    for key in ("session_key", "use_case", "provenance"):
        if not isinstance(record.get(key), str) or not record[key].strip():
            raise ValueError("Missing " + key)
    date.fromisoformat(record["evaluated_on"])
    stamp = datetime.fromisoformat(record["recorded_at"])
    if stamp.tzinfo is None or stamp.utcoffset() != stamp.astimezone(ZoneInfo("America/New_York")).utcoffset():
        raise ValueError("recorded_at must have the applicable US Eastern offset")
    observations = record.get("observations", [])
    refs = set()
    for item in observations:
        if not item.get("id") or item["id"] in refs or item.get("kind") not in KINDS:
            raise ValueError("Invalid or duplicate observation")
        if not item.get("claim") or not item.get("reference"):
            raise ValueError("Each observation needs a claim and evidence reference")
        refs.add(item["id"])
    criteria = rubric["criteria"]
    if set(record.get("scores", {})) != {c["id"] for c in criteria}:
        raise ValueError("Scores must include every fixed rubric criterion")
    coverage, points = 0, 0
    for criterion in criteria:
        item = record["scores"][criterion["id"]]
        score = item.get("score")
        if not isinstance(item.get("rationale"), str) or not item["rationale"].strip():
            raise ValueError("Each score needs a rationale, including NOT_EVALUATED")
        evidence = item.get("evidence", [])
        if not isinstance(evidence, list) or not set(evidence).issubset(refs):
            raise ValueError("Score references an unknown observation")
        if score is None:
            continue
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 10:
            raise ValueError("Scores must be finite numbers from 0 to 10, or null")
        if not evidence:
            raise ValueError("A scored criterion needs observed evidence")
        coverage += criterion["weight"]
        points += criterion["weight"] * score / 10
    failures = record.get("failures")
    if not isinstance(failures, list):
        raise ValueError("failures must be a list, including when empty")
    for failure in failures:
        if not failure.get("id") or not failure.get("description") or failure.get("attribution") not in {"tool", "agent", "provider", "external"}:
            raise ValueError("Each failure needs identity, description and attribution")
        if type(failure.get("resolved")) is not bool or not failure.get("evidence") or not set(failure["evidence"]).issubset(refs):
            raise ValueError("Each failure needs resolution state and observed evidence")
    for key, value in record.get("metrics", {}).items():
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
            raise ValueError("Metric must be a nonnegative measured number or null: " + key)
    if not isinstance(record.get("limitations"), list) or not isinstance(record.get("issue_urls"), list):
        raise ValueError("limitations and issue_urls must be lists")
    total = round(points, 2) if coverage == 100 else None
    if total == 100 and (any(row["score"] != 10 for row in record["scores"].values()) or any(not f["resolved"] for f in failures) or not any(o["kind"] == "native_result" for o in observations)):
        raise ValueError("100 requires every criterion at 10, native-result evidence and no unresolved failures")
    encoded(record)
    return {"coverage_percent": coverage, "weighted_observed_points": round(points, 2), "overall_score": total}


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, suffix=".tmp", delete=False) as stream:
        temp = Path(stream.name)
        stream.write(text)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


@contextmanager
def locked(root):
    history = root / "history"
    history.mkdir(parents=True, exist_ok=True)
    with (history / ".lock").open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def report(record, result, rubric):
    score = "NOT_EVALUATED" if result["overall_score"] is None else f'{result["overall_score"]:g}/100'
    rows = [f'# {record["evaluation_id"]}', "", f'**Score: {score}. Coverage: {result["coverage_percent"]}%.**', "",
            record["use_case"], "", "| Criterion | Weight | Score /10 | Rationale |", "|---|---:|---:|---|"]
    for c in rubric["criteria"]:
        item = record["scores"][c["id"]]
        rows.append(f'| {c["name"]} | {c["weight"]}% | {item["score"] if item["score"] is not None else "NOT_EVALUATED"} | {item["rationale"].replace(chr(10), " ").replace("|", "/")} |')
    rows += ["", "Observations:", ""]
    rows += [f'- {o["id"]} ({o["kind"]}): {o["claim"]} Reference: {o["reference"]}' for o in record["observations"]]
    rows += ["", "Recorded failures:", ""]
    rows += [f'- {f["attribution"]}: {f["description"]} Resolved in session: {f["resolved"]}.' for f in record["failures"]] or ["- None recorded; this does not certify unobserved behavior."]
    rows += ["", "Limits:", ""] + [f'- {x}' for x in record["limitations"]]
    rows += ["", "Measured costs (unknown values are not estimated):", ""]
    rows += [f'- {key}: {value if value is not None else "UNKNOWN"}' for key, value in record.get("metrics", {}).items()]
    rows += ["", "Issue references (recorded snapshot, not live status):", ""] + [f'- {x}' for x in record["issue_urls"]]
    return "\n".join(rows) + "\n"


def load_records(root):
    records = []
    for path in sorted((root / "history/evaluations").glob("*.json")):
        record = read_json(path)
        if path.stem != record["evaluation_id"]:
            raise ValueError("Record filename does not match its immutable ID")
        result = validate(record, root)
        records.append((record, result))
    records.sort(key=lambda pair: (datetime.fromisoformat(pair[0]["recorded_at"]), pair[0]["evaluation_id"]))
    return records


def rebuild(root):
    rubric = read_json(root / "references/rubric.json")
    records = load_records(root)
    for record, result in records:
        atomic_write(root / "history/reports" / (record["evaluation_id"] + ".md"), report(record, result, rubric))
    latest = {}
    for pair in records:
        latest[pair[0]["session_key"]] = pair
    selected = list(latest.values())
    complete = [result["overall_score"] for _, result in selected if result["overall_score"] is not None]
    categories = {}
    for c in rubric["criteria"]:
        values = [r["scores"][c["id"]]["score"] for r, _ in selected if r["scores"][c["id"]]["score"] is not None]
        categories[c["id"]] = {"samples": len(values), "mean": round(sum(values) / len(values), 2) if values else None}
    summary = {"rubric_version": rubric["version"], "record_count": len(records), "session_count": len(selected),
               "complete_session_count": len(complete), "mean_complete_score": round(sum(complete) / len(complete), 2) if complete else None,
               "unscored_session_count": sum(result["coverage_percent"] == 0 for _, result in selected),
               "partial_session_count": sum(0 < result["coverage_percent"] < 100 for _, result in selected),
               "criteria": categories, "latest_evaluation_id": records[-1][0]["evaluation_id"] if records else None,
               "scope": "Observational session scores; latest revision per session; not a controlled benchmark"}
    atomic_write(root / "history/summary.json", encoded(summary))
    rows = ["# NativePeers evaluation history", "", summary["scope"] + ".", "",
            f'Records: {len(records)}. Sessions: {len(selected)}. Complete evaluations: {len(complete)}.',
            f'Mean complete-session score: {str(summary["mean_complete_score"]) + "/100" if complete else "NOT_EVALUATED"}.',
            f'Partial sessions: {summary["partial_session_count"]}. Unscored sessions: {summary["unscored_session_count"]}.', "",
            "| Criterion | Weight | Observed session count | Mean /10 |", "|---|---:|---:|---:|"]
    for c in rubric["criteria"]:
        v = categories[c["id"]]
        rows.append(f'| {c["name"]} | {c["weight"]}% | {v["samples"]} | {v["mean"] if v["mean"] is not None else "NOT_EVALUATED"} |')
    rows += ["", "| Evaluation | Coverage | Overall /100 | Revision |", "|---|---:|---:|---|"]
    for record, result in records:
        current = latest[record["session_key"]][0]["evaluation_id"] == record["evaluation_id"]
        rows.append(f'| [{record["evaluation_id"]}](reports/{record["evaluation_id"]}.md) | {result["coverage_percent"]}% | {result["overall_score"] if result["overall_score"] is not None else "NOT_EVALUATED"} | {"latest" if current else "historical"} |')
    atomic_write(root / "history/summary.md", "\n".join(rows) + "\n")
    return summary


def append(record, root=ROOT):
    result = validate(record, root)
    with locked(root):
        existing = load_records(root)
        target = root / "history/evaluations" / (record["evaluation_id"] + ".json")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if read_json(target) != record:
                raise ValueError("Immutable evaluation ID already exists with different content; use a new revision ID")
            disposition = "ALREADY_RECORDED"
        else:
            prior = [r for r, _ in existing if r["session_key"] == record["session_key"]]
            if prior and datetime.fromisoformat(record["recorded_at"]) <= max(datetime.fromisoformat(r["recorded_at"]) for r in prior):
                raise ValueError("A new revision must have a later recorded_at than the existing session records")
            # Publish complete bytes exclusively; a crash cannot leave half a JSON record.
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, suffix=".tmp", delete=False) as stream:
                temp = Path(stream.name)
                stream.write(encoded(record)); stream.flush(); os.fsync(stream.fileno())
            try:
                os.link(temp, target)
            finally:
                temp.unlink(missing_ok=True)
            disposition = "APPENDED"
        rebuild(root)
    return {"status": disposition, **result, "record": str(target), "report": str(root / "history/reports" / (record["evaluation_id"] + ".md"))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "append"):
        commands.add_parser(command).add_argument("record", type=Path)
    commands.add_parser("aggregate")
    args = parser.parse_args()
    if args.command == "validate":
        result = validate(read_json(args.record))
    elif args.command == "append":
        result = append(read_json(args.record))
    else:
        with locked(ROOT):
            result = rebuild(ROOT)
    print(encoded(result), end="")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        print("Invalid evaluation: " + str(error), file=sys.stderr)
        raise SystemExit(2)
