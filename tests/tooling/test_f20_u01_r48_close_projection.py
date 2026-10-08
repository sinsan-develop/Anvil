"""R48 close revokes the scoped ACK writer without accepting F-20/U-01."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts import check_project_progress as checker

from scripts.check_project_progress import raw_event_object_prefix_bytes


ROOT = Path(__file__).resolve().parents[2]
HISTORICAL_HEAD = "718e2da8326e985bc29b0b292eaf8ad842eba8eb"


class R48CloseProjectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._isolated = TemporaryDirectory(prefix=".r48-history-", dir=ROOT)
        cls.historical_root = Path(cls._isolated.name) / "repo"
        try:
            root = Path(cls._isolated.name).resolve()
            if root.parent != ROOT.resolve() or not root.name.startswith(".r48-history-"):
                raise AssertionError("R48_HISTORY_TEMP_TARGET_INVALID")
            clone = subprocess.run(["git", "clone", "--shared", "--no-checkout", "--quiet",
                str(ROOT), str(cls.historical_root)], capture_output=True, check=False)
            if clone.returncode != 0:
                raise AssertionError("R48_HISTORY_CLONE_FAILED")
            checkout = subprocess.run(["git", "-C", str(cls.historical_root), "checkout", "--quiet",
                "--detach", HISTORICAL_HEAD], capture_output=True, check=False)
            if checkout.returncode != 0:
                raise AssertionError("R48_HISTORY_CHECKOUT_FAILED")
            head = subprocess.check_output(["git", "-C", str(cls.historical_root),
                "rev-parse", "HEAD"], text=True).strip()
            status = subprocess.check_output(["git", "-C", str(cls.historical_root),
                "status", "--porcelain"], text=True).strip()
            if head != HISTORICAL_HEAD or status:
                raise AssertionError("R48_HISTORY_IDENTITY_INVALID")
        except BaseException:
            cls._isolated.cleanup()
            raise

    @classmethod
    def tearDownClass(cls):
        temporary = Path(cls._isolated.name).resolve()
        if temporary.parent != ROOT.resolve() or not temporary.name.startswith(".r48-history-"):
            raise AssertionError("R48_HISTORY_TEMP_TARGET_INVALID")
        try:
            status = subprocess.check_output(["git", "-C", str(cls.historical_root),
                "status", "--porcelain"], text=True).strip()
            if status:
                raise AssertionError("R48_HISTORY_FIXTURE_DIRTY")
        finally:
            cls._isolated.cleanup()
            if temporary.exists():
                raise AssertionError("R48_HISTORY_TEMP_RESIDUAL")

    def test_historical_fixture_cleanup_even_if_status_is_dirty_or_fails(self):
        for scenario in ("dirty", "query_error"):
            with self.subTest(scenario=scenario):
                isolated = TemporaryDirectory(prefix=".r48-history-", dir=ROOT)
                temporary = Path(isolated.name)
                fixture = type("R48CleanupProbe", (R48CloseProjectionTests,), {})
                fixture._isolated = isolated
                fixture.historical_root = temporary / "repo"
                try:
                    if scenario == "dirty":
                        query = patch.object(subprocess, "check_output", return_value=" M tracked.py\n")
                        expected = AssertionError
                    else:
                        query = patch.object(subprocess, "check_output", side_effect=
                            subprocess.CalledProcessError(1, "git status"))
                        expected = subprocess.CalledProcessError
                    with query, self.assertRaises(expected):
                        fixture.tearDownClass()
                    self.assertFalse(temporary.exists())
                finally:
                    isolated.cleanup()

    @staticmethod
    def historical_close_time(overlay, historical_root):
        progress = json.loads(overlay._frozen(historical_root, overlay.PROGRESS))
        worker = progress["worker_lease"]
        issued = datetime.fromisoformat(worker["issued_at"])
        expires = datetime.fromisoformat(worker["expires_at"])
        return issued + (expires - issued) / 2

    def test_ordered_revocation_and_unaccepted_state(self):
        from scripts import f20_u01_r48_close_overlay as overlay

        output = overlay.project(self.historical_root,
            self.historical_close_time(overlay, self.historical_root))
        old = subprocess.check_output(
            ["git", "-c", "core.excludesFile=", "show", f"{overlay.BASE}:{overlay.EVENTS}"],
            cwd=self.historical_root)
        events = json.loads(output[overlay.EVENTS])
        progress = json.loads(output[overlay.PROGRESS])
        self.assertEqual(raw_event_object_prefix_bytes(output[overlay.EVENTS], overlay.START),
                         raw_event_object_prefix_bytes(old, overlay.START))
        self.assertEqual(events["last_sequence"], overlay.END)
        self.assertEqual([row["event_type"] for row in events["events"][overlay.START:]],
                         list(overlay.KINDS))
        self.assertIsNone(progress["write_lease"])
        self.assertIsNone(progress["worker_lease"])
        self.assertEqual(progress["completed_f20_u01_r48_worker_lease"]["status"], "REVOKED")
        self.assertEqual(progress["completed_f20_u01_r48_write_lease"]["status"], "REVOKED")
        self.assertEqual(progress["repository"]["product_write_scope"], [])
        self.assertEqual(progress["repository"]["local_wsl_qa_head"], overlay.QA_HEAD)
        self.assertNotIn("F-20", progress["completed_packages"])
        self.assertEqual(progress["scope_revision_binding"]["release_decision"], "DEFER")

    def test_authority_checker_and_manifest(self):
        from scripts import f20_u01_r48_close_overlay as overlay

        output = overlay.project(self.historical_root,
            self.historical_close_time(overlay, self.historical_root))
        self.assertEqual(overlay.validate_outputs(self.historical_root, output), [])
        self.assertEqual(output[overlay.CHECKER], overlay._checker_successor(self.historical_root))
        self.assertTrue(overlay._authority_match(self.historical_root))
        manifest = json.loads(output[overlay.MANIFEST])
        self.assertFalse(manifest["accepted"])
        self.assertEqual(manifest["release_decision"], "DEFER")
        self.assertEqual(manifest["qa_head"], overlay.QA_HEAD)

    def test_materialize_rejects_backdated_clock_without_writes(self):
        from scripts import f20_u01_r48_close_overlay as overlay

        progress = json.loads(overlay._frozen(self.historical_root, overlay.PROGRESS))
        backdated = datetime.fromisoformat(progress["worker_lease"]["issued_at"])
        before = {path: (self.historical_root / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (self.historical_root / path).exists()}
        with self.assertRaisesRegex(RuntimeError, "R48_CLOSE_CLOCK_OR_LEASE_INVALID"):
            overlay.materialize(self.historical_root, backdated)
        self.assertEqual(before, {path: (self.historical_root / path).read_bytes()
                                  for path in before})

    def test_tampered_authority_rejects_without_output_writes(self):
        from scripts import f20_u01_r48_close_overlay as overlay

        authority = "packages/api/registry.py"
        self.assertIn(authority, overlay.AUTHORITY_FILES)
        target = self.historical_root / authority
        original = target.read_bytes()
        before = {path: (self.historical_root / path).read_bytes() for path in (
            overlay.EVENTS, overlay.PROGRESS, overlay.HANDOFF,
            overlay.DIGEST, overlay.MANIFEST, overlay.CHECKER,
        ) if (self.historical_root / path).exists()}
        try:
            target.write_bytes(bytes([original[0] ^ 1]) + original[1:])
            self.assertFalse(overlay._authority_match(self.historical_root))
            with self.assertRaisesRegex(ValueError, "R48_CLOSE_AUTHORITY_INVALID"):
                overlay.project(self.historical_root,
                    self.historical_close_time(overlay, self.historical_root))
            self.assertEqual(before, {path: (self.historical_root / path).read_bytes()
                                      for path in before})
        finally:
            target.write_bytes(original)


class R48HistoryControlTests(unittest.TestCase):
    ISSUED = "a30d6477afe480e72e972d2cefbea6e7f16c63c4"
    PATHS = ("docs/progress/build-progress.json", "docs/progress/progress-events.json",
             "docs/progress/BUILD_HANDOFF.md",
             "docs/progress/progress-handoff-detached-digest-f19a-minimal-pair-auth-start.json")

    @classmethod
    def issued_bundle(cls):
        archive = {path: subprocess.check_output(["git", "show", f"{cls.ISSUED}:{path}"],
            cwd=ROOT) for path in cls.PATHS}
        bundle = checker.load_bundle(ROOT)
        bundle["progress"] = json.loads(archive[cls.PATHS[0]])
        bundle["events"] = json.loads(archive[cls.PATHS[1]])
        bundle["handoff"] = checker.extract_handoff_summary(archive[cls.PATHS[2]].decode("utf-8"))
        bundle["detached_digest"] = json.loads(archive[cls.PATHS[3]])
        return bundle, archive

    def test_epoch94_active_immutable_publication_and_forgery(self):
        bundle, archive = self.issued_bundle()
        validator = getattr(checker, "_validate_f19a_integration_r48_history", None)
        self.assertIsNotNone(validator)
        issued = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"])
        files = {self.PATHS[0]: archive[self.PATHS[0]], self.PATHS[2]: archive[self.PATHS[2]]}
        def validate(candidate, *, now=issued + timedelta(minutes=1)):
            return validator(candidate, event_raw=archive[self.PATHS[1]], now=now,
                archived_files=files)
        self.assertEqual(validate(bundle), [])
        self.assertTrue(validate(bundle, now=datetime.fromisoformat(
            bundle["progress"]["worker_lease"]["expires_at"])))
        for name, mutate in (("token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["U-01"])),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_WRITE")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(validate(forged), name)

    @classmethod
    def checkpoint_bundle(cls):
        bundle, archive = cls.issued_bundle()
        progress = bundle["progress"]
        status = "F19A_ACCEPTED_INTEGRATION_R48_HISTORY_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_INTEGRATION_R48_HISTORY_CLOSE_ONLY"
        checkpoint = "c" * 40
        progress["f19a_integration_r48_history_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=checkpoint)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(snapshot_id="snapshot-f19a-integration-r48-history-checkpoint-seq2257",
            next_safe_action=action, runtime_next_action=action,
            next_work_package={"package_id": "F-19A", "status": status})
        progress["repository"].update(local_head=checkpoint, remote_head=checkpoint,
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(repository_head=checkpoint, next_safe_action=action)
        progress_raw = (json.dumps(progress, ensure_ascii=False) + "\n").encode()
        handoff_raw = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        for section, raw in (("progress", progress_raw), ("handoff", handoff_raw)):
            bundle["detached_digest"][section].update(bytes=len(raw),
                file_sha256=hashlib.sha256(raw).hexdigest().upper())
        bundle["_r48_archive"] = archive
        bundle["_r48_progress"] = progress_raw
        bundle["_r48_handoff"] = handoff_raw
        bundle["_r48_digest"] = (json.dumps(bundle["detached_digest"]) + "\n").encode()
        return bundle

    def test_epoch94_checkpoint_projection_and_forged_acceptance(self):
        bundle = self.checkpoint_bundle()
        archive = bundle["_r48_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_integration_r48_history(candidate,
                event_raw=archive[self.PATHS[1]], now=observed,
                archived_files={self.PATHS[0]: candidate["_r48_progress"],
                    self.PATHS[2]: candidate["_r48_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (("checkpoint", lambda b: b["progress"][
                "f19a_integration_r48_history_binding"].update(control_checkpoint="0" * 40)),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_epoch94_git_issued_publication_and_remote_dirty_negative(self):
        bundle, _ = self.issued_bundle()
        collector = getattr(checker, "_collect_f19a_integration_r48_history_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("issued", "remote", "product_dirty", "descendant"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = self.ISSUED
                        if scenario == "remote" and tail[1].startswith("development/"):
                            sha = "0" * 40
                        if scenario == "descendant":
                            sha = "e" * 40
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/runtime.py\n" if scenario == "product_dirty" else
                            b" M scripts/check_project_progress.py\n"
                            b" M tests/tooling/test_f20_u01_r48_close_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "issued", f"{scenario}: {result}")

    def test_epoch94_legacy_git_dispatches_active_mode(self):
        bundle, _ = self.issued_bundle()
        with patch.object(checker, "_collect_f19a_integration_r48_history_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_f19a_integration_r48_history_git",
                          return_value=["INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_epoch94_checkpoint_git_exact_two_and_history_negative(self):
        bundle = self.checkpoint_bundle()
        collector = checker._collect_f19a_integration_r48_history_git
        checkpoint, publication = "c" * 40, "e" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f20_u01_r48_close_projection.py")
        issued = self.ISSUED
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "missing_control", "stale_blob",
                         "docs_in_control", "transient_product", "unrelated_descendant", "merge", "ancestor"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else publication
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"] and any(x in tail[-1] for x in (checkpoint, publication)):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{issued}..{checkpoint}":
                        extra = ("docs/WORK_STATUS.md\n" if scenario == "docs_in_control" else
                            "packages/api/runtime.py\n" if scenario == "transient_product" and tail[0] == "log"
                            else "")
                        paths = control[:1] if scenario == "missing_control" and tail[0] == "diff" else control
                        return ("\n".join(paths) + "\n" + extra).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return (b"packages/api/runtime.py\n" if scenario == "unrelated_descendant" else
                            b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    @classmethod
    def closed_bundle(cls):
        bundle = cls.checkpoint_bundle()
        progress, stream = bundle["progress"], bundle["events"]
        worker, write = deepcopy(progress["worker_lease"]), deepcopy(progress["write_lease"])
        at = (datetime.fromisoformat(worker["issued_at"]) + timedelta(minutes=5)).isoformat()
        reason = "F19A_INTEGRATION_R48_HISTORY_FIX_COMPLETE_INTEGRATION_GATES_PENDING"
        for sequence, kind, event_id, details in (
            (2258, "WRITE_LEASE_REVOKED", "evt_f19a_2258_integration_r48_history_write_lease_revoked",
             {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
              "reason": reason}),
            (2259, "WORKER_LEASE_REVOKED", "evt_f19a_2259_integration_r48_history_worker_lease_revoked",
             {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
              "reason": reason})):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id, "event_type": kind,
                "actor": "main-agent-eoul", "actor_id": "main-agent-eoul", "actor_type": "AGENT",
                "project_id": "anvil", "work_package_id": "F-19A", "run_id": None,
                "step_id": "F19A_INTEGRATION_R48_HISTORY_FIX_CLOSE",
                "subject_ref": "F-19A/INTEGRATION-R48-HISTORY-FIX", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2259
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = bundle["_r48_archive"][cls.PATHS[1]].decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2257_integration_r48_history_write_lease_issued"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2259_integration_r48_history_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2257', '"last_sequence": 2259', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_integration_r48_history_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_integration_r48_history_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        status, action = "F19A_ACCEPTED_INTEGRATION_GATES_PENDING", "F19A_INTEGRATION_REQUIRED_GATES_PENDING"
        progress["f19a_integration_r48_history_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="e" * 40, event_sequence=2259)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A", "status": status},
            snapshot_id="snapshot-f19a-integration-r48-history-close-seq2259")
        progress["repository"].update(projection_mode="F19A_INTEGRATION_R48_HISTORY_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2259, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2259
        for section, size in (("progress", 123), ("handoff", 456)):
            bundle["detached_digest"][section].update(bytes=size,
                file_sha256=hashlib.sha256(b"x" * size).hexdigest().upper())
        return bundle, raw

    @classmethod
    def validate_closed(cls, bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_integration_r48_history_binding"][
            "active_projection_checkpoint"]
        published = {cls.PATHS[0]: bundle["_r48_progress"], cls.PATHS[1]: bundle["_r48_archive"][cls.PATHS[1]],
            cls.PATHS[2]: bundle["_r48_handoff"], cls.PATHS[3]: bundle["_r48_digest"]}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                return published[command[2].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_integration_r48_history_closed",
            lambda *a, **k: ["route missing"])
        observed = datetime.fromisoformat(bundle["events"]["events"][2258]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={cls.PATHS[0]: b"x" * 123, cls.PATHS[2]: b"x" * 456})

    def test_epoch94_closed_immutable_b_and_forgery(self):
        bundle, raw = self.closed_bundle()
        self.assertEqual(self.validate_closed(bundle, raw), [])
        for name, mutate in (("token", lambda b: b["progress"][
                "completed_f19a_integration_r48_history_write_lease"].update(write_fencing_token="forged")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS")),
            ("published_digest", lambda b: b.__setitem__("_r48_digest", b"{}")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_WRITE")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1")),
            ("event", lambda b: b["events"]["events"][2258]["details"].update(reason="forged"))):
            with self.subTest(name=name):
                forged = deepcopy(bundle)
                mutate(forged)
                forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
                self.assertTrue(self.validate_closed(forged, raw), name)

    def test_epoch94_closed_git_publication_and_negative(self):
        bundle, _ = self.closed_bundle()
        collector = getattr(checker, "_collect_f19a_integration_r48_history_closed_git", None)
        self.assertIsNotNone(collector)
        checkpoint, publication, head = "c" * 40, "e" * 40, "f" * 40
        original, original_run = subprocess.check_output, subprocess.run
        documents = "docs/progress/build-progress.json\n"
        for scenario in ("published", "remote", "dirty", "ancestor", "merge", "product_in_b",
                         "product_after_b", "stale_b", "extra_after_b"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:1] == ["rev-list"]:
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.ISSUED}..{checkpoint}":
                        return ("scripts/check_project_progress.py\n"
                            "tests/tooling/test_f20_u01_r48_close_projection.py\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return (documents + ("packages/api/runtime.py\n" if scenario == "product_in_b" else "")).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{publication}..{head}":
                        return ("packages/api/runtime.py\n" if scenario == "product_after_b" else
                            "README.md\n" if scenario == "extra_after_b" else documents).encode()
                    if tail[:1] == ["show"]:
                        sha, path = tail[1].split(":", 1)
                        if sha == publication:
                            return b"stale" if scenario == "stale_b" else {
                                self.PATHS[0]: bundle["_r48_progress"],
                                self.PATHS[1]: bundle["_r48_archive"][self.PATHS[1]],
                                self.PATHS[2]: bundle["_r48_handoff"],
                                self.PATHS[3]: bundle["_r48_digest"],
                            }[path]
                        if sha == checkpoint:
                            return (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "ancestor" else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")


if __name__ == "__main__":
    unittest.main()
