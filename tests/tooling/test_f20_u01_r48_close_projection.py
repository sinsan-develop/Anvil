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


class IntegrationMainSyncControlTests(unittest.TestCase):
    ISSUED = "a76693852e49b0b5a34cf1d1806a88dd07bca1df"
    PREDECESSOR = "5aafbafd371137ac94fbbe3543f9ec6311b07eda"
    MAIN = "462c2e5b27823de2c1184f56f0fa9908a2cea328"
    PATHS = R48HistoryControlTests.PATHS

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

    def test_epoch95_active_frozen_acceptance_and_negative(self):
        bundle, archive = self.issued_bundle()
        validator = getattr(checker, "_validate_f19a_integration_main_sync", None)
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
            ("f20", lambda b: b["progress"]["completed_packages"].append("F-20")),
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

    def test_epoch95_issued_git_exact_private_and_dirty_negative(self):
        bundle, _ = self.issued_bundle()
        collector = getattr(checker, "_collect_f19a_integration_main_sync_git", None)
        self.assertIsNotNone(collector)
        original = subprocess.check_output
        for scenario in ("issued", "remote", "product_dirty", "descendant", "changed_main"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else (
                            "e" * 40 if scenario == "descendant" else self.ISSUED)
                        return (sha + "\n").encode()
                    if tail == ["rev-parse", "development/main"]:
                        return (("0" * 40 if scenario == "changed_main" else self.MAIN) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return (b" M packages/api/runtime.py\n" if scenario == "product_dirty" else
                            b" M scripts/check_project_progress.py\n"
                            b" M tests/tooling/test_f20_u01_r48_close_projection.py\n")
                    return original(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario != "issued", f"{scenario}: {result}")

    @classmethod
    def checkpoint_bundle(cls):
        bundle, archive = cls.issued_bundle()
        progress = bundle["progress"]
        status = "F19A_INTEGRATION_MAIN_SYNC_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_INTEGRATION_MAIN_SYNC_CLOSE_ONLY"
        checkpoint = "c" * 40
        progress["f19a_integration_main_sync_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=checkpoint)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(snapshot_id="snapshot-f19a-integration-main-sync-checkpoint-seq2262",
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
        bundle["_main_sync_archive"] = archive
        bundle["_main_sync_progress"] = progress_raw
        bundle["_main_sync_handoff"] = handoff_raw
        bundle["_main_sync_digest"] = (json.dumps(bundle["detached_digest"]) + "\n").encode()
        return bundle

    def test_epoch95_checkpoint_projection_and_unaccepted_successor(self):
        bundle = self.checkpoint_bundle()
        archive = bundle["_main_sync_archive"]
        observed = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_integration_main_sync(candidate,
                event_raw=archive[self.PATHS[1]], now=observed,
                archived_files={self.PATHS[0]: candidate["_main_sync_progress"],
                    self.PATHS[2]: candidate["_main_sync_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (("checkpoint", lambda b: b["progress"][
                "f19a_integration_main_sync_binding"].update(control_checkpoint="0" * 40)),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("handoff", lambda b: b["handoff"].update(status="ACCEPTED"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_epoch95_checkpoint_git_exact_control_then_docs_negative(self):
        bundle = self.checkpoint_bundle()
        collector = checker._collect_f19a_integration_main_sync_git
        checkpoint, publication = "c" * 40, "e" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f20_u01_r48_close_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "missing_control", "stale_blob",
                         "docs_in_control", "transient_product", "product_descendant", "merge", "ancestor"):
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
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.ISSUED}..{checkpoint}":
                        extra = ("docs/WORK_STATUS.md\n" if scenario == "docs_in_control" else
                            "packages/api/runtime.py\n" if scenario == "transient_product" and tail[0] == "log"
                            else "")
                        paths = control[:1] if scenario == "missing_control" and tail[0] == "diff" else control
                        return ("\n".join(paths) + "\n" + extra).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return (b"packages/api/runtime.py\n" if scenario == "product_descendant" else
                            b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[1].startswith(checkpoint + ":"):
                        path = tail[1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_blob" else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        if command[3] == self.MAIN:
                            return subprocess.CompletedProcess(command, 1)
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
        reason = "F19A_INTEGRATION_MAIN_SYNC_CONTROL_COMPLETE_EXACT_MAIN_MERGE_PENDING"
        for sequence, kind, event_id, details in (
            (2263, "WRITE_LEASE_REVOKED", "evt_f19a_2263_integration_main_sync_write_lease_revoked",
             {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
              "reason": reason}),
            (2264, "WORKER_LEASE_REVOKED", "evt_f19a_2264_integration_main_sync_worker_lease_revoked",
             {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
              "reason": reason})):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_INTEGRATION_MAIN_SYNC_CLOSE",
                "subject_ref": "F-19A/INTEGRATION-MAIN-SYNC", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2264
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = bundle["_main_sync_archive"][cls.PATHS[1]].decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2262_integration_main_sync_write_lease_issued"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2264_integration_main_sync_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2262', '"last_sequence": 2264', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_integration_main_sync_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_integration_main_sync_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        status, action = "F19A_ACCEPTED_INTEGRATION_GATES_PENDING", "F19A_INTEGRATION_MAIN_SYNC_EXACT_MERGE_PENDING"
        progress["f19a_integration_main_sync_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="e" * 40, event_sequence=2264)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A", "status": status},
            snapshot_id="snapshot-f19a-integration-main-sync-close-seq2264")
        progress["repository"].update(projection_mode="F19A_INTEGRATION_MAIN_SYNC_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2264, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None,
            repository_head="c" * 40, next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2264
        for section, size in (("progress", 123), ("handoff", 456)):
            bundle["detached_digest"][section].update(bytes=size,
                file_sha256=hashlib.sha256(b"x" * size).hexdigest().upper())
        return bundle, raw

    @classmethod
    def validate_closed(cls, bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_integration_main_sync_binding"]["active_projection_checkpoint"]
        published = {cls.PATHS[0]: bundle["_main_sync_progress"],
            cls.PATHS[1]: bundle["_main_sync_archive"][cls.PATHS[1]],
            cls.PATHS[2]: bundle["_main_sync_handoff"], cls.PATHS[3]: bundle["_main_sync_digest"]}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                return published[command[2].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_integration_main_sync_closed", lambda *a, **k: ["missing"])
        observed = datetime.fromisoformat(bundle["events"]["events"][2263]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={cls.PATHS[0]: b"x" * 123, cls.PATHS[2]: b"x" * 456})

    def test_epoch95_closed_immutable_b_and_forgery(self):
        bundle, raw = self.closed_bundle()
        self.assertEqual(self.validate_closed(bundle, raw), [])
        for name, mutate in (("token", lambda b: b["progress"][
                "completed_f19a_integration_main_sync_write_lease"].update(write_fencing_token="forged")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(status="PRODUCT_WRITE_READY")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(release_decision="PASS")),
            ("published_digest", lambda b: b.__setitem__("_main_sync_digest", b"{}")),
            ("handoff", lambda b: b["handoff"].update(next_safe_action="U01_WRITE")),
            ("digest", lambda b: b["detached_digest"].update(algorithm="SHA-1")),
            ("event", lambda b: b["events"]["events"][2263]["details"].update(reason="forged"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(self.validate_closed(forged, raw), name)

    def test_epoch95_closed_git_only_h_or_exact_zero_tree_merge(self):
        bundle, _ = self.closed_bundle()
        collector = getattr(checker, "_collect_f19a_integration_main_sync_closed_git", None)
        self.assertIsNotNone(collector)
        checkpoint, publication, close_head, merged = "c" * 40, "e" * 40, "d" * 40, "f" * 40
        control = ("scripts/check_project_progress.py", "tests/tooling/test_f20_u01_r48_close_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("premerge", "merged", "remote", "dirty", "wrong_parent", "wrong_tree",
                         "extra_close_commit", "product_close", "extra_merge", "changed_main", "stale_b"):
            with self.subTest(scenario=scenario):
                head = close_head if scenario == "premerge" else merged
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["rev-parse", "development/main"]:
                        return (("0" * 40 if scenario == "changed_main" else self.MAIN) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["show", "-s"] and tail[-1] == merged:
                        return (("0" * 40 if scenario == "wrong_parent" else close_head) + " "
                            + self.MAIN + "\n").encode()
                    if tail == ["rev-parse", f"{merged}^{{tree}}"]:
                        return (("2" * 40 if scenario == "wrong_tree" else "1" * 40) + "\n").encode()
                    if tail == ["rev-parse", f"{close_head}^{{tree}}"]:
                        return ("1" * 40 + "\n").encode()
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{publication}..{close_head}":
                        return (b"2\n" if scenario == "extra_close_commit" else b"1\n")
                    if tail[:1] == ["rev-list"] and any(x in tail[-1] for x in (checkpoint, publication,
                                                                          close_head, merged)):
                        return b"merge\n" if scenario == "extra_merge" and tail[-1] != f"{close_head}..{merged}" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.ISSUED}..{checkpoint}":
                        return ("\n".join(control) + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{publication}..{close_head}":
                        return (b"packages/api/runtime.py\n" if scenario == "product_close" else
                            b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and ":" in tail[-1]:
                        sha, path = tail[-1].split(":", 1)
                        if sha == checkpoint:
                            return (ROOT / path).read_bytes()
                        if sha == publication:
                            return b"stale" if scenario == "stale_b" else {
                                self.PATHS[0]: bundle["_main_sync_progress"],
                                self.PATHS[1]: bundle["_main_sync_archive"][self.PATHS[1]],
                                self.PATHS[2]: bundle["_main_sync_handoff"],
                                self.PATHS[3]: bundle["_main_sync_digest"],
                            }[path]
                        if sha == close_head:
                            return (json.dumps(bundle["progress"], ensure_ascii=False) + "\n").encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        if command[3] == self.MAIN:
                            return subprocess.CompletedProcess(command, 0 if command[4] == merged else 1)
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario not in ("premerge", "merged"),
                    f"{scenario}: {result}")

    def test_epoch95_legacy_git_dispatches_closed_mode(self):
        bundle, _ = self.closed_bundle()
        with patch.object(checker, "_collect_f19a_integration_main_sync_closed_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_f19a_integration_main_sync_closed_git",
                          return_value=["INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_epoch95_merged_main_read_only_smoke_parents_tree_and_remote(self):
        validator = getattr(checker, "_validate_f19a_integration_main_sync_merged_main", None)
        self.assertIsNotNone(validator)
        bundle, raw = self.closed_bundle()
        publication, close_head, merged, pr_head = "e" * 40, "d" * 40, "f" * 40, "9" * 40
        h_progress = (json.dumps(bundle["progress"], ensure_ascii=False) + "\n").encode()
        h_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        h_digest = deepcopy(bundle["detached_digest"])
        for section, value in (("progress", h_progress), ("handoff", h_handoff)):
            h_digest[section].update(bytes=len(value), file_sha256=hashlib.sha256(value).hexdigest().upper())
        h_digest_raw = (json.dumps(h_digest) + "\n").encode()
        published_b = {self.PATHS[0]: bundle["_main_sync_progress"],
            self.PATHS[1]: bundle["_main_sync_archive"][self.PATHS[1]],
            self.PATHS[2]: bundle["_main_sync_handoff"], self.PATHS[3]: bundle["_main_sync_digest"]}
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("merged_pr", "stale_main", "local_main_stale", "wrong_checkout_head",
                         "wrong_branch", "wrong_pr_parent", "wrong_merge_parent", "wrong_pr_tree",
                         "wrong_merge_tree", "dirty", "extra_close_commit", "unrelated_b",
                         "forged_event", "product_control", "product_docs", "product_close",
                         "forged_release"):
            with self.subTest(scenario=scenario):
                forged_events = deepcopy(bundle["events"])
                forged_events["events"][2263]["details"]["reason"] = "forged"
                forged_raw = (json.dumps(forged_events, ensure_ascii=False) + "\n").encode()
                forged_progress = deepcopy(bundle["progress"])
                forged_progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(
                    forged_raw).hexdigest().upper()
                forged_progress["snapshot_hash"] = checker.compute_snapshot_hash(forged_progress)
                release_progress = deepcopy(bundle["progress"])
                release_progress["scope_revision_binding"]["release_decision"] = "PASS"
                release_progress["snapshot_hash"] = checker.compute_snapshot_hash(release_progress)
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "wrong_checkout_head" else pr_head) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return ("codex/other\n" if scenario == "wrong_branch" else "main\n").encode()
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        raise subprocess.CalledProcessError(128, command)
                    if tail == ["rev-parse", "main"]:
                        return (("0" * 40 if scenario == "local_main_stale" else pr_head) + "\n").encode()
                    if tail == ["rev-parse", "development/main"]:
                        return (("0" * 40 if scenario == "stale_main" else pr_head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["show", "-s"] and tail[-1] == pr_head:
                        return (("0" * 40 if scenario == "wrong_pr_parent" else self.MAIN)
                            + " " + merged + "\n").encode()
                    if tail[:2] == ["show", "-s"] and tail[-1] == merged:
                        return (("0" * 40 if scenario == "wrong_merge_parent" else close_head)
                            + " " + self.MAIN + "\n").encode()
                    if tail[:1] == ["rev-parse"] and tail[1].endswith("^{tree}"):
                        sha = tail[1].split("^")[0]
                        value = "2" * 40 if (scenario == "wrong_pr_tree" and sha == pr_head
                            or scenario == "wrong_merge_tree" and sha == merged) else "1" * 40
                        return (value + "\n").encode()
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{publication}..{close_head}":
                        return b"2\n" if scenario == "extra_close_commit" else b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b""
                    if tail[:1] in (["log"], ["diff"]):
                        changed = ("packages/api/runtime.py\n" if (
                            scenario == "product_control" and tail[-1] == f"{self.ISSUED}..{'c' * 40}"
                            or scenario == "product_docs" and tail[-1] == f"{'c' * 40}..{publication}"
                            or scenario == "product_close" and tail[-1] == f"{publication}..{close_head}")
                            else "scripts/check_project_progress.py\n"
                            "tests/tooling/test_f20_u01_r48_close_projection.py\n"
                            if tail[-1] == f"{self.ISSUED}..{'c' * 40}"
                            else "docs/progress/build-progress.json\n")
                        return changed.encode()
                    if tail[:1] == ["show"] and tail[-1] == f"{close_head}:docs/progress/build-progress.json":
                        row = (forged_progress if scenario == "forged_event" else
                            release_progress if scenario == "forged_release" else bundle["progress"])
                        return (json.dumps(row, ensure_ascii=False) + "\n").encode()
                    if tail[:1] == ["show"] and tail[-1] == f"{close_head}:docs/progress/progress-events.json":
                        return forged_raw if scenario == "forged_event" else raw
                    if tail[:1] == ["show"] and ":" in tail[-1]:
                        sha, path = tail[-1].split(":", 1)
                        if sha == "c" * 40 and path in (
                                "scripts/check_project_progress.py",
                                "tests/tooling/test_f20_u01_r48_close_projection.py"):
                            return (ROOT / path).read_bytes()
                        if sha == publication:
                            return published_b[path]
                        if sha == close_head:
                            return {self.PATHS[2]: h_handoff, self.PATHS[3]: h_digest_raw}[path]
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command,
                            1 if scenario == "unrelated_b" and command[3:5] == [publication, close_head] else 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = validator(ROOT)
                self.assertEqual(bool(result), scenario != "merged_pr", f"{scenario}: {result}")

    def test_epoch95_merged_main_smoke_cli_has_separate_read_only_mode(self):
        with patch.object(checker, "_validate_f19a_integration_main_sync_merged_main", return_value=[]):
            self.assertEqual(checker.main(["--f19a-main-sync-merged-smoke", str(ROOT)]), 0)
        with patch.object(checker, "_validate_f19a_integration_main_sync_merged_main",
                          return_value=["F19A_MAIN_SYNC_MERGED_MAIN_INVALID"]):
            self.assertEqual(checker.main(["--f19a-main-sync-merged-smoke", str(ROOT)]), 1)


if __name__ == "__main__":
    unittest.main()


class IntegrationWhitespaceGateTests(unittest.TestCase):
    ISSUED = "4572c2837a2131156df4a159adf4dd830556ec96"
    PREDECESSOR = "3f0f51100d66283e39fca61ec944aabbe28467cf"
    MAIN = "462c2e5b27823de2c1184f56f0fa9908a2cea328"
    PATHS = R48HistoryControlTests.PATHS
    TARGETS = (
        "apps/api/anvil_api/projects_scan.py",
        "apps/web/tests/menu-routes.test.mjs",
        "apps/web/tests/projects.test.mjs",
        "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
        "tests/api/test_projects_scan_api.py",
    )

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

    def test_epoch96_active_frozen_pair_and_scope(self):
        bundle, archive = self.issued_bundle()
        validator = getattr(checker, "_validate_f19a_integration_whitespace_gate", None)
        self.assertIsNotNone(validator)
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        files = {self.PATHS[0]: archive[self.PATHS[0]], self.PATHS[2]: archive[self.PATHS[2]]}
        def validate(candidate):
            return validator(candidate, event_raw=archive[self.PATHS[1]], now=now,
                archived_files=files)
        self.assertEqual(validate(bundle), [])
        for name, mutate in (("token", lambda b: b["progress"]["write_lease"].update(
                write_fencing_token="forged")),
            ("scope", lambda b: b["progress"]["write_lease"].update(product_write_scope=["U-01"])),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_epoch96_issued_git_allows_exact_dirty_and_rejects_other_dirty(self):
        collector = getattr(checker, "_collect_f19a_integration_whitespace_gate_git", None)
        self.assertIsNotNone(collector)
        bundle, _ = self.issued_bundle()
        self.assertEqual(collector(bundle), [])
        original = subprocess.check_output
        def dirty(command, *args, **kwargs):
            if command[-3:] == ["status", "--porcelain=v1", "-uall"]:
                return b" M packages/api/runtime.py\n"
            return original(command, *args, **kwargs)
        with patch.object(subprocess, "check_output", side_effect=dirty):
            self.assertTrue(collector(bundle))

    def test_epoch96_live_g05_dispatches_active_mode(self):
        self.assertEqual(checker.validate_bundle(checker.load_bundle(ROOT)), [])

    @classmethod
    def checkpoint_bundle(cls):
        bundle, archive = cls.issued_bundle()
        progress = bundle["progress"]
        checkpoint = "c" * 40
        status = "F19A_INTEGRATION_WHITESPACE_GATE_CONTROL_CHECKPOINTED_CLOSE_READY"
        action = "F19A_INTEGRATION_WHITESPACE_GATE_CLOSE_ONLY"
        progress["f19a_integration_whitespace_gate_binding"].update(status=status,
            next_safe_action=action, control_checkpoint=checkpoint)
        progress["active_work_instruction"].update(result_status=status, package_status=status)
        progress.update(snapshot_id="snapshot-f19a-integration-whitespace-gate-checkpoint-seq2267",
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
        bundle["_whitespace_archive"] = archive
        bundle["_whitespace_progress"] = progress_raw
        bundle["_whitespace_handoff"] = handoff_raw
        bundle["_whitespace_digest"] = (json.dumps(bundle["detached_digest"]) + "\n").encode()
        return bundle

    def test_epoch96_checkpoint_projection_preserves_acceptance_and_u01_lock(self):
        bundle = self.checkpoint_bundle()
        archive = bundle["_whitespace_archive"]
        now = datetime.fromisoformat(bundle["progress"]["worker_lease"]["issued_at"]) + timedelta(minutes=1)
        def validate(candidate):
            return checker._validate_f19a_integration_whitespace_gate(candidate,
                event_raw=archive[self.PATHS[1]], now=now,
                archived_files={self.PATHS[0]: candidate["_whitespace_progress"],
                    self.PATHS[2]: candidate["_whitespace_handoff"]})
        self.assertEqual(validate(bundle), [])
        for name, mutate in (("checkpoint", lambda b: b["progress"][
                "f19a_integration_whitespace_gate_binding"].update(control_checkpoint="0" * 40)),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(validate(forged), name)

    def test_epoch96_checkpoint_git_exact_three_then_docs_only(self):
        bundle = self.checkpoint_bundle()
        collector = checker._collect_f19a_integration_whitespace_gate_git
        checkpoint, publication = "c" * 40, "e" * 40
        control = (".gitattributes", "scripts/check_project_progress.py",
            "tests/tooling/test_f20_u01_r48_close_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "remote", "dirty", "missing_attr", "docs_in_control",
                         "product_descendant", "stale_attr", "merge", "wrong_main", "other_whitespace"):
            with self.subTest(scenario=scenario):
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else publication
                        return (sha + "\n").encode()
                    if tail == ["rev-parse", "development/main"]:
                        return (("0" * 40 if scenario == "wrong_main" else self.MAIN) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{self.ISSUED}..{checkpoint}", f"{checkpoint}..{publication}"):
                        return b"merge\n" if scenario == "merge" else b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.ISSUED}..{checkpoint}":
                        paths = control[1:] if scenario == "missing_attr" and tail[0] == "diff" else control
                        extra = "docs/WORK_STATUS.md\n" if scenario == "docs_in_control" else ""
                        return ("\n".join(paths) + "\n" + extra).encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return (b"packages/api/runtime.py\n" if scenario == "product_descendant" else
                            b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and tail[-1].startswith(checkpoint + ":"):
                        path = tail[-1].split(":", 1)[1]
                        return b"stale" if scenario == "stale_attr" and path == ".gitattributes" else (ROOT / path).read_bytes()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 1 if command[3] == self.MAIN else 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 1 if scenario == "other_whitespace" else 0)
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
        reason = "F19A_INTEGRATION_WHITESPACE_GATE_COMPLETE_EXACT_MAIN_MERGE_PENDING"
        for sequence, kind, event_id, details in (
            (2268, "WRITE_LEASE_REVOKED", "evt_f19a_2268_integration_whitespace_gate_write_lease_revoked",
             {"lease_id": write["lease_id"], "write_fencing_token": write["write_fencing_token"],
              "reason": reason}),
            (2269, "WORKER_LEASE_REVOKED", "evt_f19a_2269_integration_whitespace_gate_worker_lease_revoked",
             {"lease_id": worker["lease_id"], "execution_fencing_token": worker["execution_fencing_token"],
              "reason": reason})):
            previous = stream["events"][-1]
            stream["events"].append({"sequence": sequence, "event_id": event_id,
                "event_type": kind, "actor": "main-agent-eoul", "actor_id": "main-agent-eoul",
                "actor_type": "AGENT", "project_id": "anvil", "work_package_id": "F-19A",
                "run_id": None, "step_id": "F19A_INTEGRATION_WHITESPACE_GATE_CLOSE",
                "subject_ref": "F-19A/INTEGRATION-WHITESPACE-GATE", "occurred_at": at,
                "occurred_at_source": "PROJECTION_RECORDING_CLOCK_NOT_RUNTIME_ACTION_TIME",
                "previous_event_sha256": hashlib.sha256(checker.canonical_json_bytes(previous)).hexdigest().upper(),
                "details": details})
        stream["last_sequence"] = progress["event_sequence"] = 2269
        stream["last_event_id"] = progress["last_event_id"] = stream["events"][-1]["event_id"]
        prefix = bundle["_whitespace_archive"][cls.PATHS[1]].decode("utf-8")
        footer = '\n  ],\n  "last_event_id": "evt_f19a_2267_integration_whitespace_gate_write_lease_issued"\n}\n'
        assert prefix.endswith(footer)
        def render(row):
            return "\n".join("  " + line for line in json.dumps(row, ensure_ascii=False, indent=2).splitlines())
        raw = (prefix[:-len(footer)] + ",\n" + ",\n".join(render(row) for row in stream["events"][-2:])
            + '\n  ],\n  "last_event_id": "evt_f19a_2269_integration_whitespace_gate_worker_lease_revoked"\n}\n')
        raw = raw.replace('"last_sequence": 2267', '"last_sequence": 2269', 1).encode()
        assert json.loads(raw) == stream
        progress["registry_refs"]["progress_events"]["sha256"] = hashlib.sha256(raw).hexdigest().upper()
        progress["worker_lease"] = progress["write_lease"] = None
        progress["completed_f19a_integration_whitespace_gate_write_lease"] = {
            **write, "status": "REVOKED", "revoked_at": at}
        progress["completed_f19a_integration_whitespace_gate_worker_lease"] = {
            **worker, "status": "REVOKED", "revoked_at": at}
        status = "F19A_INTEGRATION_WHITESPACE_GATE_CLOSED_EXACT_MAIN_MERGE_PENDING"
        action = "F19A_INTEGRATION_MAIN_SYNC_EXACT_MERGE_PENDING"
        progress["f19a_integration_whitespace_gate_binding"].update(status=status,
            next_safe_action=action, active_projection_checkpoint="e" * 40, event_sequence=2269)
        progress.update(active_agent=None, updated_at=at, next_safe_action=action,
            runtime_next_action=action, next_work_package={"package_id": "F-19A", "status": status},
            snapshot_id="snapshot-f19a-integration-whitespace-gate-close-seq2269")
        progress["repository"].update(projection_mode="F19A_INTEGRATION_WHITESPACE_GATE_CLOSED",
            head_relation=status, worktree_status=status)
        progress["snapshot_hash"] = checker.compute_snapshot_hash(progress)
        bundle["handoff"].update(event_sequence=2269, last_event_id=stream["last_event_id"],
            active_agent=None, worker_lease=None, write_lease=None, repository_head="c" * 40,
            next_safe_action=action)
        bundle["detached_digest"]["event_sequence"] = 2269
        for section, size in (("progress", 123), ("handoff", 456)):
            bundle["detached_digest"][section].update(bytes=size,
                file_sha256=hashlib.sha256(b"x" * size).hexdigest().upper())
        return bundle, raw

    @classmethod
    def validate_closed(cls, bundle, raw):
        original = subprocess.check_output
        publication = bundle["progress"]["f19a_integration_whitespace_gate_binding"][
            "active_projection_checkpoint"]
        published = {cls.PATHS[0]: bundle["_whitespace_progress"],
            cls.PATHS[1]: bundle["_whitespace_archive"][cls.PATHS[1]],
            cls.PATHS[2]: bundle["_whitespace_handoff"], cls.PATHS[3]: bundle["_whitespace_digest"]}
        def output(command, *args, **kwargs):
            if command[:2] == ["git", "show"] and len(command) == 3 and command[2].startswith(publication + ":"):
                return published[command[2].split(":", 1)[1]]
            return original(command, *args, **kwargs)
        validator = getattr(checker, "_validate_f19a_integration_whitespace_gate_closed", None)
        assert validator is not None
        observed = datetime.fromisoformat(bundle["events"]["events"][2268]["occurred_at"]) + timedelta(minutes=1)
        with patch.object(subprocess, "check_output", side_effect=output):
            return validator(bundle, event_raw=raw, now=observed,
                archived_files={cls.PATHS[0]: b"x" * 123, cls.PATHS[2]: b"x" * 456})

    def test_epoch96_closed_revokes_exact_leases_and_preserves_f19a(self):
        bundle, raw = self.closed_bundle()
        self.assertEqual(self.validate_closed(bundle, raw), [])
        for name, mutate in (("write_token", lambda b: b["progress"][
                "completed_f19a_integration_whitespace_gate_write_lease"].update(write_fencing_token="forged")),
            ("event", lambda b: b["events"]["events"][2268]["details"].update(reason="forged")),
            ("f19a", lambda b: b["progress"]["completed_packages"].remove("F-19A")),
            ("u01", lambda b: b["progress"]["next_successor_work_package"].update(
                status="PRODUCT_WRITE_READY")),
            ("release", lambda b: b["progress"]["scope_revision_binding"].update(
                release_decision="PASS")),
            ("published_digest", lambda b: b.__setitem__("_whitespace_digest", b"{}"))):
            forged = deepcopy(bundle)
            mutate(forged)
            forged["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(forged["progress"])
            self.assertTrue(self.validate_closed(forged, raw), name)

    def test_epoch96_closed_git_only_h_or_exact_tree_preserving_main_merge(self):
        bundle, _ = self.closed_bundle()
        collector = getattr(checker, "_collect_f19a_integration_whitespace_gate_closed_git", None)
        self.assertIsNotNone(collector)
        checkpoint, publication, close_head, merged = "c" * 40, "e" * 40, "d" * 40, "f" * 40
        control = (".gitattributes", "scripts/check_project_progress.py",
            "tests/tooling/test_f20_u01_r48_close_projection.py")
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("premerge", "merged", "remote", "dirty", "product_close", "wrong_tree",
                         "wrong_parent", "extra_close_commit", "stale_b", "changed_main"):
            with self.subTest(scenario=scenario):
                head = close_head if scenario == "premerge" else merged
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail in (["rev-parse", "HEAD"], ["rev-parse", "development/codex/f18-wsl-ops"]):
                        sha = "0" * 40 if scenario == "remote" and tail[1].startswith("development/") else head
                        return (sha + "\n").encode()
                    if tail == ["rev-parse", "development/main"]:
                        return (("0" * 40 if scenario == "changed_main" else self.MAIN) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["show", "-s"] and tail[-1] == merged:
                        return (("0" * 40 if scenario == "wrong_parent" else close_head)
                            + " " + self.MAIN + "\n").encode()
                    if tail == ["rev-parse", f"{merged}^{{tree}}"]:
                        return (("2" * 40 if scenario == "wrong_tree" else "1" * 40) + "\n").encode()
                    if tail == ["rev-parse", f"{close_head}^{{tree}}"]:
                        return ("1" * 40 + "\n").encode()
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{publication}..{close_head}":
                        return b"2\n" if scenario == "extra_close_commit" else b"1\n"
                    if tail[:2] == ["rev-list", "--min-parents=2"] and tail[-1] in (
                            f"{self.ISSUED}..{checkpoint}", f"{checkpoint}..{publication}",
                            f"{publication}..{close_head}"):
                        return b""
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{self.ISSUED}..{checkpoint}":
                        return ("\n".join(control) + "\n").encode()
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{checkpoint}..{publication}":
                        return b"docs/progress/build-progress.json\n"
                    if tail[:1] in (["log"], ["diff"]) and tail[-1] == f"{publication}..{close_head}":
                        return (b"packages/api/runtime.py\n" if scenario == "product_close" else
                            b"docs/progress/build-progress.json\n")
                    if tail[:1] == ["show"] and ":" in tail[-1]:
                        sha, path = tail[-1].split(":", 1)
                        if sha == checkpoint:
                            return (ROOT / path).read_bytes()
                        if sha == publication:
                            return b"stale" if scenario == "stale_b" else {
                                self.PATHS[0]: bundle["_whitespace_progress"],
                                self.PATHS[1]: bundle["_whitespace_archive"][self.PATHS[1]],
                                self.PATHS[2]: bundle["_whitespace_handoff"],
                                self.PATHS[3]: bundle["_whitespace_digest"],
                            }[path]
                        if sha == close_head:
                            return (json.dumps(bundle["progress"], ensure_ascii=False) + "\n").encode()
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        if command[3] == self.MAIN:
                            return subprocess.CompletedProcess(command, 0 if command[4] == merged else 1)
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = collector(bundle)
                self.assertEqual(bool(result), scenario not in ("premerge", "merged"),
                    f"{scenario}: {result}")

    def test_epoch96_closed_legacy_dispatch(self):
        bundle, _ = self.closed_bundle()
        with patch.object(checker, "_collect_f19a_integration_whitespace_gate_closed_git", return_value=[]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), [])
        with patch.object(checker, "_collect_f19a_integration_whitespace_gate_closed_git",
                          return_value=["INVALID"]):
            self.assertEqual(checker._collect_f19a_start_git(bundle), ["F19A_GIT_INVALID"])

    def test_epoch96_merged_main_smoke_after_broker_deletes_work_branch(self):
        validator = getattr(checker, "_validate_f19a_integration_whitespace_gate_merged_main", None)
        self.assertIsNotNone(validator)
        bundle, event_raw = self.closed_bundle()
        checkpoint, publication, close_head, merged, pr_head = "c" * 40, "e" * 40, "d" * 40, "f" * 40, "9" * 40
        control = (".gitattributes", "scripts/check_project_progress.py",
            "tests/tooling/test_f20_u01_r48_close_projection.py")
        h_progress = (json.dumps(bundle["progress"], ensure_ascii=False) + "\n").encode()
        h_handoff = ("```json anvil-recovery-summary\n"
            + json.dumps(bundle["handoff"], ensure_ascii=False) + "\n```\n").encode()
        digest = deepcopy(bundle["detached_digest"])
        for section, value in (("progress", h_progress), ("handoff", h_handoff)):
            digest[section].update(bytes=len(value), file_sha256=hashlib.sha256(value).hexdigest().upper())
        h_digest = (json.dumps(digest) + "\n").encode()
        published_b = {self.PATHS[0]: bundle["_whitespace_progress"],
            self.PATHS[1]: bundle["_whitespace_archive"][self.PATHS[1]],
            self.PATHS[2]: bundle["_whitespace_handoff"], self.PATHS[3]: bundle["_whitespace_digest"]}
        h_files = {self.PATHS[0]: h_progress, self.PATHS[1]: event_raw,
            self.PATHS[2]: h_handoff, self.PATHS[3]: h_digest}
        original, original_run = subprocess.check_output, subprocess.run
        for scenario in ("published", "wrong_head", "wrong_branch", "remote_main", "wrong_pr_parent",
                         "wrong_merge_parent", "wrong_tree", "product_control", "product_docs",
                         "product_close", "release", "dirty"):
            with self.subTest(scenario=scenario):
                forged = deepcopy(bundle["progress"])
                forged["scope_revision_binding"]["release_decision"] = "PASS"
                forged["snapshot_hash"] = checker.compute_snapshot_hash(forged)
                def output(command, *args, **kwargs):
                    tail = command[5:] if command[:5] == ["git", "-c", "core.excludesFile=",
                        "-c", "core.quotePath=false"] else command[1:]
                    if tail == ["rev-parse", "development/codex/f18-wsl-ops"]:
                        raise subprocess.CalledProcessError(128, command)
                    if tail == ["rev-parse", "HEAD"]:
                        return (("0" * 40 if scenario == "wrong_head" else pr_head) + "\n").encode()
                    if tail == ["branch", "--show-current"]:
                        return ("codex/other\n" if scenario == "wrong_branch" else "main\n").encode()
                    if tail in (["rev-parse", "main"], ["rev-parse", "development/main"]):
                        return (("0" * 40 if scenario == "remote_main" and tail[1].startswith("development/")
                            else pr_head) + "\n").encode()
                    if tail == ["status", "--porcelain=v1", "-uall"]:
                        return b" M packages/api/runtime.py\n" if scenario == "dirty" else b""
                    if tail[:2] == ["show", "-s"] and tail[-1] == pr_head:
                        return (("0" * 40 if scenario == "wrong_pr_parent" else self.MAIN)
                            + " " + merged + "\n").encode()
                    if tail[:2] == ["show", "-s"] and tail[-1] == merged:
                        return (("0" * 40 if scenario == "wrong_merge_parent" else close_head)
                            + " " + self.MAIN + "\n").encode()
                    if tail[:1] == ["rev-parse"] and tail[1].endswith("^{tree}"):
                        sha = tail[1].split("^")[0]
                        return (("2" * 40 if scenario == "wrong_tree" and sha == pr_head else "1" * 40)
                            + "\n").encode()
                    if tail[:2] == ["rev-list", "--min-parents=2"]:
                        return b""
                    if tail[:2] == ["rev-list", "--count"] and tail[-1] == f"{publication}..{close_head}":
                        return b"1\n"
                    if tail[:1] in (["log"], ["diff"]):
                        changed = ("packages/api/runtime.py\n" if (
                            scenario == "product_control" and tail[-1] == f"{self.ISSUED}..{checkpoint}"
                            or scenario == "product_docs" and tail[-1] == f"{checkpoint}..{publication}"
                            or scenario == "product_close" and tail[-1] == f"{publication}..{close_head}")
                            else "\n".join(control) + "\n" if tail[-1] == f"{self.ISSUED}..{checkpoint}"
                            else "docs/progress/build-progress.json\n")
                        return changed.encode()
                    if tail[:1] == ["show"] and ":" in tail[-1]:
                        sha, path = tail[-1].split(":", 1)
                        if sha == checkpoint:
                            return (ROOT / path).read_bytes()
                        if sha == publication:
                            return published_b[path]
                        if sha == close_head:
                            return ((json.dumps(forged, ensure_ascii=False) + "\n").encode()
                                if scenario == "release" and path == self.PATHS[0] else h_files[path])
                    return original(command, *args, **kwargs)
                def run(command, *args, **kwargs):
                    if command[:3] == ["git", "merge-base", "--is-ancestor"]:
                        return subprocess.CompletedProcess(command, 0)
                    if command[:3] == ["git", "diff", "--check"]:
                        return subprocess.CompletedProcess(command, 0)
                    return original_run(command, *args, **kwargs)
                with patch.object(subprocess, "check_output", side_effect=output), \
                        patch.object(subprocess, "run", side_effect=run):
                    result = validator(ROOT)
                self.assertEqual(bool(result), scenario != "published", f"{scenario}: {result}")

    def test_epoch96_whitespace_exception_is_exact_five_paths_and_preserves_blobs(self):
        baseline = "4572c2837a2131156df4a159adf4dd830556ec96"
        for path in self.TARGETS:
            with self.subTest(path=path):
                observed = subprocess.check_output(["git", "check-attr", "whitespace", "--", path],
                    cwd=ROOT, text=True).strip()
                self.assertEqual(observed, f"{path}: whitespace: -blank-at-eof")
                self.assertEqual((ROOT / path).read_bytes(), subprocess.check_output(
                    ["git", "show", f"{baseline}:{path}"], cwd=ROOT))
        contrast = "apps/api/anvil_api/oidc_process.py"
        self.assertEqual(subprocess.check_output(["git", "check-attr", "whitespace", "--", contrast],
            cwd=ROOT, text=True).strip(), f"{contrast}: whitespace: unspecified")
        attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8")
        self.assertIn("* text=auto eol=lf\n", attributes)
        self.assertIn("*.png binary\n", attributes)
