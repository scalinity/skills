"""Cost coverage, overlap and command transparency using disposable records only."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("capture.py")
SPEC = importlib.util.spec_from_file_location("capture", SCRIPT)
CAPTURE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CAPTURE)


class Clock:
    def __init__(self): self.now = 100
    def monotonic(self): return self.now
    def time(self): return 1700000000 + self.now


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "cost.jsonl"
        self.clock = Clock()
        CAPTURE.start(self.path, "native-parent", "useful review", ["pre-start work unknown"], self.clock)

    def tearDown(self): self.temp.cleanup()

    def event(self, kind, phase, offset, duration, **extra):
        e = dict(kind=kind, phase=phase, offset_seconds=offset, duration_seconds=duration, source="fixture")
        e.update(extra)
        CAPTURE.record(self.path, e)
        return e

    def test_failed_setup_repeated_reads_interventions_and_concurrency(self):
        for phase, offset, duration, exit_code in [("preparation", 0, 2, 127), ("preparation", 2, 3, 2), ("dispatch", 5, 1, 0), ("wait", 6, 10, 0), ("collection", 16, 2, 0), ("collection", 18, 1, 0), ("integration", 19, 3, 0)]:
            self.event("command", phase, offset, duration, stdout_bytes=10, stderr_bytes=2, exit_code=exit_code)
        worker = self.event("worker", "dispatch", 6, 10, task_id="task-a", group_id="group", phase_id=1, native_rounds=4)
        CAPTURE.record(self.path, worker)
        self.event("worker", "dispatch", 8, 5, task_id="task-b", native_rounds=3)
        for reason in ["fix selection", "repeat read"]:
            self.event("intervention", "preparation", 0, None, description=reason, attribution="agent")
        self.event("command", "integration", 22, 50, stdout_bytes=1000, stderr_bytes=0, excluded=True)
        self.clock.now = 180
        s = CAPTURE.summary(self.path, self.clock)
        self.assertEqual(s["metrics"], dict(setup_tool_calls=2, result_bytes=84, orchestration_seconds=12, native_rounds=7))
        self.assertEqual(s["measurements"]["worker_duration_sum_seconds"], 15)
        self.assertEqual(s["measurements"]["worker_interval_union_seconds"], 10)
        self.assertEqual(s["measurements"]["wait_interval_union_seconds"], 10)
        self.assertEqual(s["measurements"]["observation_window_seconds"], 80)
        self.assertIsNone(s["measurements"]["observed_parent_effort_seconds"])
        self.assertEqual(s["measurements"]["interventions"], 2)
        self.assertEqual(s["measurements"]["excluded_events"], 1)

    def test_missing_worker_values_and_mcp_coverage_stay_explicit(self):
        self.event("worker", "dispatch", 1, None, task_id="task", native_rounds=None)
        self.event("intervention", "collection", 2, None, transport="mcp", description="MCP byte coverage unobserved")
        s = CAPTURE.summary(self.path, self.clock)
        self.assertIsNone(s["metrics"]["native_rounds"])
        self.assertIsNone(s["measurements"]["worker_interval_union_seconds"])
        self.assertEqual(s["metrics"]["result_bytes"], 0)
        self.assertTrue(any("no MCP success" in x for x in s["limitations"]))

    def test_validation_and_conflicting_measurements(self):
        for value in [float("nan"), float("inf"), -1, True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.event("effort", "integration", 0, value)
        w = self.event("worker", "dispatch", 1, 2, task_id="exact")
        with self.assertRaises(ValueError): CAPTURE.record(self.path, dict(w, duration_seconds=3))
        with self.assertRaises(FileExistsError): CAPTURE.start(self.path, "x", "x", [])

    def test_unicode_line_separators_preserve_jsonl_records(self):
        text = "pasted\u2028argument\u2029with\x85separators"
        self.event("intervention", "preparation", 0, None, description=text, argv=[text])
        self.assertEqual(CAPTURE.read(self.path)[-1]["description"], text)
        self.assertEqual(CAPTURE.summary(self.path, self.clock)["events"][-1]["argv"], [text])

    def test_wrapper_preserves_arguments_environment_cwd_bytes_exit_and_ids(self):
        self.path.unlink(); CAPTURE.start(self.path, "native-parent", "subprocess", [])
        script = "import json,os,sys; print(json.dumps(dict(argv=sys.argv[1:],cwd=os.getcwd(),binding=os.environ.get('NPEER_BINDING'),client_request_id='request-exact',data=dict(task_id='task-exact')))); sys.stderr.buffer.write(b'error\\x00'); sys.exit(7)"
        cmd = [sys.executable, "-c", script, "literal $() `quoted`", "--compact", "--json"]
        env = dict(os.environ, NPEER_BINDING="fixture-native-binding")
        direct = subprocess.run(cmd, env=env, cwd=self.temp.name, capture_output=True)
        wrapped = subprocess.run([sys.executable, str(SCRIPT), "run", "--phase", "preparation", str(self.path), "--", *cmd], env=env, cwd=self.temp.name, capture_output=True)
        self.assertEqual((wrapped.returncode, wrapped.stdout, wrapped.stderr), (direct.returncode, direct.stdout, direct.stderr))
        event = CAPTURE.read(self.path)[-1]
        self.assertEqual(event["argv"], cmd)
        self.assertEqual(event["ids"], [{"client_request_id":"request-exact"}, {"task_id":"task-exact"}])
        self.assertEqual(event["stdout_bytes"] + event["stderr_bytes"], len(direct.stdout) + len(direct.stderr))

    def test_missing_command_is_recorded_and_bad_ledger_executes_nothing(self):
        self.path.unlink(); CAPTURE.start(self.path, "native-parent", "subprocess", [])
        wrapped = subprocess.run([sys.executable, str(SCRIPT), "run", "--phase", "preparation", str(self.path), "--", "/absent/capture-command"], capture_output=True)
        self.assertEqual(wrapped.returncode, 127)
        self.assertEqual(CAPTURE.read(self.path)[-1]["launch_error"], "FileNotFoundError")
        sentinel = Path(self.temp.name) / "sentinel"
        bad = subprocess.run([sys.executable, str(SCRIPT), "run", "--phase", "dispatch", str(self.path) + ".missing", "--", sys.executable, "-c", f"open({str(sentinel)!r},'w').write('bad')"], capture_output=True)
        self.assertEqual(bad.returncode, 2)
        self.assertFalse(sentinel.exists())

    def test_recording_failure_after_execution_does_not_mask_or_retry(self):
        with patch.object(CAPTURE, "record", side_effect=OSError("disk full")), patch.object(CAPTURE.subprocess, "run", return_value=subprocess.CompletedProcess([], 6, b"", b"")) as execute:
            self.assertEqual(CAPTURE.run(self.path, "dispatch", ["fixture"], clock=self.clock), 6)
            execute.assert_called_once()


if __name__ == "__main__": unittest.main()
