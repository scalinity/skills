"""Meaningful storage/scoring checks; every write uses a disposable bundle."""
import copy
from concurrent.futures import ProcessPoolExecutor
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("np_evaluate", Path(__file__).with_name("evaluate.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
BUNDLE = Path(__file__).resolve().parents[1]


def concurrent_append(args):
    root, record = args
    return MODULE.append(record, Path(root))["status"]


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "references").mkdir()
        shutil.copy2(BUNDLE / "references/rubric.json", self.root / "references/rubric.json")
        # Source tests must run without publishing or reading private session history.
        weights = {"native_collaboration":9, "isolation_recovery":9, "delivery_lifecycle":4,
                   "agent_efficiency":4, "productivity":6, "workflow_fit":7}
        self.record = dict(schema_version=1, rubric_version="1.0", evaluation_id="fixture-evaluation",
                           session_key="fixture-session", evaluated_on="2026-10-30",
                           recorded_at="2026-10-30T18:00:00-04:00", use_case="Synthetic storage fixture",
                           provenance="test_fixture",
                           observations=[dict(id="o1", kind="native_result", claim="Synthetic native result", reference="fixture only")],
                           scores={key:dict(score=value,evidence=["o1"],rationale="Fixed-weight fixture") for key,value in weights.items()},
                           failures=[dict(id="f1",description="Synthetic unresolved failure",attribution="agent",resolved=False,evidence=["o1"])],
                           metrics={}, limitations=["Synthetic fixture; never append to real history"], issue_urls=[])

    def tearDown(self):
        self.temp.cleanup()

    def test_historical_weights_reproduce_original_score(self):
        self.assertEqual(MODULE.validate(self.record, self.root), {"coverage_percent": 100, "weighted_observed_points": 64.5, "overall_score": 64.5})

    def test_missing_observation_keeps_overall_not_evaluated(self):
        self.record["scores"]["delivery_lifecycle"].update(score=None, evidence=[], rationale="Not observed")
        result = MODULE.validate(self.record, self.root)
        self.assertEqual(result["coverage_percent"], 80)
        self.assertIsNone(result["overall_score"])

    def test_unsupported_scores_and_invented_evidence_are_rejected(self):
        for bad in (True, float("nan"), float("inf"), -1, 11):
            with self.subTest(bad=bad):
                r = copy.deepcopy(self.record); r["scores"]["native_collaboration"]["score"] = bad
                with self.assertRaises(ValueError): MODULE.validate(r, self.root)
        self.record["scores"]["native_collaboration"]["evidence"] = ["missing"]
        with self.assertRaises(ValueError): MODULE.validate(self.record, self.root)

    def test_perfect_score_requires_native_evidence_and_resolution(self):
        for row in self.record["scores"].values(): row["score"] = 10
        with self.assertRaises(ValueError): MODULE.validate(self.record, self.root)
        self.record["failures"] = []
        self.assertEqual(MODULE.validate(self.record, self.root)["overall_score"], 100)
        self.record["scores"]["native_collaboration"]["score"] = 9.9999
        with self.assertRaises(ValueError): MODULE.validate(self.record, self.root)
        self.record["scores"]["native_collaboration"]["score"] = 10
        for observation in self.record["observations"]: observation["kind"] = "source_test"
        with self.assertRaises(ValueError): MODULE.validate(self.record, self.root)

    def test_idempotence_and_immutable_history(self):
        self.assertEqual(MODULE.append(self.record, self.root)["status"], "APPENDED")
        target = self.root / "history/evaluations" / (self.record["evaluation_id"] + ".json")
        original = target.read_bytes()
        self.assertEqual(MODULE.append(self.record, self.root)["status"], "ALREADY_RECORDED")
        self.record["scores"]["native_collaboration"]["score"] = 8
        with self.assertRaises(ValueError): MODULE.append(self.record, self.root)
        self.assertEqual(target.read_bytes(), original)

    def test_revisions_do_not_double_count_one_session(self):
        MODULE.append(self.record, self.root)
        revised = copy.deepcopy(self.record)
        revised.update(evaluation_id=self.record["evaluation_id"] + "-r2", recorded_at="2026-10-31T18:00:00-04:00")
        revised["scores"]["native_collaboration"]["score"] = 8
        MODULE.append(revised, self.root)
        summary = MODULE.read_json(self.root / "history/summary.json")
        self.assertEqual((summary["record_count"], summary["session_count"]), (2, 1))
        self.assertEqual(summary["mean_complete_score"], 62.5)
        self.assertEqual(summary["criteria"]["native_collaboration"]["samples"], 1)

    def test_concurrent_harnesses_keep_every_record_and_summary(self):
        records = []
        for n in range(4):
            r = copy.deepcopy(self.record)
            r.update(evaluation_id=f"parallel-session-{n}", session_key=f"parallel-{n}")
            records.append((str(self.root), r))
        with ProcessPoolExecutor(max_workers=4) as executor:
            self.assertEqual(list(executor.map(concurrent_append, records)), ["APPENDED"] * 4)
        summary = MODULE.read_json(self.root / "history/summary.json")
        self.assertEqual((summary["record_count"], summary["session_count"]), (4, 4))

    def test_corruption_is_reported_and_reports_can_be_rebuilt(self):
        MODULE.append(self.record, self.root)
        (self.root / "history/summary.md").unlink()
        with MODULE.locked(self.root): MODULE.rebuild(self.root)
        self.assertTrue((self.root / "history/summary.md").is_file())
        bad = self.root / "history/evaluations/broken.json"; bad.write_text("{bad")
        with self.assertRaises(json.JSONDecodeError): MODULE.rebuild(self.root)

    def test_partial_correction_intentionally_removes_unsupported_complete_score(self):
        MODULE.append(self.record, self.root)
        r = copy.deepcopy(self.record)
        r.update(evaluation_id=self.record["evaluation_id"] + "-r2", recorded_at="2026-10-31T18:00:00-04:00")
        r["scores"]["native_collaboration"].update(score=None, evidence=[], rationale="Prior observation was unsupported")
        MODULE.append(r, self.root)
        summary = MODULE.read_json(self.root / "history/summary.json")
        self.assertEqual((summary["record_count"], summary["session_count"], summary["complete_session_count"]), (2, 1, 0))
        self.assertEqual(summary["partial_session_count"], 1)
        self.assertIsNone(summary["mean_complete_score"])

    def test_older_revision_is_rejected_instead_of_silently_losing(self):
        MODULE.append(self.record, self.root)
        r = copy.deepcopy(self.record)
        r["evaluation_id"] += "-r2"
        with self.assertRaisesRegex(ValueError, "later recorded_at"): MODULE.append(r, self.root)
        self.assertEqual(len(list((self.root / "history/evaluations").glob("*.json"))), 1)

    def test_invalid_existing_store_does_not_publish_another_record(self):
        p = self.root / "history/evaluations";p.mkdir(parents=True)
        (p / "broken.json").write_text("{bad")
        with self.assertRaises(json.JSONDecodeError): MODULE.append(self.record, self.root)
        self.assertEqual([x.name for x in p.glob("*.json")], ["broken.json"])

    def test_cli_invalid_record_has_a_compact_error(self):
        p = self.root / "bad.json";p.write_text('{"schema_version":1,"rubric_version":"1.0","evaluation_id":12}')
        result = subprocess.run([sys.executable, str(BUNDLE / "scripts/evaluate.py"), "validate", str(p)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("Invalid evaluation:", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
