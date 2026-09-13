"""Executable G-05 contracts for project progress and session recovery."""

from __future__ import annotations

import base64
import copy
import hashlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]

# seq496 intentionally kept its independent-review authority source outside Git.
# Freeze the exact historical bytes here so detached historical tests do not
# depend on residue from whichever worktree happens to execute the suite.
_SEQ496_INDEPENDENT_JUDGMENT_SOURCE = zlib.decompress(
    base64.b64decode(
        "eNqVWN9PG1cWfuevuFJediXb49/BkSKtscdkWmO7tkm2T+PBHmCaYcY7MyZFiiqSOIgNVCFVaExqZ802DaGiqgMEqERe+HM81//DnnNnxnZCiroPIcbcOfec73znO+fMNWLK/4om4iTlD4cI7Tbp4TGxnz6233wgZdm0ZIMMNrdod3ti4tq14Ue/dxKfukEqZb5UFov8bYG/Qzgylc2nvuTTYi5fFpOpFF8o8+kKPMNuipE7pSwZbLdou0nsw+fwHxgoJEsleLI0K5STU1keT6f8QTTtGSvwubSQmxZT4ZBrNJlLsYNpoegPw0m8rlwUpqf5ItxH/lZJ+UOxyifBsIvs3lPiOUZo53jwU5O+2LL3Ngl91KHNd38Hq/3D1cFal/TPevT1Kliv6jX5W64aDvn1umxIlqJrkuqXv5WrDfz8j4R0XYqHotG5ai0oXa9FJuercjgRioeC89GgnIgHJ6XIZCSYqIxs2719utG5QQxZqvl1TV0JAKztwQ/rF6eAsn10RuyDM9psX5xOK9bFKeB2cZqeujgtGPqyUpONi9OyrMoLhrR0cbpiahJZaljMMUJfrNHOZmBiwoHcfvKc0Cd/0M6ZvdUmFUwaB9b8fLKY/dp/O5kV0smykM+JyUKhmL8NaJdS+QIv5nPZryv2L+eEbrwGz+zdNrpO33QGP67TvVUAzEdcTys1vWpy93Tjrqgb4JvJ4S3inXzxS1HIlcrF2RTeEFiqVWin5dGH7jTtnzfpbq//7ph2gA+/vrWfbRF6sk933yFH9lYJ3X4C/tsbrwPEft6zO+eACOMQpma9SyBf/aP3+PQ4hel6y+58oO1zdBpi7x/uX7LHKD3ugn3UHFL8PrlG7nvRjR+Cb50z8KF/et5/16M7q8T+/czx2uU0uT9x3+/338Afw39gNIRGXx7T1gNC21368IAMdlr9ww+kqi8tKRa3JGnKPFCVW5TMRdI/atpHx2jflI1lpSqTRVlSrUUwwkrGzVNWmBGwxuBrt8YM2WyoFhlaM+S6blj93iqpSlpNqUmWTCpSJBquxcORQCBQ8YEDmmXoKqlcvx6W5udqzrcIdGE6FOPgx2Qx5SOzAuf4wOXrspYsCCQcDPoIPKnOSdW7rLaqqixpjTrmpH/Ys3vbg+02S2DFIUUpK36VFPl/8qlZRrsiX5rNlsWZZE7IgJIEvjF1De6+8jQyKYDFi+RGL7HAuZIlLSjaAgGOYmLgr/s9grXBzRn6PQCR84qH82rHPYvY0O2mvbHOPMVchQHPgm5aC4Zc+ipLoOxNBUREq8qYEXlZ1ixOatQUBq8qrYwqBQqwB5GDqCBZnZpxclYsC8nsSCMxZeg8sj495Z5fUhYcgSGVYDAUASTKknmXKzY0jsdLSQho6CNSw1qE35QqJLNGSiXeR7KSafnZGb+QZpx8dYAFsbbrI5idRh1cNS3dkJ086Q3NMol9sm4frdLOKlNHFn7/9Mz+z4H9sAWFDbHpK9w9U+WWZUOZXwmYixUEfV751moYMot67wHtPiNQ6HyxDHWGqI9VI1Y8AwoJTbc/sFIHaj9tenpyqdT7R1hZLHVkmClmA6+uG7KfOc+yBmL34zExLUOpWqQmq5aEX1dmc7f5opARAOVhSiOItzxHUrpm6qrMIX9NaUn264YCxPEhjNxHKAJwDnOgtKqGbHGKBn0EtJ/IWq2uw2/E/qNpP4byb/9pip2qZMLXbNuHGPYHgOLjqy/lk+XoI2c8ro9VpMuZYeYcKLGXecXPMHJo6YWSky2Uakyd/etjutGm3QeuVrI26hQbAgff2M9c9T3bRPV92aNdMNh5Zm+851xDGJkDz8Wp/fDYPlmlP5/TtU0SRMEcK7AXa8NURAGXBPHKEeVnXlkAPtVAourSnKIq1gpXA8JZCOsYmC41NF3zwykVy71u6HMygpPgEhjr4Md/Y4uCiIDBs4VSOTnNk2gw5CPT/IyQE+AzaBZIZy4pON/ns9nkTJJYypKsNywQjv5RlyT6vbbXkxxPLpHKzSxLAvLZiwed+QTKkQDmCyWxGP5I0gr5oitpiE0MwhyxXlX1eyooD+cy0FEbV3oWlYVFv6GYd0Hzv5GrTDY+ixc0SQzHVBY0wLiQL5VJaPByk9wqlwuo4XCM1EHtnMIiIdQD+soDcVhxxF5vQmf1DettRZOWlKpTdx/h4yP3DKkOqjnsyaxTk3lJNWWGhhPIyHF04TPxsLpxddVtnYxRiLfHqE/z4KGHUfxpHooRlorP5cE3OlLms/x0MTkDf00nU2ACPqR4oeD2KSdjcezrQLzNt1ABv5+5kg9TAkpj8x0r5RoUo9GAkJZlrt6YUwE1VwdgxISBxevqI8XwtG442LnDAm29tn9peXMH4zuJDbZ/s3/dZ9p60rTfHEAFAIl9bmES+tMWjJMEeA9JUVFlwCAbO4fN2wc9CHK+ZT/dITX9ngYA1mR8wm3oOFYotQZ8xVr7Wc/exVHQLWmcptzxwxvNWJq8CXywsw0TKC4PUK6YWlJdlKt3ZcOb/+HhBnbXm84EgxMLFPfN5Gw5L6byubKQm+UrgdEiMa9XGybqBU4uEtiLg9qAsaKkQT4sQNskikaigWh80gRBzn/Jnv5kNiKlW0l/OBaHB2OTqWQ8FuTj6WgoMhkMpSajicxkJhZOBFOZZCQVj4YzoUxi6no0EQ2lM+kgH0ul0+F4KphIpyJhfty84/+4cT4Ny0A4FOUT4UgmPBULZaLhqUg0HkvEosF4PBiNpK9PhpOZdISfmsykJmOxTCQ6FY7yoXQsEQ8x47AIEIz1rlzjGpr7aTj33yDBALmjaJA7kyyo+hx0KSh3aPdIlUqgvoKgiFUJgK8AOZ/B/OpQsItMG+4hHs2cP7lTlDv0uqWHU/XDA/pybKqm0PeHU/XJc9R7N9FsJenCFLiPpTAPDkJeJyacnQHOwIBlmtxcQ1Frfu9Xp7jY5MAqhlRgAhFlyVBXxGVJxREWzFZQMiy97ldhHFNBkySrYWIsLkVc2YBZDA6ydtdrgYAMm6SP9Hs7qBGDzU0KzQ2uqzj3iWyXUTS3ZJkv2MBwnhq8WicQKqxYbrNBhQNLP7Cy6K3SvaaDhJ9UHDqIjmc3hZwIG9Y0jLAlXAQrdUigtCB7fwZ5EW7zjOzFfFYszcKSWirli6PtNz8Do75YmC3dYs8bQAJoWWOI3BwXu+Fzwkwhy8/wubKz57lmkrn08K4pwTnpmJ5wB2sXRoCkgROPt+0i6tAX6XobFkpW/mzak6pVuW5JUMJM8sFE5xzF2M3gHQEzMP6yYORfLs3jZ/BQ/GI2PY2uwure2kIncD1f+56ABpkygZaFUkkfPRg8YhspthjN5a1DssHOc0gwNnBXYJCK2MNHdMREV/VF2UC9Qa+Q0yerOLo+bYKqwRh1TLfPibe4LCo4NYNoqghJ6DvsNVBSqHO7x7AKQMvHqOewwNi2vd5ivnxu4/SYs72OrAH2gNxOTIQCZEZSNEayzvAVjFN0SCv6aP2jUNlIyH2y4LEN3ZFlBwDcRD30gc/CiM7jtemkEm9xoXbQdUfLMVAZGBNhJ92stTopl2s3WVeHtomvbQjtvbU33jK3YcndW/VgZK9qGD7sPctlfCKw0r16Rl88hq44ePk9psmFywWk//5g0GpenA4eb9InrwdPztAabhVr32Pytlo+d/F436b/fTzGSHzBgxd/dhD2jU+izpjCgWfYMk/WgT0Xp87456TD9//PZg69xibhwXaTvkSasrCjEPZGlz7s2RstzL67TwGLcJKFVJ4xxQUYyeiVz9BhZ9gY7m/IgV4TBnAXXntvC6ngaOCQq2wc77YhUnurS+ztTVwZqoYCyw1SIvpdjC12rw6cmL3cM3HvndHdnvtuBG06YTG5++uvgfB0UltWVHGw9h4I5kRh77GkvvkNsisuh0WzARk0Td3AR8jFXswbAUeDjzNDjZnzqOFyqNm+0pA7qtmbq4AylMI+VM8wkmBUZC3TKS8vmj9/IzF80IN5WKFXP/vJu4+r779ifbj6wSvm3cuOu62F+4tj8NDAlf388qmpWSGbFm9BK8pnMsyT/wHNOf96"
    )
)


def _restore_pre_wsl_approval_state(progress: dict) -> None:
    """Remove the current seq483 approval hold from synthetic historical projections."""
    progress["status"] = "ACTIVE"
    progress["pending_approvals"] = []
    progress["reporting_decision"] = {
        "decision": "AUTO_CONTINUE",
        "reason_codes": ["C21_LR02C_OPERATIONAL_EXECUTION_ACTIVE_AUTO_CONTINUE"],
        "stop_before_dialogue_report": False,
    }
    progress.pop("wsl_readiness_decision", None)

def _b10_acceptance_projection_current() -> bool:
    progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
    if progress.get("event_sequence", 0) > 346:
        return True
    if progress.get("event_sequence") == 346:
        assert progress.get("status") == "TEST_REVIEW" and progress.get("active_agent") is None
        return True
    if progress.get("event_sequence") == 343:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "ACTIVE"
        assert progress.get("active_agent") == "developer-primary-b11"
        assert (progress.get("active_work_instruction") or {}).get("result_status") == "REWORK_IN_PROGRESS"
        assert (progress.get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_B11_ACCEPTANCE"
        return True
    if progress.get("event_sequence") == 339:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "TEST_REVIEW"
        assert progress.get("active_agent") is None
        assert (progress.get("next_work_package") or {}).get("status") == "BLOCKED_PENDING_B11_ACCEPTANCE"
        return True
    if progress.get("event_sequence") == 336:
        assert progress.get("current_work_package") == "B-11"
        assert progress.get("status") == "ACTIVE"
        assert progress.get("active_agent") == "developer-primary-b11"
        assert (progress.get("next_work_package") or {}) == {
            "package_id": "B-12",
            "status": "BLOCKED_PENDING_B11_ACCEPTANCE",
        }
        return True
    if progress.get("event_sequence") != 333:
        return False
    assert progress.get("current_work_package") == "B-11"
    assert progress.get("status") == "READY"
    assert "B-10" in progress.get("completed_packages", [])
    assert progress.get("valid_failure_count") == 0
    assert (progress.get("historical_failure_counts_by_lineage") or {}).get("B-10") == 2
    assert progress.get("active_work_instruction") is None
    assert progress.get("active_agent") is None
    assert progress.get("worker_lease") is None
    assert progress.get("write_lease") is None
    assert (progress.get("next_work_package") or {}) == {"package_id": "B-11", "status": "READY"}
    return True

CHECKER_PATH = ROOT / "scripts" / "check_project_progress.py"
FAILURE_FIXTURE_PATH = ROOT / "tests" / "fixtures" / "g05" / "failure-ledger.json"
ALL_EVENT_FIXTURE_PATH = ROOT / "tests" / "fixtures" / "g05" / "progress-events-all-categories.json"
MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-05_EVIDENCE_MANIFEST.json"
R2_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-05_EVIDENCE_MANIFEST_R2.json"
R2_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-05_TEST_REPORT_R2.md"
G06_R3_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-06_EVIDENCE_MANIFEST_R3.json"
G06_R2_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-06_TEST_REPORT_R2.md"
G07_R2_MANIFEST_PATH = ROOT / "docs" / "evidence" / "manifests" / "G-07_EVIDENCE_MANIFEST_R2.json"
G07_TEST_REPORT_PATH = ROOT / "docs" / "test_reports" / "G-07_TEST_REPORT.md"


def _load_checker_or_none():
    if not CHECKER_PATH.is_file():
        return None
    spec = importlib.util.spec_from_file_location("g05_progress_checker", CHECKER_PATH)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ProjectProgressContractTests(unittest.TestCase):
    def assert_current_b09_start(self, progress):
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("B-10", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("WI-B-10-20260821-003", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertIsNone(progress["active_agent"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["B-09"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_dir1_owner_direction_and_gate_precede_b01_fenced_start(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 185 <= event["sequence"] <= 186]

        self.assert_current_b09_start(progress)
        self.assertIn("A-15", progress["completed_packages"])
        self.assertEqual(
            ["DIR_OWNER_DIRECTION_RECORDED", "PHASE_GATE_DECIDED"],
            [event["event_type"] for event in events],
        )
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertEqual("0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F", manifest["developer_target_hash"])
        self.assertFalse(manifest["self_reference"])
        self.assertEqual("CONTINUE", events[0]["details"]["direction"])
        self.assertEqual("A Gate", events[-1]["subject_ref"])
        self.assertEqual("DIR-1", progress["dir_review"]["checkpoint"])
        self.assertEqual("CLEARED", progress["dir_review"]["status"])
        self.assertEqual(
            "docs/evidence/manifests/B-10_REWORK_COMPLETION_PROGRESS_MANIFEST_R3.json",
            progress["current_progress_evidence_ref"]["manifest_path"],
        )
        self.assertEqual("AUTO_CONTINUE", progress["reporting_decision"]["decision"])
        self.assertFalse(progress["reporting_decision"]["stop_before_dialogue_report"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual("ACCEPTED", progress["phase_gate"]["decision"])
        self.assertFalse(events[-1]["details"]["b01_started"])
        self.assertTrue(progress["phase_gate"]["b01_started"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a14_failure_report_starts_fenced_rework_without_counting_environment_block(self):
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 155 <= event["sequence"] <= 158]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        failure = events[0]["details"]
        self.assertEqual("a14-independent-test:a13-clean-checkout-successor-raw-byte-mismatch-r1", failure["failure_fingerprint"])
        self.assertEqual(["BLK-A14-002"], failure["counted_finding_ids"])
        self.assertEqual(["BLK-A14-001"], failure["environment_blocked_finding_ids"])
        self.assertEqual(1, failure["valid_failure_count"])
        completion = [event for event in bundle["events"]["events"] if 159 <= event["sequence"] <= 161]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion],
        )
        a14_r3_rework = [event for event in bundle["events"]["events"] if 162 <= event["sequence"] <= 165]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in a14_r3_rework],
        )
        self.assertEqual(2, a14_r3_rework[0]["details"]["valid_failure_count"])
        self.assertEqual("D40A0FA0A64CF7FDA8DFBEF5605A3434941464614FD0BB3D3838385B00A30C69", a14_r3_rework[0]["details"]["test_report_ref"]["sha256"])
        self.assertEqual(3, a14_r3_rework[1]["details"]["lease_epoch"])
        self.assertEqual(3, a14_r3_rework[2]["details"]["write_epoch"])
        a14_r3_completion = [event for event in bundle["events"]["events"] if 166 <= event["sequence"] <= 168]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_r3_completion],
        )
        takeover_events = [event for event in bundle["events"]["events"] if 169 <= event["sequence"] <= 171]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in takeover_events],
        )
        self.assertEqual(3, takeover_events[0]["details"]["valid_failure_count"])
        self.assertEqual(
            "MAIN_AGENT_TAKEOVER_REQUIRED",
            takeover_events[0]["details"]["takeover_status"],
        )
        self.assertEqual("main-agent-eoul", takeover_events[1]["details"]["developer_actor"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_COMPLETED", takeover_events[2]["details"]["takeover_status"])
        portability_events = [event for event in bundle["events"]["events"] if 172 <= event["sequence"] <= 174]
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "PACKAGE_RESUMED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in portability_events],
        )
        self.assertEqual(4, portability_events[0]["details"]["valid_failure_count"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_CONTINUED", portability_events[1]["details"]["takeover_status"])
        self.assertEqual("MAIN_AGENT_TAKEOVER_COMPLETED", portability_events[2]["details"]["takeover_status"])
        acceptance = next((event for event in bundle["events"]["events"] if event["sequence"] == 175), None)
        self.assertIsNotNone(acceptance)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("READY_FOR_MAIN_ACCEPTANCE", acceptance["details"]["verdict"])
        completion = [event for event in bundle["events"]["events"] if 190 <= event["sequence"] <= 192]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in completion])
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 241)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("E90448B45A3646E32351C60E17C8FD77F628A1C1D688B42A6481FCEEFCCB59C6", acceptance["details"]["test_report_sha256"])
        rework_manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_detached_progress_binding(bundle))
        self.assertEqual("B-04", rework_manifest["package_id"])

        with tempfile.TemporaryDirectory() as temp:
            clone = Path(temp) / "bundle"
            subprocess.run(
                ["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--local", "--no-hardlinks", str(ROOT), str(clone)],
                check=True,
            )
            for relative in progress["repository"]["exact_allowed_paths"]:
                source = ROOT / relative
                destination = clone / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            clone_bundle = checker.load_bundle(clone)
            clone_manifest = json.loads((clone / "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
            self.assertEqual([], checker.validate_detached_progress_binding(clone_bundle))
            self.assertEqual([], checker.validate_b04_completion_manifest(clone_manifest, clone_bundle))
        self.assertEqual([], checker.validate_bundle(bundle))
    def test_package_specific_detached_progress_ref_is_resolved_safely(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "resolve_detached_digest_path"),
            "package-specific detached digest resolution is not implemented",
        )
        progress = {
            "current_progress_evidence_ref": {
                "package_id": "G-06",
                "path": "docs/progress/progress-handoff-detached-digest-g06.json",
            }
        }
        self.assertEqual(
            checker.resolve_detached_digest_path(progress),
            "docs/progress/progress-handoff-detached-digest-g06.json",
        )
        progress["current_progress_evidence_ref"]["path"] = "../outside.json"
        with self.assertRaises(ValueError):
            checker.resolve_detached_digest_path(progress)

    def test_historical_manifest_validates_its_frozen_rows_not_current_mutable_files(self) -> None:
        checker = self.require_checker()
        manifest = json.loads(
            (ROOT / "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertEqual(checker.validate_historical_manifest_raw_checksums(manifest, ROOT), [])

        mutated = copy.deepcopy(manifest)
        mutated["raw_checksums"][0]["sha256"] = "0" * 64
        errors = checker.validate_historical_manifest_raw_checksums(mutated, ROOT)
        self.assertTrue(any("HISTORICAL_MANIFEST_TARGET_MISMATCH" in error for error in errors))

    @classmethod
    def setUpClass(cls) -> None:
        cls.checker = _load_checker_or_none()

    def require_checker(self):
        if self.checker is None:
            self.skipTest("checker is not implemented yet")
        return self.checker

    def test_00_checker_exists(self) -> None:
        self.assertIsNotNone(
            self.checker,
            "G-05 RED: scripts/check_project_progress.py is not implemented",
        )

    def test_current_progress_handoff_and_registries_are_consistent(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        self.assertEqual(checker.validate_bundle(bundle), [])
        self.assertEqual(
            bundle["progress"]["snapshot_hash"],
            checker.compute_snapshot_hash(bundle["progress"]),
        )

    def test_chapter_15_minimum_fields_and_evidence_identity_are_guarded(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        for field in checker.CHAPTER_15_MINIMUM_FIELDS:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                del mutated["progress"][field]
                self.assertIn("PRG_MINIMUM_FIELD_MISSING", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_refs"].append(
            {
                "path": mutated["progress"]["latest_evidence_refs"][0]["path"],
                "sha256": "F" * 64,
            }
        )
        self.assertIn("PRG_DUPLICATE_EVIDENCE_HASH", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_refs"][0]["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["latest_evidence_manifest_ref"]["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

    def test_git_and_authority_bindings_are_checked_against_workspace(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["repository"]["validated_base_commit"] = "0" * 40
        if bundle["progress"]["event_sequence"] == 715:
            self.assertIn("C01_ACCEPTANCE_GIT_BASE_OR_PRODUCT_INVALID", checker.validate_bundle(mutated))
        else:
            self.assertIn("GIT_VALIDATED_BASE_NOT_ANCESTOR", checker.validate_bundle(mutated))
        # The generic era is independently exercised below by the frozen
        # test_exact_evidence_only_descendant_rejects_each_provenance_violation.

        mutated = copy.deepcopy(bundle)
        instruction = (
            mutated["progress"]["active_work_instruction"]
            or mutated["progress"]["last_accepted_work_instruction"]
        )
        instruction["sha256"] = "0" * 64
        self.assertIn("PRG_REFERENCED_HASH_MISMATCH", checker.validate_bundle(mutated))

    def test_exact_evidence_only_descendant_accepts_committed_and_worktree_states(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "853da76458929e007d8a02ab32f7f918ab26d590"
        head = "f" * 40
        allowed = [
            "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-a01-precondition-acceptance.json",
            "scripts/check_g07_baseline.py",
            "scripts/check_project_progress.py",
            "tests/tooling/test_g07_baseline.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
        }

        self.assertEqual(
            [],
            validate(
                repository,
                actual_head=head,
                actual_branch="main",
                actual_upstream="origin/main",
                actual_remote_head=head,
                base_is_ancestor=True,
                actual_changed_paths=allowed,
                working_tree_mode=False,
            ),
        )
        self.assertEqual(
            [],
            validate(
                repository,
                actual_head=base,
                actual_branch="main",
                actual_upstream="origin/main",
                actual_remote_head=base,
                base_is_ancestor=True,
                actual_changed_paths=allowed,
                working_tree_mode=True,
            ),
        )

    def test_exact_evidence_only_descendant_rejects_each_provenance_violation(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "853da76458929e007d8a02ab32f7f918ab26d590"
        head = "f" * 40
        allowed = ["docs/progress/build-progress.json"]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
        }
        defaults = {
            "actual_head": head,
            "actual_branch": "main",
            "actual_upstream": "origin/main",
            "actual_remote_head": head,
            "base_is_ancestor": True,
            "actual_changed_paths": allowed,
            "working_tree_mode": False,
        }

        product = copy.deepcopy(repository)
        product["exact_allowed_paths"] = ["apps/api/anvil_api/main.py"]
        self.assertIn(
            "GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN",
            validate(product, **{**defaults, "actual_changed_paths": product["exact_allowed_paths"]}),
        )
        for changed in ([], allowed + ["docs/progress/unlisted.json"]):
            with self.subTest(changed=changed):
                self.assertIn(
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                    validate(repository, **{**defaults, "actual_changed_paths": changed}),
                )
        self.assertIn(
            "GIT_VALIDATED_BASE_NOT_ANCESTOR",
            validate(repository, **{**defaults, "base_is_ancestor": False}),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate(repository, **{**defaults, "actual_remote_head": "e" * 40}),
        )

    def test_phase_b_test_review_exact22_descendant_allows_pending_push_only(self) -> None:
        checker = self.require_checker()
        validate = getattr(checker, "validate_repository_projection", None)
        self.assertIsNotNone(validate, "validated-base descendant projection is not implemented")
        base = "165a9bfff5e085bfec322c748e83464477642f8a"
        head = "a" * 40
        allowed = [
            "docs/approvals/APPROVAL-20260821-PHASE-B-GATE-EXACT44-001.md",
            "docs/completion_reports/PHASE_B_GATE_COMPLETION_REPORT.md",
            "docs/evidence/manifests/PHASE_B_GATE_EVIDENCE_MANIFEST.json",
            "docs/evidence/manifests/PHASE_B_GATE_PROGRESS_PROJECTION_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/SESSION_CHECKPOINT_2026-08-21_PHASE_B_GATE.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-phase-b-gate-start.json",
            "docs/test_reports/PHASE_B_GATE_INDEPENDENT_TEST_REPORT.md",
            "docs/validation/PHASE_B_GATE_AUTHORITY_CONFLICT_EVIDENCE.md",
            "docs/validation/PHASE_B_GATE_VALIDATION.md",
            "docs/work_orders/PHASE_B_GATE_INVOCATION_PROMPT.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R2.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_INVOCATION_PROMPT_R3.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R2.md",
            "docs/work_orders/PHASE_B_GATE_REWORK_WORK_INSTRUCTION_R3.md",
            "docs/work_orders/PHASE_B_GATE_WORK_INSTRUCTION.md",
            "scripts/check_phase_b_gate.py",
            "scripts/check_project_progress.py",
            "tests/tooling/test_phase_b_gate.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = {
            "projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            "validated_base_commit": base,
            "head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
            "exact_allowed_paths": allowed,
            "branch": "main",
            "upstream": "origin/main",
            "remote_head": base,
            "push_status": "PUSH_PENDING_MAIN",
        }
        phase_b_progress = {
            "current_work_package": "PHASE_B_GATE",
            "status": "TEST_REVIEW",
            "active_work_instruction": {
                "result_status": "COMPLETED",
                "package_status": "TEST_REVIEW",
                "accepted": False,
            },
        }
        defaults = {
            "actual_head": head,
            "actual_branch": "main",
            "actual_upstream": "origin/main",
            "actual_remote_head": base,
            "base_is_ancestor": True,
            "actual_changed_paths": allowed,
            "working_tree_mode": False,
            "progress": phase_b_progress,
        }

        self.assertEqual([], validate(repository, **defaults))

        product_path = copy.deepcopy(repository)
        product_path["exact_allowed_paths"] = sorted([*allowed, "packages/recovery/service.py"])
        self.assertIn(
            "GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN",
            validate(product_path, **{**defaults, "actual_changed_paths": product_path["exact_allowed_paths"]}),
        )

        accepted = copy.deepcopy(phase_b_progress)
        accepted["active_work_instruction"]["accepted"] = True
        self.assertIn("GIT_DESCENDANT_PRODUCT_PATH_FORBIDDEN", validate(repository, **{**defaults, "progress": accepted}))

    def test_event_sequence_and_complete_event_contract_are_guarded(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        mutated["events"]["events"].append(
            {
                "event_id": "evt_regression",
                "sequence": 1,
                "event_type": "PACKAGE_STARTED",
                "occurred_at": "2026-08-10T16:00:00+09:00",
                "actor": "developer-primary-g05",
                "subject_ref": "G-05",
                "details": {},
            }
        )
        self.assertIn("PRG_EVENT_SEQUENCE_REGRESSION", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["event_contract"]["event_types"].remove("GIT_PUSH")
        self.assertIn("EVENT_CONTRACT_MISSING_TYPE", checker.validate_bundle(mutated))

    def test_handoff_must_match_progress_projection(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        cases = (
            ("event_sequence", 999, "HANDOFF_SEQUENCE_MISMATCH"),
            (
                "status",
                "ACTIVE" if bundle["progress"]["status"] != "ACTIVE" else "READY",
                "HANDOFF_STATUS_MISMATCH",
            ),
            ("next_safe_action", "wrong action", "HANDOFF_NEXT_ACTION_MISMATCH"),
        )
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                mutated["handoff"][field] = value
                self.assertIn(reason, checker.validate_bundle(mutated))

    def test_only_valid_failure_reports_count_and_lineage_is_part_of_key(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        fixture = json.loads(FAILURE_FIXTURE_PATH.read_text(encoding="utf-8"))

        projection = checker.failure_projection(fixture)
        self.assertEqual(projection["lineage-A|same-fingerprint"]["valid_failure_count"], 3)
        self.assertEqual(projection["lineage-A|same-fingerprint"]["takeover_status"], "MAIN_AGENT_TAKEOVER_REQUIRED")
        self.assertEqual(projection["lineage-B|same-fingerprint"]["valid_failure_count"], 1)

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        rejected = next(item for item in mutated["failure_ledger"]["entries"] if item["accepted"] is False)
        rejected["counts_toward_valid_failure"] = True
        self.assertIn("FAILURE_COUNT_INVALID", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        incomplete = next(item for item in mutated["failure_ledger"]["entries"] if item["result_status"] == "INCOMPLETE")
        incomplete["accepted"] = True
        incomplete["counts_toward_valid_failure"] = True
        self.assertIn("FAILURE_COUNT_INVALID", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        mutated["failure_ledger"] = copy.deepcopy(fixture)
        mutated["failure_ledger"]["entries"][-1]["step_lineage_id"] = "lineage-B"
        self.assertIn("TAKEOVER_STATE_INVALID", checker.validate_bundle(mutated))

    def test_nonsemantic_binding_cannot_invent_approval_or_expand_scope(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        cases = (
            ("root_human_approval_id", None, "NSEM_ROOT_APPROVAL_MISSING"),
            ("new_hash", bundle["nonsemantic"]["bindings"][0]["old_hash"], "NSEM_HASH_UNCHANGED"),
            ("derived_scope", ["G-01", "G-02", "G-03"], "NSEM_SCOPE_EXPANSION"),
            ("semantic_diff_classification", "REQUIREMENT_CHANGE", "NSEM_SEMANTIC_DISGUISE"),
        )
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(bundle)
                mutated["nonsemantic"]["bindings"][0][field] = value
                self.assertIn(reason, checker.validate_bundle(mutated))

    def test_dir_hold_and_owner_direction_guards_are_enforced(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        mutated = copy.deepcopy(bundle)
        cleared = mutated["dir_registry"]["checkpoints"][0]
        cleared.update({"status": "CLEARED", "verdict": "ALIGNED", "owner_direction_event_id": None})
        self.assertIn("DIR_DIRECTION_EVENT_REQUIRED", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        held = mutated["dir_registry"]["checkpoints"][0]
        held.update({"status": "DIR_HOLD", "lease_released": False, "blocked_next_action": "B-01"})
        mutated["progress"]["worker_lease"] = {"lease_id": "worker-1"}
        self.assertIn("DIR_HOLD_LEASE_FORBIDDEN", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        checkpoint = mutated["dir_registry"]["checkpoints"][0]
        checkpoint.update({"status": "NOT_REACHED", "verdict": None, "subject_hash": None, "evidence_hash": None, "trigger_event_id": None, "report_event_id": None, "report_ref": None, "blocked_next_action": None})
        mutated["events"]["events"].append(
            {
                "event_id": "evt_a15",
                "sequence": mutated["progress"]["event_sequence"] + 1,
                "event_type": "PACKAGE_COMPLETED",
                "occurred_at": "2026-08-10T16:00:00+09:00",
                "actor": "main-agent-eoul",
                "subject_ref": "A-15",
                "details": {"package_status": "ACCEPTED"},
            }
        )
        mutated["progress"]["event_sequence"] += 1
        mutated["progress"]["last_event_id"] = "evt_a15"
        mutated["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mutated["progress"])
        self.assertIn("DIR_TRIGGER_CHECKPOINT_MISSING", checker.validate_bundle(mutated))

        mutated = copy.deepcopy(bundle)
        dir_x = next(item for item in mutated["dir_registry"]["checkpoints"] if item["checkpoint"] == "DIR-X")
        dir_x["canonical_trigger"] = "UNAPPROVED_TRIGGER"
        self.assertIn("DIRX_TRIGGER_INVALID", checker.validate_bundle(mutated))

    def test_recovery_reporting_decision_stops_only_for_scope_risk_or_dir(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        bundle["progress"]["pending_approvals"] = []
        bundle["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }

        projection = checker.recovery_projection(bundle)
        self.assertEqual(projection["reporting_decision"], "AUTO_CONTINUE")
        self.assertFalse(projection["stop_before_dialogue_report"])

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["reporting_decision"] = {
            "decision": "STOP_AND_REPORT_SCOPE_RISK",
            "reason_codes": ["REQUIREMENT_CHANGE"],
            "stop_before_dialogue_report": True,
        }
        projection = checker.recovery_projection(mutated)
        self.assertEqual(projection["reporting_decision"], "STOP_AND_REPORT_SCOPE_RISK")
        self.assertTrue(projection["stop_before_dialogue_report"])

        mutated["progress"]["reporting_decision"] = {
            "decision": "STOP_AND_REPORT_DIR",
            "reason_codes": ["DIR-1_REACHED"],
            "stop_before_dialogue_report": True,
        }
        projection = checker.recovery_projection(mutated)
        self.assertEqual(projection["reporting_decision"], "STOP_AND_REPORT_DIR")
        self.assertTrue(projection["stop_before_dialogue_report"])

    def test_recovery_cannot_label_scope_risk_or_dir_state_as_routine(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        scope_risk = copy.deepcopy(bundle)
        scope_risk["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
        scope_risk["progress"]["pending_approvals"] = [
            {"approval_id": "pending-risk", "change_classification": "IMPORTANT_RISK_CHANGE"}
        ]
        self.assertIn("RECOVERY_SCOPE_RISK_MUST_STOP", checker.validate_bundle(scope_risk))

        direction_hold = copy.deepcopy(bundle)
        checkpoint = direction_hold["dir_registry"]["checkpoints"][0]
        checkpoint.update(
            {
                "status": "WAITING_OWNER_DIRECTION",
                "verdict": "ALIGNED",
                "trigger_event_id": "evt_dir_1",
                "report_ref": "docs/test_reports/DIR-1_REPORT.md",
                "lease_released": True,
                "blocked_next_action": "A_GATE",
            }
        )
        direction_hold["progress"]["dir_review"]["checkpoint"] = "DIR-1"
        direction_hold["progress"]["dir_review"]["status"] = "WAITING_OWNER_DIRECTION"
        direction_hold["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
        self.assertIn("RECOVERY_DIR_MUST_STOP", checker.validate_bundle(direction_hold))

    def test_cli_returns_stable_reason_code_and_nonzero_on_invalid_bundle(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            for relative in checker.BUNDLE_PATHS.values():
                source = ROOT / relative
                destination = temp_root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            progress_path = temp_root / checker.BUNDLE_PATHS["progress"]
            progress = json.loads(progress_path.read_text(encoding="utf-8"))
            extra_paths = {
                checker.resolve_detached_digest_path(progress),
                progress["current_progress_evidence_ref"]["manifest_path"],
                "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json",
                "docs/evidence/manifests/GIT_EOL_PORTABILITY_R1.json",
            }
            current_manifest = json.loads(
                (ROOT / progress["current_progress_evidence_ref"]["manifest_path"]).read_text(encoding="utf-8")
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("a13_successor_projection", {}).get("live_raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
            extra_paths.update(
                row["path"] for row in current_manifest.get("a14_server_successor_projection", {}).get("live_raw_checksums", [])
                if isinstance(row, dict) and isinstance(row.get("path"), str)
            )
            for relative in extra_paths:
                source = ROOT / relative
                destination = temp_root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            del progress["next_safe_action"]
            progress_path.write_text(json.dumps(progress, ensure_ascii=False, indent=2), encoding="utf-8")

            result = subprocess.run(
                [sys.executable, str(CHECKER_PATH), str(temp_root)],
                capture_output=True,
                check=False,
                text=True,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("PRG_MINIMUM_FIELD_MISSING", result.stdout)

    def test_schema_files_are_draft_2020_12_and_registered(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        self.assertEqual(checker.validate_schema_catalog(bundle["schema_catalog"], ROOT), [])
        self.assertEqual(len(bundle["schema_catalog"]["schemas"]), 6)

    def test_detached_digest_binds_current_progress_and_handoff_into_manifest_target(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / bundle["progress"]["current_progress_evidence_ref"]["manifest_path"]
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertTrue(hasattr(checker, "validate_detached_progress_binding"))
        self.assertTrue(hasattr(checker, "validate_manifest_progress_binding"))

        self.assertEqual(checker.validate_detached_progress_binding(bundle), [])
        self.assertEqual(checker.validate_manifest_progress_binding(manifest, bundle), [])

        mutated = copy.deepcopy(bundle)
        mutated["progress"]["next_safe_action"] = "tampered after verification"
        mutated["handoff"]["next_safe_action"] = "tampered after verification"
        mutated["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mutated["progress"])
        self.assertIn("DETACHED_DIGEST_MISMATCH", checker.validate_bundle(mutated))

    def test_a01_acceptance_manifest_remains_historical_and_self_reference_free(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_ACCEPTANCE_MANIFEST.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

        self.assertEqual(
            "B94B1E8294C040C43250A90F6F44A239027F323FDA3D2F08C78A5FA6F91AD09D",
            hashlib.sha256(manifest_path.read_bytes()).hexdigest().upper(),
        )
        self.assertFalse(manifest["self_reference"])
        self.assertEqual([], checker.validate_historical_manifest_raw_checksums(manifest, bundle["_root"]))

    def test_failure_evidence_is_real_and_projection_matches_progress(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)

        forged = copy.deepcopy(bundle)
        forged["failure_ledger"]["entries"].append(
            {
                "entry_id": "forged-failure",
                "step_lineage_id": "G-05",
                "failure_fingerprint": "forged",
                "result_status": "FAILURE_REPORT",
                "accepted": True,
                "counts_toward_valid_failure": True,
                "validator_acceptance": True,
                "evidence_refs": [
                    {"path": "docs/evidence/does-not-exist.json", "sha256": "0" * 64}
                ],
                "accepted_sequence": 1,
                "takeover_status": "NOT_REQUIRED",
            }
        )
        self.assertIn("FAILURE_EVIDENCE_MISSING", checker.validate_bundle(forged))

        mismatched = copy.deepcopy(bundle)
        mismatched["progress"]["valid_failure_count"] += 1
        mismatched["handoff"]["valid_failure_count"] += 1
        mismatched["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(mismatched["progress"])
        self.assertIn("FAILURE_PROJECTION_MISMATCH", checker.validate_bundle(mismatched))

    def test_nonsemantic_binding_uses_real_approval_subject_and_scope(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        binding = bundle["nonsemantic"]["bindings"][0]

        binding["root_human_approval_id"] = "APPROVAL-DOES-NOT-EXIST"
        binding["root_approval_subject_hash"] = "0" * 64
        binding["root_approval_scope"] = "UNBOUNDED"
        binding["derived_scope"] = ["UNBOUNDED"]

        self.assertIn("NSEM_APPROVAL_ARTIFACT_INVALID", checker.validate_bundle(bundle))

    def test_dir_cleared_requires_real_owner_direction_event_chain(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        checkpoint = bundle["dir_registry"]["checkpoints"][0]
        checkpoint.update(
            {
                "status": "CLEARED",
                "verdict": "ALIGNED",
                "subject_hash": "A" * 64,
                "trigger_event_id": "evt-does-not-exist-trigger",
                "report_event_id": "evt-does-not-exist-report",
                "report_ref": "docs/test_reports/DIR-1_REPORT.md",
                "owner_direction_event_id": "evt-does-not-exist-direction",
            }
        )

        self.assertIn("DIR_DIRECTION_EVENT_INVALID", checker.validate_bundle(bundle))

    def test_scope_expansion_required_normalizes_to_stop_and_report(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        self.assertTrue(hasattr(checker, "normalize_change_classification"))
        bundle["progress"]["reporting_decision"] = {
            "decision": "AUTO_CONTINUE",
            "reason_codes": ["APPROVED_PLAN_ROUTINE_PROGRESS"],
            "stop_before_dialogue_report": False,
        }
        bundle["progress"]["pending_approvals"] = [
            {
                "approval_id": "scope-expansion",
                "change_classification": "SCOPE_EXPANSION_REQUIRED",
            }
        ]
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])

        self.assertEqual(
            checker.normalize_change_classification("SCOPE_EXPANSION_REQUIRED"),
            "FUNCTION_SCOPE_CHANGE",
        )
        self.assertIn("RECOVERY_SCOPE_RISK_MUST_STOP", checker.validate_bundle(bundle))

    def test_event_payload_effects_and_all_categories_fixture_are_enforced(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        self.assertTrue(hasattr(checker, "validate_event_stream"))
        self.assertTrue(
            ALL_EVENT_FIXTURE_PATH.is_file(),
            "G05-DEF-006 RED: all-category event fixture is missing",
        )
        fixture = json.loads(ALL_EVENT_FIXTURE_PATH.read_text(encoding="utf-8"))

        self.assertEqual(
            checker.validate_event_stream(fixture, bundle["event_contract"]),
            [],
        )
        self.assertEqual(
            {event["event_type"] for event in fixture["events"]},
            set(bundle["event_contract"]["event_types"]),
        )

        empty_push = copy.deepcopy(bundle)
        empty_push["events"]["events"].append(
            {
                "event_id": "evt-empty-git-push",
                "sequence": empty_push["progress"]["event_sequence"] + 1,
                "event_type": "GIT_PUSH",
                "occurred_at": "2026-08-10T17:00:00+09:00",
                "actor": "main-agent-eoul",
                "subject_ref": "main",
                "details": {},
            }
        )
        empty_push["events"]["last_sequence"] += 1
        empty_push["progress"]["event_sequence"] += 1
        empty_push["progress"]["last_event_id"] = "evt-empty-git-push"
        empty_push["handoff"]["event_sequence"] += 1
        empty_push["handoff"]["last_event_id"] = "evt-empty-git-push"
        empty_push["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(empty_push["progress"])
        self.assertIn("EVENT_PAYLOAD_MISSING", checker.validate_bundle(empty_push))

        bad_effect = copy.deepcopy(empty_push)
        bad_effect["events"]["events"][-1]["details"] = {
            "remote": "origin",
            "branch": "main",
            "local_commit": "1" * 40,
            "remote_commit": "1" * 40,
            "evidence_ref": {"path": "docs/test_reports/G-05_TEST_REPORT.md", "sha256": "CB03A995BF654964623737C5A347DCBD21ED62BF1268E5A53F5867516C32C26E"},
        }
        self.assertIn("EVENT_EFFECT_MISMATCH", checker.validate_bundle(bad_effect))

    def test_repository_reconciliation_supersedes_historical_push_projection(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        local_head = "1" * 40
        remote_head = "2" * 40
        bundle["progress"]["repository"].update(
            {
                "branch": "main",
                "local_head": local_head,
                "upstream": "origin/main",
                "remote_head": remote_head,
            }
        )
        for field in (
            "projection_mode",
            "validated_base_commit",
            "head_relation",
            "exact_allowed_paths",
        ):
            bundle["progress"]["repository"].pop(field, None)
        next_sequence = bundle["events"]["last_sequence"] + 1
        bundle["events"]["events"].append(
            {
                "event_id": "evt-test-repository-reconciled",
                "sequence": next_sequence,
                "event_type": "REPOSITORY_RECONCILED",
                "occurred_at": "2026-08-10T23:59:00+09:00",
                "actor": "developer-primary",
                "subject_ref": "A-01",
                "details": {
                    "branch": "main",
                    "local_head": local_head,
                    "remote_head": remote_head,
                    "upstream": "origin/main",
                    "observed_at": "2026-08-10T23:59:00+09:00",
                    "reason": "project the observed repository state without rewriting prior push history",
                },
            }
        )
        bundle["events"]["last_sequence"] = next_sequence

        errors = checker.validate_event_stream(
            bundle["events"], bundle["event_contract"], bundle["progress"]
        )

        self.assertNotIn("EVENT_EFFECT_MISMATCH", errors)

    def test_historical_git_push_rejects_corrupt_evidence_reference(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical_push = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "GIT_PUSH"
        )
        historical_push["details"]["evidence_ref"] = "corrupt"

        errors = checker.validate_event_stream(
            bundle["events"], bundle["event_contract"], bundle["progress"]
        )

        self.assertIn("EVENT_PAYLOAD_MISSING", errors)

    def test_phase_g_checkpoint_push_projects_a01_ready_without_active_instruction(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        a01_reconciliation_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_responsibility_baseline_reconciled"
        )
        gate_checkpoint_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "GIT_PUSH" and event["subject_ref"] == "PHASE_G_GATE"
        )
        g06_acceptance = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "MAIN_PACKAGE_ACCEPTED" and event["subject_ref"] == "G-06"
        )
        g07_acceptance = next(
            event
            for event in bundle["events"]["events"]
            if event["event_type"] == "MAIN_PACKAGE_ACCEPTED" and event["subject_ref"] == "G-07"
        )
        a01_start = next(
            event for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_package_started"
        )

        self.assertIn("G-06", progress["completed_packages"])
        self.assertIn("G-07", progress["completed_packages"])
        self.assertIn("PHASE_G_GATE", progress["completed_packages"])
        self.assertEqual("WI-A-01-20260811-001", a01_start["details"]["work_instruction_id"])
        self.assertEqual(g06_acceptance["details"]["next_work_package"], "G-07")
        self.assertEqual(g06_acceptance["details"]["test_report_sha256"], "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertEqual(g07_acceptance["details"]["test_report_sha256"], hashlib.sha256(G07_TEST_REPORT_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["manifest_sha256"], hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper())
        self.assertEqual(g07_acceptance["details"]["next_work_package"], "PHASE_G_GATE")
        self.assertEqual(gate_checkpoint_event["details"]["checkpoint_status"], "CLEARED")
        self.assertTrue(gate_checkpoint_event["details"]["a01_start_allowed"])
        self.assertEqual(gate_checkpoint_event["details"]["remote_commit"], "5ca9c1f65a5909e75283b878764509d747d6d2cf")
        self.assertEqual(a01_reconciliation_event["event_type"], "REPOSITORY_RECONCILED")
        self.assertEqual(a01_reconciliation_event["subject_ref"], "A-01")
        self.assertEqual(a01_reconciliation_event["details"]["projection_status"], "PUSH_PENDING_MAIN")
        self.assertTrue(G06_R3_MANIFEST_PATH.is_file())
        r3_hash = hashlib.sha256(G06_R3_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        self.assertEqual(r3_hash, "1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0")
        g07_r2_hash = hashlib.sha256(G07_R2_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        a01_manifest_path = ROOT / "docs/evidence/manifests/A-01_EVIDENCE_MANIFEST_R2.json"
        self.assertEqual(hashlib.sha256(a01_manifest_path.read_bytes()).hexdigest().upper(), "BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4")
        self.assertEqual(progress["phase_gate"]["checkpoint_status"], "CLEARED_AND_DECIDED")
        self.assertTrue(progress["phase_gate"]["b01_start_allowed"])
        self.assertTrue(progress["phase_gate"]["b01_started"])
        self.assertEqual(hashlib.sha256(G06_R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(), "436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546")
        self.assertIn("MAIN_PACKAGE_ACCEPTED", bundle["event_contract"]["event_types"])

    def test_a01_post_push_materialization_projects_current_ready_checkpoint(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        post_push_event = next(
            event
            for event in bundle["events"]["events"]
            if event["event_id"] == "evt_a01_responsibility_successor_push_confirmed"
        )
        self.assertEqual("GIT_PUSH", post_push_event["event_type"])
        self.assertEqual("A-01", post_push_event["subject_ref"])
        self.assertEqual(post_push_event["details"]["local_commit"], post_push_event["details"]["remote_commit"])
        self.assertEqual("PUSH_CONFIRMED", post_push_event["details"]["checkpoint_status"])
        self.assertEqual("READY", post_push_event["details"]["package_status"])
        self.assertEqual(
            "BASELINE-A-01-PRECONDITION-DERIVED-20260810-001",
            progress["derived_baseline_binding"]["baseline_id"],
        )
        proposal_path = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_EVIDENCE_MANIFEST.json"
        self.assertEqual(
            "A308F7907C10E0E0D67B598674CFBA50ADC34B2F068679EBCD186C75BF786EAC",
            hashlib.sha256(proposal_path.read_bytes()).hexdigest().upper(),
        )
        post_push_digest = ROOT / "docs/progress/progress-handoff-detached-digest-a01-post-push.json"
        self.assertEqual(
            "10B9648576F6FDE790EB382DCB6FA2DE5732B558A4C12C03C08D03BC276A2079",
            hashlib.sha256(post_push_digest.read_bytes()).hexdigest().upper(),
        )

    def test_task4_acceptance_projects_ready_for_a01_work_instruction(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        acceptance_event = next(event for event in bundle["events"]["events"] if event["sequence"] == 30)
        a02_start_event = next(event for event in bundle["events"]["events"] if event["sequence"] == 46)

        self.assertEqual("REPOSITORY_RECONCILED", acceptance_event["event_type"])
        self.assertEqual("A-01", acceptance_event["subject_ref"])
        self.assertEqual("A01_PRECONDITION_ACCEPTED", acceptance_event["details"]["checkpoint_status"])
        self.assertEqual("ACCEPTED", acceptance_event["details"]["precondition_status"])
        self.assertEqual("READY_FOR_A01_WI", acceptance_event["details"]["readiness"])
        self.assertEqual(
            "9555428AF1FA22C05A74010849564F3DA6160DAD9C1C736DBE5E0B3EBD998369",
            acceptance_event["details"]["task4_test_report_ref"]["sha256"],
        )
        self.assertEqual(
            "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
            a02_start_event["details"]["projection_mode"],
        )
        self.assertEqual(
            "1ace56384d55cbe11d34f2532e9f602d389a9512",
            a02_start_event["details"]["validated_base_commit"],
        )
        self.assertEqual("PACKAGE_STARTED", a02_start_event["event_type"])
        self.assertEqual(
            "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT", a02_start_event["details"]["head_relation"]
        )
        self.assertEqual(
            "WI-A-02-20260811-001", a02_start_event["details"]["work_instruction_id"]
        )
        self.assertEqual("ACCEPTED", progress["a01_precondition"]["status"])
        self.assertEqual("READY_FOR_A01_WI", progress["a01_precondition"]["readiness"])
        self.assertIn("AV-FLOW-001", progress["a01_precondition"]["runtime_deferred"])
        self.assertEqual("worker-lease-a02-20260811-001", a02_start_event["details"]["worker_lease_id"])
        self.assertEqual("write-lease-a02-20260811-001", a02_start_event["details"]["write_lease_id"])
        self.assertEqual(
            "BASELINE-A-01-PRECONDITION-DERIVED-20260810-001",
            progress["derived_baseline_binding"]["baseline_id"],
        )
        start_digest = ROOT / "docs/progress/progress-handoff-detached-digest-a02-start.json"
        start_manifest = ROOT / "docs/evidence/manifests/A-02_START_EVIDENCE_MANIFEST.json"
        self.assertEqual("B14D96D1D3A6BEB083D2B71C92D03CB6E146D4CE096452FA4B71D62C3556977C", hashlib.sha256(start_digest.read_bytes()).hexdigest().upper())
        self.assertEqual("04DCD12BD4E4CA93FE5939A8BAC02BF954684D750D2A0812C70478859FB0D8BB", hashlib.sha256(start_manifest.read_bytes()).hexdigest().upper())
        prior_manifest = ROOT / "docs/evidence/manifests/A-01_PRECONDITION_TEST_ENTRY_MANIFEST.json"
        self.assertEqual(
            "388F117408CF41F0889C7362807A17289AF2FA73DC3159777B0DEA8827216791",
            hashlib.sha256(prior_manifest.read_bytes()).hexdigest().upper(),
        )

    def test_g05_historical_acceptance_chain_remains_immutable(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

        self.assertTrue(R2_MANIFEST_PATH.is_file())
        r2_file_hash = hashlib.sha256(R2_MANIFEST_PATH.read_bytes()).hexdigest().upper()
        self.assertEqual(
            r2_file_hash,
            "F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6",
        )
        self.assertEqual(manifest["supersedes_artifact_ref"]["path"], "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json")
        self.assertEqual(manifest["supersedes_artifact_ref"]["file_sha256"], r2_file_hash)
        self.assertNotEqual(
            bundle["progress"]["latest_evidence_manifest_ref"]["path"],
            "docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json",
        )
        self.assertEqual(
            hashlib.sha256(R2_TEST_REPORT_PATH.read_bytes()).hexdigest().upper(),
            "ED0F03496060C84D67DE84C0758611610CD753CF8D854216F9933089F07C758C",
        )

    def test_a02_start_projection_binds_instruction_leases_and_detached_digest(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        events = bundle["events"]["events"]
        start_events = [event for event in events if 44 <= event["sequence"] <= 46]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual([44, 45, 46], [event["sequence"] for event in start_events])
        self.assertEqual("WI-A-02-20260811-001", start_events[-1]["details"]["work_instruction_id"])

    def test_a02_revision2_main_acceptance_projects_a03_ready(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]

        acceptance = next(event for event in events if event["sequence"] == 57)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-02", acceptance["subject_ref"])
        self.assertEqual("A-03", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])

    def test_a03_start_projection_binds_clean_dispatch_and_fencing(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]
        start_events = [event for event in events if 58 <= event["sequence"] <= 60]

        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual("A-03", start_events[-1]["subject_ref"])
        self.assertEqual("ACTIVE", start_events[-1]["details"]["package_status"])
        self.assertEqual("WI-A-03-20260811-001", start_events[-1]["details"]["work_instruction_id"])
        self.assertEqual("worker-lease-a03-20260811-001", start_events[0]["details"]["lease_id"])
        self.assertEqual("write-lease-a03-20260811-001", start_events[1]["details"]["lease_id"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        self.assertEqual("39af6aa58670f8ed1eb72fb4b5e4b13e9abb6599", start_events[-1]["details"]["dispatch_head"])
        self.assertEqual(start_events[-1]["details"]["dispatch_head"], start_events[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a03_completion_projection_revokes_leases_before_test_review(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = bundle["events"]["events"]
        completion_events = [event for event in events if 61 <= event["sequence"] <= 63]

        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed["package_status"])
        self.assertEqual("COMPLETED", completed["result_status"])
        self.assertFalse(completed["accepted"])
        self.assertEqual("PENDING", completed["independent_tester_status"])
        self.assertIsNone(completed["worker_lease"])
        self.assertIsNone(completed["write_lease"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_a07_completion_enters_test_review_after_ordered_revocation(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        start_events = [event for event in bundle["events"]["events"] if 64 <= event["sequence"] <= 67]

        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(2, start_events[1]["details"]["lease_epoch"])
        self.assertEqual(2, start_events[2]["details"]["write_epoch"])
        self.assertEqual(start_events[1]["details"]["lease_id"], start_events[2]["details"]["worker_lease_id"])
        self.assertEqual("REWORK_IN_PROGRESS", start_events[-1]["details"]["result_status"])

        events = [event for event in bundle["events"]["events"] if 68 <= event["sequence"] <= 70]

        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("TEST_REVIEW", events[-1]["details"]["package_status"])
        acceptance_events = [event for event in bundle["events"]["events"] if event["sequence"] == 71]
        self.assertEqual(1, len(acceptance_events))
        acceptance = acceptance_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        start_events = [event for event in bundle["events"]["events"] if 72 <= event["sequence"] <= 74]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        completion_events = [event for event in bundle["events"]["events"] if 75 <= event["sequence"] <= 77]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        a04_completed = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", a04_completed["package_status"])
        self.assertEqual("COMPLETED", a04_completed["result_status"])
        self.assertFalse(a04_completed["accepted"])
        self.assertEqual("PENDING", a04_completed["independent_tester_status"])
        self.assertIsNone(a04_completed["worker_lease"])
        self.assertIsNone(a04_completed["write_lease"])
        self.assertEqual("BLOCKED_PENDING_A04_ACCEPTANCE", a04_completed["next_package_status"])
        self.assertEqual("C44A699D237C35FDE28E4EEE9E033F1B35CDFC3839967698CDCD6C5A759AA0EB", a04_completed["developer_manifest_ref"]["sha256"])
        self.assertEqual("D2ED622DD179611026D8B396392C84EB5A373986C7733D0ADA78C897D049464E", a04_completed["developer_target_hash"])
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 78)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-04", acceptance["subject_ref"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("A-05", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual("TEST_REVIEW", acceptance["details"]["prior_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", acceptance["details"]["canonical_l7"])
        start_events = [event for event in bundle["events"]["events"] if 79 <= event["sequence"] <= 81]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        completion_events = [event for event in bundle["events"]["events"] if 82 <= event["sequence"] <= 84]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a05 = completion_events[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a05["package_status"])
        self.assertEqual("COMPLETED", completed_a05["result_status"])
        self.assertFalse(completed_a05["accepted"])
        self.assertEqual("PENDING", completed_a05["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A05_ACCEPTANCE", completed_a05["next_package_status"])
        self.assertEqual("90C6AA195FC1DB6AB48D02B4A6403BBE242488177045F393C05E17EAF76085F1", completed_a05["developer_manifest_ref"]["sha256"])
        self.assertEqual("974045F91F01FFDD342099BAA6CC2788C525FE8D74C7C8F5D0BDD31679E22266", completed_a05["developer_target_hash"])
        accepted = next(event for event in bundle["events"]["events"] if event["sequence"] == 85)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted["event_type"])
        self.assertEqual("A-05", accepted["subject_ref"])
        self.assertEqual("ACCEPTED", accepted["details"]["decision"])
        self.assertEqual(0, accepted["details"]["blocking_findings"])
        self.assertEqual("A-06", accepted["details"]["next_work_package"])
        start_events = [event for event in bundle["events"]["events"] if 86 <= event["sequence"] <= 88]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in start_events])
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        completion_events = [event for event in bundle["events"]["events"] if 89 <= event["sequence"] <= 91]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a06 = completion_events[-1]["details"]
        self.assertEqual("COMPLETED", completed_a06["result_status"])
        self.assertEqual("TEST_REVIEW", completed_a06["package_status"])
        self.assertFalse(completed_a06["accepted"])
        self.assertEqual("PENDING", completed_a06["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A06_ACCEPTANCE", completed_a06["next_package_status"])
        self.assertEqual(
            "A6F2B8B2E866A4F4AF6E2BAD8BAA2D005217071E263BA52FE63F35C935844449",
            completed_a06["developer_manifest_ref"]["sha256"],
        )
        self.assertEqual(
            "0CCF57584738B6CF38949D959297AF0877DC084070C352F7944C85AA0AF91258",
            completed_a06["developer_target_hash"],
        )
        acceptance = next(event for event in bundle["events"]["events"] if event["sequence"] == 92)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", acceptance["event_type"])
        self.assertEqual("A-06", acceptance["subject_ref"])
        self.assertEqual("ACCEPTED", acceptance["details"]["decision"])
        self.assertEqual(0, acceptance["details"]["blocking_findings"])
        self.assertEqual("A-07", acceptance["details"]["next_work_package"])
        self.assertEqual("READY", acceptance["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", acceptance["details"]["canonical_l7"])
        start_events = [event for event in bundle["events"]["events"] if 93 <= event["sequence"] <= 95]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in start_events],
        )
        self.assertEqual(1, start_events[0]["details"]["lease_epoch"])
        self.assertEqual(1, start_events[1]["details"]["write_epoch"])
        self.assertEqual(start_events[0]["details"]["lease_id"], start_events[1]["details"]["worker_lease_id"])
        completion_events = [event for event in bundle["events"]["events"] if 96 <= event["sequence"] <= 98]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in completion_events],
        )
        completed_a07 = completion_events[-1]["details"]
        self.assertEqual("COMPLETED", completed_a07["result_status"])
        self.assertEqual("TEST_REVIEW", completed_a07["package_status"])
        self.assertFalse(completed_a07["accepted"])
        self.assertEqual("PENDING", completed_a07["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A07_ACCEPTANCE", completed_a07["next_package_status"])
        self.assertEqual("796B40512FBB0D6EAA596409B3464190455E772246FF361F6EC056D701DEA3E7", completed_a07["developer_manifest_ref"]["sha256"])
        self.assertEqual("45633F09FF8690D56499B75C813D6F5000FF4EB0323742CB6C1AF820396ECB9B", completed_a07["developer_target_hash"])
        self.assertEqual("NOT_EXECUTED", completed_a07["dir_status"])
        accepted_a07 = next(event for event in bundle["events"]["events"] if event["sequence"] == 99)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a07["event_type"])
        self.assertEqual("A-07", accepted_a07["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a07["details"]["decision"])
        self.assertEqual(0, accepted_a07["details"]["blocking_findings"])
        self.assertEqual("A5352696B24E95FE8BD86E845AD8B4A0171C805B7521F21F3543461A8C628506", accepted_a07["details"]["test_report_sha256"])
        self.assertEqual("A-08", accepted_a07["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a07["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", accepted_a07["details"]["canonical_l4"])
        self.assertEqual("NOT_EXECUTED", accepted_a07["details"]["dir_status"])
        a08_start = [event for event in bundle["events"]["events"] if 100 <= event["sequence"] <= 102]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a08_start],
        )
        self.assertEqual(1, a08_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a08_start[1]["details"]["write_epoch"])
        self.assertEqual(a08_start[0]["details"]["lease_id"], a08_start[1]["details"]["worker_lease_id"])
        self.assertEqual("79495e6d0d7da3530f99bb81d5b713ad0b3aebbf", a08_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a08_start[-1]["details"]["dispatch_head"], a08_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a08_start[-1]["details"]["dispatch_worktree_status"])
        a08_completion = [event for event in bundle["events"]["events"] if 103 <= event["sequence"] <= 105]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a08_completion],
        )
        completed_a08 = a08_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a08["package_status"])
        self.assertEqual("COMPLETED", completed_a08["result_status"])
        self.assertFalse(completed_a08["accepted"])
        self.assertEqual("PENDING", completed_a08["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A08_ACCEPTANCE", completed_a08["next_package_status"])
        self.assertEqual("73CC3936D3AF55674412C746B1CB95D53F08B3C8BDA927765286F3E60BE6C9A5", completed_a08["developer_manifest_ref"]["sha256"])
        self.assertEqual("0C10A4F557B2AAF6D90B5BA8C9320CFD694B4DCBF42C9FF3495E3B5D431DE52C", completed_a08["developer_target_hash"])
        self.assertEqual("NOT_EXECUTED", completed_a08["actual_product_validation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a08["actual_release_status"])
        self.assertEqual("NOT_EXECUTED", completed_a08["dir_status"])
        accepted_a08_events = [event for event in bundle["events"]["events"] if event["sequence"] == 106]
        self.assertEqual(1, len(accepted_a08_events))
        accepted_a08 = accepted_a08_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a08["event_type"])
        self.assertEqual("A-08", accepted_a08["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a08["details"]["decision"])
        self.assertEqual(0, accepted_a08["details"]["blocking_findings"])
        self.assertEqual("74D97BB4CBA10151918EDBB49C859936FF2AB3835CAA60986BAFF5B21FFF155A", accepted_a08["details"]["test_report_sha256"])
        self.assertEqual("A-09", accepted_a08["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a08["details"]["next_package_status"])
        self.assertEqual("RUNTIME_DEFERRED / NOT_EXECUTED", accepted_a08["details"]["canonical_l4"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["actual_product_validation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["actual_release_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a08["details"]["dir_status"])
        a09_start = [event for event in bundle["events"]["events"] if 107 <= event["sequence"] <= 109]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a09_start],
        )
        self.assertEqual(1, a09_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a09_start[1]["details"]["write_epoch"])
        self.assertEqual(a09_start[0]["details"]["lease_id"], a09_start[1]["details"]["worker_lease_id"])
        self.assertEqual("1bed9e88d962bebe9e4f6ad806b67d92c027fdcf", a09_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a09_start[-1]["details"]["dispatch_head"], a09_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a09_start[-1]["details"]["dispatch_worktree_status"])
        self.assertIn("A-03", progress["completed_packages"])
        self.assertIn("A-04", progress["completed_packages"])
        self.assertIn("A-06", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertEqual(0, progress["historical_failure_counts_by_lineage"].get("A-04", 0))
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["A-03"])
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["A-13"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["A-14"])
        a09_completion = [event for event in bundle["events"]["events"] if 110 <= event["sequence"] <= 112]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a09_completion],
        )
        completed_a09 = a09_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a09["package_status"])
        self.assertEqual("COMPLETED", completed_a09["result_status"])
        self.assertFalse(completed_a09["accepted"])
        self.assertEqual("PENDING", completed_a09["independent_tester_status"])
        self.assertEqual("A917008E376E34F51BFADE8E74FE1B6E065D7FDBAC79C748D3DC0424A4E23EA3", completed_a09["developer_manifest_ref"]["sha256"])
        self.assertEqual("915B377C6390405664E8A2685DC502A65FE6305D8F327C80A46EFF457C4D4AA3", completed_a09["developer_target_hash"])
        self.assertEqual("A-10", completed_a09["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A09_ACCEPTANCE", completed_a09["next_package_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_skill_activation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_hook_activation_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["actual_runtime_status"])
        self.assertEqual("NOT_EXECUTED", completed_a09["dir_status"])
        accepted_a09 = next(event for event in bundle["events"]["events"] if event["sequence"] == 113)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a09["event_type"])
        self.assertEqual("A-09", accepted_a09["subject_ref"])
        self.assertEqual("ACCEPTED", accepted_a09["details"]["decision"])
        self.assertEqual(0, accepted_a09["details"]["blocking_findings"])
        self.assertEqual("99F0B25764286668F709D221BE294D1A1F21BA2638EDAF5F0A4D5D7909DCF98F", accepted_a09["details"]["test_report_sha256"])
        self.assertEqual("A-10", accepted_a09["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a09["details"]["next_package_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_skill_activation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_hook_activation_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["actual_runtime_status"])
        self.assertEqual("NOT_EXECUTED", accepted_a09["details"]["dir_status"])
        self.assertIn("A-09", progress["completed_packages"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        a10_start = [event for event in bundle["events"]["events"] if 114 <= event["sequence"] <= 116]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a10_start],
        )
        self.assertEqual(1, a10_start[0]["details"]["lease_epoch"])
        self.assertEqual(1, a10_start[1]["details"]["write_epoch"])
        self.assertEqual(a10_start[0]["details"]["lease_id"], a10_start[1]["details"]["worker_lease_id"])
        self.assertEqual("0278141b9af2f94833f21997dddec52a5102fb3e", a10_start[-1]["details"]["dispatch_head"])
        self.assertEqual(a10_start[-1]["details"]["dispatch_head"], a10_start[-1]["details"]["dispatch_upstream_head"])
        self.assertEqual("CLEAN", a10_start[-1]["details"]["dispatch_worktree_status"])
        a10_completion = [event for event in bundle["events"]["events"] if 117 <= event["sequence"] <= 119]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a10_completion],
        )
        completed_a10 = a10_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a10["package_status"])
        self.assertEqual("COMPLETED", completed_a10["result_status"])
        self.assertFalse(completed_a10["accepted"])
        self.assertEqual("PENDING", completed_a10["independent_tester_status"])
        self.assertEqual("C9667081B8BEA555C32F8833D7F28BCF3528882324814CCE08CAAEAA27DE6A84", completed_a10["developer_manifest_ref"]["sha256"])
        self.assertEqual("C179BA2371401BB57CAA02B5148D96A58B094092BE52088E85C6BA9882CFA64A", completed_a10["developer_target_hash"])
        self.assertEqual("A-11", completed_a10["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A10_ACCEPTANCE", completed_a10["next_package_status"])
        for field in ("actual_provider_status", "actual_secret_status", "actual_egress_status", "actual_api_status", "actual_db_status", "actual_event_status", "actual_browser_status", "actual_network_status", "actual_runtime_status", "dir_status"):
            self.assertEqual("NOT_EXECUTED", completed_a10[field])
        accepted_a10 = next(event for event in bundle["events"]["events"] if event["sequence"] == 120)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a10["event_type"])
        self.assertEqual("ACCEPTED", accepted_a10["details"]["decision"])
        self.assertEqual(0, accepted_a10["details"]["blocking_findings"])
        self.assertEqual("B1B51F68561805B3C12355D6A7A939063EA1AB77EF45553C22E036F4D1682045", accepted_a10["details"]["test_report_sha256"])
        self.assertEqual("A-11", accepted_a10["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a10["details"]["next_package_status"])
        for field in ("actual_provider_status", "actual_secret_status", "actual_egress_status", "actual_api_status", "actual_db_status", "actual_event_status", "actual_browser_status", "actual_network_status", "actual_runtime_status", "dir_status"):
            self.assertEqual("NOT_EXECUTED", accepted_a10["details"][field])
        a11_start = [event for event in bundle["events"]["events"] if 121 <= event["sequence"] <= 123]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a11_start],
        )
        a11_completion = [event for event in bundle["events"]["events"] if 124 <= event["sequence"] <= 126]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a11_completion])
        completed_a11 = a11_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a11["package_status"])
        self.assertEqual("COMPLETED", completed_a11["result_status"])
        self.assertFalse(completed_a11["accepted"])
        self.assertEqual("PENDING", completed_a11["independent_tester_status"])
        self.assertEqual("23280C4FD8EA6C3FCEF814D8D429A4BA45FA0BE940E88E8237008B60FDBADFC0", completed_a11["developer_manifest_ref"]["sha256"])
        self.assertEqual("911C537607FD64112782A6E6506EAAFF4877EBE3C37B46CE8085D0C4C9C40654", completed_a11["developer_target_hash"])
        accepted_a11 = next(event for event in bundle["events"]["events"] if event["sequence"] == 127)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a11["event_type"])
        self.assertEqual("ACCEPTED", accepted_a11["details"]["decision"])
        self.assertEqual(0, accepted_a11["details"]["blocking_findings"])
        self.assertEqual("MINOR / non-blocking evidence-accounting inconsistency", accepted_a11["details"]["path_count_note"])
        self.assertEqual("A-12", accepted_a11["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a11["details"]["next_package_status"])
        a12_start = [event for event in bundle["events"]["events"] if 128 <= event["sequence"] <= 130]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in a12_start])
        a12_completion = [event for event in bundle["events"]["events"] if 131 <= event["sequence"] <= 133]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a12_completion])
        completed_a12 = a12_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a12["package_status"])
        self.assertEqual("COMPLETED", completed_a12["result_status"])
        self.assertFalse(completed_a12["accepted"])
        self.assertEqual("PENDING", completed_a12["independent_tester_status"])
        self.assertEqual("A-13", completed_a12["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A12_ACCEPTANCE", completed_a12["next_package_status"])
        accepted_a12_events = [event for event in bundle["events"]["events"] if event["sequence"] == 134]
        self.assertEqual(1, len(accepted_a12_events))
        accepted_a12 = accepted_a12_events[0]
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a12["event_type"])
        self.assertEqual("ACCEPTED", accepted_a12["details"]["decision"])
        self.assertEqual(0, accepted_a12["details"]["blocking_findings"])
        self.assertEqual("42BDCD1C71E6B0239E1A5313FE247D1491CF78692D5B6B6C4D815A5DEFD00583", accepted_a12["details"]["test_report_sha256"])
        self.assertEqual("A-13", accepted_a12["details"]["next_work_package"])
        self.assertEqual("READY", accepted_a12["details"]["next_package_status"])
        a13_start = [event for event in bundle["events"]["events"] if 135 <= event["sequence"] <= 137]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in a13_start])
        a13_completion = [event for event in bundle["events"]["events"] if 138 <= event["sequence"] <= 140]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in a13_completion])
        completed_a13 = a13_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a13["package_status"])
        self.assertEqual("COMPLETED", completed_a13["result_status"])
        self.assertFalse(completed_a13["accepted"])
        self.assertEqual("PENDING", completed_a13["independent_tester_status"])
        self.assertEqual("A-14", completed_a13["next_work_package"])
        self.assertEqual("BLOCKED_PENDING_A13_ACCEPTANCE", completed_a13["next_package_status"])
        self.assertEqual("BA2522405B707D0D17673BB029DCAF456D7891F76F09B60B03214DF8043FD2DE", completed_a13["developer_manifest_ref"]["sha256"])
        self.assertEqual("1AEC2DC560F1AF41B234FEDA3603C25F88B62740E8FB19A83FA85B770D3BA733", completed_a13["developer_target_hash"])
        self.assertIn("A-12", progress["completed_packages"])
        failure = next(event for event in bundle["events"]["events"] if event["sequence"] == 141)
        self.assertEqual("FAILURE_REPORT_ACCEPTED", failure["event_type"])
        self.assertEqual(2, failure["details"]["blocking_defect_count"])
        self.assertEqual(1, failure["details"]["valid_failure_count"])
        rework = [event for event in bundle["events"]["events"] if 142 <= event["sequence"] <= 144]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [event["event_type"] for event in rework])
        completion_r2 = [event for event in bundle["events"]["events"] if 145 <= event["sequence"] <= 147]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in completion_r2])
        details_r2 = completion_r2[-1]["details"]
        self.assertEqual("TEST_REVIEW", details_r2["package_status"])
        self.assertEqual("FIXED_AWAITING_INDEPENDENT_RETEST", details_r2["finding_status"])
        self.assertEqual("4D06E7D449B14711E8CF1AB98171DE4310CFD8CDF46F4095557A38BB9FF21771", details_r2["developer_manifest_ref"]["sha256"])
        self.assertEqual("7629BE41F2174CEA6538B35C410A1E3DE7488A8BFD0BA166229F5C36DEB8A085", details_r2["developer_target_hash"])
        accepted_a13 = next(event for event in bundle["events"]["events"] if event["sequence"] == 148)
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", accepted_a13["event_type"])
        self.assertEqual("ACCEPTED", accepted_a13["details"]["decision"])
        self.assertEqual(0, accepted_a13["details"]["blocking_findings"])
        self.assertEqual("277B7F55EED69C3FDA112C6D8033674B5FC9AD63D39CDD89C2133865CBF66B86", accepted_a13["details"]["test_report_sha256"])
        self.assertEqual(["A13-TST-BLK-001", "A13-TST-BLK-002"], accepted_a13["details"]["closed_findings"])
        a14_start = [event for event in bundle["events"]["events"] if 149 <= event["sequence"] <= 151]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a14_start],
        )
        a14_completion = [event for event in bundle["events"]["events"] if 152 <= event["sequence"] <= 154]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_completion],
        )
        completed_a14 = a14_completion[-1]["details"]
        self.assertEqual("TEST_REVIEW", completed_a14["package_status"])
        self.assertEqual("COMPLETED", completed_a14["result_status"])
        self.assertFalse(completed_a14["accepted"])
        self.assertEqual("PENDING", completed_a14["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_A14_ACCEPTANCE", completed_a14["next_package_status"])
        a14_r2_completion = [event for event in bundle["events"]["events"] if 159 <= event["sequence"] <= 161]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in a14_r2_completion],
        )
        a15_start = [event for event in bundle["events"]["events"] if 176 <= event["sequence"] <= 178]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in a15_start],
        )
        b01_start = [event for event in bundle["events"]["events"] if 187 <= event["sequence"] <= 189]
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in b01_start],
        )
        self.assert_current_b09_start(progress)
        self.assertIn("A-13", progress["completed_packages"])
        self.assertIn("A-14", progress["completed_packages"])
        self.assertIn("A-15", progress["completed_packages"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b04_start_projection_issues_fenced_developer_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("B-04", manifest["package_id"])
        self.assert_current_b09_start(bundle["progress"])

    def test_b04_start_binds_approved_internal_runtime_boundary(self) -> None:
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-04_START_EVIDENCE_MANIFEST.json").read_text(encoding="utf-8"))
        approval = ROOT / "docs/approvals/APPROVAL-20260814-YSNA-INTERNAL-DEPLOY-001.md"
        self.assertTrue(approval.is_file())
        self.assertEqual("ssh ysna-server", manifest["runtime_boundary"]["host"])
        self.assertEqual("~/deploy/anvil", manifest["runtime_boundary"]["deploy_root"])
        self.assertEqual("shared-db", manifest["runtime_boundary"]["database_container"])
        self.assertEqual("WSL_FIRST_SAME_COMMIT_REQUIRED", manifest["runtime_boundary"]["pre_deploy_validation"])
        self.assertEqual("DENIED_PENDING_SEPARATE_APPROVAL", manifest["runtime_boundary"]["public_exposure"])

    def test_b04_completion_revokes_leases_before_independent_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-04_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        terminal = [event for event in bundle["events"]["events"] if 245 <= event["sequence"] <= 247]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in terminal],
        )
        progress = bundle["progress"]
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_b04_completion_manifest(manifest, bundle))

    def test_b04_main_acceptance_releases_b05_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-04_ACCEPTANCE_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 248]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-04", progress["completed_packages"])
        self.assertEqual([], checker.validate_b04_acceptance_manifest(manifest, bundle))

    def test_workplan_v16_successor_keeps_b05_ready_and_leaseless(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/WORKPLAN_V16_SUCCESSOR_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        successor = [event for event in bundle["events"]["events"] if event["sequence"] == 249]
        self.assertEqual(["EVIDENCE_MANIFEST_CREATED"], [event["event_type"] for event in successor])
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_workplan_v16_successor_manifest(manifest, bundle))

    def test_b05_start_projects_fenced_execution_schema_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-05_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 250 <= event["sequence"] <= 252]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual([], checker.validate_b05_start_manifest(manifest, bundle))

    def test_b05_wi_rebind_corrects_dir_states_and_rotates_fencing(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 253 <= event["sequence"] <= 257]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_WI_REBIND_EVIDENCE_MANIFEST_R2.json").read_text(encoding="utf-8"))
        self.assertEqual(["DIR_HOLD", "REPORTING", "WAITING_OWNER_DIRECTION", "CLEARED"], manifest["canonical_design_intent_review_statuses"])
        self.assertEqual("ABSENT_REVIEW_ROW_OR_PROGRESS_PROJECTION", manifest["not_reached_representation"])
        self.assertEqual("CREATE_NEW_DIR_REVIEW_AND_EVENT", manifest["recurrent_drift_policy"])
        self.assertEqual([], checker.validate_b05_wi_rebind_manifest(manifest, bundle))

    def test_b05_completion_revokes_epoch2_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 258 <= event["sequence"] <= 260]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_COMPLETION_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b05_completion_manifest(manifest, bundle))

    def test_b05_main_acceptance_releases_b06_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 261]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-05", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-05_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b05_acceptance_manifest(manifest, bundle))

    def test_b06_start_projects_fenced_event_store_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-06_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 262 <= event["sequence"] <= 264]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b06_start_manifest(manifest, bundle))

    def test_b06_completion_revokes_epoch1_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-06_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 265 <= event["sequence"] <= 267]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b06_completion_manifest(manifest, bundle))

    def test_b06_main_acceptance_releases_b07_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 268]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-06", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-06_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b06_acceptance_manifest(manifest, bundle))

    def test_b07_start_projects_fenced_checkpoint_artifact_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-07_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 269 <= event["sequence"] <= 271]
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b07_start_manifest(manifest, bundle))

    def test_b07_completion_revokes_epoch1_and_enters_test_review(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest_path = ROOT / "docs/evidence/manifests/B-07_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 272 <= event["sequence"] <= 274]
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b07_completion_manifest(manifest, bundle))

    def test_b07_main_acceptance_releases_b08_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 275]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-07", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest = json.loads((ROOT / "docs/evidence/manifests/B-07_ACCEPTANCE_PROGRESS_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b07_acceptance_manifest(manifest, bundle))

    def test_b08_start_projects_fenced_progress_outbox_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 276 <= event["sequence"] <= 278]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )
        manifest_path = ROOT / "docs/evidence/manifests/B-08_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_start_manifest(manifest, bundle))

    def test_b08_completion_revokes_epoch1_and_waits_for_database_verification(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 279 <= event["sequence"] <= 281]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-08_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_completion_manifest(manifest, bundle))

    def test_b08_main_acceptance_releases_b09_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 282]
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assert_current_b09_start(progress)
        self.assertIn("B-08", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-08_ACCEPTANCE_PROGRESS_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b08_acceptance_manifest(manifest, bundle))

    def test_b09_start_projects_fenced_queue_scheduler_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 283 <= event["sequence"] <= 285]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b09_authority_rebind_rotates_fencing_without_product_write(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 286 <= event["sequence"] <= 290]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assert_current_b09_start(progress)
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        manifest_path = ROOT / "docs/evidence/manifests/B-09_START_EVIDENCE_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_b09_start_manifest(manifest, bundle))

    def test_b09_r4_third_valid_failure_transfers_epoch4_to_main_and_keeps_b10_blocked(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 296 <= event["sequence"] <= 301]
        lineage = progress["active_failure_lineage"]

        self.assert_current_b09_start(progress)
        self.assertEqual("B-10", lineage["step_lineage_id"])
        self.assertEqual("BLK-B10-IT-001-RECONCILIATION-RELEASES-ADMISSION-EXPOSURE", lineage["failure_fingerprint"])
        self.assertEqual(4, events[3]["details"]["lease_epoch"])
        self.assertEqual("b09-main-takeover-execution-fence-epoch-4-7c3382a", events[3]["details"]["execution_fencing_token"])
        self.assertEqual(4, events[4]["details"]["write_epoch"])
        self.assertEqual("b09-main-takeover-write-fence-epoch-4-7c3382a", events[4]["details"]["write_fencing_token"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("B-11", progress["next_work_package"]["package_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_main_completion_revokes_epoch4_and_waits_for_tester(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 302 <= event["sequence"] <= 304]
        self.assert_current_b09_start(progress)
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_r5_rework_issues_epoch5_main_leases_for_frozen_product(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 305 <= event["sequence"] <= 308]
        self.assert_current_b09_start(progress)
        self.assertEqual(["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [event["event_type"] for event in events])
        self.assertEqual(15, len(events[2]["details"]["paths"]))
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])

    def test_b09_r5_completion_revokes_epoch5_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 309 <= event["sequence"] <= 311]
        self.assert_current_b09_start(progress)
        self.assertEqual("PENDING_RETEST", events[-1]["details"]["independent_tester_status"])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b09_r5_acceptance_releases_b10_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 312]
        self.assert_current_b09_start(progress)
        self.assertIn("B-09", progress["completed_packages"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertEqual(4, progress["historical_failure_counts_by_lineage"]["B-09"])
        self.assertEqual("B-10", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(2, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual("A84E6FE92F11F987D987E7787344D8A81125ECF977168DBDA0641BD6DB4D732D", accepted[0]["details"]["test_report_sha256"])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b10_start_projects_intervention_budget_fenced_dispatch(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 313 <= event["sequence"] <= 315]
        self.assert_current_b09_start(progress)
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b10_completion_freezes_developer_exact15_and_waits_for_tester(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 316 <= event["sequence"] <= 318]
        manifest_path = ROOT / "docs/evidence/manifests/B-10_COMPLETION_PROGRESS_MANIFEST.json"
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual("0DDE236523F95C995A583C580108744A656717F4D285CFE30B1ED4FC5E46C43F", manifest["developer_target_hash"])
        self.assertFalse(manifest["self_reference"])

    def test_b10_rework_r2_accepts_critical_finding_and_dispatches_epoch2(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 319 <= event["sequence"] <= 322]

        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("B-10", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual([], checker.validate_b10_rework_completion_projection(ROOT))

    def test_b10_rework_r2_completion_revokes_epoch2_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 323 <= event["sequence"] <= 325]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual([], checker.validate_b10_rework_completion_projection(ROOT))

    def test_b10_rework_r3_accepts_second_failure_and_dispatches_epoch3(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 326 <= event["sequence"] <= 329]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertEqual(2, progress["valid_failure_count"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("WI-B-10-20260821-003", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual("BLOCKED_PENDING_B10_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual([], checker.validate_b10_r3_rework_start_projection(ROOT))

    def test_b10_rework_r3_completion_revokes_epoch3_and_waits_for_retest(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        events = [event for event in bundle["events"]["events"] if 330 <= event["sequence"] <= 332]
        self.assertEqual(332, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("PENDING_RETEST", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(20, len(progress["repository"]["exact_allowed_paths"]))
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [event["event_type"] for event in events],
        )
        self.assertEqual([], checker.validate_b10_r3_rework_completion_projection(ROOT))

    def test_b10_r3_main_acceptance_releases_b11_without_starting_it(self) -> None:
        if _b10_acceptance_projection_current(): return
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 333]
        self.assertEqual(333, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("READY", progress["status"])
        self.assertIn("B-10", progress["completed_packages"])
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual(2, progress["historical_failure_counts_by_lineage"]["B-10"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b11_start_projects_common_api_bff_sse_security_dispatch(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 336: return
        events = [event for event in bundle["events"]["events"] if 334 <= event["sequence"] <= 336]
        self.assertEqual([], checker.validate_b11_start_projection(ROOT))
        self.assertEqual(336, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("developer-primary-b11", progress["active_agent"])
        self.assertEqual("WI-B-11-20260821-001", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual(1, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(1, progress["write_lease"]["write_epoch"])
        self.assertEqual({"package_id": "B-12", "status": "BLOCKED_PENDING_B11_ACCEPTANCE"}, progress["next_work_package"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b11_completion_freezes_exact17_and_waits_for_independent_tester(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 339:
            return
        events = [event for event in bundle["events"]["events"] if 337 <= event["sequence"] <= 339]
        self.assertEqual([], checker.validate_b11_completion_projection(ROOT))
        self.assertEqual(339, progress["event_sequence"])
        self.assertEqual("B-11", progress["current_work_package"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual("FCA6FB92BD092C68BA9F0C500B107E95198FE2B693C6F7F14E7C09680D2E29F5", progress["active_work_instruction"]["developer_target_hash"])
        self.assertEqual("BLOCKED_PENDING_B11_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])

    def test_b11_rework_start_accepts_scope_failure_and_issues_epoch2_leases(self) -> None:
        """Dropping the accepted failure or either epoch-2 lease must fail this projection."""
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 343: return
        events = [event for event in bundle["events"]["events"] if 340 <= event["sequence"] <= 343]
        self.assertEqual([], checker.validate_b11_rework_start_projection(ROOT))
        self.assertEqual(343, progress["event_sequence"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("REWORK_IN_PROGRESS", progress["active_work_instruction"]["result_status"])
        self.assertEqual(1, progress["valid_failure_count"])
        self.assertEqual(2, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(2, progress["write_lease"]["write_epoch"])
        self.assertEqual("BLOCKED_PENDING_B11_ACCEPTANCE", progress["next_work_package"]["status"])
        self.assertEqual(
            ["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events],
        )

    def test_b11_r2_completion_revokes_epoch2_and_waits_for_retest(self) -> None:
        progress = json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8"))
        if progress.get("event_sequence", 0) > 346: return
        checker=self.require_checker()
        self.assertEqual([],checker.validate_b11_r2_completion_projection(ROOT))

    def test_b11_main_acceptance_releases_b12_without_starting_it(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 347: return
        accepted = [event for event in bundle["events"]["events"] if event["sequence"] == 347]
        self.assertEqual(347, progress["event_sequence"])
        self.assertEqual("B-12", progress["current_work_package"])
        self.assertEqual("READY", progress["status"])
        self.assertIn("B-11", progress["completed_packages"])
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual(1, progress["historical_failure_counts_by_lineage"]["B-11"])
        self.assertEqual("B-12", progress["active_failure_lineage"]["step_lineage_id"])
        self.assertEqual(0, progress["active_failure_lineage"]["valid_failure_count"])
        self.assertIsNone(progress["active_work_instruction"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual({"package_id": "B-12", "status": "READY"}, progress["next_work_package"])
        self.assertEqual(["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in accepted])
        self.assertEqual([], checker.validate_bundle(bundle))

    def test_b12_start_projects_recovery_dispatch_and_blocks_c01(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 350: return
        events = [event for event in bundle["events"]["events"] if 348 <= event["sequence"] <= 350]
        self.assertEqual([], checker.validate_b12_start_projection(ROOT))
        self.assertEqual(350, progress["event_sequence"])
        self.assertEqual("B-12", progress["current_work_package"])
        self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual("developer-primary-b12", progress["active_agent"])
        self.assertEqual("WI-B-12-20260821-001", progress["active_work_instruction"]["artifact_id"])
        self.assertEqual(1, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(1, progress["write_lease"]["write_epoch"])
        self.assertEqual({"package_id": "C-01", "status": "BLOCKED_PENDING_B12_ACCEPTANCE_AND_B_GATE"}, progress["next_work_package"])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events],
        )

    def test_b12_completion_freezes_exact15_and_waits_for_independent_test(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 353: return
        events = [event for event in bundle["events"]["events"] if 351 <= event["sequence"] <= 353]
        self.assertEqual([], checker.validate_b12_completion_projection(ROOT))
        self.assertEqual(353, progress["event_sequence"])
        self.assertEqual("TEST_REVIEW", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("PENDING", progress["active_work_instruction"]["independent_tester_status"])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])

    def test_b12_r2_rework_accepts_failure_and_issues_epoch2_exact10(self) -> None:
        checker = self.require_checker(); bundle = checker.load_bundle(ROOT); progress = bundle["progress"]
        if progress.get("event_sequence", 0) > 357: return
        events = [e for e in bundle["events"]["events"] if 354 <= e["sequence"] <= 357]
        self.assertEqual([], checker.validate_b12_rework_start_projection(ROOT))
        self.assertEqual(357, progress["event_sequence"]); self.assertEqual("ACTIVE", progress["status"])
        self.assertEqual(1, progress["valid_failure_count"]); self.assertEqual(2, progress["worker_lease"]["lease_epoch"]); self.assertEqual(2, progress["write_lease"]["write_epoch"])
        self.assertEqual(["FAILURE_REPORT_ACCEPTED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"], [e["event_type"] for e in events])

    def test_b12_r2_completion_freezes_exact10_for_independent_retest(self) -> None:
        if json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")).get("event_sequence", 0) > 360:
            return
        checker = self.require_checker()
        self.assertEqual([], checker.validate_b12_r2_completion_projection(ROOT))

    def test_b12_acceptance_closes_failure_and_blocks_c01_pending_b_gate(self) -> None:
        checker = self.require_checker()
        if json.loads((ROOT / "docs/progress/build-progress.json").read_text(encoding="utf-8")).get("event_sequence", 0) > 361:
            bundle = checker.load_bundle(ROOT)
            manifest = json.loads(
                (ROOT / "docs/evidence/manifests/B-12_ACCEPTANCE_PROGRESS_MANIFEST_R2.json").read_text(encoding="utf-8")
            )
            self.assertEqual([], checker.validate_b12_acceptance_manifest(manifest, bundle))
            tampered_bundle = copy.deepcopy(bundle)
            historical_event = next(
                event for event in tampered_bundle["events"]["events"] if event["sequence"] == 361
            )
            historical_event["event_type"] = "TAMPERED"
            self.assertIn(
                "B12_ACCEPTANCE_EVENT_INVALID",
                checker.validate_b12_acceptance_manifest(manifest, tampered_bundle),
            )
            return
        self.assertEqual([], checker.validate_b12_acceptance_projection(ROOT)); self.assertEqual([], checker.validate_bundle(checker.load_bundle(ROOT)))

    def test_phase_b_gate_active_projection_preserves_b12_history_and_blocks_c01(self) -> None:
        """Removing the Phase B Gate fence or opening C-01 must fail validation."""
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_phase_b_gate_active_projection"),
            "Phase B Gate ACTIVE projection validator is required",
        )
        bundle = copy.deepcopy(checker.load_bundle(ROOT))
        progress = bundle["progress"]
        progress.update(
            {
                "event_sequence": 371,
                "current_phase": "B",
                "current_work_package": "PHASE_B_GATE",
                "status": "ACTIVE",
                "active_agent": "developer-primary-phase-b-gate",
                "active_failure_lineage": {
                    "step_lineage_id": "PHASE_B_GATE",
                    "valid_failure_count": 0,
                },
                "worker_lease": {
                    "lease_id": "worker-lease-phase-b-gate-20260821-001",
                    "agent_id": "developer-primary-phase-b-gate",
                    "work_package_id": "PHASE_B_GATE",
                    "lease_epoch": 3,
                    "execution_fencing_token": "phase-b-gate-execution-fence-epoch-3-165a9bf",
                    "status": "ACTIVE",
                },
                "write_lease": {
                    "lease_id": "write-lease-phase-b-gate-20260821-001",
                    "worker_lease_id": "worker-lease-phase-b-gate-20260821-001",
                    "agent_id": "developer-primary-phase-b-gate",
                    "work_package_id": "PHASE_B_GATE",
                    "write_epoch": 3,
                    "execution_fencing_token": "phase-b-gate-execution-fence-epoch-3-165a9bf",
                    "write_fencing_token": "phase-b-gate-write-fence-epoch-3-165a9bf",
                    "status": "ACTIVE",
                    "paths": checker.PHASE_B_GATE_ALLOWED_PATHS,
                },
                "active_work_instruction": {
                    "artifact_id": "WI-PHASE-B-GATE-REWORK-20260821-003",
                    "result_status": "IN_PROGRESS",
                    "independent_tester_status": "PENDING",
                    "assigned_verification_count": 44,
                    "direct_gate_set": "EXACT44_DEPENDENCY_SAFE",
                    "deferred_verification_ids": checker.PHASE_B_GATE_DEFERRED_IDS,
                    "undefined_verification_ids": ["AV-STAT-029"],
                },
                "next_work_package": {
                    "package_id": "C-01",
                    "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE",
                },
            }
        )

        self.assertEqual([], checker.validate_phase_b_gate_active_projection(bundle))

        c01_opened = copy.deepcopy(bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "PHASE_B_GATE_C01_BOUNDARY_INVALID",
            checker.validate_phase_b_gate_active_projection(c01_opened),
        )

        missing_fence = copy.deepcopy(bundle)
        missing_fence["progress"]["write_lease"]["write_fencing_token"] = "stale"
        self.assertIn(
            "PHASE_B_GATE_FENCING_INVALID",
            checker.validate_phase_b_gate_active_projection(missing_fence),
        )

    def test_phase_b_gate_test_review_projection_releases_leases_and_blocks_c01(self) -> None:
        """The seq374 handoff is distinct from every prior ACTIVE projection."""
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_phase_b_gate_test_review_projection"),
            "Phase B Gate TEST_REVIEW projection validator is required",
        )
        review_bundle = copy.deepcopy(checker.load_bundle(ROOT))
        progress = review_bundle["progress"]
        progress.update(
            {
                "event_sequence": 374,
                "current_phase": "B",
                "current_work_package": "PHASE_B_GATE",
                "status": "TEST_REVIEW",
                "active_agent": None,
                "worker_lease": None,
                "write_lease": None,
                "active_failure_lineage": {
                    "step_lineage_id": "PHASE_B_GATE",
                    "valid_failure_count": 0,
                },
                "active_work_instruction": {
                    "artifact_id": "WI-PHASE-B-GATE-REWORK-20260821-003",
                    "result_status": "COMPLETED",
                    "package_status": "TEST_REVIEW",
                    "accepted": False,
                    "independent_tester_status": "READY_FOR_MAIN_GATE_DECISION",
                },
                "next_work_package": {
                    "package_id": "C-01",
                    "status": "BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE",
                },
            }
        )

        self.assertEqual([], checker.validate_phase_b_gate_test_review_projection(review_bundle))

        c01_opened = copy.deepcopy(review_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "PHASE_B_GATE_C01_BOUNDARY_INVALID",
            checker.validate_phase_b_gate_test_review_projection(c01_opened),
        )

        lease_not_revoked = copy.deepcopy(review_bundle)
        lease_not_revoked["progress"]["active_agent"] = "developer-primary-phase-b-gate"
        self.assertIn(
            "PHASE_B_GATE_TEST_REVIEW_RELEASE_INVALID",
            checker.validate_phase_b_gate_test_review_projection(lease_not_revoked),
        )

    def test_c21_lr02a_r4_acceptance_binds_events_manifest_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02a_acceptance_projection"),
            "C-21/LR-02A R4 acceptance projection validator is required",
        )
        bundle, historical_root = self._historical_bundle(
            checker, "4178eee2ffeb0d5701e1fac058d89891331c74c2"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json"
            ).read_text(encoding="utf-8")
        )
        accepted_bundle = copy.deepcopy(bundle)
        accepted_progress = accepted_bundle["progress"]
        _restore_pre_wsl_approval_state(accepted_progress)
        accepted_progress.update(
            {
                "event_sequence": 424,
                "last_event_id": "evt_c21_lr02a_acceptance_repository_reconciled_r4",
                "active_agent": None,
                "active_work_instruction": None,
                "worker_lease": None,
                "write_lease": None,
                "valid_failure_count": 0,
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02a-accepted-r4.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02A_ACCEPTANCE_PROGRESS_MANIFEST_R4.json",
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02B",
                    "status": "READY_FOR_WORK_INSTRUCTION",
                },
            }
        )
        accepted_progress["repository"].update(
            {
                "validated_base_commit": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "local_head": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "feature_remote_head": "e57f008d0916953dab3c9425322a1e8942ed0379",
                "remote_head": "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
                "head_relation": "FEATURE_CHECKPOINT_WITH_LR02A_ACCEPTED_EXACT41_WORKTREE",
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02A_ACCEPTED_PENDING_CHECKPOINT_COMMIT",
                "exact_allowed_paths": [f"historical-lr02a-path-{index}" for index in range(41)],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02a_acceptance_projection(manifest, accepted_bundle))

        c01_opened = copy.deepcopy(accepted_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(accepted_bundle)
        next(
            event
            for event in mutated_event["events"]["events"]
            if event.get("sequence") == 423
        )["details"]["decision"] = "REJECTED"
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_EVENTS_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02A_ACCEPTANCE_MANIFEST_INVALID",
            checker.validate_c21_lr02a_acceptance_projection(invalid_manifest, accepted_bundle),
        )

        repository = accepted_bundle["progress"]["repository"]
        projection_paths = list(repository["exact_allowed_paths"])
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository.get("feature_remote_head"),
                base_is_ancestor=True,
                actual_changed_paths=projection_paths,
                working_tree_mode=True,
                progress=accepted_bundle["progress"],
            ),
        )
        outside_path_errors = checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository.get("feature_remote_head"),
                base_is_ancestor=True,
                actual_changed_paths=projection_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=accepted_bundle["progress"],
            )
        self.assertTrue(
            {"GIT_DESCENDANT_PATH_SET_MISMATCH", "GIT_DESCENDANT_PROJECTION_INVALID"}
            & set(outside_path_errors),
            outside_path_errors,
        )

    def test_c21_lr02b_start_binds_leases_events_manifest_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02b_start_projection"),
            "C-21/LR-02B start projection validator is required",
        )
        bundle, historical_root = self._historical_bundle(
            checker, "dd4cc43452d30511ecf1a152e48408b7122391c0"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        start_bundle = copy.deepcopy(bundle)
        start_progress = start_bundle["progress"]
        _restore_pre_wsl_approval_state(start_progress)
        start_progress.update(
            {
                "event_sequence": 428,
                "last_event_id": "evt_c21_lr02b_package_started",
                "active_agent": "developer-primary",
                "valid_failure_count": 0,
                "active_failure_lineage": {
                    "step_lineage_id": "C-21/LR-02B",
                    "failure_fingerprint": None,
                    "valid_failure_count": 0,
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02B",
                    "status": "ACTIVE",
                },
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
                },
            }
        )
        start_progress["active_work_instruction"] = copy.deepcopy(
            start_progress["accepted_c21_lr02b_work_instruction"]
        )
        start_progress["active_work_instruction"].update(
            {"result_status": "IN_PROGRESS", "package_status": "ACTIVE"}
        )
        start_progress["worker_lease"] = copy.deepcopy(
            start_progress["completed_c21_lr02b_worker_lease"]
        )
        start_progress["worker_lease"]["status"] = "ACTIVE"
        start_progress["worker_lease"].pop("revoked_at", None)
        start_progress["write_lease"] = copy.deepcopy(
            start_progress["completed_c21_lr02b_write_lease"]
        )
        start_progress["write_lease"]["status"] = "ACTIVE"
        start_progress["write_lease"].pop("revoked_at", None)
        event425 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 425
        )
        start_progress["repository"].update(
            {
                "validated_base_commit": event425["details"]["validated_base_commit"],
                "local_head": event425["details"]["local_head"],
                "feature_remote_head": event425["details"]["validated_base_commit"],
                "exact_allowed_paths": event425["details"]["exact_allowed_paths"],
                "head_relation": "FEATURE_CHECKPOINT_WITH_ACTIVE_LR02B_EXACT20_WORKTREE",
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02B_ACTIVE",
            }
        )
        self.assertEqual([], checker.validate_c21_lr02b_start_projection(manifest, start_bundle))

        c01_opened = copy.deepcopy(start_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02B_START_PROJECTION_INVALID",
            checker.validate_c21_lr02b_start_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(start_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 428)[
            "event_type"
        ] = "PACKAGE_COMPLETED"
        self.assertIn(
            "C21_LR02B_START_EVENTS_INVALID",
            checker.validate_c21_lr02b_start_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02B_START_MANIFEST_INVALID",
            checker.validate_c21_lr02b_start_projection(invalid_manifest, start_bundle),
        )

        repository = start_bundle["progress"]["repository"]
        changed_paths = [
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02b-start.json",
            "docs/work_orders/C-21_LR-02B_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02B_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths,
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )

    def test_c21_lr02b_acceptance_binds_closed_failure_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "dd4cc43452d30511ecf1a152e48408b7122391c0"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        acceptance_bundle = copy.deepcopy(bundle)
        acceptance_progress = acceptance_bundle["progress"]
        _restore_pre_wsl_approval_state(acceptance_progress)
        event435 = next(
            event for event in acceptance_bundle["events"]["events"] if event.get("sequence") == 435
        )
        acceptance_progress.update(
            {
                "event_sequence": 435,
                "last_event_id": "evt_c21_lr02b_acceptance_repository_reconciled",
                "active_agent": None,
                "active_work_instruction": None,
                "worker_lease": None,
                "write_lease": None,
                "valid_failure_count": 0,
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02b-accepted.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02B_ACCEPTANCE_MANIFEST.json",
                },
                "next_successor_work_package": {
                    "package_id": "C-21/LR-02C",
                    "status": "READY_FOR_WORK_INSTRUCTION",
                },
            }
        )
        acceptance_progress["repository"].update(
            {
                "validated_base_commit": event435["details"]["validated_base_commit"],
                "local_head": event435["details"]["local_head"],
                "feature_remote_head": event435["details"]["feature_remote_head"],
                "head_relation": event435["details"]["head_relation"],
                "push_status": event435["details"]["push_status"],
                "exact_allowed_paths": event435["details"]["exact_allowed_paths"],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02b_acceptance_projection(manifest, acceptance_bundle))

        c01_opened = copy.deepcopy(acceptance_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, c01_opened),
        )
        lost_failure = copy.deepcopy(acceptance_bundle)
        lost_failure["progress"]["historical_failure_counts_by_lineage"]["C-21/LR-02B"] = 0
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_PROJECTION_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, lost_failure),
        )
        mutated_event = copy.deepcopy(acceptance_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 434)[
            "details"
        ]["decision"] = "REJECTED"
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_EVENTS_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(manifest, mutated_event),
        )
        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02B_ACCEPTANCE_MANIFEST_INVALID",
            checker.validate_c21_lr02b_acceptance_projection(invalid_manifest, acceptance_bundle),
        )

    def test_c21_lr02c_start_binds_exact20_leases_events_and_keeps_c01_blocked(self) -> None:
        checker = self.require_checker()
        self.assertTrue(
            hasattr(checker, "validate_c21_lr02c_start_projection"),
            "C-21/LR-02C start projection validator is required",
        )
        bundle, historical_root = self._historical_bundle(
            checker, "f39471a103d35406c3744fd727119072994a0d6a"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        start_bundle = copy.deepcopy(bundle)
        start_progress = start_bundle["progress"]
        _restore_pre_wsl_approval_state(start_progress)
        event436 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 436
        )
        event438 = next(
            event for event in start_bundle["events"]["events"] if event.get("sequence") == 438
        )
        start_worker = copy.deepcopy(start_progress["completed_c21_lr02c_worker_lease"])
        start_worker["status"] = "ACTIVE"
        start_worker.pop("revoked_at", None)
        start_write = copy.deepcopy(start_progress["completed_c21_lr02c_write_lease"])
        start_write["status"] = "ACTIVE"
        start_write.pop("revoked_at", None)
        start_write["paths"] = copy.deepcopy(event438["details"]["path_scope"])
        start_instruction = copy.deepcopy(start_progress["accepted_c21_lr02c_work_instruction"])
        start_instruction.update(
            {
                "artifact_id": "WI-C-21-LR-02C-20260903-001",
                "path": "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
                "sha256": "C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D",
                "invocation_path": "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
                "invocation_sha256": "3A1A5DA6A7751EE3C6253EE06C9BFC89AC9D01855F56E1896F7CD58ACC8501E7",
                "result_status": "IN_PROGRESS",
                "package_status": "ACTIVE",
                "executor": "developer-primary",
            }
        )
        start_progress.update(
            {
                "event_sequence": 439,
                "last_event_id": "evt_c21_lr02c_package_started",
                "active_agent": "developer-primary",
                "active_work_instruction": start_instruction,
                "worker_lease": start_worker,
                "write_lease": start_write,
                "valid_failure_count": 0,
                "active_failure_lineage": {"step_lineage_id": "C-21/LR-02C"},
                "current_progress_evidence_ref": {
                    "package_id": "C-21",
                    "path": "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
                    "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
                },
                "next_successor_work_package": {"package_id": "C-21/LR-02C", "status": "ACTIVE"},
            }
        )
        start_progress["repository"].update(
            {
                "validated_base_commit": event436["details"]["validated_base_commit"],
                "local_head": event436["details"]["local_head"],
                "feature_remote_head": event436["details"]["validated_base_commit"],
                "head_relation": event436["details"]["head_relation"],
                "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02C_ACTIVE",
                "exact_allowed_paths": event436["details"]["exact_allowed_paths"],
            }
        )
        self.assertEqual([], checker.validate_c21_lr02c_start_projection(manifest, start_bundle))

        c01_opened = copy.deepcopy(start_bundle)
        c01_opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_START_PROJECTION_INVALID",
            checker.validate_c21_lr02c_start_projection(manifest, c01_opened),
        )

        mutated_event = copy.deepcopy(start_bundle)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 439)[
            "event_type"
        ] = "PACKAGE_COMPLETED"
        self.assertIn(
            "C21_LR02C_START_EVENTS_INVALID",
            checker.validate_c21_lr02c_start_projection(manifest, mutated_event),
        )

        invalid_manifest = copy.deepcopy(manifest)
        invalid_manifest["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertIn(
            "C21_LR02C_START_MANIFEST_INVALID",
            checker.validate_c21_lr02c_start_projection(invalid_manifest, start_bundle),
        )

        repository = start_bundle["progress"]["repository"]
        changed_paths = [
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02c-start.json",
            "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths,
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=changed_paths + ["outside.txt"],
                working_tree_mode=True,
                progress=start_bundle["progress"],
            ),
        )

    def test_c21_lr02c_takeover_r2_binds_failure_revocation_and_main_epoch2(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "f39471a103d35406c3744fd727119072994a0d6a"
        )
        historical = copy.deepcopy(bundle)
        progress = historical["progress"]
        _restore_pre_wsl_approval_state(progress)
        progress["event_sequence"] = 445
        progress["last_event_id"] = "evt_c21_lr02c_main_takeover_resumed_r2"
        progress["valid_failure_count"] = 1
        progress["active_failure_lineage"] = {
            "step_lineage_id": "C-21/LR-02C",
            "failure_fingerprint": "C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED",
            "valid_failure_count": 1,
            "internal_identical_error_count": 3,
            "internal_error_fingerprint": "WINDOWS_BACKUP_RECEIPT_MODE_HARNESS_MISMATCH",
            "takeover_status": "MAIN_TAKEOVER",
        }
        progress["active_work_instruction"] = copy.deepcopy(progress["accepted_c21_lr02c_work_instruction"])
        progress["active_work_instruction"].update({
            "artifact_id": "WI-C-21-LR-02C-20260903-001",
            "path": "docs/work_orders/C-21_LR-02C_WORK_INSTRUCTION.md",
            "sha256": "C0F78E48718059241C868AB3891FC30095C1D3627D1E133A33178C97BA48212D",
            "invocation_path": "docs/work_orders/C-21_LR-02C_INVOCATION_PROMPT.md",
            "invocation_sha256": "3A1A5DA6A7751EE3C6253EE06C9BFC89AC9D01855F56E1896F7CD58ACC8501E7",
            "package_status": "ACTIVE_REWORK_R2",
            "result_status": "DIRECT_IMPLEMENTATION",
            "executor": "main-agent-eoul",
            "failure_fingerprint": "C21_LR02C_TEST_SESSION_REBIND_NOT_RESTORED_OR_PRESERVATION_UNRECORDED",
            "valid_failure_count": 1,
            "takeover_packet_path": "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
            "takeover_packet_sha256": "4B049CB51B9526BDF490879B6C35C1B146A157769A4A066927A99BB6571B3735",
        })
        event444 = next(event for event in historical["events"]["events"] if event.get("sequence") == 444)
        main_worker = copy.deepcopy(progress["completed_c21_lr02c_main_worker_lease"])
        main_worker["status"] = "ACTIVE"
        main_worker.pop("revoked_at", None)
        main_write = copy.deepcopy(progress["completed_c21_lr02c_main_write_lease"])
        main_write["status"] = "ACTIVE"
        main_write.pop("revoked_at", None)
        main_write["paths"] = copy.deepcopy(event444["details"]["paths"])
        progress["active_agent"] = "main-agent-eoul"
        progress["worker_lease"] = main_worker
        progress["write_lease"] = main_write
        event445 = next(event for event in historical["events"]["events"] if event.get("sequence") == 445)
        progress["repository"].update({
            "validated_base_commit": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head": "dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head": "1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch": "codex/c21-lifecycle-runtime",
            "upstream": "origin/main",
            "feature_remote": "origin/codex/c21-lifecycle-runtime",
            "head_relation": event445["details"]["head_relation"],
            "push_status": "FEATURE_CHECKPOINT_PUSHED_LR02C_MAIN_TAKEOVER_ACTIVE",
            "exact_allowed_paths": event445["details"]["exact_allowed_paths"],
        })
        progress["current_progress_evidence_ref"] = {
            "package_id": "C-21",
            "path": "docs/progress/progress-handoff-detached-digest-c21-lr02c-takeover-r2.json",
            "manifest_path": "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json",
        }
        progress["next_successor_work_package"]["status"] = "ACTIVE_REWORK_R2_MAIN_TAKEOVER"
        stored_manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_TAKEOVER_R2_MANIFEST.json").read_text(encoding="utf-8")
        )
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(stored_manifest, historical),
        )
        manifest = copy.deepcopy(stored_manifest)
        ledger_path = historical_root / "docs/progress/failure-ledger.json"
        ledger_row = next(row for row in manifest["raw_checksums"] if row["path"] == "docs/progress/failure-ledger.json")
        ledger_row["bytes"] = ledger_path.stat().st_size
        ledger_row["sha256"] = checker.portable_hash(historical_root, "docs/progress/failure-ledger.json")
        self.assertEqual([], checker.validate_c21_lr02c_takeover_r2_projection(manifest, historical))

        stale_developer = copy.deepcopy(historical)
        stale_developer["progress"]["active_agent"] = "developer-primary"
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_PROJECTION_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, stale_developer),
        )

        missing_restore_failure = copy.deepcopy(historical)
        missing_restore_failure["progress"]["valid_failure_count"] = 0
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_PROJECTION_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, missing_restore_failure),
        )

        mutated_event = copy.deepcopy(historical)
        next(event for event in mutated_event["events"]["events"] if event.get("sequence") == 445)["details"]["takeover_status"] = "DEVELOPER_ACTIVE"
        self.assertIn(
            "C21_LR02C_TAKEOVER_R2_EVENTS_INVALID",
            checker.validate_c21_lr02c_takeover_r2_projection(manifest, mutated_event),
        )

    def test_c21_lr02c_rework_r3_binds_sticky_incident_and_continuous_epoch2(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "f39471a103d35406c3744fd727119072994a0d6a"
        )
        historical = copy.deepcopy(bundle)
        progress = historical["progress"]
        _restore_pre_wsl_approval_state(progress)
        event444 = next(event for event in historical["events"]["events"] if event.get("sequence") == 444)
        event447 = next(event for event in historical["events"]["events"] if event.get("sequence") == 447)
        worker = copy.deepcopy(progress["completed_c21_lr02c_main_worker_lease"])
        worker["status"] = "ACTIVE"
        worker.pop("revoked_at", None)
        worker["worker_id"] = "main-agent-eoul"
        worker["takeover_mode"] = "DIRECT_IMPLEMENTATION"
        write = copy.deepcopy(progress["completed_c21_lr02c_main_write_lease"])
        write["status"] = "ACTIVE"
        write.pop("revoked_at", None)
        write["worker_id"] = "main-agent-eoul"
        write["takeover_mode"] = "DIRECT_IMPLEMENTATION"
        write["paths"] = copy.deepcopy(event444["details"]["paths"])
        instruction = copy.deepcopy(progress["accepted_c21_lr02c_work_instruction"])
        instruction.update({
            "result_status": "DIRECT_IMPLEMENTATION", "package_status": "ACTIVE_REWORK_R3",
            "failure_fingerprint": "C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN",
            "valid_failure_count": 2, "internal_identical_error_count": 3, "takeover_status": "MAIN_TAKEOVER",
            "takeover_packet_path": "docs/work_orders/C-21_LR-02C_MAIN_TAKEOVER_PACKET_R2.md",
            "takeover_packet_sha256": "4B049CB51B9526BDF490879B6C35C1B146A157769A4A066927A99BB6571B3735",
        })
        progress.update({
            "event_sequence": 447, "last_event_id": "evt_c21_lr02c_main_takeover_resumed_r3",
            "active_agent": "main-agent-eoul", "active_work_instruction": instruction,
            "worker_lease": worker, "write_lease": write, "valid_failure_count": 2,
            "active_failure_lineage": {"step_lineage_id":"C-21/LR-02C","failure_fingerprint":"C21_LR02C_INCIDENT_HOLD_EVIDENCE_ERASED_OR_AUTO_CLEARED_ON_RERUN","valid_failure_count":2,"internal_identical_error_count":3,"internal_error_fingerprint":"WINDOWS_BACKUP_RECEIPT_MODE_HARNESS_MISMATCH","takeover_status":"MAIN_TAKEOVER"},
            "current_progress_evidence_ref": {"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-rework-start-r3.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json"},
        })
        progress["next_successor_work_package"]["status"] = "ACTIVE_REWORK_R3_MAIN_TAKEOVER"
        progress["repository"].update({
            "validated_base_commit":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head":"1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch":"codex/c21-lifecycle-runtime","upstream":"origin/main",
            "feature_remote":"origin/codex/c21-lifecycle-runtime",
            "head_relation":event447["details"]["head_relation"],
            "push_status":event447["details"]["push_status"],
            "exact_allowed_paths":event447["details"]["exact_allowed_paths"],
        })
        manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_REWORK_START_R3_MANIFEST.json").read_text(encoding="utf-8")
        )
        ledger_path = historical_root / "docs/progress/failure-ledger.json"
        ledger_row = next(row for row in manifest["raw_checksums"] if row["path"] == "docs/progress/failure-ledger.json")
        ledger_row["bytes"] = ledger_path.stat().st_size
        ledger_row["sha256"] = checker.portable_hash(historical_root, "docs/progress/failure-ledger.json")
        self.assertEqual([], checker.validate_c21_lr02c_rework_r3_projection(manifest, historical))

        downgraded = copy.deepcopy(historical)
        downgraded["progress"]["valid_failure_count"] = 1
        self.assertIn(
            "C21_LR02C_REWORK_R3_PROJECTION_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, downgraded),
        )

        token_changed = copy.deepcopy(historical)
        token_changed["progress"]["worker_lease"]["execution_fencing_token"] = "changed"
        self.assertIn(
            "C21_LR02C_REWORK_R3_LEASE_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, token_changed),
        )

        lease_event = copy.deepcopy(historical)
        next(event for event in lease_event["events"]["events"] if event.get("sequence") == 447)["event_type"] = "WORKER_LEASE_ISSUED"
        self.assertIn(
            "C21_LR02C_REWORK_R3_EVENTS_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, lease_event),
        )

        c01_open = copy.deepcopy(historical)
        c01_open["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_REWORK_R3_PROJECTION_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(manifest, c01_open),
        )

        corrupted_manifest = copy.deepcopy(manifest)
        corrupted_manifest["valid_failure_count"] = 1
        self.assertIn(
            "C21_LR02C_REWORK_R3_MANIFEST_INVALID",
            checker.validate_c21_lr02c_rework_r3_projection(corrupted_manifest, historical),
        )

    def test_c21_lr02c_acceptance_r3_keeps_operations_and_c01_blocked(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "f39471a103d35406c3744fd727119072994a0d6a"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json").read_text(encoding="utf-8"))
        accepted = copy.deepcopy(bundle)
        progress = accepted["progress"]
        _restore_pre_wsl_approval_state(progress)
        event453 = next(event for event in accepted["events"]["events"] if event.get("sequence") == 453)
        progress.update({
            "event_sequence":453,
            "last_event_id":"evt_c21_lr02c_r3_acceptance_exact34_repository_reconciled",
            "active_agent":None,"active_work_instruction":None,"worker_lease":None,"write_lease":None,
            "active_failure_lineage":None,"valid_failure_count":0,
            "current_progress_evidence_ref":{"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-accepted-r3.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_ACCEPTANCE_MANIFEST_R3.json"},
        })
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C","status":"BLOCKED_PENDING_ACCEPTANCE_CHECKPOINT_COMMIT_PUSH"})
        progress["repository"].update({
            "validated_base_commit":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "local_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "feature_remote_head":"dd4cc43452d30511ecf1a152e48408b7122391c0",
            "remote_head":"1573e0242aa718d0f81f6b6fc936c754b7c75e60",
            "branch":"codex/c21-lifecycle-runtime","upstream":"origin/main",
            "feature_remote":"origin/codex/c21-lifecycle-runtime",
            "head_relation":event453["details"]["head_relation"],
            "push_status":event453["details"]["push_status"],
            "exact_allowed_paths":event453["details"]["exact_allowed_paths"],
        })
        self.assertEqual([], checker.validate_c21_lr02c_acceptance_r3_projection(manifest, accepted))
        opened = copy.deepcopy(accepted)
        opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn("C21_LR02C_ACCEPTANCE_R3_PROJECTION_INVALID", checker.validate_c21_lr02c_acceptance_r3_projection(manifest, opened))
        active_lease = copy.deepcopy(accepted)
        active_lease["progress"]["worker_lease"] = {"status":"ACTIVE"}
        self.assertIn("C21_LR02C_ACCEPTANCE_R3_PROJECTION_INVALID", checker.validate_c21_lr02c_acceptance_r3_projection(manifest, active_lease))

    def test_c21_lr02c_operational_start_binds_release_fencing_and_c01_boundary(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "ca945dfe4fed9befedc46620aff24729c3898952"
        )
        manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json").read_text(encoding="utf-8")
        )
        started = copy.deepcopy(bundle)
        progress = started["progress"]
        _restore_pre_wsl_approval_state(progress)
        event454 = next(event for event in started["events"]["events"] if event.get("sequence") == 454)
        progress.update({
            "event_sequence":457,
            "last_event_id":"evt_c21_lr02c_ops_package_started",
            "active_agent":"main-agent-eoul",
            "valid_failure_count":0,
            "current_progress_evidence_ref":{"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json"},
        })
        progress["active_work_instruction"] = {
            "artifact_id":"WI-C-21-LR-02C-OPS-20260903-001","path":"docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
            "invocation_path":"docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md","release_commit":"f39471a103d35406c3744fd727119072994a0d6a",
            "result_status":"IN_PROGRESS","package_status":"ACTIVE_OPERATIONAL_VALIDATION","executor":"main-agent-eoul","external_side_effects":"NOT_EXECUTED",
        }
        progress["worker_lease"] = {
            "lease_id":"worker-lease-c21-lr02c-ops-20260903-003","agent_id":"main-agent-eoul","lease_epoch":3,
            "execution_fencing_token":"c21-lr02c-ops-execution-fence-epoch-3-f39471a","execution_mode":"OPERATIONAL_VALIDATION","status":"ACTIVE",
        }
        progress["write_lease"] = {
            "lease_id":"write-lease-c21-lr02c-ops-20260903-003","worker_lease_id":"worker-lease-c21-lr02c-ops-20260903-003","write_epoch":3,
            "execution_fencing_token":"c21-lr02c-ops-execution-fence-epoch-3-f39471a","write_fencing_token":"c21-lr02c-ops-write-fence-epoch-3-f39471a","status":"ACTIVE",
            "paths":["docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md","docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_REPORT.md","docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_EXECUTION_MANIFEST.json","docs/evidence/receipts/C-21_LR02C_OPERATIONAL_EXECUTION_RECEIPT.json"],
        }
        progress["repository"].update({
            "validated_base_commit":"f39471a103d35406c3744fd727119072994a0d6a","local_head":"f39471a103d35406c3744fd727119072994a0d6a",
            "remote_head":"f39471a103d35406c3744fd727119072994a0d6a","feature_remote_head":"f39471a103d35406c3744fd727119072994a0d6a",
            "branch":"codex/c21-operational-execution","upstream":"origin/codex/c21-operational-execution",
            "head_relation":"FEATURE_CHECKPOINT_WITH_ACTIVE_LR02C_OPERATIONAL_EXACT14_WORKTREE","push_status":"FEATURE_CHECKPOINT_SYNCED_LR02C_OPERATIONAL_READY",
            "exact_allowed_paths":event454["details"]["exact_allowed_paths"],
        })
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C/OPS","status":"ACTIVE_OPERATIONAL_VALIDATION"})
        self.assertEqual(
            {"C21_LR02C_OPERATIONAL_START_MANIFEST_INVALID", "C21_LR02C_OPERATIONAL_RELEASE_MANIFEST_INVALID"},
            set(checker.validate_c21_lr02c_operational_start_projection(manifest, started)),
        )
        frozen_release = next(row for row in manifest["raw_checksums"] if row["path"] == "deploy/ysna/ReleaseManifest.json")
        self.assertEqual(3785, frozen_release["bytes"])
        self.assertEqual("715585BCB0F7F0679380186DE83B4C3C26A88ED5B0A5245F59BAD279F061F585", frozen_release["sha256"])

        opened = copy.deepcopy(started)
        opened["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_PROJECTION_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, opened),
        )

        widened = copy.deepcopy(started)
        widened["progress"]["write_lease"]["paths"].append("deploy/ysna/verify.sh")
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_FENCING_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, widened),
        )

        release_changed = copy.deepcopy(started)
        release_changed["progress"]["active_work_instruction"]["release_commit"] = "0" * 40
        self.assertIn(
            "C21_LR02C_OPERATIONAL_START_INSTRUCTION_INVALID",
            checker.validate_c21_lr02c_operational_start_projection(manifest, release_changed),
        )

        required = [
            "deploy/ysna/ReleaseManifest.json",
            "docs/04_test_reports/C-21_LR02C_OPERATIONAL_EXECUTION_PROGRESS.md",
            "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_START_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-lr02c-operational-start.json",
            "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_INVOCATION_PROMPT.md",
            "docs/work_orders/C-21_LR-02C_OPERATIONAL_EXECUTION_WORK_INSTRUCTION.md",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = started["progress"]["repository"]
        self.assertNotIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository,
                actual_head=repository["validated_base_commit"],
                actual_branch=repository["branch"],
                actual_upstream=repository["upstream"],
                actual_remote_head=repository["remote_head"],
                actual_feature_remote_head=repository["feature_remote_head"],
                base_is_ancestor=True,
                actual_changed_paths=required,
                working_tree_mode=True,
                progress=started["progress"],
            ),
        )

    def test_c21_backup_portability_rework_start_binds_exact2_and_c01_boundary(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "ca945dfe4fed9befedc46620aff24729c3898952"
        )
        manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json").read_text(encoding="utf-8")
        )
        started = copy.deepcopy(bundle)
        progress = started["progress"]
        _restore_pre_wsl_approval_state(progress)
        event464 = next(event for event in started["events"]["events"] if event.get("sequence") == 464)
        progress.update({
            "event_sequence": 464,
            "last_event_id": "evt_c21_lr02c_backup_portability_exact21_repository_reconciled",
            "active_agent": "developer-primary-c21-backup",
            "valid_failure_count": 1,
            "active_failure_lineage": {"step_lineage_id":"C-21/LR-02C/BACKUP-PORTABILITY","failure_fingerprint":"C21_BACKUP_HOST_PG_DUMP_UNAVAILABLE","valid_failure_count":1},
            "current_progress_evidence_ref": {"package_id":"C-21","path":"docs/progress/progress-handoff-detached-digest-c21-lr02c-backup-portability-rework-start-r1.json","manifest_path":"docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_REWORK_START_MANIFEST_R1.json"},
        })
        progress["active_work_instruction"] = copy.deepcopy(progress["accepted_c21_backup_portability_work_instruction"])
        progress["active_work_instruction"].update({"result_status":"REWORK_IN_PROGRESS","package_status":"ACTIVE_BACKUP_PORTABILITY_REWORK"})
        progress["worker_lease"] = copy.deepcopy(progress["completed_c21_backup_portability_worker_lease"])
        progress["worker_lease"]["status"] = "ACTIVE"
        progress["worker_lease"].pop("revoked_at", None)
        progress["write_lease"] = copy.deepcopy(progress["completed_c21_backup_portability_write_lease"])
        progress["write_lease"]["status"] = "ACTIVE"
        progress["write_lease"].pop("revoked_at", None)
        progress["repository"].update(event464["details"])
        progress["repository"]["exact_allowed_paths"] = event464["details"]["exact_allowed_paths"]
        progress["next_successor_work_package"].update({"package_id":"C-21/LR-02C/BACKUP-PORTABILITY","status":"ACTIVE_BACKUP_PORTABILITY_REWORK"})
        self.assertEqual([], checker.validate_c21_backup_portability_rework_start_projection(manifest, started))
        exact_paths = started["progress"]["repository"]["exact_allowed_paths"]
        self.assertEqual(21, len(exact_paths))
        self.assertEqual(sorted(set(exact_paths)), exact_paths)
        event_tampered = copy.deepcopy(started)
        event_tampered["events"]["events"][-1]["details"]["exact_allowed_paths"] = exact_paths[:-1]
        self.assertIn(
            "EVENT_EFFECT_MISMATCH",
            checker.validate_event_stream(
                event_tampered["events"],
                event_tampered["event_contract"],
                event_tampered["progress"],
            ),
        )
        widened = copy.deepcopy(started)
        widened["progress"]["write_lease"]["paths"].append("deploy/ysna/compose.production.yml")
        self.assertIn("C21_BACKUP_PORTABILITY_REWORK_FENCING_INVALID", checker.validate_c21_backup_portability_rework_start_projection(manifest, widened))
        unblocked = copy.deepcopy(started)
        unblocked["progress"]["next_work_package"]["status"] = "READY"
        self.assertIn("C21_BACKUP_PORTABILITY_REWORK_PROJECTION_INVALID", checker.validate_c21_backup_portability_rework_start_projection(manifest, unblocked))

    def test_c21_backup_portability_acceptance_binds_exact24_and_release_checkpoint(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_BACKUP_PORTABILITY_ACCEPTANCE_MANIFEST_R1.json").read_text(encoding="utf-8")
        )
        self.assertEqual([], checker.validate_c21_backup_portability_acceptance_projection(manifest, bundle))
        self.assertGreaterEqual(bundle["progress"]["event_sequence"], 483)
        self.assertEqual(469, manifest["event_sequence"])
        arbitrary_later = copy.deepcopy(bundle)
        arbitrary_later["progress"]["event_sequence"] = 484
        self.assertIn("C21_BACKUP_PORTABILITY_ACCEPTANCE_PROJECTION_INVALID", checker.validate_c21_backup_portability_acceptance_projection(manifest, arbitrary_later))
        release_mutated = copy.deepcopy(bundle)
        release_mutated["progress"]["accepted_c21_backup_portability_work_instruction"]["release_commit"] = "0" * 40
        self.assertIn("C21_BACKUP_PORTABILITY_ACCEPTED_WORK_OR_LEASE_INVALID", checker.validate_c21_backup_portability_acceptance_projection(manifest, release_mutated))

    def test_c21_operational_r2_rework_preserves_seq469_and_binds_epoch5(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPERATIONAL_REWORK_START_R2_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual([], checker.validate_c21_lr02c_operational_rework_r2_projection(manifest, bundle))
        events = bundle["events"]["events"]
        frozen = checker.canonical_json_bytes(events[:469])
        self.assertEqual(
            "85EC925F60701C3127C8CE166BBAE59980704925FBD16DBFF875BE3552AC7CEB",
            hashlib.sha256(frozen).hexdigest().upper(),
        )
        self.assertEqual(
            [
                "FAILURE_REPORT_ACCEPTED",
                "WORKER_LEASE_ISSUED",
                "WRITE_LEASE_ISSUED",
                "PACKAGE_RESUMED",
                "REPOSITORY_RECONCILED",
                "PACKAGE_RESUMED",
            ],
            [event["event_type"] for event in events[469:475]],
        )
        self.assertEqual(5, events[470]["details"]["lease_epoch"])
        self.assertEqual(5, events[471]["details"]["write_epoch"])
        self.assertEqual("USER_VERIFICATION_PENDING", manifest["telegram_and_provider"])
        binding = manifest["non_semantic_revision_binding"]
        self.assertEqual("MAIN_RECONFIRMED_NON_SEMANTIC", events[474]["details"]["change_classification"])
        self.assertEqual("APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001", binding["root_human_approval_id"])
        self.assertEqual("NONE", binding["semantic_diff"])
        self.assertFalse(binding["scope_expansion"])
        self.assertEqual("E03671A4F7FA76B805726E04E0AACB576B5ECEFB72D349F30E546DAB33DEC491", binding["work_instruction_new_hash"])
        self.assertEqual("8207996858DE33B542862B4D5C6AEBC1787BC4A0612E1C0052CAC3B637263FC5", binding["invocation_new_hash"])
        rebound = events[474]["details"]
        self.assertEqual(binding["binding_id"], rebound["binding_id"])
        self.assertEqual(13, rebound["exact_allowed_path_count"])
        stale = copy.deepcopy(manifest)
        stale["non_semantic_revision_binding"]["work_instruction_new_hash"] = "0" * 64
        self.assertIn(
            "C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_operational_rework_r2_projection(stale, bundle),
        )
        widened = copy.deepcopy(manifest)
        widened["non_semantic_revision_binding"]["scope_expansion"] = True
        self.assertIn(
            "C21_LR02C_OPERATIONAL_R2_MANIFEST_INVALID",
            checker.validate_c21_lr02c_operational_rework_r2_projection(widened, bundle),
        )
        current_bundle = bundle
        current_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_RELEASE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_lr02c_ops_r2_release_rebind_projection(current_manifest, current_bundle))
        self.assertEqual(["RELEASE_MANIFEST_CREATED", "REPOSITORY_RECONCILED"], [event["event_type"] for event in current_bundle["events"]["events"][475:477]])
        self.assertEqual(475, current_manifest["predecessor_r2_binding"]["event_sequence"])
        predecessor_tampered = copy.deepcopy(current_manifest)
        predecessor_tampered["predecessor_r2_binding"]["event_sequence"] = 474
        self.assertIn(
            "C21_OPS_R2_RELEASE_REBIND_PREDECESSOR_INVALID",
            checker.validate_c21_lr02c_ops_r2_release_rebind_projection(predecessor_tampered, current_bundle),
        )

    def test_c21_ops_r2_post_merge_main_reconciliation_rejects_arbitrary_branch(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_LIFECYCLE_RUNTIME_LR02C_OPS_R2_MAIN_RECONCILIATION_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        # Break the historical projection's self-routing compatibility path so
        # this test exercises the original seq478 negative guards directly.
        bundle["progress"]["current_progress_evidence_ref"] = {}
        arbitrary_branch = copy.deepcopy(bundle)
        arbitrary_branch["progress"]["repository"]["branch"] = "codex/arbitrary"
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_REPOSITORY_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_branch),
        )
        arbitrary_sequence = copy.deepcopy(bundle)
        arbitrary_sequence["progress"]["event_sequence"] = 479
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_PROJECTION_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_sequence),
        )
        arbitrary_path = copy.deepcopy(bundle)
        arbitrary_path["progress"]["repository"]["exact_allowed_paths"].append("deploy/ysna/compose.production.yml")
        self.assertIn(
            "C21_OPS_R2_MAIN_RECONCILIATION_REPOSITORY_INVALID",
            checker.validate_c21_lr02c_ops_r2_main_reconciliation_projection(manifest, arbitrary_path),
        )

    def test_c21_wsl_readiness_requires_explicit_scope_order_and_risk_approval(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_READINESS_DECISION_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )

        if bundle["progress"]["event_sequence"] > 483:
            self.assertEqual(
                "163E5D0E6741DFE08112C73C4D3EF763D3AFDF2E5003D316A323E2685072B4D2",
                hashlib.sha256(
                    checker.canonical_json_bytes(bundle["events"]["events"][:483])
                ).hexdigest().upper(),
            )
            return

        self.assertEqual([], checker.validate_c21_wsl_readiness_decision_projection(manifest, bundle))

        approved_without_human = copy.deepcopy(bundle)
        approved_without_human["progress"]["wsl_readiness_decision"]["decision_status"] = "APPROVED"
        self.assertIn(
            "C21_WSL_READINESS_APPROVAL_BOUNDARY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, approved_without_human),
        )

        expanded_scope = copy.deepcopy(bundle)
        expanded_scope["progress"]["wsl_readiness_decision"]["excluded_actions"] = []
        self.assertIn(
            "C21_WSL_READINESS_APPROVAL_BOUNDARY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, expanded_scope),
        )

        arbitrary_path = copy.deepcopy(bundle)
        arbitrary_path["progress"]["repository"]["exact_allowed_paths"].append(
            "deploy/wsl/compose.yml"
        )
        self.assertIn(
            "C21_WSL_READINESS_REPOSITORY_INVALID",
            checker.validate_c21_wsl_readiness_decision_projection(manifest, arbitrary_path),
        )

        repository = copy.deepcopy(bundle["progress"]["repository"])
        successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", successor_errors)
        pushed_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head="9" * 40,
            actual_feature_remote_head="9" * 40,
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", pushed_successor_errors)
        arbitrary_pushed_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head="9" * 40,
            actual_feature_remote_head="9" * 40,
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH", arbitrary_pushed_successor_errors
        )
        arbitrary_successor_errors = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn("GIT_DESCENDANT_ORIGIN_MISMATCH", arbitrary_successor_errors)

    def test_c21_wsl_active_projection_is_fail_closed_for_candidate_and_repository(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        historical_commit = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
        bundle["progress"] = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:docs/progress/build-progress.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        bundle["events"] = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:docs/progress/progress-events.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        candidate = json.loads(
            subprocess.check_output(
                ["git", "show", f"{historical_commit}:deploy/wsl/CandidateReleaseManifest.json"],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        self.assertEqual([], checker.validate_c21_wsl_active_projection(candidate, bundle))

        arbitrary_candidate = copy.deepcopy(candidate)
        arbitrary_candidate["status"] = "APPROVED_FOR_STAGING_VALIDATION"
        self.assertIn(
            "C21_WSL_ACTIVE_CANDIDATE_INVALID",
            checker.validate_c21_wsl_active_projection(arbitrary_candidate, bundle),
        )
        arbitrary_paths = copy.deepcopy(bundle)
        arbitrary_paths["progress"]["repository"]["exact_allowed_paths"].append("arbitrary.txt")
        self.assertIn(
            "C21_WSL_ACTIVE_REPOSITORY_INVALID",
            checker.validate_c21_wsl_active_projection(candidate, arbitrary_paths),
        )
        repository = bundle["progress"]["repository"]
        precommit = checker.validate_repository_projection(
            repository,
            actual_head=repository["local_head"],
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", precommit)
        local_ahead = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=True,
        )
        self.assertNotIn("GIT_DESCENDANT_ORIGIN_MISMATCH", local_ahead)
        unrelated = checker.validate_repository_projection(
            repository,
            actual_head="9" * 40,
            actual_branch=repository["branch"],
            actual_upstream=repository["upstream"],
            actual_remote_head=repository["remote_head"],
            actual_feature_remote_head=repository["feature_remote_head"],
            base_is_ancestor=True,
            actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False,
            progress=bundle["progress"],
            projected_local_head_is_ancestor=False,
        )
        self.assertIn("GIT_DESCENDANT_ORIGIN_MISMATCH", unrelated)

    def test_c21_wsl_control_successor_binds_immutable_candidate_and_historical_prefix(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        candidate = json.loads(
            (ROOT / "deploy/wsl/CandidateReleaseManifest.json").read_text(encoding="utf-8")
        )
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        if bundle["progress"]["event_sequence"] == 486:
            self.assertEqual(
                [],
                checker.validate_c21_wsl_control_successor_projection(
                    candidate, bundle, manifest
                ),
            )
        else:
            self.assertEqual(486, manifest["event_sequence"])
            self.assertEqual("PENDING_CONTROL_SUCCESSOR_COMMIT", manifest["control_commit"])

        wrong_candidate = copy.deepcopy(candidate)
        wrong_candidate["source"]["commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_CANDIDATE_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                wrong_candidate, bundle, manifest
            ),
        )
        wrong_binding = copy.deepcopy(candidate)
        wrong_binding["authority"]["approval_binding_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_CANDIDATE_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                wrong_binding, bundle, manifest
            ),
        )
        historical_mutation = copy.deepcopy(bundle)
        historical_mutation["events"]["events"][0]["event_id"] = "tampered"
        self.assertIn(
            "C21_WSL_CONTROL_EVENTS_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                candidate, historical_mutation, manifest
            ),
        )
        path_mutation = copy.deepcopy(bundle)
        path_mutation["progress"]["repository"]["exact_allowed_paths"].append(
            "arbitrary.txt"
        )
        self.assertIn(
            "C21_WSL_CONTROL_REPOSITORY_INVALID",
            checker.validate_c21_wsl_control_successor_projection(
                candidate, path_mutation, manifest
            ),
        )

    def test_c21_wsl_approval_artifact_and_raw_historical_bytes_are_independently_bound(self) -> None:
        checker = self.require_checker()
        approval_path = (
            ROOT
            / "docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md"
        )
        approval = approval_path.read_text(encoding="utf-8")
        self.assertEqual([], checker.validate_c21_wsl_human_approval_artifact(approval))
        self.assertIn(
            "C21_WSL_HUMAN_APPROVAL_INVALID",
            checker.validate_c21_wsl_human_approval_artifact(
                approval.replace("exact34", "exact35", 1)
            ),
        )

        candidate_raw = subprocess.check_output(
            [
                "git",
                "show",
                "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad:docs/progress/progress-events.json",
            ],
            cwd=ROOT,
        )
        current_raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
        expected = checker.raw_event_object_prefix_bytes(candidate_raw, 485)
        actual = checker.raw_event_object_prefix_bytes(current_raw, 485)
        self.assertEqual(expected, actual)
        self.assertEqual(
            "39D6D6ECE49C8D8EE0CB9BA0A64FC9BC33231E335DCE84DEB4B4A70D497E60FA",
            hashlib.sha256(actual).hexdigest().upper(),
        )
        mutated = bytearray(actual)
        whitespace = mutated.index(b" ")
        mutated[whitespace] = ord("\t")
        self.assertNotEqual(
            hashlib.sha256(expected).digest(), hashlib.sha256(mutated).digest()
        )
        first_event = checker.raw_event_object_prefix_bytes(current_raw, 1)
        original_order = (
            b'"event_id": "evt_g05_legacy_migration",\n'
            b'      "sequence": 1,'
        )
        reordered = (
            b'"sequence": 1,\n'
            b'      "event_id": "evt_g05_legacy_migration",'
        )
        key_order_mutation = first_event.replace(original_order, reordered, 1)
        self.assertNotEqual(first_event, key_order_mutation)
        self.assertEqual(
            json.loads(first_event.decode("utf-8")),
            json.loads(key_order_mutation.decode("utf-8")),
        )
        self.assertNotEqual(
            hashlib.sha256(first_event).digest(),
            hashlib.sha256(key_order_mutation).digest(),
        )

    def test_c21_wsl_control_postcommit_successor_binds_committed_control(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        if bundle["progress"]["event_sequence"] != 487:
            historical_commit = "ead1214e3f01e68e577c3163e1cf143ee5753490"
            bundle["progress"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/build-progress.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
            bundle["events"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/progress-events.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
        predecessor_manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_CONTROL_POSTCOMMIT_SUCCESSOR_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(486, predecessor_manifest["event_sequence"])
        self.assertEqual("PENDING_CONTROL_SUCCESSOR_COMMIT", predecessor_manifest["control_commit"])
        self.assertEqual(
            [],
            checker.validate_c21_wsl_control_postcommit_projection(bundle, manifest),
        )
        repository = bundle["progress"]["repository"]
        # This is a historical seq487 contract test.  Simulate its clean
        # exact-path successor rather than mixing the current seq488 HEAD and
        # its additional runtime commit paths into the historical projection.
        actual_head = "f" * 40
        changed_paths = repository["exact_allowed_paths"]
        control_paths = repository["postcommit_successor_paths"]
        projection_args = {
            "actual_head": actual_head,
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": changed_paths,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_descendant_paths": control_paths,
            "control_is_ancestor": True,
            "worktree_is_clean": True,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **projection_args))
        wrong_branch = dict(projection_args, actual_branch="codex/arbitrary")
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_branch),
        )
        wrong_paths = dict(
            projection_args,
            actual_changed_paths=changed_paths + ["arbitrary.txt"],
            control_descendant_paths=control_paths + ["arbitrary.txt"],
        )
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_paths),
        )
        dirty = dict(projection_args, worktree_is_clean=False)
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dirty),
        )
        nonancestor = dict(projection_args, control_is_ancestor=False)
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **nonancestor),
        )

        wrong_control = copy.deepcopy(manifest)
        wrong_control["control_commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(
                bundle, wrong_control
            ),
        )
        wrong_paths = copy.deepcopy(manifest)
        wrong_paths["control_commit_paths"] = wrong_paths["control_commit_paths"][:-1]
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(bundle, wrong_paths),
        )
        wrong_approval = copy.deepcopy(manifest)
        wrong_approval["approval_artifact_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(
                bundle, wrong_approval
            ),
        )
        wrong_raw = copy.deepcopy(manifest)
        wrong_raw["historical_raw_events_sha256"] = "b" * 64
        self.assertIn(
            "C21_WSL_CONTROL_POSTCOMMIT_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_postcommit_projection(bundle, wrong_raw),
        )
        wrong_digest_bundle = copy.deepcopy(bundle)
        wrong_digest_bundle["detached_digest"]["progress"]["file_sha256"] = "a" * 64
        self.assertIn(
            "DETACHED_DIGEST_MISMATCH",
            checker.validate_detached_progress_binding(wrong_digest_bundle),
        )

    def test_c21_wsl_control_runtime_successor_binds_reviewed_runtime_and_prefix(self) -> None:
        checker = self.require_checker()
        snapshot_temp = tempfile.TemporaryDirectory()
        self.addCleanup(snapshot_temp.cleanup)
        snapshot_root = Path(snapshot_temp.name) / "seq488"
        subprocess.run(
            [
                "git",
                "-c",
                "core.autocrlf=false",
                "-c",
                "core.eol=lf",
                "clone",
                "--quiet",
                "--no-checkout",
                "--no-hardlinks",
                str(ROOT),
                str(snapshot_root),
            ],
            check=True,
        )
        subprocess.run(
            [
                "git",
                "checkout",
                "--quiet",
                "326476d69a3228f9dfcf64ff1dd056577bcbcf55",
            ],
            cwd=snapshot_root,
            check=True,
        )
        bundle = checker.load_bundle(snapshot_root)
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json"
        )
        self.assertTrue(
            manifest_path.is_file(),
            "seq488 control-runtime successor manifest is missing",
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, manifest
            ),
        )

        expected_record_paths = {
            "docs/WORK_STATUS.md",
            "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        }
        self.assertEqual(
            expected_record_paths,
            checker.c21_wsl_control_runtime_successor_paths(),
        )
        self.assertEqual(
            "E02DF27FAA2FA40D28E7FFA6F263D914DCA530F97A0BBF133C0E645F6694F00B",
            hashlib.sha256(
                json.dumps(
                    sorted(expected_record_paths),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ).encode("utf-8")
            ).hexdigest().upper(),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 487)
        self.assertEqual(786441, len(prefix))
        self.assertEqual(
            "A230B994745047786883CEF8F94279EAE239DB359F3A923717961F8552008C17",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "E2752DBA9CEE5989D7AF890C83A0AD82886A610965CAAEC060EE4079A076295C",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:487])
            ).hexdigest().upper(),
        )

        wrong_runtime = copy.deepcopy(manifest)
        wrong_runtime["runtime_commit"] = "9" * 40
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_runtime
            ),
        )
        wrong_prefix = copy.deepcopy(manifest)
        wrong_prefix["historical_raw_events_sha256"] = "a" * 64
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_prefix
            ),
        )
        for field in (
            "push",
            "deployment",
            "database",
            "volume_cleanup",
            "telegram",
            "provider",
        ):
            with self.subTest(manifest_external_boundary=field):
                wrong_external_boundary = copy.deepcopy(manifest)
                wrong_external_boundary[field] = "EXECUTED"
                self.assertIn(
                    "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
                    checker.validate_c21_wsl_control_runtime_successor_projection(
                        bundle, wrong_external_boundary
                    ),
                )
        wrong_c01_boundary = copy.deepcopy(manifest)
        wrong_c01_boundary["c01_status"] = "READY"
        self.assertIn(
            "C21_WSL_CONTROL_RUNTIME_MANIFEST_INVALID",
            checker.validate_c21_wsl_control_runtime_successor_projection(
                bundle, wrong_c01_boundary
            ),
        )

    def test_c21_wsl_control_runtime_successor_git_projection_is_stable(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        runtime = "ead1214e3f01e68e577c3163e1cf143ee5753490"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact42 = subprocess.check_output(
            ["git", "diff", "--name-only", base, runtime],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
        ).splitlines()
        self.assertEqual(42, len(exact42))
        self.assertEqual(
            "11F56564BC0460157FDD9E99BA00FFF7EA0B5EAC0FA5E6C24BC980BBDA08AA99",
            hashlib.sha256(
                json.dumps(
                    sorted(exact42), ensure_ascii=False, separators=(",", ":")
                ).encode("utf-8")
            ).hexdigest().upper(),
        )
        record_paths = [
            "docs/WORK_STATUS.md",
            "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
            "docs/progress/BUILD_HANDOFF.md",
            "docs/progress/build-progress.json",
            "docs/progress/progress-events.json",
            "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            "scripts/check_project_progress.py",
            "tests/tooling/test_project_progress.py",
        ]
        repository = {
                "projection_mode": checker.VALIDATED_BASE_PROJECTION_MODE,
                "validated_base_commit": base,
                "head_relation": "FEATURE_WORKTREE_C21_WSL_CONTROL_RUNTIME_SUCCESSOR_ACTIVE_EXACT42",
                "branch": "codex/c21-operational-execution",
                "upstream": "origin/codex/c21-operational-execution",
                "remote_head": remote,
                "feature_remote": "origin/codex/c21-operational-execution",
                "feature_remote_head": remote,
                "local_head": runtime,
                "exact_allowed_paths": exact42,
            }
        progress = {
            "event_sequence": 488,
            "last_event_id": "evt_c21_wsl_control_runtime_successor_bound",
            "wsl_early_validation": {
                "status": "ACTIVE_CONTROL_RUNTIME_SUCCESSOR_PENDING_PUSH"
            },
        }
        common = {
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": progress,
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(
            common,
            actual_head=runtime,
            actual_changed_paths=exact42,
            control_descendant_paths=record_paths,
            worktree_is_clean=False,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **precommit)
        )

        exact44 = sorted(
            set(exact42)
            | {
                "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
                "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
            }
        )
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=exact44,
            control_descendant_paths=record_paths,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **postcommit)
        )

        for bad_paths in (
            record_paths[:-1],
            record_paths + ["arbitrary.txt"],
            record_paths + ["deploy/wsl/cleanup.sh"],
        ):
            invalid_precommit = dict(precommit, control_descendant_paths=bad_paths)
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(
                    repository, **invalid_precommit
                ),
            )
            invalid_paths = dict(postcommit, control_descendant_paths=bad_paths)
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **invalid_paths),
            )
        wrong_branch = dict(postcommit, actual_branch="codex/arbitrary")
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_branch),
        )
        wrong_upstream = dict(postcommit, actual_upstream="origin/arbitrary")
        self.assertIn(
            "GIT_UPSTREAM_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_upstream),
        )
        wrong_remote = dict(postcommit, actual_remote_head="0" * 40)
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **wrong_remote),
        )
        nonancestor = dict(
            postcommit,
            projected_local_head_is_ancestor=False,
            control_is_ancestor=False,
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            checker.validate_repository_projection(repository, **nonancestor),
        )
        dirty_descendant = dict(postcommit, worktree_is_clean=False)
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dirty_descendant),
        )

    def test_c21_wsl_control_runtime_postcommit_real_git_requires_one_direct_exact44_record_commit(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        bundle["progress"] = json.loads(
            subprocess.check_output(
                [
                    "git",
                    "show",
                    "326476d69a3228f9dfcf64ff1dd056577bcbcf55:docs/progress/build-progress.json",
                ],
                cwd=ROOT,
                text=True,
                encoding="utf-8",
            )
        )
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        runtime = "ead1214e3f01e68e577c3163e1cf143ee5753490"
        runtime_parent = "5251a0b889f4e1062a5780eea9f03d8e9b9f69bb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(
            {
                "docs/WORK_STATUS.md",
                "docs/evidence/manifests/C-21_WSL_CONTROL_RUNTIME_SUCCESSOR_MANIFEST.json",
                "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/build-progress.json",
                "docs/progress/progress-events.json",
                "docs/progress/progress-handoff-detached-digest-c21-wsl-control-runtime-successor.json",
                "scripts/check_project_progress.py",
                "tests/tooling/test_project_progress.py",
            }
        )

        def git(repo: Path, *args: str, input_text: str | None = None) -> str:
            return subprocess.check_output(
                ["git", *args],
                cwd=repo,
                input=input_text,
                text=True,
                encoding="utf-8",
            ).strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(
                [
                    "git",
                    "-c",
                    "core.autocrlf=false",
                    "-c",
                    "core.eol=lf",
                    "clone",
                    "--quiet",
                    "--no-checkout",
                    "--no-hardlinks",
                    str(ROOT),
                    str(repo),
                ],
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-B", branch, runtime],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True
            )
            subprocess.run(
                ["git", "config", "user.email", "anvil-test@example.invalid"],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "update-ref", f"refs/remotes/origin/{branch}", remote],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "branch", "--set-upstream-to", f"origin/{branch}", branch],
                cwd=repo,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def commit_record(repo: Path, message: str) -> str:
            subprocess.run(
                ["git", "commit", "--quiet", "-m", message], cwd=repo, check=True
            )
            return git(repo, "rev-parse", "HEAD")

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)

            valid_repo = create_fixture(temp_root, "valid")
            valid_head = commit_record(valid_repo, "seq488 exact8 record")
            self.assertEqual(
                44,
                len(
                    git(
                        valid_repo, "diff", "--name-only", base, valid_head
                    ).splitlines()
                ),
            )
            self.assertEqual(
                [runtime],
                git(valid_repo, "show", "-s", "--format=%P", valid_head).split(),
            )
            self.assertEqual([], validate(valid_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(
                    ["git", "show", f"{base}:docs/progress/BUILD_HANDOFF.md"],
                    cwd=reverted_repo,
                )
            )
            subprocess.run(
                ["git", "add", "--", "docs/progress/BUILD_HANDOFF.md"],
                cwd=reverted_repo,
                check=True,
            )
            reverted_head = commit_record(reverted_repo, "seq488 record with reversion")
            self.assertEqual(
                43,
                len(
                    git(
                        reverted_repo, "diff", "--name-only", base, reverted_head
                    ).splitlines()
                ),
            )
            reverted_errors = validate(reverted_repo)

            second_repo = create_fixture(temp_root, "second-descendant")
            first_record_head = commit_record(second_repo, "seq488 exact8 record")
            with (second_repo / "docs/WORK_STATUS.md").open(
                "a", encoding="utf-8", newline="\n"
            ) as stream:
                stream.write("\nsecond descendant mutation\n")
            subprocess.run(
                ["git", "add", "--", "docs/WORK_STATUS.md"],
                cwd=second_repo,
                check=True,
            )
            second_head = commit_record(second_repo, "second exact8 descendant")
            self.assertEqual(
                44,
                len(git(second_repo, "diff", "--name-only", base, second_head).splitlines()),
            )
            self.assertEqual(
                [first_record_head],
                git(second_repo, "show", "-s", "--format=%P", second_head).split(),
            )
            second_descendant_errors = validate(second_repo)

            wrong_parent_repo = create_fixture(temp_root, "wrong-parent")
            record_tree = git(wrong_parent_repo, "write-tree")
            side_tree = git(wrong_parent_repo, "rev-parse", f"{runtime_parent}^{{tree}}")
            side_commit = git(
                wrong_parent_repo,
                "commit-tree",
                side_tree,
                "-p",
                runtime_parent,
                input_text="side parent\n",
            )
            wrong_parent_head = git(
                wrong_parent_repo,
                "commit-tree",
                record_tree,
                "-p",
                runtime,
                "-p",
                side_commit,
                input_text="seq488 wrong-parent merge\n",
            )
            subprocess.run(
                ["git", "update-ref", "HEAD", wrong_parent_head],
                cwd=wrong_parent_repo,
                check=True,
            )
            self.assertEqual(
                44,
                len(
                    git(
                        wrong_parent_repo,
                        "diff",
                        "--name-only",
                        base,
                        wrong_parent_head,
                    ).splitlines()
                ),
            )
            self.assertEqual(
                [runtime, side_commit],
                git(
                    wrong_parent_repo,
                    "show",
                    "-s",
                    "--format=%P",
                    wrong_parent_head,
                ).split(),
            )
            wrong_parent_errors = validate(wrong_parent_repo)

            for scenario, errors in (
                ("base_to_head_exact43_reversion", reverted_errors),
                ("second_descendant_commit", second_descendant_errors),
                ("wrong_parent_merge", wrong_parent_errors),
            ):
                with self.subTest(scenario=scenario):
                    self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", errors)

    def test_c21_wsl_postcommit_git_projection_rejects_every_dirty_variant(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        if bundle["progress"]["event_sequence"] != 487:
            historical_commit = "ead1214e3f01e68e577c3163e1cf143ee5753490"
            bundle["progress"] = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{historical_commit}:docs/progress/build-progress.json",
                    ],
                    cwd=ROOT,
                    text=True,
                    encoding="utf-8",
                )
            )
        repository = bundle["progress"]["repository"]
        actual_head = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
        expected_upstream = "ca92b7845eda803cff3c432799642e4f9243d4d6"

        def validate_simulated(
            *,
            status: str = "",
            branch: str = "codex/c21-operational-execution",
            remote: str = expected_upstream,
            ancestor: bool = True,
        ) -> list[str]:
            with tempfile.TemporaryDirectory() as temp:
                simulated_root = Path(temp)
                (simulated_root / ".git").write_text("gitdir: simulated\n", encoding="utf-8")

                def fake_git_value(_root: Path, *args: str) -> str | None:
                    if args == ("rev-parse", "HEAD"):
                        return actual_head
                    if args == ("branch", "--show-current"):
                        return branch
                    if args == ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"):
                        return "origin/codex/c21-operational-execution"
                    if args == ("rev-parse", "@{u}"):
                        return remote
                    if args == ("rev-parse", repository["feature_remote"]):
                        return remote
                    if args[:2] == ("diff", "--name-only"):
                        revision_range = args[2]
                        if revision_range.startswith(repository["local_head"]):
                            return "\n".join(repository["postcommit_successor_paths"])
                        return "\n".join(repository["exact_allowed_paths"])
                    if args[-2:] == ("status", "--porcelain=v1") or "status" in args:
                        return status
                    return None

                simulated = copy.deepcopy(bundle)
                simulated["_root"] = simulated_root
                with mock.patch.object(checker, "_git_value", side_effect=fake_git_value), mock.patch.object(
                    checker, "_git_returncode", return_value=0 if ancestor else 1
                ):
                    return checker._validate_git_projection(simulated)

        self.assertEqual([], validate_simulated())
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status=" M docs/WORK_STATUS.md"),
        )
        current_six = repository["postcommit_successor_paths"][:6]
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status="\n".join(f" M {path}" for path in current_six)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status="?? arbitrary-untracked.txt"),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            validate_simulated(status=" M arbitrary-tracked.txt"),
        )
        self.assertIn(
            "GIT_BRANCH_MISMATCH",
            validate_simulated(branch="codex/arbitrary"),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate_simulated(remote="f" * 40),
        )
        self.assertIn(
            "GIT_DESCENDANT_ORIGIN_MISMATCH",
            validate_simulated(ancestor=False),
        )

    def _historical_bundle(self, checker, commit: str):
        """Load an immutable historical projection without mixing current files."""
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        repo = Path(temp.name) / "historical"
        subprocess.run(
            [
                "git",
                "-c",
                "core.autocrlf=false",
                "-c",
                "core.eol=lf",
                "clone",
                "--quiet",
                "--no-checkout",
                "--no-hardlinks",
                str(ROOT),
                str(repo),
            ],
            check=True,
        )
        subprocess.run(["git", "checkout", "--quiet", "--detach", commit], cwd=repo, check=True)
        return checker.load_bundle(repo), repo

    def _independent_judgment_bundle(self, checker):
        """Load seq498 plus its intentionally untracked tester authority source."""
        bundle, repo = self._historical_bundle(
            checker, "4178ae78db2c48e176e8543364d09787e54bb4ad"
        )
        source = Path(".superpowers/sdd/Anvil_작업계획서_v1/seq496-c21-independent-judgment.md")
        destination = repo / source
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(_SEQ496_INDEPENDENT_JUDGMENT_SOURCE)
        return bundle, repo

    def test_c21_wsl_fresh_clone_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq489 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_fresh_clone_candidate_rebind_projection(
                bundle, manifest
            ),
        )

        current_raw = (historical_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 488)
        self.assertEqual(792116, len(prefix))
        self.assertEqual(
            "842F518F9F935402BE41BA9E873EDAFE57973D86C87A37AFFD77482F173B7A7D",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "CC651FA094FCD1873450DDB9C6E57F1EDF019A6373712756129ADC86FEA9B6C9",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:488])
            ).hexdigest().upper(),
        )

        exact44 = checker.c21_wsl_fresh_clone_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        exact46 = checker.c21_wsl_fresh_clone_candidate_record_committed_exact_paths()
        self.assertEqual((44, 11, 46), (len(exact44), len(exact11), len(exact46)))
        for paths, expected in (
            (exact44, "A6D1C6AC386639995DA003F6934D9C24ACF81EE860FCCB094AAA731BD8A88E6B"),
            (exact11, "C4DDBACD49E01E710FDC93D83B6247C0BCBFA484C2FBA8317BEF83CF14C3885A"),
            (exact46, "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

        candidate_manifest = json.loads(
            (historical_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        binding = candidate_manifest["authority"]["derived_binding"]
        self.assertEqual(binding, manifest["derived_correction_binding"])
        self.assertEqual(
            candidate_manifest["authority"]["derived_binding_sha256"],
            manifest["derived_correction_binding_sha256"],
        )

    def test_c21_wsl_fresh_clone_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_FRESH_CLONE_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )

        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = (
            "refs/remotes/origin/candidates/c21-wsl-exact34"
        )
        mutations.append(("old_candidate_ref", bundle, old_ref, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("derived_binding_hash", bundle, wrong_binding, "C21_WSL_FRESH_CLONE_REBIND_BINDING_INVALID"))
        subset = copy.deepcopy(manifest)
        subset["path_contracts"]["record_successor"]["path_count"] = 10
        mutations.append(("record_subset", bundle, subset, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external_execution", bundle, external, "C21_WSL_FRESH_CLONE_REBIND_BOUNDARY_INVALID"))
        changed_event = copy.deepcopy(bundle)
        changed_event["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical_event", changed_event, manifest, "C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID"))
        changed_current_event = copy.deepcopy(bundle)
        changed_current_event["events"]["events"][-1]["details"]["branch"] = "codex/arbitrary"
        mutations.append(("current_event_branch", changed_current_event, manifest, "C21_WSL_FRESH_CLONE_REBIND_EVENTS_INVALID"))
        wrong_record_paths = copy.deepcopy(manifest)
        wrong_record_paths["record_successor_paths"] = wrong_record_paths[
            "record_successor_paths"
        ][:-1]
        mutations.append(("record_path_list", bundle, wrong_record_paths, "C21_WSL_FRESH_CLONE_REBIND_MANIFEST_INVALID"))

        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_fresh_clone_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_fresh_clone_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        repository = bundle["progress"]["repository"]
        candidate = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact44 = sorted(checker.c21_wsl_fresh_clone_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths())
        exact46 = sorted(checker.c21_wsl_fresh_clone_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(
            common,
            actual_head=candidate,
            actual_changed_paths=exact44,
            control_descendant_paths=exact11,
            worktree_is_clean=False,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **precommit)
        )
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=exact46,
            control_descendant_paths=exact11,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual(
            [], checker.validate_repository_projection(repository, **postcommit)
        )
        for bad_paths in (
            exact11[:-1],
            exact11 + ["arbitrary.txt"],
            exact11 + ["deploy/wsl/deploy.sh"],
        ):
            with self.subTest(bad_paths=bad_paths):
                self.assertIn(
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                    checker.validate_repository_projection(
                        repository,
                        **dict(precommit, control_descendant_paths=bad_paths),
                    ),
                )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(
                repository,
                **dict(postcommit, control_runtime_record_commit_is_direct=False),
            ),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(
                repository, **dict(postcommit, worktree_is_clean=False)
            ),
        )

    def test_c21_wsl_fresh_clone_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "99e83e4b07df1cffced6a89ff16ff2266ddaa426"
        )
        candidate = "326476d69a3228f9dfcf64ff1dd056577bcbcf55"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(
            checker.c21_wsl_fresh_clone_candidate_rebind_successor_paths()
        )

        def git(repo: Path, *args: str, input_text: str | None = None) -> str:
            return subprocess.check_output(
                ["git", *args],
                cwd=repo,
                input=input_text,
                text=True,
                encoding="utf-8",
            ).strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(
                [
                    "git",
                    "-c",
                    "core.autocrlf=false",
                    "-c",
                    "core.eol=lf",
                    "clone",
                    "--quiet",
                    "--no-checkout",
                    "--no-hardlinks",
                    str(ROOT),
                    str(repo),
                ],
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-B", branch, candidate],
                cwd=repo,
                check=True,
            )
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(
                ["git", "config", "user.email", "anvil-test@example.invalid"],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "update-ref", f"refs/remotes/origin/{branch}", remote],
                cwd=repo,
                check=True,
            )
            subprocess.run(
                ["git", "branch", "--set-upstream-to", f"origin/{branch}", branch],
                cwd=repo,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "seq489 exact11 record"],
                cwd=valid_repo,
                check=True,
            )
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(46, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq489 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "seq489 record"],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", "-b", "side", candidate],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"],
                cwd=merge_repo,
                check=True,
            )
            subprocess.run(
                ["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True
            )
            subprocess.run(
                ["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"],
                cwd=merge_repo,
                check=True,
            )
            self.assertEqual(
                2,
                len(git(merge_repo, "show", "-s", "--format=%P", "HEAD").split()),
            )
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(
                    ["git", "show", f"{base}:docs/progress/BUILD_HANDOFF.md"],
                    cwd=reverted_repo,
                )
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(reverted_repo))


    def test_c21_wsl_compose_runner_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq490 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_compose_runner_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 489)
        self.assertEqual(803027, len(prefix))
        self.assertEqual(
            "8F3067777D6B906E12A9B5E225F63DE3049CD27BD32B0449C48016327E008539",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "0D7CEDE2D5A539EA321872599D45398F6A3C55629EE2F9708AA98F59A7C5B26D",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:489])
            ).hexdigest().upper(),
        )
        exact46 = checker.c21_wsl_compose_runner_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_compose_runner_candidate_rebind_successor_paths()
        exact48 = checker.c21_wsl_compose_runner_candidate_record_committed_exact_paths()
        self.assertEqual((46, 11, 48), (len(exact46), len(exact11), len(exact48)))
        for paths, expected in (
            (exact46, "F538ABED26C9EB01210C14144CD861889BFF603175A72203CEA717DFC46C1C86"),
            (exact11, "E439C0A394C536E1825E7C3FCF606BB7CC14D39C0DF29E7B60E648885EB6B110"),
            (exact48, "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_compose_runner_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = (
            "COMPLETE_SEQ490_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
            "WITHOUT_SEPARATE_PROJECT_APPROVAL"
        )
        expected_safe_action = (
            "seq490 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
            "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
            "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
            "C-01은 계속 차단한다."
        )
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_compose_runner_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COMPOSE_RUNNER_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_COMPOSE_RUNNER_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_COMPOSE_RUNNER_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_COMPOSE_RUNNER_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_COMPOSE_RUNNER_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_compose_runner_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_compose_runner_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        repository = bundle["progress"]["repository"]
        candidate = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact46 = sorted(checker.c21_wsl_compose_runner_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_compose_runner_candidate_rebind_successor_paths())
        exact48 = sorted(checker.c21_wsl_compose_runner_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact46, control_descendant_paths=exact11, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact48, control_descendant_paths=exact11, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact11[:-1], exact11 + ["arbitrary.txt"], exact11 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_compose_runner_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "18fa604531acfd303c10effa528797fbd5b55c8b")
        snapshot_root = bundle["_root"]
        candidate = "830ad98546ed82a59524dd5a6cef0a5b7a6a96b0"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_compose_runner_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 exact11 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(48, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq490 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_cold_start_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq491 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_cold_start_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 490)
        self.assertEqual(814540, len(prefix))
        self.assertEqual(
            "E0A940F4FB2AD3EAE694831599063512339647ECABE64E20C924677A27672B19",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "22A0C80EDABC24894FFCFF8D4036E9B4CB09698B21FA713958D515CD7DCCEFF8",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:490])
            ).hexdigest().upper(),
        )
        exact48 = checker.c21_wsl_cold_start_candidate_committed_exact_paths()
        exact11 = checker.c21_wsl_cold_start_candidate_rebind_successor_paths()
        exact50 = checker.c21_wsl_cold_start_candidate_record_committed_exact_paths()
        self.assertEqual((48, 11, 50), (len(exact48), len(exact11), len(exact50)))
        for paths, expected in (
            (exact48, "2626990127D2830414F77371813D893143C51065B0ACF41D14EAD3FEBBF88288"),
            (exact11, "D7016A7C101CE330EECD91A12A4FB093628969D3B19158A6950FF398401D1952"),
            (exact50, "9D28888908150BC834FC8931D12A35A9265C7D589ED2D89EAD7F2248E2D179EE"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_cold_start_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = (
            "COMPLETE_SEQ491_REVIEW_THEN_AUTONOMOUS_PRIVATE_PUSH_"
            "WITHOUT_SEPARATE_PROJECT_APPROVAL"
        )
        expected_safe_action = (
            "seq491 review 완료 후 Main이 승인된 개발·테스트 범위의 private "
            "candidate/control refs를 별도 프로젝트 승인 대기 없이 자동 push하고 "
            "append-only 결과 checkpoint를 기록한 뒤 WSL 검증으로 진행한다. "
            "C-01은 계속 차단한다."
        )
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_cold_start_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_COLD_START_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_COLD_START_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_COLD_START_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_COLD_START_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_COLD_START_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_cold_start_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_cold_start_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        repository = bundle["progress"]["repository"]
        candidate = "324eb169fedbce958d2e8cc29362deb7af433677"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact48 = sorted(checker.c21_wsl_cold_start_candidate_committed_exact_paths())
        exact11 = sorted(checker.c21_wsl_cold_start_candidate_rebind_successor_paths())
        exact50 = sorted(checker.c21_wsl_cold_start_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact48, control_descendant_paths=exact11, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact50, control_descendant_paths=exact11, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact11[:-1], exact11 + ["arbitrary.txt"], exact11 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_cold_start_candidate_rebind_real_git_requires_direct_exact11_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "3f52d26a61e49543dd3d3121f5cc62a04f809a3d")
        snapshot_root = bundle["_root"]
        candidate = "324eb169fedbce958d2e8cc29362deb7af433677"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_cold_start_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 exact11 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(50, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq491 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_ingress_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq492 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_ingress_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 491)
        self.assertEqual(827250, len(prefix))
        self.assertEqual(
            "7BE4FFEF2DC5B38FA84974BB296712E25AB8E346D274B1523C7B134804083F71",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "8453BE8410EE21BBED0EAC04F75C2DA3FB02CDA41FF1D731590FD149057AF7D7",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:491])
            ).hexdigest().upper(),
        )
        exact51 = checker.c21_wsl_ingress_candidate_committed_exact_paths()
        exact13 = checker.c21_wsl_ingress_candidate_rebind_successor_paths()
        exact54 = checker.c21_wsl_ingress_candidate_record_committed_exact_paths()
        self.assertEqual((51, 13, 54), (len(exact51), len(exact13), len(exact54)))
        for paths, expected in (
            (exact51, "F3AD3734333F4D40E2C3AC7B00C59AB0D91F06574C2CBBFCA8AAA79B49217EF2"),
            (exact13, "F17A6B348C9A88343FCB9DE019A80429698293C62E7C2D35ADCBD9D23C049DEF"),
            (exact54, "176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_ingress_candidate_rebind_routes_private_push_autonomously(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "REVIEW_COMPLETION_THEN_AUTONOMOUS_PRIVATE_PUSH"
        expected_action = "COMPLETE_SEQ492_BINDING_REVIEW_THEN_HOLD_RUNTIME_FOR_I3_PRODUCT_SUCCESSOR"
        expected_safe_action = 'seq492 결박 검토·기록 후 I-3 rollback allowlist 제품 보완 승인과 검증을 기다린다. 새 candidate의 deploy/rollback/cleanup은 금지하며 C-01은 계속 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_ingress_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_INGRESS_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_INGRESS_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_INGRESS_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_INGRESS_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_ingress_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_ingress_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        repository = bundle["progress"]["repository"]
        candidate = "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact51 = sorted(checker.c21_wsl_ingress_candidate_committed_exact_paths())
        exact13 = sorted(checker.c21_wsl_ingress_candidate_rebind_successor_paths())
        exact54 = sorted(checker.c21_wsl_ingress_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact51, control_descendant_paths=exact13, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact54, control_descendant_paths=exact13, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact13[:-1], exact13 + ["arbitrary.txt"], exact13 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_ingress_candidate_rebind_real_git_requires_direct_exact13_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        candidate = "ccf5109d0640bf28c461e7754ad56e0821fd77be"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_ingress_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 exact13 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(54, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq492 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_ingress_runtime_hold_cannot_be_promoted_to_execution(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "48fbad8be35c7e826dd31363464c7c477d9ca9e8")
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_INGRESS_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("BLOCKED_IMPORTANT_I3", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_INGRESS_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_ingress_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_rollback_allowlist_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest_path = (
            snapshot_root
            / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq493 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (snapshot_root / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 492)
        self.assertEqual(841414, len(prefix))
        self.assertEqual(
            "F38EA939F8A29669377EC527384EF5EEE9E5F3DEBA1DCA3FAC448B3875C7C063",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "5A8F4B9FC0187F0D06E0CB74F5EFF059004CC0D93A624EF85FE6CBB242C3530B",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:492])
            ).hexdigest().upper(),
        )
        exact54 = checker.c21_wsl_rollback_allowlist_candidate_committed_exact_paths()
        exact12 = checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths()
        exact56 = checker.c21_wsl_rollback_allowlist_candidate_record_committed_exact_paths()
        self.assertEqual((54, 12, 56), (len(exact54), len(exact12), len(exact56)))
        for paths, expected in (
            (exact54, "176FB83A22359E5C2D5A4DC7180439A31318E16BF50288B154E02046415EFCF5"),
            (exact12, "6A7D0BE483A2B9C119B6566FAB91D6B3D7A4377544DAAEC5D6C07E3359AAE183"),
            (exact56, "0BB4FEDFE3582C50A539182B065AAE2E6B19E313356CFCFC0DD6B9B385BC6714"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_keeps_external_execution_outside_current_scope(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "NOT_EXECUTED_EXTERNAL_SCOPE_HOLD"
        expected_action = "COMPLETE_SEQ493_RECORD_REVIEW_THEN_HOLD_EXTERNAL_EXECUTION_OUTSIDE_CURRENT_SCOPE"
        expected_safe_action = 'seq493 내부 결박·검토를 마감한다. I-3는 로컬 제품 검증에서 보완됐으나 이번 범위에 외부 실행은 없으므로 push/배포/rollback/cleanup은 수행하지 않으며 C-01은 계속 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (snapshot_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (snapshot_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_rollback_allowlist_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest = json.loads(
            (
                snapshot_root
                / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_ROLLBACK_ALLOWLIST_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        repository = bundle["progress"]["repository"]
        candidate = "5f8c301e18c332e3353092dab9efe5c32d0fda84"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact54 = sorted(checker.c21_wsl_rollback_allowlist_candidate_committed_exact_paths())
        exact12 = sorted(checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths())
        exact56 = sorted(checker.c21_wsl_rollback_allowlist_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact54, control_descendant_paths=exact12, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact56, control_descendant_paths=exact12, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact12[:-1], exact12 + ["arbitrary.txt"], exact12 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_rollback_allowlist_candidate_rebind_real_git_requires_direct_exact12_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        candidate = "5f8c301e18c332e3353092dab9efe5c32d0fda84"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_rollback_allowlist_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(snapshot_root), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = snapshot_root / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 exact12 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(56, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq493 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_rollback_allowlist_runtime_hold_cannot_be_promoted_to_execution(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_ROLLBACK_ALLOWLIST_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_rollback_allowlist_coherent_local_evidence_cannot_claim_external_success(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994")
        bundle = copy.deepcopy(bundle)
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_WSL_ROLLBACK_ALLOWLIST_CANDIDATE_REBIND_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))
        for document in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            document["local_product_evidence"]["external_execution"] = "PASS"
        self.assertIn("C21_WSL_ROLLBACK_ALLOWLIST_REBIND_LOCAL_EVIDENCE_INVALID", checker.validate_c21_wsl_rollback_allowlist_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_candidate_rebind_projection_binds_exact_contracts(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file(), "seq494 rebind manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(
                bundle, manifest
            ),
        )
        current_raw = (ROOT / "docs/progress/progress-events.json").read_bytes()
        prefix = checker.raw_event_object_prefix_bytes(current_raw, 493)
        self.assertEqual(857131, len(prefix))
        self.assertEqual(
            "CD537E3872F9AA042DBDB8028FB0310EBD7512673229A7D12F70A49D373465C7",
            hashlib.sha256(prefix).hexdigest().upper(),
        )
        self.assertEqual(
            "854B2F3E08482698C44251D16A7D5E3D51AF0C1879DF4DCF564DFD6A7615BAF2",
            hashlib.sha256(
                checker.canonical_json_bytes(bundle["events"]["events"][:493])
            ).hexdigest().upper(),
        )
        exact56 = checker.c21_wsl_qa_resume_candidate_committed_exact_paths()
        exact12 = checker.c21_wsl_qa_resume_candidate_rebind_successor_paths()
        exact58 = checker.c21_wsl_qa_resume_candidate_record_committed_exact_paths()
        self.assertEqual((56, 12, 58), (len(exact56), len(exact12), len(exact58)))
        for paths, expected in (
            (exact56, "0BB4FEDFE3582C50A539182B065AAE2E6B19E313356CFCFC0DD6B9B385BC6714"),
            (exact12, "315FA23EA1B82C16252A749802C3CE94E611BDF3618BF55837A2FBEA187185F5"),
            (exact58, "6F3B6CFA9DD2EA91B40A277D3199084947B0FE2C74744849FC59CF2A52647BC4"),
        ):
            self.assertEqual(
                expected,
                hashlib.sha256(
                    json.dumps(
                        sorted(paths), ensure_ascii=False, separators=(",", ":")
                    ).encode("utf-8")
                ).hexdigest().upper(),
            )

    def test_c21_wsl_qa_resume_candidate_rebind_separates_ready_from_actual_execution(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        progress = bundle["progress"]
        repository = progress["repository"]
        active = progress["wsl_early_validation"]
        expected_status = "NOT_EXECUTED_PENDING_LOCAL_SEQ494_COMMIT_EXTERNAL_SCOPE_RECONFIRMATION"
        expected_action = "COMPLETE_SEQ494_LOCAL_REVIEW_AND_COMMIT_THEN_RECONFIRM_EXTERNAL_SCOPE"
        expected_safe_action = 'seq494 로컬 검토·direct-child commit과 clean postcommit 검증까지만 완료한다. 최신 PMO 지시에 따라 private push·WSL·DB·rollback·cleanup 등 외부 실행은 금지하며 이후 외부 범위를 재확인한다. READY는 기술적 준비 상태일 뿐 현재 dispatch 권한이나 실제 성공이 아니다. Telegram·Provider·ysna·main 병합은 제외하고 C-01은 독립 판정까지 차단한다.'
        self.assertEqual(expected_status, repository["push_status"])
        self.assertEqual(expected_status, repository["candidate_push_status"])
        self.assertEqual(expected_status, active["candidate_push_status"])
        self.assertEqual(expected_action, active["next_action"])
        self.assertEqual(expected_safe_action, progress["next_safe_action"])
        handoff = checker.extract_handoff_summary(
            (historical_root / "docs/progress/BUILD_HANDOFF.md").read_text(encoding="utf-8")
        )
        self.assertEqual(expected_safe_action, handoff["next_safe_action"])
        self.assertEqual(expected_status, handoff["repository_push_status"])
        self.assertEqual(expected_status, handoff["candidate_push_status"])
        self.assertEqual(expected_action, handoff["next_action"])
        candidate = json.loads(
            (historical_root / "deploy/wsl/CandidateReleaseManifest.json").read_text(
                encoding="utf-8"
            )
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        expected_policy = "MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE"
        self.assertEqual(expected_policy, candidate["authority"]["private_push_policy"])
        self.assertEqual(expected_policy, manifest["private_push_policy"])

    def test_c21_wsl_qa_resume_candidate_rebind_projection_rejects_mutations(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        manifest = json.loads(
            (
                historical_root
                / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations: list[tuple[str, dict, dict, str]] = []
        old_ref = copy.deepcopy(manifest)
        old_ref["candidate_remote_ref"] = "refs/remotes/origin/candidates/c21-wsl-exact44"
        mutations.append(("old_ref", bundle, old_ref, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        wrong_parent = copy.deepcopy(manifest)
        wrong_parent["candidate_parent_commit"] = "0" * 40
        mutations.append(("wrong_parent", bundle, wrong_parent, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        wrong_binding = copy.deepcopy(manifest)
        wrong_binding["derived_correction_binding_sha256"] = "0" * 64
        mutations.append(("binding", bundle, wrong_binding, "C21_WSL_QA_RESUME_REBIND_BINDING_INVALID"))
        for paths in (
            manifest["record_successor_paths"][:-1],
            manifest["record_successor_paths"] + ["arbitrary.txt"],
            manifest["record_successor_paths"] + ["deploy/wsl/deploy.sh"],
        ):
            wrong_paths = copy.deepcopy(manifest)
            wrong_paths["record_successor_paths"] = paths
            mutations.append(("record_paths", bundle, wrong_paths, "C21_WSL_QA_RESUME_REBIND_MANIFEST_INVALID"))
        external = copy.deepcopy(manifest)
        external["push"] = "EXECUTED"
        mutations.append(("external", bundle, external, "C21_WSL_QA_RESUME_REBIND_BOUNDARY_INVALID"))
        historical = copy.deepcopy(bundle)
        historical["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("historical", historical, manifest, "C21_WSL_QA_RESUME_REBIND_EVENTS_INVALID"))
        for scenario, candidate_bundle, candidate_manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(
                        candidate_bundle, candidate_manifest
                    ),
                )

    def test_c21_wsl_qa_resume_candidate_rebind_git_projection_is_exact(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        repository = bundle["progress"]["repository"]
        candidate = "a342d62391a44b349733d1468ac3b180761155ab"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        exact56 = sorted(checker.c21_wsl_qa_resume_candidate_committed_exact_paths())
        exact12 = sorted(checker.c21_wsl_qa_resume_candidate_rebind_successor_paths())
        exact58 = sorted(checker.c21_wsl_qa_resume_candidate_record_committed_exact_paths())
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": remote,
            "actual_feature_remote_head": remote,
            "base_is_ancestor": True,
            "working_tree_mode": False,
            "progress": bundle["progress"],
            "projected_local_head_is_ancestor": True,
            "control_is_ancestor": True,
        }
        precommit = dict(common, actual_head=candidate, actual_changed_paths=exact56, control_descendant_paths=exact12, worktree_is_clean=False)
        postcommit = dict(common, actual_head="f" * 40, actual_changed_paths=exact58, control_descendant_paths=exact12, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **precommit))
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for bad_paths in (exact12[:-1], exact12 + ["arbitrary.txt"], exact12 + ["deploy/wsl/deploy.sh"]):
            self.assertIn(
                "GIT_DESCENDANT_PATH_SET_MISMATCH",
                checker.validate_repository_projection(repository, **dict(precommit, control_descendant_paths=bad_paths)),
            )
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)),
        )
        self.assertIn(
            "GIT_DESCENDANT_WORKTREE_DIRTY",
            checker.validate_repository_projection(repository, **dict(postcommit, worktree_is_clean=False)),
        )

    def test_c21_wsl_qa_resume_candidate_rebind_real_git_requires_direct_exact12_child(
        self,
    ) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "772afbd5eb55791ca7b5002d58378437ea496750"
        )
        candidate = "a342d62391a44b349733d1468ac3b180761155ab"
        base = "eef349682ff5598e3488c9e75163c5e0a99a0bdb"
        remote = "ca92b7845eda803cff3c432799642e4f9243d4d6"
        branch = "codex/c21-operational-execution"
        record_paths = sorted(checker.c21_wsl_qa_resume_candidate_rebind_successor_paths())

        def git(repo: Path, *args: str) -> str:
            return subprocess.check_output(["git", *args], cwd=repo, text=True, encoding="utf-8").strip()

        def create_fixture(parent: Path, name: str) -> Path:
            repo = parent / name
            subprocess.run(["git", "-c", "core.autocrlf=false", "-c", "core.eol=lf", "clone", "--quiet", "--no-checkout", "--no-hardlinks", str(ROOT), str(repo)], check=True)
            subprocess.run(["git", "checkout", "--quiet", "-B", branch, candidate], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Anvil Test"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "anvil-test@example.invalid"], cwd=repo, check=True)
            subprocess.run(["git", "update-ref", f"refs/remotes/origin/{branch}", remote], cwd=repo, check=True)
            subprocess.run(["git", "branch", "--set-upstream-to", f"origin/{branch}", branch], cwd=repo, check=True, stdout=subprocess.DEVNULL)
            for relative in record_paths:
                source = ROOT / relative
                destination = repo / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
            subprocess.run(["git", "add", "--", *record_paths], cwd=repo, check=True)
            return repo

        def validate(repo: Path) -> list[str]:
            projected = copy.deepcopy(bundle)
            projected["_root"] = repo
            return checker._validate_git_projection(projected)

        with tempfile.TemporaryDirectory() as temp:
            temp_root = Path(temp)
            valid_repo = create_fixture(temp_root, "valid")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 exact12 record"], cwd=valid_repo, check=True)
            valid_head = git(valid_repo, "rev-parse", "HEAD")
            self.assertEqual([candidate], git(valid_repo, "show", "-s", "--format=%P", valid_head).split())
            self.assertEqual(58, len(git(valid_repo, "diff", "--name-only", base, valid_head).splitlines()))
            self.assertEqual([], validate(valid_repo))

            second_repo = create_fixture(temp_root, "second")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 record"], cwd=second_repo, check=True)
            with (second_repo / "docs/WORK_STATUS.md").open("a", encoding="utf-8", newline="\n") as stream:
                stream.write("\nsecond descendant\n")
            subprocess.run(["git", "add", "docs/WORK_STATUS.md"], cwd=second_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "second descendant"], cwd=second_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(second_repo))

            merge_repo = create_fixture(temp_root, "merge")
            subprocess.run(["git", "commit", "--quiet", "-m", "seq494 record"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", "-b", "side", candidate], cwd=merge_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "--allow-empty", "-m", "side parent"], cwd=merge_repo, check=True)
            subprocess.run(["git", "checkout", "--quiet", branch], cwd=merge_repo, check=True)
            subprocess.run(["git", "merge", "--quiet", "--no-ff", "side", "-m", "merge record"], cwd=merge_repo, check=True)
            self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", validate(merge_repo))

            reverted_repo = create_fixture(temp_root, "reverted")
            (reverted_repo / "docs/progress/BUILD_HANDOFF.md").write_bytes(
                subprocess.check_output(["git", "show", f"{candidate}:docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo)
            )
            subprocess.run(["git", "add", "docs/progress/BUILD_HANDOFF.md"], cwd=reverted_repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "path reversion"], cwd=reverted_repo, check=True)
            self.assertTrue(
                {
                    "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
                    "GIT_DESCENDANT_PATH_SET_MISMATCH",
                }
                & set(validate(reverted_repo))
            )


    def test_c21_wsl_qa_resume_ready_gate_cannot_be_replaced_by_unrestricted_allowed(self):
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual("READY_FOR_APPROVED_WSL_QA", manifest["runtime_safety_gate"])
        manifest["runtime_safety_gate"] = "ALLOWED"
        self.assertIn("C21_WSL_QA_RESUME_REBIND_RUNTIME_GATE_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_coherent_local_evidence_cannot_claim_external_success(self):
        checker = self.require_checker()
        historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        bundle = copy.deepcopy(historical_bundle)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
        for document in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            document["local_product_evidence"]["external_execution"] = "PASS"
        self.assertIn("C21_WSL_QA_RESUME_REBIND_LOCAL_EVIDENCE_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_resume_coherent_predecessor_recovery_cannot_claim_new_candidate_push(self):
        checker = self.require_checker()
        historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
        bundle = copy.deepcopy(historical_bundle)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
        for doc in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest):
            doc["predecessor_private_recovery"]["current_candidate_push"] = "PASS"
        self.assertIn("C21_WSL_QA_RESUME_PREDECESSOR_RECOVERY_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))


    def test_c21_wsl_qa_resume_coherent_runtime_next_action_cannot_dispatch(self):
        checker = self.require_checker()
        for value in ("MAIN_DISPATCH_DEPLOY_NOW_WITHOUT_SCOPE_RECONFIRMATION", "OTHER_HOLD", " ", None):
            with self.subTest(value=value):
                historical_bundle, historical_root = self._historical_bundle(checker, "772afbd5eb55791ca7b5002d58378437ea496750")
                bundle = copy.deepcopy(historical_bundle)
                manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_WSL_QA_RESUME_MANIFEST.json").read_text(encoding="utf-8"))
                self.assertEqual([], checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))
                for doc in (bundle["progress"]["wsl_early_validation"], bundle["events"]["events"][-1]["details"], manifest, bundle["handoff"]):
                    if value is None: doc.pop("runtime_next_action", None)
                    else: doc["runtime_next_action"] = value
                self.assertIn("C21_WSL_QA_RESUME_REBIND_RUNTIME_NEXT_ACTION_INVALID", checker.validate_c21_wsl_qa_resume_candidate_rebind_projection(bundle, manifest))

    def test_c21_wsl_qa_execution_result_projection_is_strictly_scoped(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        manifest_path = (
            historical_root
            / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json"
        )
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
        )
        self.assertEqual("SUITABLE", manifest["product_validation"])
        self.assertEqual(
            "C-21/WSL-EARLY-VALIDATION_APPROVED_SCOPE_ONLY",
            manifest["validation_scope"],
        )
        self.assertFalse(manifest["accepted"])
        self.assertEqual("PENDING", manifest["independent_tester_status"])
        self.assertEqual(
            "BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT",
            manifest["c01_status"],
        )
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])

    def test_c21_wsl_qa_execution_result_projection_rejects_evidence_promotion(self) -> None:
        checker = self.require_checker()
        original_bundle = checker.load_bundle(ROOT)
        original_manifest = json.loads(
            (
                ROOT
                / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json"
            ).read_text(encoding="utf-8")
        )
        mutations = []
        promoted = copy.deepcopy(original_manifest)
        promoted["accepted"] = True
        mutations.append(("accepted", copy.deepcopy(original_bundle), promoted, "C21_WSL_QA_RESULT_DECISION_BOUNDARY_INVALID"))
        external = copy.deepcopy(original_manifest)
        external["execution_result"]["excluded"]["provider"] = "PASS"
        mutations.append(("provider", copy.deepcopy(original_bundle), external, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        residue = copy.deepcopy(original_manifest)
        residue["execution_result"]["cleanup"]["volumes"] = 1
        mutations.append(("residue", copy.deepcopy(original_bundle), residue, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        product_failure = copy.deepcopy(original_manifest)
        product_failure["execution_result"]["deploy_attempts"][0]["product_valid_failure"] = True
        mutations.append(("premutation_failure", copy.deepcopy(original_bundle), product_failure, "C21_WSL_QA_RESULT_EXECUTION_INVALID"))
        history = copy.deepcopy(original_bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("history", history, copy.deepcopy(original_manifest), "C21_WSL_QA_RESULT_HISTORY_INVALID"))
        for scenario, bundle, manifest, reason in mutations:
            with self.subTest(scenario=scenario):
                self.assertIn(
                    reason,
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
                )

    def test_c21_wsl_qa_execution_result_git_projection_is_exact(self) -> None:
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        repository = bundle["progress"]["repository"]
        common = {
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
        }
        precommit = dict(
            common,
            actual_head="772afbd5eb55791ca7b5002d58378437ea496750",
            actual_changed_paths=sorted(checker.c21_wsl_qa_execution_result_parent_paths()),
            control_descendant_paths=sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            worktree_is_clean=False,
            record_commit_is_direct=False,
        )
        self.assertEqual([], checker.validate_c21_wsl_qa_execution_result_git(repository, **precommit))
        bad = dict(precommit, control_descendant_paths=precommit["control_descendant_paths"] + ["arbitrary.txt"])
        self.assertIn("GIT_DESCENDANT_PATH_SET_MISMATCH", checker.validate_c21_wsl_qa_execution_result_git(repository, **bad))
        postcommit = dict(
            common,
            actual_head="f" * 40,
            actual_changed_paths=sorted(checker.c21_wsl_qa_execution_result_record_paths()),
            control_descendant_paths=sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            worktree_is_clean=True,
            record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_c21_wsl_qa_execution_result_git(repository, **postcommit))
        self.assertIn("GIT_DESCENDANT_RECORD_COMMIT_INVALID", checker.validate_c21_wsl_qa_execution_result_git(repository, **dict(postcommit, record_commit_is_direct=False)))

    def test_c21_wsl_qa_execution_result_rejects_coherent_evidence_mutations(self) -> None:
        checker = self.require_checker()
        original_bundle, historical_root = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        original_manifest = json.loads(
            (historical_root / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json").read_text(encoding="utf-8")
        )

        def mutate_all(path, value):
            bundle = copy.deepcopy(original_bundle)
            manifest = copy.deepcopy(original_manifest)
            for result in (
                manifest["execution_result"],
                bundle["events"]["events"][-1]["details"]["execution_result"],
                bundle["progress"]["wsl_early_validation"]["execution_result"],
            ):
                target = result
                for part in path[:-1]:
                    target = target[part]
                target[path[-1]] = value
            return bundle, manifest

        mutations = [
            (("candidate_commit",), "0" * 40),
            (("control_commit",), "0" * 40),
            (("environment",), "PRODUCTION"),
            (("targets",), ["POSTGRESQL_15"]),
            (("deploy_attempts", 0, "reason"), "OTHER"),
            (("deploy_attempts", 1, "cleanup_trap"), "FAIL"),
            (("deploy_attempts", 2, "ssh_config"), "/tmp/config"),
            (("candidate_deploy", "return_after_rollback"), "FAIL"),
            (("verification", "migration"), "0012_run_authority"),
            (("rollback", "from"), "0" * 40),
            (("rollback_observation", "database_counts_before_after"), "2|1|1_CHANGED"),
            (("final_state", "env_content"), "CHANGED"),
            (("excluded", "telegram"), "PASS"),
            (("evidence", "rollback_observer_scratch_sha256"), "0" * 64),
        ]
        for path, value in mutations:
            with self.subTest(path=path):
                bundle, manifest = mutate_all(path, value)
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, manifest),
                    path,
                )

    def test_c21_wsl_qa_execution_result_rejects_manifest_and_recovery_mutations(self) -> None:
        checker = self.require_checker()
        original_bundle = checker.load_bundle(ROOT)
        original_manifest = json.loads(
            (ROOT / "docs/evidence/manifests/C-21_WSL_QA_EXECUTION_RESULT_MANIFEST.json").read_text(encoding="utf-8")
        )
        manifest_mutations = {
            "record_parent_commit": "0" * 40,
            "candidate_commit": "0" * 40,
            "runtime_commit": "0" * 40,
            "historical_raw_event_bytes": 1,
            "historical_raw_events_sha256": "0" * 64,
            "historical_events_sha256": "0" * 64,
            "record_successor_path_count": 9,
            "record_successor_path_list_sha256": "0" * 64,
            "postcommit_exact_path_count": 60,
            "postcommit_exact_path_list_sha256": "0" * 64,
        }
        for field, value in manifest_mutations.items():
            with self.subTest(field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(copy.deepcopy(original_bundle), manifest),
                    field,
                )
        recovery_mutations = {
            "candidate_push_status": "NOT_EXECUTED",
            "wsl_access": "NOT_EXECUTED",
            "postgres_15": "NOT_EXECUTED",
            "postgres_18_rc": "NOT_EXECUTED",
            "migration": "NOT_EXECUTED",
            "api": "NOT_EXECUTED",
            "authenticated_sse": "NOT_EXECUTED",
            "last_event_id": "NOT_EXECUTED",
            "same_origin": "NOT_EXECUTED",
            "backup_restore": "NOT_EXECUTED",
            "application_rollback": "NOT_EXECUTED",
            "deployment": "NOT_EXECUTED",
            "database": "NOT_EXECUTED",
            "volume_cleanup": "NOT_EXECUTED",
            "runtime_safety_gate": "READY_FOR_APPROVED_WSL_QA",
            "runtime_next_action": "DISPATCH_NOW",
        }
        for field, value in recovery_mutations.items():
            with self.subTest(field=field):
                bundle = copy.deepcopy(original_bundle)
                bundle["progress"]["wsl_early_validation"][field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, copy.deepcopy(original_manifest)),
                    field,
                )
        handoff_mutations = {
            "status": "ACTIVE",
            "repository_push_status": "NOT_EXECUTED",
            "candidate_push_status": "NOT_EXECUTED",
            "deployment_status": "NOT_EXECUTED",
            "runtime_safety_gate": "READY_FOR_APPROVED_WSL_QA",
            "runtime_next_action": "DISPATCH_NOW",
            "c01_status": "STARTED",
            "dir2_status": "TRIGGERED",
        }
        for field, value in handoff_mutations.items():
            with self.subTest(handoff_field=field):
                bundle = copy.deepcopy(original_bundle)
                bundle["handoff"][field] = value
                self.assertTrue(
                    checker.validate_c21_wsl_qa_execution_result_projection(bundle, copy.deepcopy(original_manifest)),
                    field,
                )

    def test_c21_wsl_qa_execution_result_fast_path_preserves_generic_repository_guards(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "9a7a6144bcd0a7d38fce291610f40e9608a38309"
        )
        repository = bundle["progress"]["repository"]
        common = {
            "actual_head": "772afbd5eb55791ca7b5002d58378437ea496750",
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
            "base_is_ancestor": True,
            "actual_changed_paths": sorted(checker.c21_wsl_qa_execution_result_parent_paths()),
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": sorted(checker.c21_wsl_qa_execution_result_successor_paths()),
            "worktree_is_clean": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        cases = [
            ("projection_mode", "TAMPERED", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("validated_base_commit", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("head_relation", "TAMPERED", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("branch", "other", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("upstream", "origin/other", "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("remote_head", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("feature_remote_head", "0" * 40, "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1], "GIT_DESCENDANT_PROJECTION_INVALID"),
            ("qa_execution_result_successor_paths", repository["qa_execution_result_successor_paths"][:-1], "GIT_DESCENDANT_PROJECTION_INVALID"),
        ]
        for field, value, reason in cases:
            with self.subTest(field=field):
                mutated = copy.deepcopy(repository)
                mutated[field] = value
                self.assertIn(reason, checker.validate_repository_projection(mutated, **common))
        self.assertIn(
            "GIT_VALIDATED_BASE_NOT_ANCESTOR",
            checker.validate_repository_projection(repository, **dict(common, base_is_ancestor=False)),
        )
        real_git_bundle = copy.deepcopy(bundle)
        real_git_bundle["progress"]["repository"]["projection_mode"] = "TAMPERED"
        self.assertIn(
            "GIT_DESCENDANT_PROJECTION_INVALID",
            checker._validate_git_projection(real_git_bundle),
        )

    def test_c21_independent_judgment_projection_is_blocked_not_accepted(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._independent_judgment_bundle(checker)
        manifest_path = historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json"
        self.assertTrue(manifest_path.is_file())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_independent_judgment_projection(bundle, manifest))
        self.assertEqual("TEST_REVIEW", bundle["progress"]["status"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["verdict"])
        self.assertFalse(manifest["accepted"])
        self.assertIsNone(bundle["progress"]["worker_lease"])
        self.assertIsNone(bundle["progress"]["write_lease"])
        self.assertIsNone(bundle["progress"]["active_agent"])

    def test_c21_independent_judgment_rejects_revocation_order_and_lease_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_independent_judgment_projection(original, manifest))
        mutations = []
        swapped = copy.deepcopy(original)
        swapped["events"]["events"][-3], swapped["events"]["events"][-2] = swapped["events"]["events"][-2], swapped["events"]["events"][-3]
        mutations.append(("order", swapped))
        duplicate = copy.deepcopy(original)
        duplicate["events"]["events"][-2]["event_type"] = "WRITE_LEASE_REVOKED"
        mutations.append(("duplicate", duplicate))
        lease_id = copy.deepcopy(original)
        lease_id["events"]["events"][-3]["details"]["lease_id"] = "other"
        mutations.append(("lease_id", lease_id))
        fencing = copy.deepcopy(original)
        fencing["events"]["events"][-2]["details"]["execution_fencing_token"] = "other"
        mutations.append(("fencing", fencing))
        write_active = copy.deepcopy(original)
        write_active["progress"]["write_lease"] = {"status": "ACTIVE"}
        mutations.append(("write_active", write_active))
        worker_active = copy.deepcopy(original)
        worker_active["progress"]["worker_lease"] = {"status": "ACTIVE"}
        mutations.append(("worker_active", worker_active))
        agent_active = copy.deepcopy(original)
        agent_active["progress"]["active_agent"] = "developer-primary-wsl"
        mutations.append(("agent_active", agent_active))
        stale_wi = copy.deepcopy(original)
        stale_wi["progress"]["active_work_instruction"]["result_status"] = "IN_PROGRESS"
        mutations.append(("stale_wi", stale_wi))
        for scenario, bundle in mutations:
            with self.subTest(scenario=scenario):
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(manifest)))

    def test_c21_independent_judgment_rejects_coherent_decision_promotion(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))

        def mutate_all(field, value):
            bundle = copy.deepcopy(original)
            manifest = copy.deepcopy(original_manifest)
            docs = [manifest, bundle["events"]["events"][-1]["details"], bundle["progress"]["c21_independent_judgment"], bundle["handoff"]]
            for doc in docs:
                doc[field] = value
            return bundle, manifest

        for field, value in (
            ("verdict", "PASS"),
            ("accepted", True),
            ("c01_status", "STARTED"),
            ("dir2_status", "TRIGGERED"),
            ("runtime_next_action", "DISPATCH_NOW"),
        ):
            with self.subTest(field=field):
                bundle, manifest = mutate_all(field, value)
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, manifest))
        for criterion in ("2", "3", "4", "5"):
            with self.subTest(criterion=criterion):
                bundle = copy.deepcopy(original)
                manifest = copy.deepcopy(original_manifest)
                for doc in (manifest, bundle["events"]["events"][-1]["details"], bundle["progress"]["c21_independent_judgment"]):
                    doc["criteria"][criterion] = "PASS"
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, manifest))

    def test_c21_independent_judgment_rejects_history_hash_and_repository_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        history = copy.deepcopy(original)
        history["events"]["events"][0]["event_id"] += "-tampered"
        self.assertTrue(checker.validate_c21_independent_judgment_projection(history, copy.deepcopy(original_manifest)))
        for field, value in (
            ("historical_raw_event_bytes", 1),
            ("historical_raw_events_sha256", "0" * 64),
            ("historical_events_sha256", "0" * 64),
            ("record_successor_path_count", 8),
            ("record_successor_path_list_sha256", "0" * 64),
            ("postcommit_exact_path_count", 63),
            ("postcommit_exact_path_list_sha256", "0" * 64),
        ):
            with self.subTest(field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), manifest))
        for field, value in (
            ("projection_mode", "TAMPERED"),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("remote_head", "0" * 40),
            ("exact_allowed_paths", original["progress"]["repository"]["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                bundle = copy.deepcopy(original)
                bundle["progress"]["repository"][field] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(original_manifest)))

    def test_c21_independent_judgment_rejects_all_binding_event_and_digest_mutations(self) -> None:
        checker = self.require_checker()
        original, historical_root = self._independent_judgment_bundle(checker)
        original_manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_INDEPENDENT_JUDGMENT_MANIFEST.json").read_text(encoding="utf-8"))
        for field, value in (
            ("judgment_source_sha256", "0" * 64),
            ("work_instruction_sha256", "0" * 64),
            ("revocation_events", ["other"]),
            ("judgment_event_id", "other"),
        ):
            with self.subTest(manifest_field=field):
                manifest = copy.deepcopy(original_manifest)
                manifest[field] = value
                self.assertIn("C21_JUDGMENT_MANIFEST_INVALID", checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), manifest))
        event_mutations = (
            (-3, "actor", "other"), (-3, "subject_ref", "other"),
            (-3, "occurred_at", "other"), (-3, "details.execution_fencing_token", "other"),
            (-3, "details.worker_lease_id", "other"), (-3, "details.reason", "other"),
            (-2, "actor", "other"), (-2, "subject_ref", "other"),
            (-2, "details.reason", "other"), (-1, "actor", "other"),
            (-1, "subject_ref", "other"), (-1, "details.judgment_source_sha256", "0" * 64),
            (-1, "details.work_instruction_sha256", "0" * 64),
            (-1, "details.evidence_ref", "other"),
            (-1, "details.write_revocation_event_id", "other"),
            (-1, "details.worker_revocation_event_id", "other"),
        )
        for index, path, value in event_mutations:
            with self.subTest(event=index, path=path):
                bundle = copy.deepcopy(original)
                target = bundle["events"]["events"][index]
                parts = path.split(".")
                for part in parts[:-1]: target = target[part]
                target[parts[-1]] = value
                self.assertTrue(checker.validate_c21_independent_judgment_projection(bundle, copy.deepcopy(original_manifest)))
        digest = json.loads((historical_root / "docs/progress/progress-handoff-detached-digest-c21-independent-judgment.json").read_text(encoding="utf-8"))
        for path, value in (
            (("progress", "bytes"), 1), (("progress", "canonical_json_sha256"), "0" * 64),
            (("handoff", "bytes"), 1), (("handoff", "machine_summary_canonical_sha256"), "0" * 64),
            (("scope",), "other"), (("self_reference",), True),
        ):
            with self.subTest(digest_path=path):
                mutated = copy.deepcopy(digest); target = mutated
                for part in path[:-1]: target = target[part]
                target[path[-1]] = value
                with mock.patch.object(checker, "_load_json", return_value=mutated):
                    self.assertIn("C21_JUDGMENT_DIGEST_INVALID", checker.validate_c21_independent_judgment_projection(copy.deepcopy(original), copy.deepcopy(original_manifest)))

    def test_c21_independent_judgment_real_git_fast_path_preserves_structural_guards(self) -> None:
        checker = self.require_checker()
        original, _ = self._independent_judgment_bundle(checker)
        mutations = (
            ("feature_remote", "origin/tampered"),
            ("feature_remote_head", "0" * 40),
            ("projection_mode", "TAMPERED"),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("local_head", "0" * 40),
            ("worktree_status", "TAMPERED"),
            ("exact_allowed_paths", original["progress"]["repository"]["exact_allowed_paths"][:-1]),
        )
        for field, value in mutations:
            with self.subTest(field=field):
                bundle = copy.deepcopy(original)
                bundle["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(bundle), field)

    def test_c21_independent_judgment_report_is_valid_markdown(self) -> None:
        text = (ROOT / "docs/04_test_reports/C-21_INDEPENDENT_JUDGMENT_REPORT.md").read_text(encoding="utf-8")
        self.assertIn("## 판정", text)
        self.assertIn("- 전체 C-21: `TEST_REVIEW / BLOCKED_NOT_ACCEPTED`", text)
        self.assertIn("## 근거", text)
        self.assertIn("## lease 종료와 경계", text)
        self.assertFalse(any(line.startswith("+") for line in text.splitlines()))

    def test_c21_development_qa_resume_start_projection_activates_exact_leases(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "580ed9d7b202383a107b5e0bda0f53b2066cddc5"
        )
        manifest_path = historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json"
        self.assertTrue(manifest_path.is_file(), "development QA resume start manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        self.assertEqual(501, bundle["progress"]["event_sequence"])
        self.assertEqual("ACTIVE_DEVELOPMENT_QA", bundle["progress"]["status"])
        self.assertEqual("developer-primary", bundle["progress"]["active_agent"])
        self.assertEqual(
            "worker-lease-c21-development-qa-resume-20260905-001",
            bundle["progress"]["worker_lease"]["lease_id"],
        )
        self.assertEqual(
            "write-lease-c21-development-qa-resume-20260905-001",
            bundle["progress"]["write_lease"]["lease_id"],
        )

    def test_c21_development_qa_resume_rejects_event_fencing_and_decision_mutations(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "580ed9d7b202383a107b5e0bda0f53b2066cddc5"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        mutations = []
        for index, path, value in (
            (-3, "event_type", "PACKAGE_RESUMED"),
            (-3, "details.execution_fencing_token", "tampered"),
            (-2, "details.write_fencing_token", "tampered"),
            (-2, "details.paths", ["other"]),
            (-1, "details.reason", "tampered"),
        ):
            mutated = copy.deepcopy(bundle)
            target = mutated["events"]["events"][index]
            parts = path.split(".")
            for part in parts[:-1]:
                target = target[part]
            target[parts[-1]] = value
            mutations.append((path, mutated, copy.deepcopy(manifest)))
        for field, value in (
            ("status", "TEST_REVIEW"),
            ("active_agent", None),
            ("worker_lease", None),
            ("write_lease", None),
        ):
            mutated = copy.deepcopy(bundle)
            mutated["progress"][field] = value
            mutations.append((field, mutated, copy.deepcopy(manifest)))
        for field, value in (
            ("accepted", True),
            ("c01_status", "STARTED"),
            ("dir2_status", "TRIGGERED"),
            ("runtime_next_action", "HOLD_USER_VALIDATION_REQUIRED"),
        ):
            mutated = copy.deepcopy(bundle)
            mutated["progress"]["development_qa_resume"][field] = value
            mutations.append((field, mutated, copy.deepcopy(manifest)))
        for scenario, mutated_bundle, mutated_manifest in mutations:
            with self.subTest(scenario=scenario):
                self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(mutated_bundle, mutated_manifest))

    def test_c21_development_qa_resume_rejects_history_manifest_and_exact_scope_mutations(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "580ed9d7b202383a107b5e0bda0f53b2066cddc5"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        history = copy.deepcopy(bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(history, copy.deepcopy(manifest)))
        for field, value in (
            ("historical_full_file_bytes", 1),
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_bytes", 1),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("historical_events_canonical_sha256", "0" * 64),
            ("start_exact_path_count", 9),
            ("start_exact_path_list_sha256", "0" * 64),
            ("developer_exact_path_count", 6),
            ("developer_exact_path_list_sha256", "0" * 64),
        ):
            mutated = copy.deepcopy(manifest)
            mutated[field] = value
            self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(copy.deepcopy(bundle), mutated), field)

    def test_c21_development_qa_resume_distinguishes_full_blob_prefix_and_execution_authority(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "580ed9d7b202383a107b5e0bda0f53b2066cddc5"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_RESUME_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_resume_start_projection(bundle, manifest))
        self.assertNotIn("proposal_sha256", manifest)
        self.assertEqual("SCRATCH_ONLY_MAIN_REVIEW_INPUT_NOT_AUTHORITY", manifest["proposal_classification"])
        self.assertEqual(882505, manifest["historical_full_file_bytes"])
        self.assertEqual("B9C412B586999C2DCD530B7E6EDD283CE3A124BF4E98B08F8673A3184D641F78", manifest["historical_full_file_sha256"])
        self.assertEqual(882302, manifest["historical_event_object_prefix_bytes"])
        self.assertEqual("3659A9808E97F6927E983CFCCD617BF5B1740D60CCDFE16D39D8107C8780C955", manifest["historical_event_object_prefix_sha256"])
        self.assertEqual("docs/work_orders/C-21_DEVELOPMENT_QA_RESUME_WORK_INSTRUCTION.md", manifest["execution_authority_path"])
        for field, value in (
            ("proposal_classification", "APPROVED_AUTHORITY"),
            ("historical_full_file_bytes", 1),
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_bytes", 1),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("execution_authority_path", "other"),
            ("execution_authority_sha256", "0" * 64),
        ):
            with self.subTest(field=field):
                mutated = copy.deepcopy(manifest)
                mutated[field] = value
                self.assertTrue(checker.validate_c21_development_qa_resume_start_projection(copy.deepcopy(bundle), mutated))

    def test_c21_development_qa_resume_public_and_real_git_paths_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "580ed9d7b202383a107b5e0bda0f53b2066cddc5"
        )
        repository = bundle["progress"]["repository"]
        exact64 = sorted(checker.c21_independent_judgment_record_paths())
        exact10 = sorted(checker.c21_development_qa_resume_start_paths())
        common = {
            "actual_head": repository["local_head"],
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": exact64,
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": exact10,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        postcommit = dict(
            common,
            actual_head="34eb1725b47c544b6ec314a28428b364a029f3eb",
            actual_changed_paths=sorted(set(exact64) | set(exact10)),
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=False,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for field, value in (
            ("control_is_ancestor", False),
            ("actual_changed_paths", sorted(set(exact64) | set(exact10))[:-1]),
            ("control_descendant_paths", exact10[:-1]),
            ("working_tree_mode", True),
            ("worktree_is_clean", False),
        ):
            with self.subTest(postcommit_field=field):
                self.assertTrue(
                    checker.validate_repository_projection(
                        repository, **dict(postcommit, **{field: value})
                    )
                )
        for field, value in (
            ("remote_head", "0" * 40),
            ("feature_remote", "origin/tampered"),
            ("feature_remote_head", "0" * 40),
            ("branch", "other"),
            ("upstream", "origin/other"),
            ("local_head", "0" * 40),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("worktree_status", "CLEAN"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                mutated = copy.deepcopy(repository)
                mutated[field] = value
                self.assertTrue(checker.validate_repository_projection(mutated, **common))
                real = copy.deepcopy(bundle)
                real["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(real))
        for field, value in (
            ("actual_remote_head", "0" * 40),
            ("actual_feature_remote_head", "0" * 40),
            ("actual_changed_paths", exact64[:-1]),
            ("working_tree_mode", False),
            ("control_descendant_paths", exact10[:-1]),
            ("worktree_is_clean", True),
            ("base_is_ancestor", False),
            ("control_runtime_record_commit_is_direct", True),
        ):
            with self.subTest(actual_field=field):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(common, **{field: value})))

    def test_c21_development_qa_review_successor_projects_rework_without_external_hold(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "aa116e2044671628011b46d190de014ad7fd0af4"
        )
        manifest_path = historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_REVIEW_SUCCESSOR_MANIFEST.json"
        self.assertTrue(manifest_path.is_file(), "development QA review successor manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_review_successor_projection(bundle, manifest))
        self.assertEqual(506, bundle["progress"]["event_sequence"])
        self.assertEqual("REWORK_REQUIRED", bundle["progress"]["status"])
        self.assertEqual("ISSUE_C21_RUNTIME_UI_REWORK_WI", bundle["progress"]["runtime_next_action"])
        self.assertIsNone(bundle["progress"]["active_agent"])
        self.assertIsNone(bundle["progress"]["worker_lease"])
        self.assertIsNone(bundle["progress"]["write_lease"])

    def test_c21_development_qa_review_successor_rejects_decision_and_history_mutations(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "aa116e2044671628011b46d190de014ad7fd0af4"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_REVIEW_SUCCESSOR_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_review_successor_projection(bundle, manifest))
        history = copy.deepcopy(bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        self.assertTrue(checker.validate_c21_development_qa_review_successor_projection(history, copy.deepcopy(manifest)))
        for field, value in (
            ("verdict", "BLOCKED_NOT_ACCEPTED"),
            ("accepted", True),
            ("c01_status", "STARTED"),
            ("dir2_status", "TRIGGERED"),
            ("runtime_next_action", "HOLD_USER_VALIDATION_REQUIRED"),
            ("provider_runtime_status_port", "PASS"),
            ("workbench_config", "PASS"),
            ("ui_click_evidence", True),
            ("actual_provider_calls", "EXECUTED"),
            ("actual_telegram_outbound", "EXECUTED"),
        ):
            with self.subTest(field=field):
                mutated = copy.deepcopy(manifest)
                mutated[field] = value
                self.assertTrue(checker.validate_c21_development_qa_review_successor_projection(copy.deepcopy(bundle), mutated))

    def test_c21_development_qa_review_successor_rejects_event_and_binding_mutations(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "aa116e2044671628011b46d190de014ad7fd0af4"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_DEVELOPMENT_QA_REVIEW_SUCCESSOR_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_development_qa_review_successor_projection(bundle, manifest))
        for index, path, value in (
            (-5, "event_type", "PACKAGE_COMPLETED"),
            (-5, "details.write_fencing_token", "tampered"),
            (-4, "details.execution_fencing_token", "tampered"),
            (-3, "details.commit", "0" * 40),
            (-2, "details.verdict", "SPEC_FAIL"),
            (-1, "details.verdict", "BLOCKED_NOT_ACCEPTED"),
            (-1, "details.runtime_next_action", "HOLD_USER_VALIDATION_REQUIRED"),
        ):
            with self.subTest(event=index, path=path):
                mutated = copy.deepcopy(bundle)
                target = mutated["events"]["events"][index]
                parts = path.split(".")
                for part in parts[:-1]:
                    target = target[part]
                target[parts[-1]] = value
                self.assertTrue(checker.validate_c21_development_qa_review_successor_projection(mutated, copy.deepcopy(manifest)))
        for field, value in (
            ("historical_full_file_bytes", 1),
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_bytes", 1),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("historical_events_canonical_ascii_sha256", "0" * 64),
            ("developer_commit", "0" * 40),
            ("developer_exact_path_list_sha256", "0" * 64),
            ("cumulative_exact_path_list_sha256", "0" * 64),
            ("record_exact_path_list_sha256", "0" * 64),
            ("record_commit", "0" * 40),
            ("record_commit_mode", "SELF_BOUND"),
        ):
            with self.subTest(manifest_field=field):
                mutated = copy.deepcopy(manifest)
                mutated[field] = value
                self.assertTrue(checker.validate_c21_development_qa_review_successor_projection(copy.deepcopy(bundle), mutated))

    def test_c21_development_qa_review_successor_public_and_real_git_paths_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "aa116e2044671628011b46d190de014ad7fd0af4"
        )
        repository = bundle["progress"]["repository"]
        exact75 = sorted(checker.c21_development_qa_review_predecessor_paths())
        exact9 = sorted(checker.c21_development_qa_review_successor_paths())
        common = {
            "actual_head": repository["local_head"],
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": exact75,
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": exact9,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        for field, value in (
            ("remote_head", "0" * 40),
            ("feature_remote", "origin/tampered"),
            ("feature_remote_head", "0" * 40),
            ("branch", "other"),
            ("upstream", "origin/other"),
            ("local_head", "0" * 40),
            ("validated_base_commit", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("worktree_status", "CLEAN"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                mutated = copy.deepcopy(repository)
                mutated[field] = value
                self.assertTrue(checker.validate_repository_projection(mutated, **common))
                real = copy.deepcopy(bundle)
                real["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(real))
        for field, value in (
            ("actual_remote_head", "0" * 40),
            ("actual_feature_remote_head", "0" * 40),
            ("actual_changed_paths", exact75[:-1]),
            ("working_tree_mode", False),
            ("control_descendant_paths", exact9[:-1]),
            ("worktree_is_clean", True),
            ("base_is_ancestor", False),
            ("control_runtime_record_commit_is_direct", True),
        ):
            with self.subTest(actual_field=field):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(common, **{field: value})))

    def test_c21_provider_status_read_start_projects_exact_leases_and_boundaries(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "51ed9d852a1fb48d24d7112cc900485de2f8011e"
        )
        manifest_path = historical_root / "docs/evidence/manifests/C-21_PROVIDER_STATUS_READ_START_MANIFEST.json"
        self.assertTrue(manifest_path.is_file(), "Provider status READ start manifest is missing")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_provider_status_read_start_projection(bundle, manifest))
        self.assertEqual(10, len(checker.c21_provider_status_read_start_paths()))
        self.assertEqual(18, len(checker.c21_provider_status_read_lease_paths()))
        self.assertEqual(
            "300FEF86F8357958E74BEAAA9440CA4B7F56240CC1C9B51A115A58B48B4122E8",
            checker._path_list_sha256(checker.c21_provider_status_read_lease_paths()),
        )
        self.assertEqual("ACTIVE_PROVIDER_STATUS_READ", bundle["progress"]["status"])
        self.assertEqual("developer-primary", bundle["progress"]["active_agent"])
        self.assertFalse(bundle["progress"]["provider_status_read"]["accepted"])
        prompt_sha = hashlib.sha256(
            (historical_root / "docs/work_orders/C-21_PROVIDER_STATUS_READ_INVOCATION_PROMPT.md").read_bytes()
        ).hexdigest().upper()
        self.assertEqual(prompt_sha, bundle["progress"]["active_work_instruction"]["invocation_sha256"])
        self.assertEqual(prompt_sha, bundle["handoff"]["active_invocation_sha256"])

    def test_c21_provider_status_read_start_rejects_event_lease_history_and_boundary_mutations(self) -> None:
        checker = self.require_checker()
        bundle, historical_root = self._historical_bundle(
            checker, "51ed9d852a1fb48d24d7112cc900485de2f8011e"
        )
        manifest = json.loads((historical_root / "docs/evidence/manifests/C-21_PROVIDER_STATUS_READ_START_MANIFEST.json").read_text(encoding="utf-8"))
        self.assertEqual([], checker.validate_c21_provider_status_read_start_projection(bundle, manifest))
        mutations = []
        for index, path, value in (
            (-3, "event_type", "PACKAGE_STARTED"),
            (-3, "details.execution_fencing_token", "tampered"),
            (-2, "details.write_fencing_token", "tampered"),
            (-2, "details.paths", ["other"]),
            (-1, "details.runtime_next_action", "WAIT_FOR_EXTERNAL_PROVIDER"),
        ):
            changed = copy.deepcopy(bundle)
            target = changed["events"]["events"][index]
            parts = path.split(".")
            for part in parts[:-1]:
                target = target[part]
            target[parts[-1]] = value
            mutations.append((path, changed, copy.deepcopy(manifest)))
        for field, value in (
            ("status", "WAITING_APPROVAL"),
            ("active_agent", None),
            ("worker_lease", None),
            ("write_lease", None),
        ):
            changed = copy.deepcopy(bundle)
            changed["progress"][field] = value
            mutations.append((field, changed, copy.deepcopy(manifest)))
        for field, value in (
            ("accepted", True),
            ("c01_status", "READY"),
            ("dir2_status", "TRIGGERED"),
            ("actual_provider_calls", "EXECUTED"),
            ("database_migration", "EXECUTED"),
            ("runtime_next_action", "EXECUTE_WORKBENCH_UI_REWORK"),
        ):
            changed = copy.deepcopy(bundle)
            changed["progress"]["provider_status_read"][field] = value
            mutations.append((field, changed, copy.deepcopy(manifest)))
        history = copy.deepcopy(bundle)
        history["events"]["events"][0]["event_id"] += "-tampered"
        mutations.append(("history", history, copy.deepcopy(manifest)))
        for field, value in (
            ("historical_full_file_sha256", "0" * 64),
            ("historical_event_object_prefix_sha256", "0" * 64),
            ("historical_events_canonical_ascii_sha256", "0" * 64),
            ("start_exact_path_list_sha256", "0" * 64),
            ("lease_exact_path_list_sha256", "0" * 64),
            ("execution_authority_sha256", "0" * 64),
        ):
            changed_manifest = copy.deepcopy(manifest)
            changed_manifest[field] = value
            mutations.append((field, copy.deepcopy(bundle), changed_manifest))
        for scenario, changed_bundle, changed_manifest in mutations:
            with self.subTest(scenario=scenario):
                self.assertTrue(checker.validate_c21_provider_status_read_start_projection(changed_bundle, changed_manifest))
        stale_handoff = copy.deepcopy(bundle)
        stale_handoff["handoff"]["active_invocation_sha256"] = "0" * 64
        self.assertIn(
            "C21_PROVIDER_STATUS_READ_HANDOFF_INVALID",
            checker.validate_c21_provider_status_read_start_projection(stale_handoff, copy.deepcopy(manifest)),
        )

    def test_c21_provider_wsl_auth_reviewed_exact10_contract_exists(self) -> None:
        """The seq524 record surface is the frozen exact10 requested by Main."""
        checker = self.require_checker()
        exact10 = sorted(
            {
                "docs/WORK_STATUS.md",
                "docs/evidence/manifests/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_MANIFEST.json",
                "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/build-progress.json",
                "docs/progress/progress-events.json",
                "docs/progress/progress-handoff-detached-digest-c21-provider-wsl-auth-reviewed.json",
                "docs/work_orders/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_INVOCATION_PROMPT.md",
                "docs/work_orders/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_WORK_INSTRUCTION.md",
                "scripts/check_project_progress.py",
                "tests/tooling/test_project_progress.py",
            }
        )
        self.assertEqual(exact10, sorted(checker.c21_provider_wsl_auth_reviewed_paths()))
        self.assertEqual(
            "3C963ACAF605AD6BF212F56C6C3D1FA3D5F9434E0787045C4F4E1D754F1C0B93",
            checker.path_list_lf_sha256(exact10),
        )

    def test_c21_provider_wsl_auth_reviewed_git_projection_is_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        repository = copy.deepcopy(bundle["progress"]["repository"])
        product_commit = "0f70afeabe9a031e7960d49cfe27c808c0770d16"
        product_parent = "b85d2b48e14f513e326054bc0be28009f269a827"
        committed = sorted(
            checker.c21_development_qa_review_predecessor_paths()
            | checker.c21_development_qa_review_successor_paths()
            | checker.c21_provider_status_read_start_paths()
            | checker.c21_provider_status_read_actual_paths()
            | checker.c21_provider_status_read_review_successor_paths()
            | checker.c21_provider_wsl_auth_product_paths()
        )
        record = sorted(checker.c21_provider_wsl_auth_reviewed_paths())
        cumulative = sorted(set(committed) | set(record))
        repository.update(
            local_head=product_commit,
            product_parent_commit=product_parent,
            head_relation="FEATURE_WORKTREE_C21_PROVIDER_WSL_AUTH_PRODUCT_EXACT99_REVIEW_RECORD10",
            worktree_status="SEQ524_PROVIDER_WSL_AUTH_REVIEWED_EXACT10_DIRTY",
            exact_allowed_paths=cumulative,
            provider_wsl_auth_reviewed_paths=record,
        )
        progress = copy.deepcopy(bundle["progress"])
        progress["event_sequence"] = 524
        common = {
            "actual_head": product_commit,
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": committed,
            "working_tree_mode": True,
            "progress": progress,
            "control_descendant_paths": record,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
            "product_commit_parent_is_direct": True,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        wrong_product_parent = dict(common, product_commit_parent_is_direct=False)
        self.assertIn(
            "GIT_PRODUCT_COMMIT_PARENT_INVALID",
            checker.validate_repository_projection(repository, **wrong_product_parent),
        )
        postcommit = dict(
            common,
            actual_head="a" * 40,
            actual_changed_paths=cumulative,
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        dirty_postcommit = dict(postcommit, worktree_is_clean=False)
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(repository, **dirty_postcommit),
        )

    def test_c21_provider_wsl_auth_reviewed_projection_rejects_binding_mutation(self) -> None:
        checker = self.require_checker()
        validator = checker.validate_c21_provider_wsl_auth_reviewed_projection
        bundle, snapshot_root = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        manifest = json.loads(
            (snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_MANIFEST.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual([], validator(bundle, manifest))
        for field in (
            "historical_full_file_sha256",
            "historical_event_object_prefix_sha256",
            "historical_events_canonical_ascii_sha256",
            "product_commit",
            "product_parent_commit",
            "product_exact_path_list_sha256",
            "record_exact_path_list_sha256",
            "record_commit",
            "record_commit_mode",
        ):
            mutated = copy.deepcopy(manifest)
            mutated[field] = "tampered"
            self.assertTrue(validator(bundle, mutated), field)
        mutated_progress = copy.deepcopy(bundle)
        mutated_progress["progress"]["provider_wsl_auth"]["actual_provider_calls"] = "EXECUTED"
        self.assertIn(
            "C21_PROVIDER_WSL_AUTH_REVIEW_BOUNDARY_INVALID",
            validator(mutated_progress, manifest),
        )
        mutated_events = copy.deepcopy(bundle)
        mutated_events["events"]["events"][515]["event_id"] = "tampered"
        self.assertIn(
            "C21_PROVIDER_WSL_AUTH_REVIEW_HISTORY_INVALID",
            validator(mutated_events, manifest),
        )

    def test_c21_provider_wsl_auth_reviewed_rejects_each_terminal_event_detail_mutation(self) -> None:
        checker = self.require_checker()
        validator = checker.validate_c21_provider_wsl_auth_reviewed_projection
        bundle, snapshot_root = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        manifest = json.loads(
            (snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_MANIFEST.json").read_text(
                encoding="utf-8"
            )
        )
        for sequence in range(514, 525):
            with self.subTest(sequence=sequence):
                mutated = copy.deepcopy(bundle)
                mutated["events"]["events"][sequence - 1]["details"]["unexpected_binding"] = "tampered"
                self.assertIn(
                    "C21_PROVIDER_WSL_AUTH_REVIEW_EVENT_INVALID",
                    validator(mutated, manifest),
                )

    def test_c21_provider_wsl_auth_reviewed_rejects_manifest_and_digest_metadata_mutation(self) -> None:
        checker = self.require_checker()
        validator = checker.validate_c21_provider_wsl_auth_reviewed_projection
        bundle, snapshot_root = self._historical_bundle(
            checker, "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        )
        manifest = json.loads(
            (snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_MANIFEST.json").read_text(
                encoding="utf-8"
            )
        )
        for field in ("schema_version", "created_at"):
            with self.subTest(manifest_field=field):
                mutated = copy.deepcopy(manifest)
                mutated[field] = "tampered"
                self.assertIn(
                    "C21_PROVIDER_WSL_AUTH_REVIEW_MANIFEST_INVALID",
                    validator(bundle, mutated),
                )
        digest = json.loads(
            (snapshot_root / "docs/progress/progress-handoff-detached-digest-c21-provider-wsl-auth-reviewed.json").read_text(
                encoding="utf-8"
            )
        )
        for field in ("schema_version", "digest_id", "algorithm", "created_at", "scope"):
            with self.subTest(digest_field=field):
                mutated = copy.deepcopy(digest)
                mutated[field] = "tampered"
                with mock.patch.object(checker, "_load_json", return_value=mutated):
                    self.assertIn(
                        "C21_PROVIDER_WSL_AUTH_REVIEW_DIGEST_INVALID",
                        validator(bundle, manifest),
                    )

    def test_c21_provider_wsl_git_only_candidate_start_exact_scopes_are_frozen(self) -> None:
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_git_only_candidate_start_paths"))
        self.assertTrue(hasattr(checker, "c21_provider_wsl_git_only_candidate_paths"))
        start = sorted(checker.c21_provider_wsl_git_only_candidate_start_paths())
        developer = sorted(checker.c21_provider_wsl_git_only_candidate_paths())
        self.assertEqual(10, len(start))
        self.assertEqual(
            "87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2",
            checker.path_list_lf_sha256(start),
        )
        self.assertEqual(12, len(developer))
        self.assertEqual(
            "6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765",
            checker.path_list_lf_sha256(developer),
        )

    def test_c21_provider_wsl_git_only_candidate_start_git_projection_is_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "a6dca0da5a37e64491e91813895268e78ecb78b2")
        repository = copy.deepcopy(bundle["progress"]["repository"])
        committed = sorted(
            checker.c21_development_qa_review_predecessor_paths()
            | checker.c21_development_qa_review_successor_paths()
            | checker.c21_provider_status_read_start_paths()
            | checker.c21_provider_status_read_actual_paths()
            | checker.c21_provider_status_read_review_successor_paths()
            | checker.c21_provider_wsl_auth_product_paths()
            | checker.c21_provider_wsl_auth_reviewed_paths()
        )
        start = sorted(checker.c21_provider_wsl_git_only_candidate_start_paths())
        progress = copy.deepcopy(bundle["progress"])
        common = {
            "actual_head": "e4cccf3ce99e29005103cea3bd76fa0eede36f28",
            "actual_branch": "codex/c21-operational-execution",
            "actual_upstream": "origin/codex/c21-operational-execution",
            "actual_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
            "actual_feature_remote_head": "ca92b7845eda803cff3c432799642e4f9243d4d6",
            "base_is_ancestor": True,
            "actual_changed_paths": committed,
            "working_tree_mode": True,
            "progress": progress,
            "control_descendant_paths": start,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(
                repository, **dict(common, control_descendant_paths=start + ["outside.txt"])
            ),
        )
        postcommit = dict(
            common,
            actual_head="a" * 40,
            actual_changed_paths=sorted(set(committed) | set(start)),
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(
                repository, **dict(postcommit, control_runtime_record_commit_is_direct=False)
            ),
        )

    def test_c21_provider_wsl_git_only_candidate_postcommit_rejects_missing_status_collection(self) -> None:
        """A failed status collector must not be interpreted as a clean seq527 worktree."""
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "a6dca0da5a37e64491e91813895268e78ecb78b2")
        repository = bundle["progress"]["repository"]
        parent = "e4cccf3ce99e29005103cea3bd76fa0eede36f28"
        child = "a" * 40
        exact107 = "\n".join(repository["exact_allowed_paths"])
        exact10 = "\n".join(repository["provider_wsl_git_only_candidate_start_paths"])

        def validate(status_raw):
            def fake_git_value(_root, *arguments):
                values = {
                    ("rev-parse", "HEAD"): child,
                    ("branch", "--show-current"): repository["branch"],
                    ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): repository["upstream"],
                    ("rev-parse", "@{u}"): repository["remote_head"],
                    ("rev-parse", repository["feature_remote"]): repository["feature_remote_head"],
                    ("diff", "--name-only", repository["validated_base_commit"], child): exact107,
                    ("show", "-s", "--format=%P", child): parent,
                    ("diff", "--name-only", f"{parent}..{child}"): exact10,
                    ("show", "-s", "--format=%P", parent): repository["product_parent_commit"],
                }
                if arguments == (
                    "-c",
                    "core.quotePath=false",
                    "status",
                    "--porcelain=v1",
                    "--untracked-files=all",
                ):
                    return status_raw
                return values.get(arguments)

            with mock.patch.object(checker, "_git_value", side_effect=fake_git_value), mock.patch.object(
                checker, "_git_returncode", return_value=0
            ):
                return checker._validate_git_projection(copy.deepcopy(bundle))

        self.assertEqual([], validate(""))
        self.assertIn("GIT_STATUS_COLLECTION_FAILED", validate(None))

    def test_c21_provider_wsl_git_only_candidate_start_projection_rejects_mutations(self) -> None:
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "validate_c21_provider_wsl_git_only_candidate_start_projection"))
        validator = checker.validate_c21_provider_wsl_git_only_candidate_start_projection
        bundle, snapshot_root = self._historical_bundle(checker, "a6dca0da5a37e64491e91813895268e78ecb78b2")
        manifest = json.loads(
            (snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_MANIFEST.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual([], validator(bundle, manifest))
        for index, field in ((-3, "status"), (-2, "write_fencing_token"), (-1, "accepted")):
            with self.subTest(event_index=index, field=field):
                changed = copy.deepcopy(bundle)
                changed["events"]["events"][index]["details"][field] = "tampered"
                self.assertIn(
                    "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_EVENT_INVALID",
                    validator(changed, copy.deepcopy(manifest)),
                )
        for section, field, value, reason in (
            ("provider_wsl_git_only_candidate", "actual_push", "EXECUTED", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_BOUNDARY_INVALID"),
            ("active_work_instruction", "artifact_sha256", "tampered", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_WORK_INSTRUCTION_INVALID"),
            ("repository", "candidate_remote_ref", "refs/remotes/origin/candidates/other", "GIT_DESCENDANT_PROJECTION_INVALID"),
        ):
            with self.subTest(section=section, field=field):
                changed = copy.deepcopy(bundle)
                changed["progress"][section][field] = value
                self.assertIn(reason, validator(changed, copy.deepcopy(manifest)) if section != "repository" else checker.validate_repository_projection(
                    changed["progress"]["repository"],
                    actual_head="e4cccf3ce99e29005103cea3bd76fa0eede36f28",
                    actual_branch="codex/c21-operational-execution",
                    actual_upstream="origin/codex/c21-operational-execution",
                    actual_remote_head="ca92b7845eda803cff3c432799642e4f9243d4d6",
                    actual_feature_remote_head="ca92b7845eda803cff3c432799642e4f9243d4d6",
                    base_is_ancestor=True,
                    actual_changed_paths=sorted(checker.c21_development_qa_review_predecessor_paths() | checker.c21_development_qa_review_successor_paths() | checker.c21_provider_status_read_start_paths() | checker.c21_provider_status_read_actual_paths() | checker.c21_provider_status_read_review_successor_paths() | checker.c21_provider_wsl_auth_product_paths() | checker.c21_provider_wsl_auth_reviewed_paths()),
                    working_tree_mode=True,
                    progress=changed["progress"],
                    control_descendant_paths=sorted(checker.c21_provider_wsl_git_only_candidate_start_paths()),
                    worktree_is_clean=False,
                ))
        for field in (
            "execution_authority_sha256",
            "invocation_sha256",
            "start_exact_path_list_sha256",
            "source_committed_exact_path_list_sha256",
            "source_cumulative_exact_path_list_sha256",
            "developer_exact_path_list_sha256",
            "post_developer_cumulative_exact_path_list_sha256",
        ):
            with self.subTest(manifest_field=field):
                changed_manifest = copy.deepcopy(manifest)
                changed_manifest[field] = "tampered"
                self.assertIn(
                    "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_MANIFEST_INVALID",
                    validator(copy.deepcopy(bundle), changed_manifest),
                )
        changed = copy.deepcopy(bundle)
        changed["progress"]["latest_evidence_refs"] = [
            {**row, "sha256": "0" * 64} if row.get("path") == "scripts/check_project_progress.py" else row
            for row in changed["progress"]["latest_evidence_refs"]
        ]
        self.assertIn("C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_LATEST_REF_INVALID", validator(changed, copy.deepcopy(manifest)))
        changed = copy.deepcopy(bundle)
        changed["handoff"]["runtime_next_action"] = "tampered"
        self.assertIn("C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_HANDOFF_INVALID", validator(changed, copy.deepcopy(manifest)))
        changed = copy.deepcopy(bundle)
        changed["detached_digest"]["scope"] = "tampered"
        self.assertIn("C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_START_DIGEST_INVALID", validator(changed, copy.deepcopy(manifest)))
        changed = copy.deepcopy(bundle)
        changed["progress"]["snapshot_hash"] = "0" * 64
        self.assertIn("PRG_SNAPSHOT_HASH_MISMATCH", checker.validate_bundle(changed))

    def test_c21_provider_wsl_git_only_candidate_bound_projection_rejects_mutations(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "e6c562cf07bc2c35e24addb60efa9d90fae08046")
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json").read_text(encoding="utf-8"))
        validator = checker.validate_c21_provider_wsl_git_only_candidate_projection
        self.assertEqual([], validator(bundle, manifest))
        for section, field, value in (
            ("provider_wsl_git_only_candidate", "actual_push", "EXECUTED"),
            ("provider_wsl_git_only_candidate", "candidate_ref", "refs/remotes/origin/other"),
            ("active_work_instruction", "artifact_sha256", "0" * 64),
            ("repository", "local_head", "0" * 40),
        ):
            with self.subTest(section=section, field=field):
                changed = copy.deepcopy(bundle)
                changed["progress"][section][field] = value
                self.assertTrue(validator(changed, manifest))
        for offset in (-3, -2, -1):
            changed = copy.deepcopy(bundle)
            changed["events"]["events"][offset]["details"]["unexpected_authority"] = True
            self.assertIn("C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_EVENT_INVALID", validator(changed, manifest))
        for field in ("created_at", "historical_full_file_sha256", "developer_exact_paths", "execution_authority_sha256", "raw_checksums"):
            changed = copy.deepcopy(manifest)
            changed[field] = "tampered"
            self.assertTrue(validator(bundle, changed), field)
        changed = copy.deepcopy(bundle)
        changed["detached_digest"]["scope"] = "tampered"
        self.assertIn("C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_DIGEST_INVALID", validator(changed, manifest))
        changed = copy.deepcopy(bundle)
        changed["handoff"]["accepted"] = True
        self.assertTrue(validator(changed, manifest))


    def test_c21_provider_wsl_git_only_candidate_bound_malformed_digest_fails_closed(self):
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json").read_text(encoding="utf-8"))
        for case in ("missing", "null", "list", "progress_null", "progress_list", "handoff_null", "handoff_list"):
            with self.subTest(case=case):
                changed = copy.deepcopy(bundle)
                if case == "missing":
                    del changed["detached_digest"]
                elif case in ("null", "list"):
                    changed["detached_digest"] = None if case == "null" else []
                else:
                    section, shape = case.split("_")
                    changed["detached_digest"][section] = None if shape == "null" else []
                self.assertIn(
                    "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_DIGEST_INVALID",
                    checker.validate_c21_provider_wsl_git_only_candidate_projection(changed, manifest),
                )

    def test_c21_provider_wsl_git_only_candidate_bound_history_unavailable_fails_closed(self):
        checker = self.require_checker()
        bundle = checker.load_bundle(ROOT)
        manifest = json.loads((ROOT / "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json").read_text(encoding="utf-8"))
        original = subprocess.check_output
        for relative in ("docs/progress/progress-events.json", "docs/progress/build-progress.json"):
            for payload in (None, b"not-json", b"null", b"[]", b"{}"):
                with self.subTest(relative=relative, payload=payload):
                    def read_history(command, *args, **kwargs):
                        if command == ["git", "show", "a6dca0da5a37e64491e91813895268e78ecb78b2:" + relative]:
                            if payload is None:
                                raise subprocess.CalledProcessError(128, command)
                            return payload
                        return original(command, *args, **kwargs)
                    with mock.patch.object(subprocess, "check_output", side_effect=read_history):
                        self.assertIn(
                            "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_HISTORY_INVALID",
                            checker.validate_c21_provider_wsl_git_only_candidate_projection(bundle, manifest),
                        )

    def test_c21_provider_wsl_git_only_candidate_bound_missing_files_fail_closed(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(
            checker, "e6c562cf07bc2c35e24addb60efa9d90fae08046"
        )
        manifest = json.loads((snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json").read_text(encoding="utf-8"))
        original = Path.read_bytes
        instruction = bundle["progress"]["active_work_instruction"]
        for relative, expected in (
            ("docs/progress/progress-events.json", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_HISTORY_INVALID"),
            ("docs/progress/build-progress.json", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_DIGEST_INVALID"),
            ("docs/progress/BUILD_HANDOFF.md", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_DIGEST_INVALID"),
            ("deploy/wsl/CandidateReleaseManifest.json", "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_LATEST_REF_INVALID"),
            (instruction["artifact_path"], "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_LATEST_REF_INVALID"),
            (instruction["invocation_path"], "C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_LATEST_REF_INVALID"),
        ):
            with self.subTest(relative=relative):
                def read_evidence(path):
                    if path == snapshot_root / relative:
                        raise FileNotFoundError(str(path))
                    return original(path)
                with mock.patch.object(Path, "read_bytes", read_evidence):
                    self.assertIn(
                        expected,
                        checker.validate_c21_provider_wsl_git_only_candidate_projection(bundle, manifest),
                    )

    def test_c21_provider_wsl_git_only_candidate_bound_status_collection_fails_closed(self):
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(checker, "e6c562cf07bc2c35e24addb60efa9d90fae08046")
        original = checker._git_value
        def collect(root, *arguments):
            if arguments == ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"):
                return None
            return original(root, *arguments)
        with mock.patch.object(checker, "_git_value", side_effect=collect):
            self.assertIn("GIT_STATUS_COLLECTION_FAILED", checker._validate_git_projection(bundle))

    def test_c21_provider_wsl_git_only_candidate_bound_git_projection_is_exact(self):
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(checker, "e6c562cf07bc2c35e24addb60efa9d90fae08046")
        repository = bundle["progress"]["repository"]
        source_paths = set(repository["exact_allowed_paths"]) - {
            "docs/evidence/manifests/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_MANIFEST.json",
            "docs/progress/progress-handoff-detached-digest-c21-provider-wsl-git-only-candidate-bound.json",
        }
        arguments = dict(
            actual_head="a6dca0da5a37e64491e91813895268e78ecb78b2",
            actual_branch="codex/c21-operational-execution",
            actual_upstream="origin/codex/c21-operational-execution",
            actual_remote_head="ca92b7845eda803cff3c432799642e4f9243d4d6",
            actual_feature_remote_head="ca92b7845eda803cff3c432799642e4f9243d4d6",
            base_is_ancestor=True, actual_changed_paths=sorted(source_paths),
            working_tree_mode=True, progress=bundle["progress"],
            control_descendant_paths=sorted(checker.c21_provider_wsl_git_only_candidate_paths()),
            worktree_is_clean=False, product_commit_parent_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **arguments))
        for field, value in (
            ("actual_branch", "main"), ("actual_upstream", None),
            ("actual_remote_head", "0" * 40), ("base_is_ancestor", False),
            ("product_commit_parent_is_direct", False), ("worktree_is_clean", True),
            ("actual_changed_paths", sorted(source_paths)[:-1]),
            ("control_descendant_paths", sorted(checker.c21_provider_wsl_git_only_candidate_paths()) + ["extra.txt"]),
        ):
            self.assertTrue(checker.validate_repository_projection(repository, **(arguments | {field: value})), field)
        committed = arguments | dict(
            actual_head="1" * 40, actual_changed_paths=repository["exact_allowed_paths"],
            working_tree_mode=False, worktree_is_clean=True,
            control_is_ancestor=True, control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **committed))
        for field, value in (("control_runtime_record_commit_is_direct", False), ("worktree_is_clean", False), ("control_is_ancestor", False)):
            self.assertTrue(checker.validate_repository_projection(repository, **(committed | {field: value})), field)

    def test_c21_provider_status_read_review_successor_accepts_only_exact_record_projection(self) -> None:
        """A committed exact13 plus any record path outside exact8 must fail closed."""
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "b85d2b48e14f513e326054bc0be28009f269a827"
        )
        repository = bundle["progress"]["repository"]
        exact95 = sorted(
            checker.c21_development_qa_review_predecessor_paths()
            | checker.c21_development_qa_review_successor_paths()
            | checker.c21_provider_status_read_start_paths()
            | checker.c21_provider_status_read_actual_paths()
        )
        exact8 = sorted(checker.c21_provider_status_read_review_successor_paths())
        repository.update(
            local_head="13b2b4e7dbd0aaec8d8fc8bcf22ed969e9e82fe0",
            head_relation="FEATURE_WORKTREE_C21_PROVIDER_STATUS_READ_COMMITTED_EXACT95_REVIEW_RECORD8",
            worktree_status="SEQ513_PROVIDER_STATUS_READ_REVIEW_SUCCESSOR_DIRTY",
            exact_allowed_paths=sorted(set(exact95) | set(exact8)),
            provider_status_read_review_successor_paths=exact8,
        )
        progress = copy.deepcopy(bundle["progress"])
        progress["event_sequence"] = 513
        common = {
            "actual_head": "13b2b4e7dbd0aaec8d8fc8bcf22ed969e9e82fe0",
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": exact95,
            "working_tree_mode": True,
            "progress": progress,
            "control_descendant_paths": exact8,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        tampered = dict(common, control_descendant_paths=exact8 + ["outside.txt"])
        self.assertIn(
            "GIT_DESCENDANT_PATH_SET_MISMATCH",
            checker.validate_repository_projection(repository, **tampered),
        )
        postcommit = dict(
            common,
            actual_head="a" * 40,
            actual_changed_paths=sorted(set(exact95) | set(exact8)),
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        wrong_parent = dict(postcommit, control_runtime_record_commit_is_direct=False)
        self.assertIn(
            "GIT_DESCENDANT_RECORD_COMMIT_INVALID",
            checker.validate_repository_projection(repository, **wrong_parent),
        )

    def test_c21_provider_status_read_review_successor_fails_closed_on_binding_mutation(self) -> None:
        checker = self.require_checker()
        bundle, snapshot_root = self._historical_bundle(
            checker, "b85d2b48e14f513e326054bc0be28009f269a827"
        )
        manifest = json.loads(
            (snapshot_root / "docs/evidence/manifests/C-21_PROVIDER_STATUS_READ_REVIEW_SUCCESSOR_MANIFEST.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            [],
            checker.validate_c21_provider_status_read_review_successor_projection(bundle, manifest),
        )
        mutated_manifest = copy.deepcopy(manifest)
        mutated_manifest["product_exact_paths"].append("outside.txt")
        self.assertIn(
            "C21_PROVIDER_STATUS_READ_REVIEW_MANIFEST_INVALID",
            checker.validate_c21_provider_status_read_review_successor_projection(bundle, mutated_manifest),
        )
        for field in (
            "manifest_id",
            "appended_event_count",
            "product_parent_commit",
            "review_report_sha256",
            "record_commit",
            "record_commit_mode",
        ):
            mutated_provenance = copy.deepcopy(manifest)
            mutated_provenance[field] = "tampered"
            self.assertIn(
                "C21_PROVIDER_STATUS_READ_REVIEW_MANIFEST_INVALID",
                checker.validate_c21_provider_status_read_review_successor_projection(
                    bundle, mutated_provenance
                ),
                field,
            )
        mutated_progress = copy.deepcopy(bundle)
        mutated_progress["progress"]["provider_status_read"]["actual_provider_calls"] = "PASS"
        self.assertIn(
            "C21_PROVIDER_STATUS_READ_REVIEW_BOUNDARY_INVALID",
            checker.validate_c21_provider_status_read_review_successor_projection(mutated_progress, manifest),
        )
        mutated_events = copy.deepcopy(bundle)
        mutated_events["events"]["events"][508]["event_id"] = "tampered"
        self.assertIn(
            "C21_PROVIDER_STATUS_READ_REVIEW_HISTORY_INVALID",
            checker.validate_c21_provider_status_read_review_successor_projection(mutated_events, manifest),
        )

    def test_c21_provider_status_read_start_public_and_real_git_paths_fail_closed(self) -> None:
        checker = self.require_checker()
        bundle, _ = self._historical_bundle(
            checker, "51ed9d852a1fb48d24d7112cc900485de2f8011e"
        )
        repository = bundle["progress"]["repository"]
        exact78 = sorted(checker.c21_development_qa_review_predecessor_paths() | checker.c21_development_qa_review_successor_paths())
        exact10 = sorted(checker.c21_provider_status_read_start_paths())
        common = {
            "actual_head": repository["local_head"],
            "actual_branch": repository["branch"],
            "actual_upstream": repository["upstream"],
            "actual_remote_head": repository["remote_head"],
            "actual_feature_remote_head": repository["feature_remote_head"],
            "base_is_ancestor": True,
            "actual_changed_paths": exact78,
            "working_tree_mode": True,
            "progress": bundle["progress"],
            "control_descendant_paths": exact10,
            "worktree_is_clean": False,
            "control_runtime_record_commit_is_direct": False,
        }
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        postcommit = dict(
            common,
            actual_head="e" * 40,
            actual_changed_paths=sorted(set(exact78) | set(exact10)),
            working_tree_mode=False,
            control_is_ancestor=True,
            worktree_is_clean=True,
            control_runtime_record_commit_is_direct=True,
        )
        self.assertEqual([], checker.validate_repository_projection(repository, **postcommit))
        for field, value in (
            ("actual_changed_paths", sorted(set(exact78) | set(exact10))[:-1]),
            ("control_descendant_paths", exact10[:-1]),
            ("working_tree_mode", True),
            ("control_is_ancestor", False),
            ("worktree_is_clean", False),
            ("control_runtime_record_commit_is_direct", False),
        ):
            with self.subTest(postcommit_field=field):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(postcommit, **{field: value})))
        for field, value in (
            ("actual_remote_head", "0" * 40),
            ("actual_feature_remote_head", "0" * 40),
            ("actual_changed_paths", exact78[:-1]),
            ("control_descendant_paths", exact10[:-1]),
            ("working_tree_mode", False),
            ("worktree_is_clean", True),
            ("base_is_ancestor", False),
        ):
            with self.subTest(field=field):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(common, **{field: value})))
        for field, value in (
            ("branch", "other"),
            ("upstream", "origin/other"),
            ("remote_head", "0" * 40),
            ("feature_remote", "origin/other"),
            ("feature_remote_head", "0" * 40),
            ("validated_base_commit", "0" * 40),
            ("local_head", "0" * 40),
            ("head_relation", "TAMPERED"),
            ("worktree_status", "CLEAN"),
            ("exact_allowed_paths", repository["exact_allowed_paths"][:-1]),
        ):
            with self.subTest(repository_field=field):
                changed = copy.deepcopy(repository)
                changed[field] = value
                self.assertTrue(checker.validate_repository_projection(changed, **common))
                changed_bundle = copy.deepcopy(bundle)
                changed_bundle["progress"]["repository"][field] = value
                self.assertTrue(checker._validate_git_projection(changed_bundle))

    def _execution_resume_fixture(self):
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_execution_resume_start_artifacts"))
        source = "e6c562cf07bc2c35e24addb60efa9d90fae08046"
        historical = {
            path: subprocess.check_output(["git", "show", f"{source}:{path}"], cwd=ROOT)
            for path in ("docs/progress/build-progress.json", "docs/progress/progress-events.json")
        }
        directory = tempfile.TemporaryDirectory(prefix="anvil-seq533-", dir="D:/tmp")
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        files = {path: (ROOT / path).read_bytes() for path in (
            "docs/WORK_STATUS.md", "docs/progress/BUILD_HANDOFF.md",
            "docs/work_orders/C-21_PROVIDER_WSL_EXECUTION_RESUME_WORK_INSTRUCTION.md",
            "docs/work_orders/C-21_PROVIDER_WSL_EXECUTION_RESUME_INVOCATION_PROMPT.md",
            "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
        )}
        artifacts = checker.c21_provider_wsl_execution_resume_start_artifacts(historical, files)
        for path, raw in dict(files, **artifacts).items():
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        bundle = {
            "_root": root,
            "progress": json.loads(artifacts[checker.C21_RESUME_P]),
            "events": json.loads(artifacts[checker.C21_RESUME_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C21_RESUME_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C21_RESUME_D]),
        }
        manifest = json.loads(artifacts[checker.C21_RESUME_M])
        return checker, bundle, manifest, historical

    def test_c21_provider_wsl_exact_binding_start_contract_is_frozen(self):
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_exact_binding_start_artifacts"))
        self.assertTrue(hasattr(checker, "c21_provider_wsl_exact_binding_start_paths"))
        paths = sorted(checker.c21_provider_wsl_exact_binding_start_paths())
        self.assertEqual(10, len(paths))
        self.assertEqual(
            "410EB4E3EB843BFF2FE9D332505445286986BE8572A288DF713E388DAF587B62",
            checker.path_list_lf_sha256(paths),
        )
        source = "3501c37b25274c2c3b406a15bc8a57aa03a162e7"
        historical = {
            path: subprocess.check_output(["git", "show", f"{source}:{path}"], cwd=ROOT)
            for path in ("docs/progress/build-progress.json", "docs/progress/progress-events.json")
        }
        files = {
            "docs/WORK_STATUS.md": (ROOT / "docs/WORK_STATUS.md").read_bytes(),
            "docs/progress/BUILD_HANDOFF.md": (ROOT / "docs/progress/BUILD_HANDOFF.md").read_bytes(),
            "docs/work_orders/C-21_PROVIDER_WSL_EXACT_BINDING_WORK_INSTRUCTION.md": b"binding wi\n",
            "docs/work_orders/C-21_PROVIDER_WSL_EXACT_BINDING_INVOCATION_PROMPT.md": b"binding prompt\n",
            "scripts/check_project_progress.py": (ROOT / "scripts/check_project_progress.py").read_bytes(),
            "tests/tooling/test_project_progress.py": (ROOT / "tests/tooling/test_project_progress.py").read_bytes(),
        }
        artifacts = checker.c21_provider_wsl_exact_binding_start_artifacts(historical, files)
        progress = json.loads(artifacts[checker.C21_EXACT_BINDING_P])
        events = json.loads(artifacts[checker.C21_EXACT_BINDING_E])
        self.assertEqual(539, progress["event_sequence"])
        self.assertEqual([537, 538, 539], [row["sequence"] for row in events["events"][-3:]])
        self.assertEqual(
            "8A7D4AA0124FBC49DD67D48DBF10C9CCC586BB43AB4A9A4473604C1E2F43B429",
            progress["repository"]["exact_allowed_path_list_sha256"],
        )
        self.assertEqual("NOT_EXECUTED", progress["provider_wsl_exact_binding"]["push"])
        self.assertEqual("SINSAN", progress["provider_wsl_exact_binding"]["wsl_observation"]["host"])
        started = events["events"][-1]["details"]
        for event_field, repository_field in (
            ("dispatch_head", "local_head"), ("dispatch_upstream_head", "remote_head"),
            ("projection_mode", "projection_mode"), ("validated_base_commit", "validated_base_commit"),
            ("head_relation", "head_relation"),
        ):
            self.assertEqual(progress["repository"][repository_field], started[event_field])

    def test_c21_provider_wsl_exact_binding_start_preserves_history_and_rejects_tamper(self):
        checker = self.require_checker()
        source = checker.C21_EXACT_BINDING_SOURCE
        historical = {path: subprocess.check_output(["git", "show", f"{source}:{path}"], cwd=ROOT)
                      for path in (checker.C21_EXACT_BINDING_P, checker.C21_EXACT_BINDING_E)}
        files = {path: (ROOT / path).read_bytes() for path in (
            "docs/WORK_STATUS.md", checker.C21_EXACT_BINDING_H, checker.C21_EXACT_BINDING_WI,
            checker.C21_EXACT_BINDING_PROMPT, "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py")}
        artifacts = checker.c21_provider_wsl_exact_binding_start_artifacts(historical, files)
        old, new = historical[checker.C21_EXACT_BINDING_E], artifacts[checker.C21_EXACT_BINDING_E]
        self.assertEqual(checker.raw_event_object_prefix_bytes(old, 536), checker.raw_event_object_prefix_bytes(new, 536))
        self.assertEqual(539, json.loads(new)["last_sequence"])
        metadata = checker.c21_provider_wsl_exact_binding_path_metadata()
        self.assertEqual(14, metadata["successor_exact_path_count"])
        self.assertEqual("B570C707DBEA3594C6AC57B0D44DBD0F64BBDEE26A037FC954FF03CFD78A133E",
                         metadata["successor_exact_path_list_sha256"])
        self.assertEqual([], checker.validate_c21_provider_wsl_exact_binding_start_artifacts(historical, files, artifacts))
        for path in artifacts:
            changed = dict(artifacts)
            changed[path] = artifacts[path] + b" "
            with self.subTest(path=path):
                self.assertTrue(checker.validate_c21_provider_wsl_exact_binding_start_artifacts(historical, files, changed))
        corrupted = dict(historical)
        corrupted[checker.C21_EXACT_BINDING_E] += b" "
        with self.assertRaises(ValueError):
            checker.c21_provider_wsl_exact_binding_start_artifacts(corrupted, files)

    def test_c21_provider_wsl_exact_binding_git_contract_requires_direct_child_and_private_authority(self):
        checker = self.require_checker()
        metadata = checker.c21_provider_wsl_exact_binding_path_metadata()
        repository = {
            "branch": "codex/c21-operational-execution", "upstream": "origin/codex/c21-operational-execution",
            "local_head": checker.C21_EXACT_BINDING_SOURCE, "validated_base_commit": checker.C21_EXACT_BINDING_BASE,
            "head_relation": "FEATURE_WORKTREE_C21_PROVIDER_WSL_EXACT_BINDING_SOURCE_EXACT117_START_RECORD10",
            "exact_allowed_paths": metadata["post_start_cumulative_exact_paths"],
            "exact_allowed_path_list_sha256": metadata["post_start_cumulative_exact_path_list_sha256"],
        }
        common = dict(actual_head=checker.C21_EXACT_BINDING_SOURCE,
            actual_branch="codex/c21-operational-execution", actual_upstream="origin/codex/c21-operational-execution",
            actual_changed_paths=metadata["source_exact_paths"], dirty_paths=metadata["start_exact_paths"],
            source_parent=checker.C21_EXACT_BINDING_PARENT, source_is_ancestor=True, base_is_ancestor=True,
            record_commit_is_direct=False, worktree_is_clean=False,
            private_remote_url="git@github-sinsan-develop:sinsan-develop/Anvil.git",
            private_control="772afbd5eb55791ca7b5002d58378437ea496750", private_candidate_ref="",
            private_control_is_ancestor=True)
        self.assertEqual([], checker.validate_c21_provider_wsl_exact_binding_repository(repository, **common))
        child = dict(common, actual_head="a" * 40,
            actual_changed_paths=metadata["post_start_cumulative_exact_paths"], dirty_paths=[],
            record_commit_is_direct=True, worktree_is_clean=True)
        self.assertEqual([], checker.validate_c21_provider_wsl_exact_binding_repository(repository, **child))
        for field, value in (("record_commit_is_direct", False), ("source_is_ancestor", False),
                             ("base_is_ancestor", False), ("private_candidate_ref", "unexpected"),
                             ("private_control_is_ancestor", False), ("private_remote_url", "git@github.com:public/Anvil.git")):
            with self.subTest(field=field):
                self.assertTrue(checker.validate_c21_provider_wsl_exact_binding_repository(repository, **dict(child, **{field:value})))

    def test_c21_provider_wsl_execution_resume_event_bytes_freeze_header_and_history(self):
        checker, bundle, manifest, historical = self._execution_resume_fixture()
        raw = (bundle["_root"] / checker.C21_RESUME_E).read_bytes()
        old = historical[checker.C21_RESUME_E]
        self.assertEqual(533, json.loads(raw)["last_sequence"])
        self.assertEqual(checker.raw_event_object_prefix_bytes(old, 530), checker.raw_event_object_prefix_bytes(raw, 530))
        self.assertEqual([531, 532, 533], [event["sequence"] for event in bundle["events"]["events"][-3:]])
        for corrupted in (old.replace(b'"last_sequence": 530', b'"last_sequence": 529'), old + b" ", old.replace(b'"stream_id":', b'"stream_id":"duplicate", "stream_id":')):
            with self.subTest(corruption=corrupted[:110]), self.assertRaises(ValueError):
                checker.c21_provider_wsl_execution_resume_event_bytes(corrupted, bundle["events"]["events"][-3:])

    def test_c21_provider_wsl_execution_resume_matches_shared_recovery_contracts(self):
        checker, generated, manifest, _ = self._execution_resume_fixture()
        bundle = checker.load_bundle(ROOT)
        bundle.update(generated)
        bundle["_detached_digest_path"] = checker.C21_RESUME_D
        bundle["_file_hashes"].update({path: hashlib.sha256((bundle["_root"] / path).read_bytes()).hexdigest().upper()
                                      for path in checker.c21_provider_wsl_execution_resume_start_paths()})
        for validator in (checker._validate_events, checker._validate_handoff,
                          checker._validate_registry_refs, checker._validate_reporting_state,
                          checker.validate_detached_progress_binding):
            with self.subTest(validator=validator.__name__):
                self.assertEqual([], validator(bundle))
        self.assertEqual([], checker.validate_manifest_progress_binding(manifest, bundle))
        self.assertEqual("EXECUTE_C21_PROVIDER_WSL_EXECUTION_RESUME_EXACT14", bundle["progress"]["next_safe_action"])

    def test_c21_provider_wsl_execution_resume_public_main_rejects_nonobject_and_nested_corruption(self):
        """Malformed P/E/M must reach the public CLI boundary without a traceback."""
        checker, historical_bundle, historical_manifest, _ = self._execution_resume_fixture()
        original_read = Path.read_text
        historical_json = {
            checker.C21_RESUME_P: historical_bundle["progress"],
            checker.C21_RESUME_E: historical_bundle["events"],
            checker.C21_RESUME_M: historical_manifest,
        }
        for relative, nested in (
            (checker.C21_RESUME_P, {"reporting_decision": None}),
            (checker.C21_RESUME_E, {"events": [None]}),
            (checker.C21_RESUME_M, {"raw_checksums": None}),
        ):
            for shape in ([], None, nested):
                original = historical_json[relative]
                corrupted = original | shape if isinstance(shape, dict) else shape
                def read_json(path, *args, **kwargs):
                    if path == ROOT / relative:
                        return json.dumps(corrupted)
                    for historical_path, payload in historical_json.items():
                        if path == ROOT / historical_path:
                            return json.dumps(payload)
                    return original_read(path, *args, **kwargs)
                output = io.StringIO()
                with self.subTest(path=relative, shape=shape), mock.patch.object(Path, "read_text", read_json), mock.patch("sys.stdout", output):
                    self.assertEqual(1, checker.main([str(ROOT)]))
                    self.assertIn("LOAD_ERROR:INVALID_STRUCTURE:", output.getvalue())
                    self.assertNotIn("Traceback", output.getvalue())

    def test_c21_provider_wsl_execution_resume_projection_rejects_adversarial_evidence(self):
        checker, bundle, manifest, historical = self._execution_resume_fixture()
        validator = checker.validate_c21_provider_wsl_execution_resume_start_projection
        def git_blob(arguments, **kwargs):
            return historical[arguments[-1].split(":", 1)[1]]
        with mock.patch.object(checker.subprocess, "check_output", side_effect=git_blob):
            self.assertEqual([], validator(bundle, manifest))
            for section in ("progress", "events", "handoff", "detached_digest"):
                for value in (None, [], "malformed"):
                    altered = copy.deepcopy(bundle)
                    altered[section] = value
                    with self.subTest(section=section, value=value):
                        self.assertTrue(validator(altered, manifest))
            for key, value in (("accepted", True), ("push", "EXECUTED"), ("start_exact_path_count", 9)):
                altered = copy.deepcopy(manifest)
                altered[key] = value
                self.assertTrue(validator(bundle, altered))
            for rows_field, owner in (("raw_checksums", manifest), ("latest_evidence_refs", bundle["progress"])):
                rows = copy.deepcopy(owner[rows_field])
                for malformed in (rows + [rows[0]], rows[:-1], [None], "wrong"):
                    altered, altered_manifest = copy.deepcopy(bundle), copy.deepcopy(manifest)
                    target = altered_manifest if owner is manifest else altered["progress"]
                    target[rows_field] = malformed
                    with self.subTest(rows=rows_field):
                        self.assertTrue(validator(altered, altered_manifest))
            for path in (checker.C21_RESUME_P, checker.C21_RESUME_E, checker.C21_RESUME_H, checker.C21_RESUME_D, checker.C21_RESUME_M, checker.C21_RESUME_WI, checker.C21_RESUME_PROMPT, "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py", "docs/WORK_STATUS.md"):
                target = bundle["_root"] / path
                original = target.read_bytes()
                for invalid in (None, b"{", b"[]", b'{"x":1,"x":2}', b'{"x":NaN}', b'\xff'):
                    if invalid is None:
                        target.unlink()
                    else:
                        target.write_bytes(invalid)
                    with self.subTest(path=path, invalid=invalid):
                        self.assertTrue(validator(bundle, manifest))
                    target.write_bytes(original)
            altered = copy.deepcopy(bundle)
            altered["progress"]["next_work_package"]["status"] = "READY"
            self.assertTrue(validator(altered, manifest))
            altered = copy.deepcopy(bundle)
            altered["events"]["events"][0]["actor"] = "rewritten"
            self.assertTrue(validator(altered, manifest))
            path = bundle["_root"] / checker.C21_RESUME_E
            raw = path.read_bytes()
            path.write_bytes(raw.replace(b'"last_sequence": 533', b'"last_sequence": 530'))
            self.assertTrue(validator(bundle, manifest))

    def test_c21_provider_wsl_execution_resume_git_projection_rejects_scope_and_lineage(self):
        checker, bundle, _, _ = self._execution_resume_fixture()
        repository = bundle["progress"]["repository"]
        metadata = checker.c21_provider_wsl_execution_resume_path_metadata()
        source = metadata["source_cumulative_exact_paths"]
        start = metadata["start_exact_paths"]
        common = dict(actual_head=checker.C21_RESUME_SOURCE, actual_branch=repository["branch"],
            actual_upstream=repository["upstream"], actual_remote_head=checker.C21_RESUME_REMOTE,
            actual_feature_remote_head=checker.C21_RESUME_REMOTE, base_is_ancestor=True,
            actual_changed_paths=source, working_tree_mode=True, progress=bundle["progress"],
            control_descendant_paths=start, control_is_ancestor=True, worktree_is_clean=False,
            control_runtime_record_commit_is_direct=False, product_commit_parent_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **common))
        post = dict(common, actual_head="a" * 40, actual_changed_paths=metadata["post_start_cumulative_exact_paths"],
            working_tree_mode=False, worktree_is_clean=True, control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker.validate_repository_projection(repository, **post))
        for label, base, changes in (
            ("dirty widened", common, {"control_descendant_paths": start + ["outside.txt"]}),
            ("dirty narrowed", common, {"control_descendant_paths": start[:-1]}),
            ("source reverted", common, {"actual_changed_paths": source[:-1]}),
            ("second descendant", post, {"control_runtime_record_commit_is_direct": False}),
            ("merge", post, {"control_runtime_record_commit_is_direct": False}),
            ("source parent", common, {"product_commit_parent_is_direct": False}),
            ("cumulative reversion", post, {"actual_changed_paths": source}),
            ("dirty child", post, {"worktree_is_clean": False, "working_tree_mode": True}),
            ("base ancestry", common, {"base_is_ancestor": False}),
            ("remote", common, {"actual_remote_head": "0" * 40}),
        ):
            with self.subTest(label=label):
                self.assertTrue(checker.validate_repository_projection(repository, **dict(base, **changes)))

    def test_c21_provider_wsl_execution_resume_collector_fails_closed(self):
        checker, bundle, _, _ = self._execution_resume_fixture()
        (bundle["_root"] / ".git").mkdir()
        metadata = checker.c21_provider_wsl_execution_resume_path_metadata()
        source, parent, base = checker.C21_RESUME_SOURCE, checker.C21_RESUME_PARENT, checker.C21_RESUME_BASE
        values = {
            ("rev-parse", "HEAD"): source, ("branch", "--show-current"): "codex/c21-operational-execution",
            ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): "origin/codex/c21-operational-execution",
            ("rev-parse", "@{u}"): checker.C21_RESUME_REMOTE,
            ("rev-parse", "origin/codex/c21-operational-execution"): checker.C21_RESUME_REMOTE,
            ("diff", "--name-only", base, source): "\n".join(metadata["source_cumulative_exact_paths"]),
            ("show", "-s", "--format=%P", source): parent,
            ("diff", "--name-only", parent, source): "\n".join(sorted(checker.c21_provider_wsl_git_only_candidate_paths())),
            ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"): "\n".join(" M " + path for path in metadata["start_exact_paths"]),
            ("for-each-ref", "--format=%(refname) %(objectname)", checker.C21_RESUME_CANDIDATE_REF): "",
        }
        def run(mapping):
            with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: mapping.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
                return checker._validate_git_projection(bundle)
        self.assertEqual([], run(values))
        for key in values:
            with self.subTest(missing=key):
                self.assertTrue(run(dict(values, **{}) | {key: None}))
        ref_key = ("for-each-ref", "--format=%(refname) %(objectname)", checker.C21_RESUME_CANDIDATE_REF)
        self.assertTrue(run(values | {ref_key: checker.C21_RESUME_CANDIDATE_REF + " " + source}))
        status_key = ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all")
        child = "a" * 40
        post = values | {
            ("rev-parse", "HEAD"): child, status_key: "",
            ("diff", "--name-only", base, child): "\n".join(metadata["post_start_cumulative_exact_paths"]),
            ("show", "-s", "--format=%P", child): source,
            ("diff", "--name-only", f"{source}..{child}"): "\n".join(metadata["start_exact_paths"]),
        }
        self.assertEqual([], run(post))
        for label, key, value in (
            ("second descendant", ("show", "-s", "--format=%P", child), "b" * 40),
            ("merge", ("show", "-s", "--format=%P", child), source + " " + "b" * 40),
            ("source parent", ("show", "-s", "--format=%P", source), "b" * 40),
            ("cumulative reversion", ("diff", "--name-only", base, child), "\n".join(metadata["post_start_cumulative_exact_paths"][:-1])),
            ("dirty child", status_key, " M docs/WORK_STATUS.md"),
            ("missing parent collection", ("show", "-s", "--format=%P", child), None),
            ("missing descendant collection", ("diff", "--name-only", f"{source}..{child}"), None),
        ):
            with self.subTest(label=label):
                self.assertTrue(run(post | {key: value}))
        with mock.patch.object(checker, "_git_value", side_effect=OSError("git unavailable")):
            self.assertEqual(["GIT_REQUIRED_COLLECTION_FAILED"], checker._validate_git_projection(bundle))

    def test_c21_provider_wsl_execution_resume_rejects_duplicate_or_malformed_git_rows(self):
        checker, bundle, _, _ = self._execution_resume_fixture()
        self.assertTrue(hasattr(checker, "_c21_resume_git_paths"))
        self.assertEqual(["docs/WORK_STATUS.md"], checker._c21_resume_git_paths("docs/WORK_STATUS.md"))
        for raw in ("docs/WORK_STATUS.md\ndocs/WORK_STATUS.md", "docs/WORK_STATUS.md\n\n", " docs/WORK_STATUS.md", "../outside.txt"):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                checker._c21_resume_git_paths(raw)

    def test_c21_provider_wsl_execution_resume_start_paths_are_frozen(self) -> None:
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_execution_resume_start_paths"))
        self.assertTrue(hasattr(checker, "c21_provider_wsl_execution_resume_paths"))
        start = sorted(checker.c21_provider_wsl_execution_resume_start_paths())
        successor = sorted(checker.c21_provider_wsl_execution_resume_paths())
        self.assertEqual(10, len(start))
        self.assertEqual(
            "0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070",
            checker.path_list_lf_sha256(start),
        )
        self.assertEqual(14, len(successor))
        self.assertEqual(
            "3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B",
            checker.path_list_lf_sha256(successor),
        )

    def test_c21_provider_wsl_execution_resume_completion_appends_terminal_events(self):
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_execution_resume_artifacts"))
        historical = {
            path: subprocess.check_output(["git", "show", f"{checker.C21_RESUME_START_COMMIT}:{path}"], cwd=ROOT)
            for path in (checker.C21_RESUME_P, checker.C21_RESUME_E, checker.C21_RESUME_H)
        }
        files = {
            path: (ROOT / path).read_bytes()
            for path in checker.c21_provider_wsl_execution_resume_paths()
            if path not in {
                checker.C21_RESUME_P, checker.C21_RESUME_E, checker.C21_RESUME_H,
                checker.C21_RESUME_BOUND_D, checker.C21_RESUME_BOUND_M,
            } and (ROOT / path).is_file()
        }
        artifacts = checker.c21_provider_wsl_execution_resume_artifacts(historical, files)
        progress = json.loads(artifacts[checker.C21_RESUME_P])
        events = json.loads(artifacts[checker.C21_RESUME_E])
        manifest = json.loads(artifacts[checker.C21_RESUME_BOUND_M])
        self.assertTrue(artifacts[checker.C21_RESUME_H].startswith(
            b"# C-21 Provider WSL execution-resume K exact14"
        ))
        self.assertEqual(536, progress["event_sequence"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual("COMPLETED", progress["active_work_instruction"]["result_status"])
        self.assertEqual("READY_FOR_APPROVED_WSL_QA", progress["status"])
        self.assertEqual([534, 535, 536], [row["sequence"] for row in events["events"][-3:]])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-3:]],
        )
        self.assertEqual(
            checker.c21_provider_wsl_execution_resume_path_metadata()["post_successor_cumulative_exact_paths"],
            events["events"][-1]["details"]["exact_allowed_paths"],
        )
        self.assertEqual("READY_FOR_APPROVED_WSL_QA", manifest["status"])
        for key in ("commit", "push", "wsl", "docker", "database", "provider", "telegram", "ysna", "main_merge"):
            self.assertEqual("NOT_EXECUTED", manifest[key])

    def test_c21_provider_wsl_execution_resume_candidate_manifest_raw_contract_is_frozen(self):
        checker = self.require_checker()
        raw = subprocess.check_output(
            ["git", "show", "3501c37b25274c2c3b406a15bc8a57aa03a162e7:deploy/wsl/CandidateReleaseManifest.json"],
            cwd=ROOT,
        )
        self.assertEqual(checker.C21_RESUME_BOUND_CANDIDATE_SHA, hashlib.sha256(raw).hexdigest().upper())
        self.assertNotEqual(checker.C21_RESUME_BOUND_CANDIDATE_SHA, hashlib.sha256(raw + b" ").hexdigest().upper())

    def test_c21_provider_wsl_execution_resume_completion_repository_is_exact14(self):
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "_validate_c21_resume_bound_repository"))
        metadata = checker.c21_provider_wsl_execution_resume_path_metadata()
        repository = {
            "projection_mode": checker.VALIDATED_BASE_PROJECTION_MODE,
            "validated_base_commit": checker.C21_RESUME_BASE,
            "head_relation": checker.C21_RESUME_BOUND_RELATION,
            "local_head": checker.C21_RESUME_START_COMMIT,
            "product_parent_commit": checker.C21_RESUME_SOURCE,
            "branch": "codex/c21-operational-execution",
            "upstream": "origin/codex/c21-operational-execution",
            "feature_remote": "origin/codex/c21-operational-execution",
            "remote_head": checker.C21_RESUME_REMOTE,
            "feature_remote_head": checker.C21_RESUME_REMOTE,
            "candidate_remote_ref": checker.C21_RESUME_BOUND_CANDIDATE_REF,
            "worktree_status": "SEQ536_PROVIDER_WSL_EXECUTION_RESUME_EXACT14_DIRTY",
            "exact_allowed_paths": metadata["post_successor_cumulative_exact_paths"],
            "provider_wsl_execution_resume_start_paths": metadata["start_exact_paths"],
            "provider_wsl_execution_resume_paths": metadata["successor_exact_paths"],
            "push_status": "NOT_EXECUTED",
        }
        common = dict(
            actual_head=checker.C21_RESUME_START_COMMIT,
            actual_branch=repository["branch"], actual_upstream=repository["upstream"],
            actual_remote_head=checker.C21_RESUME_REMOTE, actual_feature_remote_head=checker.C21_RESUME_REMOTE,
            actual_changed_paths=metadata["post_start_cumulative_exact_paths"],
            control_descendant_paths=metadata["successor_exact_paths"], working_tree_mode=True,
            worktree_is_clean=False, control_runtime_record_commit_is_direct=False,
            control_is_ancestor=True, base_is_ancestor=True, product_commit_parent_is_direct=True,
        )
        self.assertEqual([], checker._validate_c21_resume_bound_repository(repository, **common))
        post = dict(common, actual_head="f" * 40,
                    actual_changed_paths=metadata["post_successor_cumulative_exact_paths"],
                    working_tree_mode=False, worktree_is_clean=True,
                    control_runtime_record_commit_is_direct=True)
        self.assertEqual([], checker._validate_c21_resume_bound_repository(repository, **post))
        for field, value in (
            ("control_descendant_paths", metadata["successor_exact_paths"][:-1]),
            ("actual_changed_paths", metadata["post_successor_cumulative_exact_paths"][:-1]),
            ("control_runtime_record_commit_is_direct", False),
            ("worktree_is_clean", False),
            ("base_is_ancestor", False),
            ("actual_remote_head", "0" * 40),
        ):
            with self.subTest(field=field):
                self.assertTrue(checker._validate_c21_resume_bound_repository(repository, **dict(post, **{field: value})))


    def test_c21_provider_wsl_exact_binding_completion_is_forward_only(self):
        checker = self.require_checker()
        self.assertTrue(hasattr(checker, "c21_provider_wsl_exact_binding_artifacts"))
        accepted = "c330d34ea7d0acc7e423a978f9c558c94c159118"
        historical = {
            path: subprocess.check_output(["git", "show", f"{checker.C21_EXACT_BINDING_START_COMMIT}:{path}"], cwd=ROOT)
            for path in (checker.C21_EXACT_BINDING_P, checker.C21_EXACT_BINDING_E, checker.C21_EXACT_BINDING_H)
        }
        files = {
            path: subprocess.check_output(["git", "show", f"{accepted}:{path}"], cwd=ROOT)
            for path in checker.c21_provider_wsl_exact_binding_paths()
            if path not in {
                checker.C21_EXACT_BINDING_P, checker.C21_EXACT_BINDING_E, checker.C21_EXACT_BINDING_H,
                checker.C21_EXACT_BINDING_BOUND_D, checker.C21_EXACT_BINDING_BOUND_M,
            }
        }
        artifacts = checker.c21_provider_wsl_exact_binding_artifacts(historical, files)
        progress = json.loads(artifacts[checker.C21_EXACT_BINDING_P])
        events = json.loads(artifacts[checker.C21_EXACT_BINDING_E])
        manifest = json.loads(artifacts[checker.C21_EXACT_BINDING_BOUND_M])
        self.assertEqual(542, progress["event_sequence"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertEqual([540, 541, 542], [row["sequence"] for row in events["events"][-3:]])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-3:]],
        )
        self.assertEqual("READY_FOR_EXACT_PRIVATE_PUSH_AND_WSL_QA", manifest["status"])
        self.assertEqual(
            [
                "a6dca0da5a37e64491e91813895268e78ecb78b2",
                "a342d62391a44b349733d1468ac3b180761155ab",
                "324eb169fedbce958d2e8cc29362deb7af433677",
            ],
            manifest["runtime_binding"]["rollback_allowlist"],
        )
        for key in ("commit", "push", "wsl", "docker", "database", "provider", "telegram", "ysna", "main_merge"):
            self.assertEqual("NOT_EXECUTED", manifest[key])
        self.assertEqual([], checker.validate_c21_provider_wsl_exact_binding_artifacts(historical, files, artifacts))
        changed = dict(artifacts)
        tampered = copy.deepcopy(manifest)
        tampered["runtime_binding"]["observed_previous"] = "0" * 40
        changed[checker.C21_EXACT_BINDING_BOUND_M] = json.dumps(tampered).encode()
        self.assertTrue(checker.validate_c21_provider_wsl_exact_binding_artifacts(historical, files, changed))


class C21ProviderWslVerifyScopeCorrectionTests(unittest.TestCase):
    def test_seq548_builder_preserves_history_and_freezes_provider_exclusion(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_provider_wsl_verify_scope_artifacts"))
        historical = {
            path: subprocess.check_output(
                ["git", "show", f"{checker.C21_VERIFY_SCOPE_PARENT}:{path}"], cwd=ROOT
            )
            for path in (checker.C21_VERIFY_SCOPE_P, checker.C21_VERIFY_SCOPE_E, checker.C21_VERIFY_SCOPE_H)
        }
        raw_scope = set(checker.c21_provider_wsl_verify_scope_paths()) - {
            checker.C21_VERIFY_SCOPE_P, checker.C21_VERIFY_SCOPE_E,
            checker.C21_VERIFY_SCOPE_H, checker.C21_VERIFY_SCOPE_D,
            checker.C21_VERIFY_SCOPE_M,
        }
        files = {path: (ROOT / path).read_bytes() for path in raw_scope}
        artifacts = checker.c21_provider_wsl_verify_scope_artifacts(historical, files)
        events = json.loads(artifacts[checker.C21_VERIFY_SCOPE_E])["events"]
        manifest = json.loads(artifacts[checker.C21_VERIFY_SCOPE_M])

        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical[checker.C21_VERIFY_SCOPE_E], 542),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_VERIFY_SCOPE_E], 542),
        )
        self.assertEqual(list(range(543, 549)), [row["sequence"] for row in events[-6:]])
        self.assertEqual("PROVIDER_AND_TELEGRAM_EXCLUDED", manifest["verification_scope"]["mode"])
        self.assertEqual("ATTEMPTED", manifest["runtime_attempt"]["local_provider_status"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_attempt"]["external_provider_billing"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_attempt"]["telegram"])
        self.assertEqual(2, manifest["valid_failure_count"])
        self.assertEqual(17, manifest["developer_exact_path_count"])
        self.assertEqual("78D7DFC8B684F2F295D4507931128E48D67017276D85941F534BEC5A1F839502", manifest["developer_exact_path_list_sha256"])
        self.assertEqual(131, manifest["cumulative_exact_path_count"])
        self.assertEqual("984F9276F0FBAC94CED5B3BC47D794948BA6D551520D77B2144B8A340A5C574A", manifest["cumulative_exact_path_list_sha256"])
        self.assertEqual([], checker.validate_c21_provider_wsl_verify_scope_artifacts(historical, files, artifacts))


class C21WslRollbackScopeCompatR1Tests(unittest.TestCase):
    IMMUTABLE_FIXTURE_COMMIT = "797b4d831e384423fdd9a706f9512ffa9dc79bb5"

    def test_seq554_builder_preserves_history_and_binds_exact_scope(self):
        checker=_load_checker_or_none(); self.assertIsNotNone(checker)
        historical={p:subprocess.check_output(["git","show",f"{checker.C21_ROLLBACK_SCOPE_PARENT}:{p}"],cwd=ROOT)
                    for p in (checker.C21_ROLLBACK_SCOPE_P,checker.C21_ROLLBACK_SCOPE_E,checker.C21_ROLLBACK_SCOPE_H)}
        generated={checker.C21_ROLLBACK_SCOPE_P,checker.C21_ROLLBACK_SCOPE_E,checker.C21_ROLLBACK_SCOPE_H,
                   checker.C21_ROLLBACK_SCOPE_D,checker.C21_ROLLBACK_SCOPE_M}
        files={p:subprocess.check_output(["git","show",f"{self.IMMUTABLE_FIXTURE_COMMIT}:{p}"],cwd=ROOT)
               for p in set(checker.c21_wsl_rollback_scope_paths())-generated}
        artifacts=checker.c21_wsl_rollback_scope_artifacts(historical,files)
        events=json.loads(artifacts[checker.C21_ROLLBACK_SCOPE_E])["events"]
        manifest=json.loads(artifacts[checker.C21_ROLLBACK_SCOPE_M])
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical[checker.C21_ROLLBACK_SCOPE_E],548),
                         checker.raw_event_object_prefix_bytes(artifacts[checker.C21_ROLLBACK_SCOPE_E],548))
        self.assertEqual(list(range(549,555)),[row["sequence"] for row in events[-6:]])
        self.assertEqual(16,manifest["developer_exact_path_count"])
        self.assertEqual("27647FE5BBE135FAB147A635D75BF93B7A4EC03E26BA00C2C709402EFB80B841",manifest["developer_exact_path_list_sha256"])
        self.assertEqual(137,manifest["cumulative_exact_path_count"])
        self.assertEqual("71F5E29A6F2AFA16219059D9417415DE3F62A515D7145728F21363EFCB4B42FC",manifest["cumulative_exact_path_list_sha256"])
        self.assertEqual("PASS",manifest["runtime_fact"]["verify_receipts"]["pg15"])
        self.assertEqual("NOT_STARTED",manifest["runtime_fact"]["first_rollback_attempt"]["pg18rc_mutation"])
        self.assertEqual("UNCHANGED",manifest["runtime_fact"]["environment"]["bytes"])
        self.assertEqual("NOT_EXECUTED",manifest["provider"])

    def test_seq554_builder_rejects_scope_map_and_history_tamper(self):
        checker=_load_checker_or_none(); self.assertIsNotNone(checker)
        historical={p:subprocess.check_output(["git","show",f"{checker.C21_ROLLBACK_SCOPE_PARENT}:{p}"],cwd=ROOT)
                    for p in (checker.C21_ROLLBACK_SCOPE_P,checker.C21_ROLLBACK_SCOPE_E,checker.C21_ROLLBACK_SCOPE_H)}
        generated={checker.C21_ROLLBACK_SCOPE_P,checker.C21_ROLLBACK_SCOPE_E,checker.C21_ROLLBACK_SCOPE_H,
                   checker.C21_ROLLBACK_SCOPE_D,checker.C21_ROLLBACK_SCOPE_M}
        files={p:subprocess.check_output(["git","show",f"{self.IMMUTABLE_FIXTURE_COMMIT}:{p}"],cwd=ROOT)
               for p in set(checker.c21_wsl_rollback_scope_paths())-generated}
        bad=dict(files); doc=json.loads(bad["deploy/wsl/CandidateReleaseManifest.json"]); doc["rollback"]["test_session_permission_scopes_by_commit"].pop(next(iter(doc["rollback"]["test_session_permission_scopes_by_commit"])))
        bad["deploy/wsl/CandidateReleaseManifest.json"]=json.dumps(doc).encode()
        with self.assertRaises(ValueError): checker.c21_wsl_rollback_scope_artifacts(historical,bad)
        corrupt=dict(historical); corrupt[checker.C21_ROLLBACK_SCOPE_E]=corrupt[checker.C21_ROLLBACK_SCOPE_E].replace(b'"sequence": 1',b'"sequence": 0',1)
        with self.assertRaises(ValueError): checker.c21_wsl_rollback_scope_artifacts(corrupt,files)


class C21WslCleanupGuardSourceR1Tests(unittest.TestCase):
    @staticmethod
    def _seq560_git_values(checker):
        return {
            ("rev-parse", "HEAD"): checker.C21_CLEANUP_GUARD_SOURCE_PARENT,
            ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"): "",
            ("branch", "--show-current"): "codex/c21-operational-execution",
            ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): "origin/codex/c21-operational-execution",
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"): checker.C21_CLEANUP_GUARD_SOURCE_PARENT,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"): checker.C21_RESUME_PARENT,
        }

    def test_seq560_git_collector_names_status_and_declared_base_failures(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": checker.C21_EXACT_BINDING_BASE}}}
        values = self._seq560_git_values(checker)
        status_args = ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all")
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: None if args == status_args else values.get(args)):
            self.assertEqual(["GIT_STATUS_COLLECTION_FAILED"], checker._collect_c21_cleanup_guard_source_git(bundle))
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=1):
            self.assertEqual(["GIT_VALIDATED_BASE_NOT_ANCESTOR"], checker._collect_c21_cleanup_guard_source_git(bundle))

    def test_seq560_git_collector_requires_private_development_url_and_ref_cas(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": checker.C21_EXACT_BINDING_BASE}}}
        for arguments, bad_value in (
            (("remote", "get-url", "development"), "https://github.com/public/Anvil.git"),
            (("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"), "0" * 40),
            (("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"), "0" * 40),
        ):
            with self.subTest(arguments=arguments):
                values = self._seq560_git_values(checker)
                values[arguments] = bad_value
                with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)):
                    self.assertEqual(["GIT_PRIVATE_AUTHORITY_MISMATCH"], checker._collect_c21_cleanup_guard_source_git(bundle))

    def test_seq560_builder_preserves_seq554_history_and_binds_exact15(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_cleanup_guard_source_artifacts"))
        historical = {p: subprocess.check_output(["git", "show", f"{checker.C21_CLEANUP_GUARD_SOURCE_PARENT}:{p}"], cwd=ROOT)
                      for p in (checker.C21_CLEANUP_GUARD_SOURCE_P, checker.C21_CLEANUP_GUARD_SOURCE_E, checker.C21_CLEANUP_GUARD_SOURCE_H)}
        generated = {checker.C21_CLEANUP_GUARD_SOURCE_P, checker.C21_CLEANUP_GUARD_SOURCE_E, checker.C21_CLEANUP_GUARD_SOURCE_H,
                     checker.C21_CLEANUP_GUARD_SOURCE_D, checker.C21_CLEANUP_GUARD_SOURCE_M}
        files = {p: (ROOT / p).read_bytes() for p in set(checker.c21_cleanup_guard_source_paths()) - generated}
        artifacts = checker.c21_cleanup_guard_source_artifacts(historical, files)
        events = json.loads(artifacts[checker.C21_CLEANUP_GUARD_SOURCE_E])["events"]
        manifest = json.loads(artifacts[checker.C21_CLEANUP_GUARD_SOURCE_M])
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical[checker.C21_CLEANUP_GUARD_SOURCE_E], 554), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_CLEANUP_GUARD_SOURCE_E], 554))
        self.assertEqual(list(range(555, 561)), [row["sequence"] for row in events[-6:]])
        self.assertEqual(15, manifest["developer_exact_path_count"])
        self.assertEqual("6722B8BCE25FAFA0467214F8C5C91833515E3443A59CD8FBC1471538AF62DE82", manifest["developer_exact_path_list_sha256"])
        self.assertEqual(143, manifest["cumulative_exact_path_count"])
        self.assertEqual("F69664E702C97D7859E21F455919D1BCF913BCF70C6375F752892B25B793DB22", manifest["cumulative_exact_path_list_sha256"])
        self.assertEqual(0, manifest["runtime"]["prior_runtime_cleanup_attempt"]["mutation_count"])


class C21WslCleanupRuntimeResultTests(unittest.TestCase):
    @staticmethod
    def _historical(checker):
        return {
            path: subprocess.check_output(
                ["git", "show", f"{checker.C21_CLEANUP_RUNTIME_RESULT_PARENT}:{path}"], cwd=ROOT
            )
            for path in (
                checker.C21_CLEANUP_RUNTIME_RESULT_P,
                checker.C21_CLEANUP_RUNTIME_RESULT_E,
                checker.C21_CLEANUP_RUNTIME_RESULT_H,
            )
        }

    @staticmethod
    def _raw_files(checker):
        generated = {
            checker.C21_CLEANUP_RUNTIME_RESULT_P,
            checker.C21_CLEANUP_RUNTIME_RESULT_E,
            checker.C21_CLEANUP_RUNTIME_RESULT_H,
            checker.C21_CLEANUP_RUNTIME_RESULT_D,
            checker.C21_CLEANUP_RUNTIME_RESULT_M,
        }
        return {
            path: (ROOT / path).read_bytes()
            for path in set(checker.c21_cleanup_runtime_result_paths()) - generated
        }

    def test_seq566_builder_preserves_seq560_and_records_strict_runtime_result(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_cleanup_runtime_result_artifacts"))
        historical = self._historical(checker)
        artifacts = checker.c21_cleanup_runtime_result_artifacts(historical, self._raw_files(checker))
        events = json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_E])["events"]
        manifest = json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_M])
        progress = json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_P])
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical[checker.C21_CLEANUP_RUNTIME_RESULT_E], 560),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_E], 560),
        )
        self.assertEqual(list(range(561, 567)), [row["sequence"] for row in events[-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events[-6:]],
        )
        self.assertEqual("READY_FOR_C21_WSL_ACCEPTANCE", progress["status"])
        self.assertEqual("INDEPENDENT_C21_WSL_ACCEPTANCE_REVIEW", progress["runtime_next_action"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("PENDING", manifest["independent_tester_status"])
        self.assertEqual("BLOCKED_PENDING_C21_ACCEPTANCE", manifest["c01_status"])
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])
        runtime = manifest["runtime"]
        self.assertEqual("UNAVAILABLE_AFTER_SUBAGENT_COMPACTION", runtime["runtime_observed_at_status"])
        self.assertIsNone(runtime["runtime_observed_at"])
        self.assertEqual("2026-09-07", runtime["runtime_observed_date"])
        self.assertNotEqual(runtime["runtime_observed_at"], manifest["recorded_at"])
        self.assertEqual("LOCAL_CLOCK_AT_APPEND_ONLY_RECORDING", manifest["recorded_at_source"])
        self.assertEqual(1, runtime["cleanup"]["invocation_count"])
        self.assertEqual(0, runtime["cleanup"]["internal_exit_code"])
        self.assertEqual(1, runtime["cleanup"]["outer_wrapper_exit_code"])
        self.assertEqual("SUCCEEDED", runtime["cleanup"]["cleanup_status"])
        self.assertFalse(runtime["cleanup"]["wrapper_failure_is_cleanup_failure"])
        self.assertEqual("POST_CLEANUP_UNRELATED_INVENTORY_EQUALITY_ASSERTION", runtime["cleanup"]["wrapper_failure"])
        self.assertEqual(
            {"containers": {"before": 6, "deleted": 6, "remaining": 0}, "networks": {"before": 4, "deleted": 4, "remaining": 0}, "volumes": {"before": 2, "deleted": 2, "remaining": 0}},
            runtime["target_cleanup"],
        )
        self.assertFalse(runtime["unrelated_inventory"]["global_equality"])
        self.assertEqual(0, runtime["unrelated_inventory"]["preexisting_missing_count"])
        self.assertEqual(0, runtime["unrelated_inventory"]["preexisting_changed_count"])
        self.assertEqual(["Daon2", "eoul"], runtime["unrelated_inventory"]["concurrent_added_or_replaced_projects"])
        self.assertEqual("a6dca0da5a37e64491e91813895268e78ecb78b2", runtime["application"]["head"])
        self.assertEqual("DETACHED", runtime["application"]["head_mode"])
        self.assertTrue(runtime["application"]["clean"])
        self.assertEqual("stage.3558037.6302", runtime["control"]["active_stage"])
        self.assertEqual(checker.C21_CLEANUP_RUNTIME_RESULT_PARENT, runtime["control"]["head"])
        self.assertEqual("fecae53b750e170a5bf345a23ac8d9ba12b508e9c6d0b47c518b90fd4d52a79a", runtime["environment"]["sha256"])
        self.assertEqual(443, runtime["environment"]["size"])
        self.assertEqual("0600", runtime["environment"]["mode"])
        self.assertEqual("root:root", runtime["environment"]["owner"])
        self.assertTrue(runtime["environment"]["unchanged"])
        self.assertEqual("324eb169fedbce958d2e8cc29362deb7af433677", runtime["markers"]["pg15"]["current"])
        self.assertEqual(runtime["markers"]["pg15"], runtime["markers"]["pg18rc"])
        self.assertTrue(runtime["receipts_and_evidence"]["hashes_and_counts_preserved"])
        self.assertEqual("EXECUTED_APPROVED", runtime["external_execution"]["volume_cleanup"])
        for name in ("provider", "telegram", "separate_database", "ysna", "main"):
            self.assertEqual("NOT_EXECUTED", runtime["external_execution"][name])
        limitation = manifest["evidence_detail_limitations"][0]
        self.assertEqual("PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION", limitation["code"])
        self.assertEqual("OPEN", limitation["status"])
        self.assertEqual("UNRESOLVED_EVIDENCE_DETAIL", limitation["resolution"])
        self.assertEqual("MINOR", limitation["reviewer_severity"])

    def test_seq566_metadata_binds_windows_and_ordinal_exact12_cumulative149(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_cleanup_runtime_result_metadata"))
        metadata = checker.c21_cleanup_runtime_result_metadata()
        self.assertEqual(12, metadata["developer_exact_path_count"])
        self.assertEqual("54DE92EBEC20A6897379A2B14FBBA258517A0E6A52A221C6217739B40FA9E0EF", metadata["developer_exact_path_list_sha256"])
        self.assertEqual("63E7070C7D5D018F76DE04A0369B5778F3B58AF2798EA2EC78ED3CFB75645CA0", metadata["developer_exact_path_list_ordinal_sha256"])
        self.assertEqual(149, metadata["cumulative_exact_path_count"])
        self.assertEqual("F804F93F8F8BE351071EB0CC3674A4EB442BF8D0E74DFF0D65FAD88AD1DE85F2", metadata["cumulative_exact_path_list_sha256"])
        self.assertEqual("B956DA56B0D6BD17D0918878F1E3F80E672FAE971CEE3E4793A1CE227E0C47C8", metadata["cumulative_exact_path_list_ordinal_sha256"])

    def test_seq566_runtime_validator_rejects_tamper_and_malformed_json(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "validate_c21_cleanup_runtime_result_runtime"))
        runtime = checker._c21_cleanup_runtime_result_runtime()
        mutations = (
            ("cleanup_count", lambda d: d["cleanup"].__setitem__("invocation_count", 2)),
            ("cleanup_exit", lambda d: d["cleanup"].__setitem__("internal_exit_code", 1)),
            ("misclassification", lambda d: d["cleanup"].__setitem__("wrapper_failure_is_cleanup_failure", True)),
            ("target_remaining", lambda d: d["target_cleanup"]["containers"].__setitem__("remaining", 1)),
            ("unrelated_loss", lambda d: d["unrelated_inventory"].__setitem__("preexisting_missing_count", 1)),
            ("environment", lambda d: d["environment"].__setitem__("unchanged", False)),
            ("marker", lambda d: d["markers"]["pg15"].__setitem__("current", "0" * 40)),
            ("receipt", lambda d: d["receipts_and_evidence"].__setitem__("hashes_and_counts_preserved", False)),
            ("external", lambda d: d["external_execution"].__setitem__("provider", "EXECUTED")),
            ("observed_at", lambda d: d.__setitem__("runtime_observed_at", "2026-09-07T00:00:00Z")),
        )
        self.assertEqual([], checker.validate_c21_cleanup_runtime_result_runtime(runtime))
        for name, mutate in mutations:
            with self.subTest(name=name):
                changed = copy.deepcopy(runtime); mutate(changed)
                self.assertTrue(checker.validate_c21_cleanup_runtime_result_runtime(changed))
        with self.assertRaises((json.JSONDecodeError, UnicodeDecodeError)):
            checker._c21_resume_json(b'{"broken":')

    def test_seq566_manifest_and_history_validators_reject_boundary_evidence_and_prefix_tamper(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "validate_c21_cleanup_runtime_result_manifest"))
        historical = self._historical(checker)
        raw_files = self._raw_files(checker)
        artifacts = checker.c21_cleanup_runtime_result_artifacts(historical, raw_files)
        manifest = json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_M])
        self.assertEqual([], checker.validate_c21_cleanup_runtime_result_manifest(manifest))
        mutations = (
            ("accepted", lambda d: d.__setitem__("accepted", True)),
            ("tester", lambda d: d.__setitem__("independent_tester_status", "PASS")),
            ("c01", lambda d: d.__setitem__("c01_status", "READY")),
            ("dir2", lambda d: d.__setitem__("dir2_status", "TRIGGERED")),
            ("limitation", lambda d: d.__setitem__("evidence_detail_limitations", [])),
            ("path_count", lambda d: d.__setitem__("developer_exact_path_count", 11)),
            ("path_hash", lambda d: d.__setitem__("cumulative_exact_path_list_sha256", "0" * 64)),
            ("history_hash", lambda d: d["historical_hashes"].__setitem__(checker.C21_CLEANUP_RUNTIME_RESULT_E, "0" * 64)),
        )
        for name, mutate in mutations:
            with self.subTest(name=name):
                changed = copy.deepcopy(manifest); mutate(changed)
                self.assertTrue(checker.validate_c21_cleanup_runtime_result_manifest(changed))
        self.assertTrue(checker.validate_c21_cleanup_runtime_result_manifest({}))
        corrupt = dict(historical)
        corrupt[checker.C21_CLEANUP_RUNTIME_RESULT_E] = corrupt[checker.C21_CLEANUP_RUNTIME_RESULT_E].replace(b'"sequence": 1', b'"sequence": 0', 1)
        with self.assertRaises(ValueError):
            checker.c21_cleanup_runtime_result_artifacts(corrupt, raw_files)
        missing = dict(raw_files); missing.pop(next(iter(missing)))
        with self.assertRaises(ValueError):
            checker.c21_cleanup_runtime_result_artifacts(historical, missing)

    def test_seq566_public_validators_reject_json_scalar_type_confusion(self):
        """A bool/float accepted as an int would let an invalid public record pass."""
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        historical = self._historical(checker)
        artifacts = checker.c21_cleanup_runtime_result_artifacts(historical, self._raw_files(checker))
        manifest = json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_M])

        runtime = copy.deepcopy(manifest["runtime"])
        runtime["cleanup"]["invocation_count"] = True
        runtime["cleanup"]["internal_exit_code"] = False
        runtime["cleanup"]["outer_wrapper_exit_code"] = 1.0
        self.assertTrue(checker.validate_c21_cleanup_runtime_result_runtime(runtime))

        confused_manifest = copy.deepcopy(manifest)
        confused_manifest["accepted"] = 0
        confused_manifest["event_sequence"] = 566.0
        confused_manifest["self_reference"] = 0
        confused_manifest["developer_exact_path_count"] = 12.0
        confused_manifest["raw_checksums"][0]["bytes"] = True
        self.assertTrue(checker.validate_c21_cleanup_runtime_result_manifest(confused_manifest))

        projection_bundle = {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_P]),
            "events": json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_E]),
            "detached_digest": json.loads(artifacts[checker.C21_CLEANUP_RUNTIME_RESULT_D]),
        }
        generated = {
            checker.C21_CLEANUP_RUNTIME_RESULT_P,
            checker.C21_CLEANUP_RUNTIME_RESULT_E,
            checker.C21_CLEANUP_RUNTIME_RESULT_H,
            checker.C21_CLEANUP_RUNTIME_RESULT_D,
            checker.C21_CLEANUP_RUNTIME_RESULT_M,
        }
        original_read_bytes = Path.read_bytes
        def read_seq566_generated(path):
            try:
                relative = path.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return artifacts[relative] if relative in generated else original_read_bytes(path)
        projection_bundle["progress"]["event_sequence"] = 566.0
        with mock.patch.object(Path, "read_bytes", autospec=True, side_effect=read_seq566_generated):
            self.assertTrue(checker.validate_c21_cleanup_runtime_result_projection(projection_bundle, manifest))

        public_bundle = checker.load_bundle(ROOT)
        public_bundle["progress"]["event_sequence"] = 566.0
        public_bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(public_bundle["progress"])
        public_bundle["events"]["last_sequence"] = 566.0
        public_bundle["events"]["events"][-1]["sequence"] = 566.0
        public_bundle["detached_digest"]["event_sequence"] = 566.0
        self.assertTrue(checker.validate_bundle(public_bundle))

    @staticmethod
    def _seq566_git_values(checker, *, head=None, status=None, parents=None):
        head = head or checker.C21_CLEANUP_RUNTIME_RESULT_PARENT
        return {
            ("rev-parse", "HEAD"): head,
            ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"): status,
            ("branch", "--show-current"): "codex/c21-operational-execution",
            ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): "origin/codex/c21-operational-execution",
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"): checker.C21_CLEANUP_RUNTIME_RESULT_PARENT,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"): "a6dca0da5a37e64491e91813895268e78ecb78b2",
            ("diff", "--name-only", checker.C21_CLEANUP_RUNTIME_RESULT_PARENT, head): "\n".join(checker.c21_cleanup_runtime_result_paths()),
            ("diff", "--name-only", checker.C21_EXACT_BINDING_BASE, head): "\n".join(checker.c21_cleanup_runtime_result_metadata()["cumulative_exact_paths"]),
            ("show", "-s", "--format=%P", head): parents,
        }

    def test_seq566_git_collector_fail_closed_precommit_postcommit_and_invalid_descendants(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "_collect_c21_cleanup_runtime_result_git"))
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": checker.C21_EXACT_BINDING_BASE}}}
        dirty = "\n".join(f" M {path}" for path in checker.c21_cleanup_runtime_result_paths())
        values = self._seq566_git_values(checker, status=dirty)
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
            self.assertEqual([], checker._collect_c21_cleanup_runtime_result_git(bundle))
        values[("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all")] = None
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)):
            self.assertEqual(["GIT_STATUS_COLLECTION_FAILED"], checker._collect_c21_cleanup_runtime_result_git(bundle))
        child = "1" * 40
        values = self._seq566_git_values(checker, head=child, status="", parents=checker.C21_CLEANUP_RUNTIME_RESULT_PARENT)
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
            self.assertEqual([], checker._collect_c21_cleanup_runtime_result_git(bundle))
        for name, bad_head, bad_parents in (("merge", "2" * 40, checker.C21_CLEANUP_RUNTIME_RESULT_PARENT + " " + "3" * 40), ("second_descendant", "4" * 40, child), ("reversion", checker.C21_CLEANUP_RUNTIME_RESULT_PARENT, None)):
            with self.subTest(name=name):
                bad_status = "" if name != "reversion" else dirty.replace(" M ", "")
                values = self._seq566_git_values(checker, head=bad_head, status=bad_status, parents=bad_parents)
                if name == "reversion":
                    values[("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all")] = ""
                with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
                    self.assertTrue(checker._collect_c21_cleanup_runtime_result_git(bundle))


class C21WslAcceptanceStrictSuccessorTests(unittest.TestCase):
    @staticmethod
    def _historical(checker):
        return {
            path: subprocess.check_output(
                ["git", "show", f"{checker.C21_WSL_ACCEPTANCE_STRICT_PARENT}:{path}"], cwd=ROOT
            )
            for path in (
                checker.C21_WSL_ACCEPTANCE_STRICT_P,
                checker.C21_WSL_ACCEPTANCE_STRICT_E,
                checker.C21_WSL_ACCEPTANCE_STRICT_H,
            )
        }

    @staticmethod
    def _raw_files(checker):
        generated = {
            checker.C21_WSL_ACCEPTANCE_STRICT_P,
            checker.C21_WSL_ACCEPTANCE_STRICT_E,
            checker.C21_WSL_ACCEPTANCE_STRICT_H,
            checker.C21_WSL_ACCEPTANCE_STRICT_D,
            checker.C21_WSL_ACCEPTANCE_STRICT_M,
        }
        return {
            path: (ROOT / path).read_bytes()
            for path in set(checker.c21_wsl_acceptance_strict_paths()) - generated
        }

    def _artifacts(self, checker):
        return checker.c21_wsl_acceptance_strict_artifacts(
            self._historical(checker), self._raw_files(checker)
        )

    def test_seq572_builder_preserves_seq566_and_records_limited_wsl_acceptance(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_wsl_acceptance_strict_artifacts"))
        historical = self._historical(checker)
        artifacts = checker.c21_wsl_acceptance_strict_artifacts(historical, self._raw_files(checker))
        events = json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_E])["events"]
        progress = json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_P])
        manifest = json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_M])
        handoff = checker.extract_handoff_summary(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_H].decode())
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical[checker.C21_WSL_ACCEPTANCE_STRICT_E], 566),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_E], 566),
        )
        self.assertEqual(list(range(567, 573)), [row["sequence"] for row in events[-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events[-6:]],
        )
        expected_state = {
            "acceptance_scope": "C21_WSL",
            "wsl_acceptance_status": "ACCEPTED_WITH_LIMITATION",
            "accepted": False,
            "c21_acceptance_status": "BLOCKED_NOT_ACCEPTED",
            "c01_status": "BLOCKED_PENDING_C21_ACCEPTANCE",
            "dir2_status": "NOT_TRIGGERED",
        }
        for document in (progress["wsl_acceptance"], handoff["wsl_acceptance"], manifest["wsl_acceptance"]):
            self.assertEqual(expected_state, {key: document[key] for key in expected_state})
        self.assertFalse(events[-1]["details"]["wsl_acceptance"]["accepted"])
        self.assertEqual("INDEPENDENT_TESTER_AGENT_REPORT", manifest["independent_tester"]["source"])
        self.assertEqual("ABSENT", manifest["independent_tester"]["repository_artifact"])
        self.assertEqual({"critical": 0, "important": 0, "minor": 2}, manifest["independent_tester"]["findings"])
        self.assertIsNone(manifest["runtime"]["runtime_observed_at"])
        self.assertEqual("UNAVAILABLE_AFTER_SUBAGENT_COMPACTION", manifest["runtime"]["runtime_observed_at_status"])
        limitation_codes = {row["code"] for row in manifest["open_limitations"]}
        self.assertEqual({
            "PRIMARY_MUTATION_WRAPPER_COMMAND_FULLTEXT_UNAVAILABLE_AFTER_SUBAGENT_COMPACTION",
            "EXACT_RUNTIME_OBSERVED_TIMESTAMP_UNAVAILABLE",
            "RECEIPT_ORIGINALS_AND_PATHS_NOT_INDEPENDENTLY_INSPECTED",
            "SAME_ORIGIN_HTTP_INGRESS_NOT_BROWSER_NETWORK_ACCEPTANCE",
        }, limitation_codes)
        self.assertEqual("NOT_VERIFIED", manifest["verification_boundaries"]["provider"])
        self.assertEqual("NOT_VERIFIED", manifest["verification_boundaries"]["telegram"])
        self.assertEqual("NOT_VERIFIED", manifest["verification_boundaries"]["ysna"])
        self.assertEqual("NOT_AUTHORIZED", manifest["verification_boundaries"]["main"])

    def test_seq572_metadata_binds_exact12_and_cumulative155_hashes(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_wsl_acceptance_strict_metadata()
        self.assertEqual(12, metadata["developer_exact_path_count"])
        self.assertEqual("9E8380E9F3B58C5F8C717133B0777AEA0E2DAF90CED947590DECC56C67C86B2F", metadata["developer_exact_path_list_sha256"])
        self.assertEqual("495960755DC2C2F74DF6FB8213163FE502A3EE6DDD4F0E2692FD97D06E406536", metadata["developer_exact_path_list_ordinal_sha256"])
        self.assertEqual(155, metadata["cumulative_exact_path_count"])
        self.assertEqual("4C4BF601FE76A9C24591891176470BD87E0BE85EFB060898033D741FACC6B66C", metadata["cumulative_exact_path_list_sha256"])
        self.assertEqual("2CA55B9DCCE87ECBC0D7FD233D8F98E76FA8ED7E7C1BCB6C903B72EB1EE64F2D", metadata["cumulative_exact_path_list_ordinal_sha256"])

    def test_seq572_validator_rejects_types_scope_promotion_and_evidence_invention(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = self._artifacts(checker)
        manifest = json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_M])
        self.assertEqual([], checker.validate_c21_wsl_acceptance_strict_manifest(manifest))
        mutations = (
            ("accepted_bool", lambda d: d.__setitem__("accepted", 0)),
            ("event_sequence_float", lambda d: d.__setitem__("event_sequence", 572.0)),
            ("self_reference_bool", lambda d: d.__setitem__("self_reference", 0)),
            ("path_count_float", lambda d: d.__setitem__("developer_exact_path_count", 12.0)),
            ("checksum_bool", lambda d: d["raw_checksums"][0].__setitem__("bytes", True)),
            ("scope_promotion", lambda d: d["wsl_acceptance"].__setitem__("acceptance_scope", "C21_ALL")),
            ("wsl_status_promotion", lambda d: d["wsl_acceptance"].__setitem__("wsl_acceptance_status", "ACCEPTED")),
            ("c21_acceptance", lambda d: d["wsl_acceptance"].__setitem__("c21_acceptance_status", "ACCEPTED")),
            ("c01", lambda d: d["wsl_acceptance"].__setitem__("c01_status", "READY")),
            ("dir2", lambda d: d["wsl_acceptance"].__setitem__("dir2_status", "TRIGGERED")),
            ("limitation_removed", lambda d: d.__setitem__("open_limitations", d["open_limitations"][:-1])),
            ("timestamp_invented", lambda d: d["runtime"].__setitem__("runtime_observed_at", "2026-09-07T00:00:00Z")),
            ("provider_promoted", lambda d: d["verification_boundaries"].__setitem__("provider", "VERIFIED")),
            ("telegram_promoted", lambda d: d["verification_boundaries"].__setitem__("telegram", "VERIFIED")),
        )
        for name, mutate in mutations:
            with self.subTest(name=name):
                changed = copy.deepcopy(manifest); mutate(changed)
                self.assertTrue(checker.validate_c21_wsl_acceptance_strict_manifest(changed))

    def test_seq572_projection_rejects_strict_state_tamper(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = self._artifacts(checker)
        bundle = {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_P]),
            "events": json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_D]),
        }
        manifest = json.loads(artifacts[checker.C21_WSL_ACCEPTANCE_STRICT_M])
        generated = set(artifacts)
        original_read_bytes = Path.read_bytes
        def read_seq572_generated(path):
            try:
                relative = path.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return artifacts[relative] if relative in generated else original_read_bytes(path)
        with mock.patch.object(Path, "read_bytes", autospec=True, side_effect=read_seq572_generated):
            self.assertEqual([], checker.validate_c21_wsl_acceptance_strict_projection(bundle, manifest))
            for name, mutate_bundle, mutate_manifest in (
                ("progress", lambda b: b["progress"]["wsl_acceptance"].__setitem__("accepted", 0), None),
                ("event", lambda b: b["events"]["events"][-1]["details"]["wsl_acceptance"].__setitem__("accepted", 0), None),
                ("handoff", lambda b: b["handoff"]["wsl_acceptance"].__setitem__("accepted", 0), None),
                ("digest", lambda b: b["detached_digest"].__setitem__("event_sequence", 572.0), None),
                ("manifest", None, lambda m: m.__setitem__("accepted", 0)),
            ):
                with self.subTest(name=name):
                    changed_bundle = copy.deepcopy(bundle)
                    changed_manifest = copy.deepcopy(manifest)
                    if mutate_bundle:
                        mutate_bundle(changed_bundle)
                    if mutate_manifest:
                        mutate_manifest(changed_manifest)
                    self.assertTrue(checker.validate_c21_wsl_acceptance_strict_projection(changed_bundle, changed_manifest))

    def test_seq572_builder_rejects_history_prefix_path_and_malformed_json(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        historical = self._historical(checker)
        raw_files = self._raw_files(checker)
        corrupt = dict(historical)
        corrupt[checker.C21_WSL_ACCEPTANCE_STRICT_E] = corrupt[checker.C21_WSL_ACCEPTANCE_STRICT_E].replace(b'"sequence": 1', b'"sequence": 0', 1)
        with self.assertRaises(ValueError):
            checker.c21_wsl_acceptance_strict_artifacts(corrupt, raw_files)
        malformed = dict(historical); malformed[checker.C21_WSL_ACCEPTANCE_STRICT_P] = b'{"broken":'
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            checker.c21_wsl_acceptance_strict_artifacts(malformed, raw_files)
        missing = dict(raw_files); missing.pop(next(iter(missing)))
        with self.assertRaises(ValueError):
            checker.c21_wsl_acceptance_strict_artifacts(historical, missing)

    @staticmethod
    def _git_values(checker, *, head=None, status=None, parents=None):
        head = head or checker.C21_WSL_ACCEPTANCE_STRICT_PARENT
        return {
            ("rev-parse", "HEAD"): head,
            ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"): status,
            ("branch", "--show-current"): "codex/c21-operational-execution",
            ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): "origin/codex/c21-operational-execution",
            ("remote", "get-url", "development"): checker.C21_WSL_ACCEPTANCE_STRICT_PRIVATE_URL,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"): checker.C21_WSL_ACCEPTANCE_STRICT_PRIVATE_CONTROL,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"): checker.C21_WSL_ACCEPTANCE_STRICT_CANDIDATE,
            ("diff", "--name-only", checker.C21_WSL_ACCEPTANCE_STRICT_PARENT, head): "\n".join(checker.c21_wsl_acceptance_strict_paths()),
            ("diff", "--name-only", checker.C21_EXACT_BINDING_BASE, head): "\n".join(checker.c21_wsl_acceptance_strict_metadata()["cumulative_exact_paths"]),
            ("show", "-s", "--format=%P", head): parents,
        }

    def test_seq572_git_collector_and_routing_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        bundle = {"_root": ROOT, "progress": {"event_sequence": 572, "repository": {"validated_base_commit": checker.C21_EXACT_BINDING_BASE}}}
        dirty = "\n".join(f" M {path}" for path in checker.c21_wsl_acceptance_strict_paths())
        values = self._git_values(checker, status=dirty)
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
            self.assertEqual([], checker._collect_c21_wsl_acceptance_strict_git(bundle))
        child = "1" * 40
        values = self._git_values(checker, head=child, status="", parents=checker.C21_WSL_ACCEPTANCE_STRICT_PARENT)
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
            self.assertEqual([], checker._collect_c21_wsl_acceptance_strict_git(bundle))
        for name, update in (
            ("merge", {("show", "-s", "--format=%P", child): checker.C21_WSL_ACCEPTANCE_STRICT_PARENT + " " + "2" * 40}),
            ("private_control", {("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"): "0" * 40}),
            ("candidate", {("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"): "0" * 40}),
            ("diff", {("diff", "--name-only", checker.C21_WSL_ACCEPTANCE_STRICT_PARENT, child): "docs/WORK_STATUS.md"}),
        ):
            with self.subTest(name=name):
                changed = dict(values); changed.update(update)
                with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: changed.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
                    self.assertTrue(checker._collect_c21_wsl_acceptance_strict_git(bundle))
        with mock.patch.object(checker, "_collect_c21_wsl_acceptance_strict_git", return_value=["ROUTED"]):
            self.assertEqual(["ROUTED"], checker._validate_git_projection(bundle))


class C21WorkbenchUiReworkLocalStartTests(unittest.TestCase):
    def test_seq575_builder_preserves_seq572_and_issues_exact_leases(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_local_start_artifacts"))
        historical = {
            path: subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_LOCAL_PARENT}:{path}"], cwd=ROOT)
            for path in (checker.C21_WORKBENCH_UI_LOCAL_P, checker.C21_WORKBENCH_UI_LOCAL_E, checker.C21_WORKBENCH_UI_LOCAL_H)
        }
        generated = {checker.C21_WORKBENCH_UI_LOCAL_P, checker.C21_WORKBENCH_UI_LOCAL_E, checker.C21_WORKBENCH_UI_LOCAL_H, checker.C21_WORKBENCH_UI_LOCAL_D, checker.C21_WORKBENCH_UI_LOCAL_M}
        raw_files = {path: (ROOT / path).read_bytes() for path in set(checker.c21_workbench_ui_local_start_paths()) - generated}
        artifacts = checker.c21_workbench_ui_local_start_artifacts(historical, raw_files)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_E])["events"]
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_M])
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical[checker.C21_WORKBENCH_UI_LOCAL_E], 572),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_LOCAL_E], 572),
        )
        self.assertEqual([573, 574, 575], [row["sequence"] for row in events[-3:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [row["event_type"] for row in events[-3:]])
        self.assertEqual("ACTIVE_WORKBENCH_UI_REWORK_LOCAL", progress["status"])
        self.assertEqual("ACTIVE", progress["worker_lease"]["status"])
        self.assertEqual("ACTIVE", progress["write_lease"]["status"])
        self.assertEqual(checker.c21_workbench_ui_local_product_paths(), progress["write_lease"]["paths"])
        self.assertEqual(10, manifest["start_exact_path_count"])
        self.assertEqual(11, manifest["product_exact_path_count"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("NOT_EXECUTED", manifest["external_execution"])

    def test_seq575_metadata_binds_exact_paths_and_rejects_scope_promotion(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_local_metadata()
        self.assertEqual(10, metadata["start_exact_path_count"])
        self.assertEqual("CFBA74FE970ADD24C512890616C8CAFBB269DF5AFE81A40AEBAB2A01D3F150D6", metadata["start_exact_path_list_sha256"])
        self.assertEqual(11, metadata["product_exact_path_count"])
        self.assertEqual("3FD59352816A3CAF316F1EF832C9B206B20363197C4B5887626BA8D964095DFF", metadata["product_exact_path_list_sha256"])
        self.assertEqual(159, metadata["cumulative_start_path_count"])
        self.assertEqual("9F597E2977C2133988D895A815E97620C634CB78FCF31DD6D3BAE71A16DB259B", metadata["cumulative_start_path_list_sha256"])
        artifacts = checker.c21_workbench_ui_local_start_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_M])
        self.assertEqual([], checker.validate_c21_workbench_ui_local_start_manifest(manifest))
        for key, value in (("accepted", True), ("external_execution", "PASS"), ("c21_status", "ACCEPTED"), ("c01_status", "READY"), ("dir2_status", "TRIGGERED")):
            changed = copy.deepcopy(manifest); changed[key] = value
            self.assertTrue(checker.validate_c21_workbench_ui_local_start_manifest(changed), key)


class C21WorkbenchUiReworkLocalResultTests(unittest.TestCase):
    def test_seq578_git_collector_rejects_mutated_declared_base(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        bundle = {"_root": ROOT, "progress": {"event_sequence": 578, "repository": {"validated_base_commit": "0" * 40}}}
        values = {
            ("rev-parse", "HEAD"): checker.C21_WORKBENCH_UI_LOCAL_PRODUCT_COMMIT,
            ("-c", "core.quotePath=false", "status", "--porcelain=v1", "--untracked-files=all"): " M docs/WORK_STATUS.md",
            ("branch", "--show-current"): "codex/c21-operational-execution",
            ("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"): "origin/codex/c21-operational-execution",
            ("remote", "get-url", "development"): checker.C21_WORKBENCH_UI_LOCAL_PRIVATE_URL,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/codex/c21-operational-execution"): checker.C21_WORKBENCH_UI_LOCAL_PARENT,
            ("for-each-ref", "--format=%(objectname)", "refs/remotes/development/candidates/c21-wsl-exact107"): checker.C21_WORKBENCH_UI_LOCAL_CANDIDATE,
        }
        with mock.patch.object(checker, "_git_value", side_effect=lambda _root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", return_value=0):
            self.assertEqual(["GIT_VALIDATED_BASE_NOT_ANCESTOR"], checker._collect_c21_workbench_ui_local_result_git(bundle))

    def test_seq578_builder_preserves_seq575_and_closes_leases(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_local_result_artifacts"))
        artifacts = checker.c21_workbench_ui_local_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_E])["events"]
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_LOCAL_PRODUCT_COMMIT}:{checker.C21_WORKBENCH_UI_LOCAL_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 575), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_LOCAL_E], 575))
        self.assertEqual([576, 577, 578], [row["sequence"] for row in events[-3:]])
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events[-3:]])
        self.assertEqual("COMPLETED_LOCAL_PENDING_TOOLING_RECONCILIATION", progress["status"])
        self.assertEqual("REVOKED", progress["worker_lease"]["status"])
        self.assertEqual("REVOKED", progress["write_lease"]["status"])
        self.assertEqual("BLOCKED_PENDING_TOOLING_RECONCILIATION", progress["workbench_ui_local"]["independent_tester_status"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("NOT_EXECUTED", manifest["external_execution"])

    def test_seq578_metadata_and_manifest_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_local_result_metadata()
        self.assertEqual(10, metadata["result_exact_path_count"])
        self.assertEqual("8177130298C0103FF92935009FFC230F1AC1FC5A9F7651D3AEB40D16E67A8D80", metadata["result_exact_path_list_sha256"])
        self.assertEqual(173, metadata["cumulative_result_path_count"])
        self.assertEqual("708CE3F98FFAC1139D6A5F0CD5BCA96DCE0859B9DE6C3A7248906961BB428B9C", metadata["cumulative_result_path_list_sha256"])
        artifacts = checker.c21_workbench_ui_local_result_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_LOCAL_RESULT_M])
        self.assertEqual([], checker.validate_c21_workbench_ui_local_result_manifest(manifest))
        for key, value in (("accepted", True), ("external_execution", "PASS"), ("product_commit", "0" * 40)):
            changed = copy.deepcopy(manifest); changed[key] = value
            self.assertTrue(checker.validate_c21_workbench_ui_local_result_manifest(changed), key)


class C21WorkbenchUiHistoricalFixtureReconciliationTests(unittest.TestCase):
    def test_seq584_builder_preserves_seq578_and_records_main_takeover(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_historical_fixture_reconciliation_from_root"))
        artifacts = checker.c21_workbench_ui_historical_fixture_reconciliation_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_HISTORICAL_E])["events"]
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_HISTORICAL_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_HISTORICAL_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_WORKBENCH_UI_HISTORICAL_PARENT}:{checker.C21_WORKBENCH_UI_HISTORICAL_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 578),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_HISTORICAL_E], 578),
        )
        self.assertEqual(list(range(579, 585)), [row["sequence"] for row in events[-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events[-6:]],
        )
        self.assertEqual("READY_FOR_INDEPENDENT_REVIEW", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertEqual("REVOKED", progress["worker_lease"]["status"])
        self.assertEqual("REVOKED", progress["write_lease"]["status"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("NOT_EXECUTED", manifest["external_execution"])
        self.assertEqual([], checker.validate_c21_workbench_ui_historical_fixture_reconciliation_manifest(manifest))

    def test_seq584_metadata_and_manifest_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_historical_fixture_reconciliation_metadata()
        self.assertEqual(16, metadata["exact_path_count"])
        self.assertEqual("4B6FB5B5AEFD4A7CF943A191437A3A31F8EEADED1C96A47A6B8934AAFAB3F4F0", metadata["exact_path_list_sha256"])
        self.assertEqual("E6A1C5BB1C6004DFA22E3342FC41A5C4B455A86EA7A3866549258E5056A95C90", metadata["exact_path_list_ordinal_sha256"])
        self.assertEqual(183, metadata["cumulative_path_count"])
        self.assertEqual("BCCCA49E2B920D3A4FD4C557792F63204E20708E4897812CB4457DEB5ED7DC3B", metadata["cumulative_path_list_sha256"])
        self.assertEqual("DFA407A31DBDAD6424B9664ACBFB1F77999D5D746604A20327CFE0E0EA85D91B", metadata["cumulative_path_list_ordinal_sha256"])
        artifacts = checker.c21_workbench_ui_historical_fixture_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_HISTORICAL_M])
        for key, value in (("accepted", True), ("external_execution", "PASS"), ("event_sequence", 584.0)):
            changed = copy.deepcopy(manifest); changed[key] = value
            self.assertTrue(checker.validate_c21_workbench_ui_historical_fixture_reconciliation_manifest(changed), key)


class C21WorkbenchUiWslGitOnlyCandidateStartTests(unittest.TestCase):
    def test_seq587_start_builder_preserves_seq584_and_binds_exact10(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_candidate_start_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_candidate_start_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_START_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_START_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_START_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_SOURCE}:{checker.C21_WORKBENCH_UI_WSL_START_E}"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 584),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_START_E], 584),
        )
        self.assertEqual([585, 586, 587], [row["sequence"] for row in events["events"][-3:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"], [row["event_type"] for row in events["events"][-3:]])
        self.assertEqual("ACTIVE_WORKBENCH_UI_WSL_GIT_ONLY_CANDIDATE", progress["status"])
        self.assertEqual("ACTIVE", progress["worker_lease"]["status"])
        self.assertEqual("ACTIVE", progress["write_lease"]["status"])
        self.assertEqual("ABSENT", manifest["private_git_authority"]["observed_new_candidate"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("NOT_EXECUTED", manifest["provider"])
        self.assertEqual("NOT_EXECUTED", manifest["telegram"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_candidate_start_manifest(manifest))

    def test_seq587_metadata_and_manifest_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_candidate_metadata()
        self.assertEqual((10, "6E8FF216E3984D238E6229C489B97B8CBD3E45E7591D4378ED9EA5C4AFE8DFD5", "E6B5378AA75AE61785AAAF6E5C07695663EA4F3970010750D9DD4D5EA3492275"),
                         (metadata["start_exact_path_count"], metadata["start_exact_path_list_sha256"], metadata["start_exact_path_list_ordinal_sha256"]))
        self.assertEqual((187, "287B8617A64EC0A33E3F97E20A03E7CB69B66A9C8A1DBCC777E3A16D2F7F3D88", "1A35F7995A3AE539395E0EC515B240C276433F5AD7F736C28BE0F63182EDC889"),
                         (metadata["post_start_cumulative_path_count"], metadata["post_start_cumulative_path_list_sha256"], metadata["post_start_cumulative_path_list_ordinal_sha256"]))
        manifest = json.loads(checker.c21_workbench_ui_wsl_candidate_start_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_START_M])
        for key, value in (("accepted", True), ("c21_status", "ACCEPTED"), ("c01_status", "READY"), ("dir2_status", "TRIGGERED"), ("provider", "PASS"), ("telegram", "PASS")):
            changed = copy.deepcopy(manifest); changed[key] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_candidate_start_manifest(changed), key)


class C21WorkbenchUiWslGitOnlyCandidateBoundTests(unittest.TestCase):
    def test_seq590_bound_builder_preserves_seq587_and_closes_leases(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_candidate_bound_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_candidate_bound_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_BOUND_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_BOUND_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_BOUND_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_S_COMMIT}:{checker.C21_WORKBENCH_UI_WSL_BOUND_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical,587), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_BOUND_E],587))
        self.assertEqual([588,589,590], [row["sequence"] for row in events["events"][-3:]])
        self.assertEqual(["WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-3:]])
        self.assertEqual("GIT_ONLY_CANDIDATE_BOUND_PENDING_PRIVATE_ATOMIC_CAS", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertEqual("REVOKED", progress["worker_lease"]["status"])
        self.assertEqual("REVOKED", progress["write_lease"]["status"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_candidate_bound_manifest(manifest))

    def test_seq590_metadata_and_boundary_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_candidate_metadata()
        self.assertEqual((12,"D85669CA2C20EA8481C165F736FD28F017E7291BAFBB3916684A9DF5975EF714","4A8A0CED250CE4E9010589C68416BC4C25346F6D2DA46F44034CE92336C6D901"), (metadata["bound_exact_path_count"],metadata["bound_exact_path_list_sha256"],metadata["bound_exact_path_list_ordinal_sha256"]))
        self.assertEqual((189,"8A54D4594B30E4CACFD8AB8C54C187CB528735E39305E1503737932023BD786F","13D263C508363A6D24622CC015545B965D96F67025EA75B1F1C9C43C5EDBF31A"), (metadata["post_bound_cumulative_path_count"],metadata["post_bound_cumulative_path_list_sha256"],metadata["post_bound_cumulative_path_list_ordinal_sha256"]))
        manifest=json.loads(checker.c21_workbench_ui_wsl_candidate_bound_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_BOUND_M])
        for key,value in (("accepted",True),("c21_status","ACCEPTED"),("c01_status","READY"),("dir2_status","TRIGGERED"),("provider","PASS"),("telegram","PASS")):
            changed=copy.deepcopy(manifest); changed[key]=value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_candidate_bound_manifest(changed),key)


class C21WorkbenchUiWslRuntimeResultTests(unittest.TestCase):
    def test_seq596_runtime_result_is_append_only_and_ready_for_independent_acceptance(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_workbench_ui_wsl_runtime_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_RUNTIME_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_RUNTIME_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_RUNTIME_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_RUNTIME_PARENT}:{checker.C21_WORKBENCH_UI_WSL_RUNTIME_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 590),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_RUNTIME_E], 590),
        )
        self.assertEqual(list(range(591, 597)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["c21_status"])
        self.assertEqual("BLOCKED_PENDING_C21_ACCEPTANCE", manifest["c01_status"])
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_runtime_result_manifest(manifest))

    def test_seq596_runtime_result_binds_exact_paths_runtime_receipts_and_exclusions(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_runtime_result_metadata()
        self.assertEqual(
            (12, "D1965266EBE7DDC3D4D6B0D01A2E71EA276DDFF378B0793E5895E2FB8F07F348", "B345B0586EC4A8937238324EAC5F6FC9046C848F9B171B5E6CB6B83DDA9A6346"),
            (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]),
        )
        self.assertEqual(
            (195, "5F63907A3D63D0350B68EC277B9703EB6AB9D0631E583427BADC2D53A1A13F00", "CAD44AA61C8F359D0AD5FE19DABD70C4F7BE2106FC9EC4C59BD3E2EBFF89C516"),
            (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]),
        )
        manifest = json.loads(checker.c21_workbench_ui_wsl_runtime_result_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_RUNTIME_M])
        self.assertEqual(6, len(manifest["runtime_result"]["receipts"]))
        self.assertEqual("BYTE_IDENTICAL", manifest["runtime_result"]["environment_file"]["result"])
        self.assertEqual(3, manifest["runtime_result"]["timeout_lineage"]["valid_observation_count"])
        self.assertTrue(manifest["runtime_result"]["timeout_lineage"]["main_takeover"])
        self.assertEqual({"provider":"NOT_EXECUTED","telegram":"NOT_EXECUTED","ysna":"NOT_EXECUTED","main_merge":"NOT_EXECUTED","c01":"NOT_EXECUTED"}, manifest["exclusions"])
        for path, value in (
            (("accepted",), True),
            (("runtime_result", "cleanup", "residual_volumes"), 1),
            (("runtime_result", "environment_file", "sha256_after"), "0" * 64),
            (("runtime_result", "receipts", 0, "sha256"), "0" * 64),
            (("exclusions", "provider"), "PASS"),
        ):
            changed = copy.deepcopy(manifest)
            target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_runtime_result_manifest(changed), path)


class C21A13HistoricalModuleIsolationTests(unittest.TestCase):
    def test_seq602_builder_preserves_seq596_and_records_isolation_lifecycle(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_a13_historical_module_isolation_from_root"))
        artifacts = checker.c21_a13_historical_module_isolation_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_E])
        progress = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_P])
        manifest = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_A13_MODULE_ISOLATION_PARENT}:{checker.C21_A13_MODULE_ISOLATION_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 596),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_A13_MODULE_ISOLATION_E], 596),
        )
        self.assertEqual(list(range(597, 603)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE", progress["status"])
        self.assertEqual("INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE", progress["runtime_next_action"])
        self.assertIsNone(progress["active_agent"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["c21_status"])
        self.assertEqual("BLOCKED_PENDING_C21_ACCEPTANCE", manifest["c01_status"])
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])
        self.assertEqual([], checker.validate_c21_a13_historical_module_isolation_manifest(manifest))

    def test_seq602_manifest_binds_exact13_cumulative201_and_isolation_proof(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_a13_historical_module_isolation_metadata()
        self.assertEqual(
            (13, "3363F8F3DB4BE55C2D4CC12FCDD60D8EDEEDA46C7385CE87A92FAD6B72FF820A", "7EBDAF635BD89CFBFB9B183003613CE433A9929405AF74005DDDF85A5CB0DF42"),
            (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]),
        )
        self.assertEqual(
            (201, "DF0884A6F6AA73738488487E4A8C5181A6022FA4443DDCF1E28B69FA6EA3882D", "FF0B9643404E4EA080313E43AD52BC3D356A82710415162B437C2914FFBA8312"),
            (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]),
        )
        manifest = json.loads(checker.c21_a13_historical_module_isolation_from_root(ROOT)[checker.C21_A13_MODULE_ISOLATION_M])
        proof = manifest["isolation_result"]
        self.assertEqual("TEST_HARNESS_ONLY", proof["scope"])
        self.assertEqual(0, proof["product_code_mutation_count"])
        self.assertEqual("PASS", proof["two_node_order"])
        self.assertEqual("PASS", proof["success_restore"])
        self.assertEqual("PASS", proof["exception_restore"])
        self.assertEqual("65_PASSED", proof["a13_suite"])
        self.assertEqual("597_PASSED", proof["full_tooling"])
        self.assertEqual([], checker.validate_c21_a13_historical_module_isolation_manifest(manifest))
        for path, value in (
            (("accepted",), True),
            (("isolation_result", "product_code_mutation_count"), 1),
            (("isolation_result", "exception_restore"), "FAIL"),
            (("cumulative_path_count",), 200),
        ):
            changed = copy.deepcopy(manifest)
            target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_a13_historical_module_isolation_manifest(changed), path)


class C21A13HistoricalModuleIsolationCasPublicationTests(unittest.TestCase):
    def test_seq608_builder_preserves_seq602_and_records_cas_publication(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_a13_historical_module_isolation_cas_publication_from_root"))
        artifacts = checker.c21_a13_historical_module_isolation_cas_publication_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_E])
        progress = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_P])
        manifest = json.loads(artifacts[checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_PARENT}:{checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 602),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_E], 602),
        )
        self.assertEqual(list(range(603, 609)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("READY_FOR_INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE", progress["status"])
        self.assertEqual("INDEPENDENT_C21_WORKBENCH_UI_WSL_ACCEPTANCE", progress["runtime_next_action"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_a13_historical_module_isolation_cas_publication_manifest(manifest))

    def test_seq608_manifest_binds_exact12_cumulative207_and_cas_result(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_a13_historical_module_isolation_cas_publication_metadata()
        self.assertEqual(
            (12, "87DA6006EDA1CE51293EC2EA964519C16ED637E5BAC48283A0F62F12FD79D916", "F6DA948CBFF8E9FCEFA9415DF292AA20110C2BD1BD990A06AEC794CFA5A6233C"),
            (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]),
        )
        self.assertEqual(
            (207, "9CC4B0493469FD990C651BB73A70217F7F17E8EC5F87F43C21ACE0C230EEC5EE", "93F2AAEBF7E5637ED59EFB848F20A58C6E2ED170D7D29E9A76C6BAF1B33F5D87"),
            (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]),
        )
        manifest = json.loads(checker.c21_a13_historical_module_isolation_cas_publication_from_root(ROOT)[checker.C21_A13_MODULE_ISOLATION_CAS_PUBLICATION_M])
        publication = manifest["publication_result"]
        self.assertEqual("PASS", publication["result"])
        self.assertEqual("8fe7b975f39990b3d721d27b1a3e9353f891c5c1", publication["previous_control"])
        self.assertEqual("6134e4140d2017536563babc907c631853509ae5", publication["published_control"])
        self.assertEqual("f0d4bc7badbdae69c2d2b21089667fdcc636518d", publication["candidate"])
        self.assertEqual("git@github-sinsan-develop:sinsan-develop/Anvil.git", publication["remote_url"])
        self.assertEqual("MAIN_AGENT_DIRECT_TOOL_RECEIPT", publication["evidence_source"])
        self.assertEqual(0, publication["preflight_exit_code"])
        self.assertEqual(0, publication["cas_exit_code"])
        self.assertEqual(0, publication["postflight_exit_code"])
        self.assertIn("--force-with-lease=refs/heads/codex/c21-operational-execution:8fe7b975", publication["cas_command"])
        for path, value in (
            (("accepted",), True),
            (("publication_result", "result"), "FAIL"),
            (("publication_result", "previous_control"), "0" * 40),
            (("publication_result", "published_control"), "0" * 40),
            (("publication_result", "candidate"), "0" * 40),
            (("publication_result", "remote_url"), "https://github.com/cyhuh7950/anvil.git"),
            (("publication_result", "evidence_source"), "SUBAGENT_INFERENCE"),
            (("publication_result", "cas_exit_code"), 1),
        ):
            changed = copy.deepcopy(manifest)
            target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_a13_historical_module_isolation_cas_publication_manifest(changed), path)


class C21WorkbenchUiWslAuthBrowserProbeTests(unittest.TestCase):
    def test_seq614_builder_preserves_seq608_and_records_probe_contract(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_auth_browser_probe_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_probe_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_PARENT}:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 608),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_E], 608),
        )
        self.assertEqual(list(range(609, 615)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("READY_FOR_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION", progress["status"])
        self.assertEqual("EXECUTE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE", progress["runtime_next_action"])
        self.assertIsNone(progress["active_agent"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_execution"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_probe_manifest(manifest))

    def test_seq614_manifest_binds_exact13_cumulative213_and_secret_safe_probe_contract(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_probe_metadata()
        self.assertEqual(
            (13, "CC635465B7F0E79B3AAE5C88FFC23CAE180F28FAED00B440D200772083AA6AC6", "269419A426966B48E97F87147F2B65365D3F16B42D5D1EA6E525B95AF55F5D22"),
            (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]),
        )
        self.assertEqual(
            (213, "2878046572BD6386121F5D35C0390766468492A1E9BC6F40219F5ADBD6376D2E", "726D55C3AE83A2791A86CB79C4BBB7419FC502E992A3FDD159A955BAB432F068"),
            (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]),
        )
        manifest = json.loads(checker.c21_workbench_ui_wsl_auth_browser_probe_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_PROBE_M])
        contract = manifest["probe_contract"]
        self.assertEqual("ENVIRONMENT_ONLY", contract["credential_input"])
        self.assertEqual([[1920,1080], [1440,900], [430,844]], contract["viewports"])
        self.assertEqual("ONE_CANONICAL_JSON_RECEIPT", contract["output"])
        self.assertEqual("FAIL_CLOSED_NONZERO", contract["acceptance_failure"])
        self.assertEqual("SCHEMA_ONLY_PASS", contract["self_test"])
        self.assertEqual("MEMORY_ONLY", contract["screenshot"]["storage"])
        self.assertEqual(0, contract["screenshot"]["files_created"])
        self.assertEqual(0, contract["screenshot"]["directories_created"])
        self.assertEqual(0, contract["screenshot"]["residue_count"])
        self.assertEqual("FAIL_CLOSED_IF_SUPPLIED", contract["screenshot"]["root_input"])
        self.assertEqual("EXACT_INITIAL_EVENT_ID", contract["last_event_id"])
        self.assertEqual(["MISSING_REJECTED", "STALE_REJECTED", "WRONG_REJECTED"], contract["last_event_id_negative_cases"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_execution"])
        for path, value in (
            (("accepted",), True),
            (("runtime_execution",), "PASS"),
            (("probe_contract", "credential_input"), "CLI_ALLOWED"),
            (("probe_contract", "viewports"), [[1920,1080]]),
            (("probe_contract", "provider_write_count"), 1),
            (("probe_contract", "secret_safety", "cookie_occurrences"), 1),
            (("probe_contract", "screenshot", "storage"), "FILESYSTEM"),
            (("probe_contract", "last_event_id"), "PRESENT_ONLY"),
        ):
            changed = copy.deepcopy(manifest)
            target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_probe_manifest(changed), path)

    def test_wsl_workbench_auth_probe_self_test_receipt_schema_and_secret_safety(self):
        result = subprocess.run(
            ["node", "tests/browser/c21-network-probe.mjs", "--wsl-workbench-auth-self-test"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        self.assertEqual(1, len(lines))
        receipt = json.loads(lines[0])
        self.assertEqual(json.dumps(receipt, ensure_ascii=False, sort_keys=True, separators=(",", ":")), lines[0])
        self.assertEqual("SCHEMA_ONLY_PASS", receipt["result"])
        self.assertEqual("ENVIRONMENT_ONLY", receipt["credentialInput"])
        self.assertEqual([[1920,1080], [1440,900], [430,844]], [[row["width"], row["height"]] for row in receipt["viewports"]])
        self.assertTrue(all(set(row["screenshot"]) == {"relativeName", "bytes", "sha256"} for row in receipt["viewports"]))
        self.assertTrue(all(len(row["screenshot"]["sha256"]) == 64 for row in receipt["viewports"]))
        self.assertEqual({"directoriesCreated":0,"filesCreated":0,"residueCount":0,"storage":"MEMORY_ONLY"}, receipt["filesystemMutation"])
        self.assertEqual({"rootInput":"FAIL_CLOSED_IF_SUPPLIED","storage":"MEMORY_ONLY"}, receipt["screenshotPolicy"])
        self.assertEqual({"sentinelOccurrences":0,"authorizationHeaderOccurrences":0,"cookieOccurrences":0,"rawUrlOccurrences":0}, receipt["secretSafety"])
        rendered = json.dumps(receipt, sort_keys=True).lower()
        self.assertNotIn("bootstrap-token", rendered)
        self.assertNotIn("set-cookie", rendered)
        self.assertNotIn('"authorization":', rendered)

    def test_seq620_builder_preserves_seq614_and_records_failed_runtime_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_auth_browser_runtime_result_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_M])
        historical = subprocess.check_output(
            ["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_PARENT}:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_E}"],
            cwd=ROOT,
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 614),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_E], 614),
        )
        self.assertEqual(list(range(615, 621)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION", progress["status"])
        self.assertEqual("REVISE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_CONTROL_REF", progress["runtime_next_action"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_result_manifest(manifest))

    def test_seq620_manifest_binds_exact12_cumulative219_and_failure_cleanup(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_result_metadata()
        self.assertEqual(
            (12, "4184910AC22ECDDB800E560858463AD688BC9FA2C18A0FDB1415BAA87854E6D8", "166D23CED09DECD448F5CCAB44F1022F71516BD40914BB7A7F84CAE66A166262"),
            (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]),
        )
        self.assertEqual(
            (219, "52936B5F9C6861EE6FAE270F747A6318502747539E8E66B285DA2811612D4E6D", "7478D25196E94EB84E45BCE779E685937DB29E5736C8F482A7CD52D6040C40E2"),
            (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]),
        )
        manifest = json.loads(checker.c21_workbench_ui_wsl_auth_browser_runtime_result_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RESULT_M])
        result = manifest["runtime_result"]
        self.assertEqual("PASS", result["preflight"]["result"])
        self.assertEqual("FAIL", result["deploy"]["result"])
        self.assertEqual("CONTROL_REF_MISBOUND", result["deploy"]["failure_fingerprint"])
        self.assertEqual(1, result["deploy"]["attempt_count"])
        self.assertEqual("NOT_EXECUTED", result["verify"])
        self.assertEqual("NOT_EXECUTED", result["browser_pg15"])
        self.assertEqual("NOT_EXECUTED", result["browser_pg18rc"])
        self.assertEqual({"attempt_count": 1, "exit_code": 0, "result": "PASS"}, result["cleanup"])
        self.assertEqual("BYTE_IDENTICAL", result["postconditions"]["environment"])
        self.assertEqual(0, result["postconditions"]["container_residue_count"])
        self.assertEqual(0, result["postconditions"]["network_residue_count"])
        self.assertEqual(0, result["postconditions"]["volume_residue_count"])
        for path, value in (
            (("accepted",), True),
            (("runtime_result", "deploy", "result"), "PASS"),
            (("runtime_result", "deploy", "attempt_count"), 2),
            (("runtime_result", "cleanup", "attempt_count"), 2),
            (("runtime_result", "postconditions", "container_residue_count"), 1),
        ):
            changed = copy.deepcopy(manifest)
            target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_result_manifest(changed), path)

    def test_wsl_workbench_auth_probe_rejects_cli_credentials_and_missing_env_with_one_safe_receipt(self):
        cases = (
            (["--wsl-workbench-auth", "--bootstrap-token", "forbidden-secret-sentinel"], "INPUT_REJECTED"),
            (["--wsl-workbench-auth"], "ENVIRONMENT_ERROR"),
        )
        clean_env = {
            key: value for key, value in os.environ.items()
            if key not in {
                "ANVIL_WSL_WORKBENCH_BASE_URL",
                "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN",
                "ANVIL_TEST_SESSION_RUN_ID",
                "ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR",
                "ANVIL_SCREENSHOT_ROOT",
            }
        }
        for arguments, expected in cases:
            result = subprocess.run(
                ["node", "tests/browser/c21-network-probe.mjs", *arguments],
                cwd=ROOT,
                env=clean_env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(0, result.returncode)
            lines = [line for line in result.stdout.splitlines() if line.strip()]
            self.assertEqual(1, len(lines), result.stderr)
            receipt = json.loads(lines[0])
            self.assertEqual(expected, receipt["result"])
            self.assertEqual("ENVIRONMENT_ONLY", receipt["credentialInput"])
            self.assertNotIn("forbidden-secret-sentinel", result.stdout)
            self.assertNotIn("forbidden-secret-sentinel", result.stderr)

    def test_wsl_workbench_auth_probe_rejects_any_screenshot_root_input(self):
        for variable in ("ANVIL_SCREENSHOT_ROOT", "ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR"):
            environment = dict(os.environ)
            environment.update({
                "ANVIL_WSL_WORKBENCH_BASE_URL": "http://127.0.0.1:4770/",
                "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "not-printed",
                "ANVIL_TEST_SESSION_RUN_ID": "run-safe",
                variable: "D:/tmp/forbidden-screenshot-root",
            })
            result = subprocess.run(
                ["node", "tests/browser/c21-network-probe.mjs", "--wsl-workbench-auth"],
                cwd=ROOT, env=environment, text=True, capture_output=True, check=False,
            )
            self.assertEqual(2, result.returncode)
            receipt = json.loads(result.stdout)
            self.assertEqual("ENVIRONMENT_ERROR", receipt["result"])
            self.assertEqual("FAIL_CLOSED_IF_SUPPLIED", receipt["screenshotPolicy"]["rootInput"])
            self.assertNotIn("not-printed", result.stdout + result.stderr)

    def test_wsl_workbench_auth_probe_failure_is_memory_only_canonical_and_mutates_no_filesystem(self):
        before = sorted(Path("D:/tmp").glob("anvil-c21-auth-browser-probe-*"))
        environment = dict(os.environ)
        environment.update({
            "ANVIL_WSL_WORKBENCH_BASE_URL": "http://127.0.0.1:4770/",
            "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "not-printed",
            "ANVIL_TEST_SESSION_RUN_ID": "run-safe",
            "ANVIL_PLAYWRIGHT_MODULE": str(ROOT / "missing-playwright-for-cleanup-test"),
        })
        environment.pop("ANVIL_SCREENSHOT_ROOT", None)
        environment.pop("ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR", None)
        result = subprocess.run(
            ["node", "tests/browser/c21-network-probe.mjs", "--wsl-workbench-auth"],
            cwd=ROOT, env=environment, text=True, capture_output=True, check=False,
        )
        self.assertEqual(1, result.returncode, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual("PROBE_ERROR", receipt["result"])
        self.assertEqual(json.dumps(receipt, ensure_ascii=False, sort_keys=True, separators=(",", ":")), result.stdout.strip())
        self.assertEqual({"directoriesCreated":0,"filesCreated":0,"residueCount":0,"storage":"MEMORY_ONLY"}, receipt["filesystemMutation"])
        self.assertEqual(before, sorted(Path("D:/tmp").glob("anvil-c21-auth-browser-probe-*")))

    def test_wsl_workbench_auth_probe_self_test_memory_only_and_rejects_bad_resume_cursor(self):
        result = subprocess.run(
            ["node", "tests/browser/c21-network-probe.mjs", "--wsl-workbench-auth-self-test"],
            cwd=ROOT, text=True, capture_output=True, check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual({
            "missingRejected": True,
            "staleRejected": True,
            "wrongRejected": True,
        }, receipt["lastEventIdNegativeCases"])
        self.assertEqual({"rootInput":"FAIL_CLOSED_IF_SUPPLIED","storage":"MEMORY_ONLY"}, receipt["screenshotPolicy"])
        self.assertEqual({"directoriesCreated":0,"filesCreated":0,"residueCount":0,"storage":"MEMORY_ONLY"}, receipt["filesystemMutation"])


class C21WorkbenchUiWslAuthBrowserRuntimeRetryResultTests(unittest.TestCase):
    def test_seq626_builder_preserves_seq620_and_records_attempt2_failure(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_auth_browser_runtime_retry_result_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_PARENT}:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 620), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_E], 620))
        self.assertEqual(list(range(621, 627)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual(progress["repository"]["remote_head"], events["events"][-1]["details"]["completion_upstream_head"])
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_2", progress["status"])
        self.assertEqual("ANALYZE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_2", progress["runtime_next_action"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_result_manifest(manifest))

    def test_seq626_manifest_binds_exact12_cumulative225_and_cleanup_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_result_metadata()
        self.assertEqual((12, "849B550F3AE689CC0CA636497418956ABFBFB1107748AAA6393EFA5EC044743A", "9C7E0AADC5448C221A0F6FCA08FFB288F916DD3C018808B1E43F7518DABC0FE8"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((225, "0C4A577FC62585963C7C72ED6C5F4955D520A98B9AC92249CAA2F376B4C71E8A", "F2200D3F4FD6B824DA6823BF6D97DDFD40F8386F578C220E2BE2ED221CBDF7A2"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))
        manifest = json.loads(checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_result_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_RESULT_M])
        result = manifest["runtime_result"]
        self.assertEqual(2, result["attempt_number"])
        self.assertEqual("PASS", result["preflight"]["result"])
        self.assertEqual("FAIL", result["deploy"]["result"])
        self.assertEqual("APPLICATION_ORIGIN_ALIAS_UNRESOLVED_UNDER_ROOT", result["deploy"]["failure_fingerprint"])
        self.assertEqual(128, result["deploy"]["exit_code"])
        self.assertEqual("NOT_EXECUTED", result["verify"])
        self.assertEqual("NOT_EXECUTED", result["browser_pg15"])
        self.assertEqual("NOT_EXECUTED", result["browser_pg18rc"])
        self.assertEqual({"attempt_count": 1, "exit_code": 0, "result": "PASS"}, result["cleanup"])
        self.assertEqual("BYTE_IDENTICAL", result["postconditions"]["environment"])
        self.assertEqual(0, result["postconditions"]["total_residue_count"])
        for path, value in ((("accepted",), True), (("runtime_result", "attempt_number"), 3), (("runtime_result", "deploy", "result"), "PASS"), (("runtime_result", "cleanup", "attempt_count"), 2), (("runtime_result", "postconditions", "total_residue_count"), 1)):
            changed = copy.deepcopy(manifest); target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_result_manifest(changed), path)


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR3ResultTests(unittest.TestCase):
    def test_seq632_builder_preserves_seq626_and_records_attempt3_result(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_PARENT}:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 626), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_E], 626))
        self.assertEqual(list(range(627, 633)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_3", progress["status"])
        self.assertEqual("ISSUE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_BASH_INVOCATION_SUCCESSOR", progress["runtime_next_action"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_manifest(manifest))

    def test_seq632_manifest_binds_exact12_cumulative231_and_cleanup_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_metadata()
        self.assertEqual((12, "227E0B11E216170A0A56C7D184EB67A0D51054F9C72D9C19BDA493CEB7784E4B", "3FDD92F6996CA52C33F06522D2DF3FC2BBEEC2338F05AE097BB4A3F2FA773E3E"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((231, "1701B4B854A56B3AA965E9EA15C9270758143AC8FB3BE3F5811A9A11D9E65B15", "4491BC454A30831810DB01E50F6A824D69B22A855A9093C1086ECF554B8EEE6C"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))
        manifest = json.loads(checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R3_RESULT_M])
        result = manifest["runtime_result"]
        self.assertEqual(3, result["attempt_number"])
        self.assertEqual("PASS", result["preflight"]["result"])
        self.assertEqual({"result": "FAIL", "exit_code": 126, "failure_fingerprint": "CONTROL_RUNTIME_DIRECT_EXEC_PERMISSION_DENIED_R3", "failure_location": "CONTROL_RUNTIME_DIRECT_EXEC", "mutation_boundary": "BEFORE_CONTROL_RUNTIME_OR_APPLICATION_DOCKER_MUTATION", "evidence_reexecution": False}, result["deploy"])
        for key in ("verify", "browser_pg15", "browser_pg18rc"):
            self.assertEqual("NOT_EXECUTED", result[key])
        self.assertEqual({"attempt_count": 1, "exit_code": 126, "result": "FAIL", "failure_fingerprint": "CONTROL_RUNTIME_DIRECT_EXEC_PERMISSION_DENIED_R3"}, result["cleanup"])
        self.assertEqual("BYTE_IDENTICAL", result["postconditions"]["environment"])
        self.assertEqual(0, result["postconditions"]["total_residue_count"])
        for path, value in ((('accepted',), True), (('runtime_result', 'attempt_number'), 2), (('runtime_result', 'deploy', 'result'), 'PASS'), (('runtime_result', 'cleanup', 'attempt_count'), 2), (('runtime_result', 'postconditions', 'total_residue_count'), 1)):
            changed = copy.deepcopy(manifest); target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r3_result_manifest(changed), path)


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR4ResultTests(unittest.TestCase):
    def test_seq638_builder_preserves_seq632_and_records_attempt4_result(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_PARENT}:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 632), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_E], 632))
        self.assertEqual(list(range(633, 639)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual(progress["repository"]["remote_head"], events["events"][-1]["details"]["completion_upstream_head"])
        self.assertEqual(4, manifest["runtime_result"]["attempt_number"])
        self.assertEqual("WSL_DEVELOPMENT_VALIDATION", progress["workbench_ui_wsl_auth_browser_runtime_retry_r4_result"]["validation_classification"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["c21_status"])
        self.assertEqual("BLOCKED_PENDING_C21_ACCEPTANCE", manifest["c01_status"])
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_manifest(manifest))

    def test_seq638_metadata_binds_architect_exact12_and_cumulative237(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_metadata()
        self.assertEqual((12, "3FC15E2C39804B528F406C3C8E448AC9285DBC0BF4918FBBC680CC7A081218F1", "55CCC7D5A506AD0A8F96ABE61FFD9199D3E65469781F8F95D17692D26E39742C"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((237, "7882E92AF9AB54F00F9A3A2C77391BD041FB7E4F1D942A6A95A3CAFB42CECE7C", "7B3AF29932CDB37734654F12E970C71AAF1E3FC23035D48888DEDDEBA359245D"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq638_strictly_records_actual_attempt4_failure_without_reexecution(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        manifest = json.loads(checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R4_RESULT_M])
        result = manifest["runtime_result"]
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_VALIDATION_ATTEMPT_4", manifest["status"])
        self.assertEqual("FAILED", manifest["runtime_execution"])
        self.assertEqual({"attempt_count": 1, "result": "FAIL", "exit_code": 1, "failure_fingerprint": "WORKBENCH_CANDIDATE_CONTROL_DIRECT_CHILD_MISMATCH_R4", "failure_location": "CANDIDATE_MANIFEST_GUARD", "evidence_reexecution": False}, result["deploy"])
        for key in ("verify", "browser_pg15", "browser_pg18rc"):
            self.assertEqual("NOT_EXECUTED", result[key])
        self.assertEqual({"attempt_count": 1, "result": "FAIL", "exit_code": 1, "failure_fingerprint": "CONTROL_CLEANUP_HASH_FORMAT_INVALID_R4", "mutation_boundary": "BEFORE_CONTROL_STAGE_OR_DOCKER_MUTATION", "evidence_reexecution": False}, result["cleanup"])
        self.assertEqual(0, result["postconditions"]["total_approved_runtime_residue_count"])
        self.assertEqual(1, result["postconditions"]["active_control_stage_count"])
        self.assertFalse(manifest["accepted"])
        for path, value in ((('accepted',), True), (('runtime_result', 'deploy', 'result'), 'PASS'), (('runtime_result', 'cleanup', 'attempt_count'), 2), (('runtime_result', 'postconditions', 'total_approved_runtime_residue_count'), 1)):
            changed = copy.deepcopy(manifest); target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r4_result_manifest(changed), path)


class C21WorkbenchUiWslImmutableRuntimeControlV2PublicationTests(unittest.TestCase):
    def test_seq644_builder_preserves_seq638_and_records_create_only_publication(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_from_root"))
        artifacts = checker.c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_M])
        historical = subprocess.check_output(["git", "show", f"{checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_PARENT}:{checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 638), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_E], 638))
        self.assertEqual(list(range(639, 645)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual("READY_FOR_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION", progress["status"])
        self.assertEqual("EXECUTE_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_DEVELOPMENT_VALIDATION_R5", progress["runtime_next_action"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_manifest(manifest))

    def test_seq644_metadata_binds_exact12_and_cumulative243(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_metadata()
        self.assertEqual((12, "52BB8F1F3335F352CF407AC69BE5DE78A71E51DB9A9025A1D6D6486ED73EA45C", "78B04CBAD3026CC5E406017B99C5152CA60336855011F2BAF10272C9FE689548"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((243, "1505E6FF2DE7353174C779B8EFC65E2A1B5E8D2DC10C5208F435491BD2C8E5AF", "9746214EEA8491E43644F443AA01399FA7CB88F1C97D6E4BFC87420525E9CF62"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq644_manifest_strictly_binds_sibling_and_actual_cas_receipt(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        manifest = json.loads(checker.c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_M])
        self.assertEqual("f0d4bc7badbdae69c2d2b21089667fdcc636518d", manifest["candidate_commit"])
        self.assertEqual("22ebc0470d4bd9ddef03f763c0197d67c315443e", manifest["record_commit"])
        self.assertEqual("fb311d456fe3cbb2e8439f39017356ddec6cf266", manifest["runtime_control_v2_commit"])
        self.assertEqual("f0d4bc7badbdae69c2d2b21089667fdcc636518d", manifest["runtime_control_v2_parent"])
        self.assertEqual({"exact_path_count": 12, "cumulative_path_count": 189}, manifest["sibling_path_counts"])
        self.assertEqual("3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329", manifest["sibling_raw_sha256"]["manifest"])
        self.assertEqual("94727D9BF06BC6256B97F1FA7BB8C2E1E383F75EA5D2939A804E0A0B6D22AA19", manifest["sibling_raw_sha256"]["guard"])
        receipt = manifest["publication_receipt"]
        self.assertEqual("ABSENT", receipt["pre"]["runtime_control_v2"])
        self.assertEqual(0, receipt["create_only_cas"]["exit_code"])
        self.assertEqual("PASS", receipt["create_only_cas"]["result"])
        self.assertEqual("fb311d456fe3cbb2e8439f39017356ddec6cf266", receipt["post"]["runtime_control_v2"])
        self.assertEqual("f0d4bc7badbdae69c2d2b21089667fdcc636518d", receipt["post"]["candidate"])
        self.assertEqual("22ebc0470d4bd9ddef03f763c0197d67c315443e", receipt["post"]["record"])
        self.assertEqual({"decision": "COMMIT_READY", "critical": 0, "important": 0, "minor": 0}, manifest["reviewer_receipt"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual("BLOCKED_NOT_ACCEPTED", manifest["c21_status"])
        self.assertEqual("BLOCKED_PENDING_C21_ACCEPTANCE", manifest["c01_status"])
        self.assertEqual("NOT_TRIGGERED", manifest["dir2_status"])
        for key in ("provider", "telegram", "wsl_runtime", "ysna", "main_merge", "c01"):
            self.assertEqual("NOT_EXECUTED", manifest["exclusions"][key])

        for path, value in (
            (("runtime_control_v2_parent",), "22ebc0470d4bd9ddef03f763c0197d67c315443e"),
            (("sibling_raw_sha256", "guard"), "0" * 64),
            (("publication_receipt", "pre", "runtime_control_v2"), "fb311d456fe3cbb2e8439f39017356ddec6cf266"),
            (("publication_receipt", "create_only_cas", "exit_code"), 1),
            (("publication_receipt", "post", "candidate"), "0" * 40),
            (("reviewer_receipt", "important"), 1),
            (("accepted",), True),
        ):
            changed = copy.deepcopy(manifest); target = changed
            for key in path[:-1]: target = target[key]
            target[path[-1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_manifest(changed), path)

    def test_seq644_applies_current_environment_directive_without_mutating_workplan(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        manifest = json.loads(checker.c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_from_root(ROOT)[checker.C21_WORKBENCH_UI_WSL_IMMUTABLE_RUNTIME_CONTROL_V2_PUBLICATION_M])
        self.assertEqual("CURRENT_DIRECTIVE_APPLIED_TO_EXECUTION_EVIDENCE", manifest["environment_classification"]["directive_status"])
        self.assertEqual("DEVELOPMENT", manifest["environment_classification"]["local_pc"])
        self.assertEqual("DEVELOPMENT", manifest["environment_classification"]["wsl_server"])
        self.assertEqual("TEST_STAGING_UAT_AFTER_EXPLICIT_APPROVAL", manifest["environment_classification"]["oracle_cloud"])
        self.assertEqual("LEGACY_MACHINE_IDENTIFIER_NOT_STAGE_CLASSIFICATION", manifest["environment_classification"]["WSL_SERVER_TEST_STAGING"])
        self.assertEqual("PENDING_EXPLICIT_GOVERNANCE_CLASSIFICATION_APPROVAL", manifest["workplan_persistent_wording_change"])
        changed = copy.deepcopy(manifest); changed["workplan_persistent_wording_change"] = "APPLIED"
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_immutable_runtime_control_v2_publication_manifest(changed))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR5ResultTests(unittest.TestCase):
    def _preflight(self):
        return {
            "result": "PASS",
            "candidate_commit": "f0d4bc7badbdae69c2d2b21089667fdcc636518d",
            "runtime_control_commit": "fb311d456fe3cbb2e8439f39017356ddec6cf266",
            "manifest_ref": "refs/remotes/origin/candidates/c21-wsl-runtime-control-v2",
            "manifest_sha256": "3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329",
            "control_runtime_sha256": "D0FF497B22851DFC6CB3FA36C761D8BB69DED1CB7A838E81EF55C4A459570097",
            "application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d",
            "application_dirty_count": 0,
            "environment_mode": "600",
            "environment_sha256": "F" * 64,
            "required_names": "PRESENT",
            "provider_read_scope": True,
            "initial_residue_count": 0,
            "secret_values": "OMITTED",
        }

    def _success(self):
        phase = {"attempt_count": 1, "result": "PASS", "exit_code": 0}
        browser = {
            **phase,
            "viewport_count": 3,
            "provider_count": 9,
            "primary_provider": "UPSTAGE",
            "groq_click": "PASS",
            "authenticated_sse": "PASS",
            "last_event_id": "PASS",
            "same_origin": "PASS",
        }
        return {
            "attempt_number": 5,
            "outcome": "SUCCESS",
            "preflight": self._preflight(),
            "deploy": dict(phase),
            "verify": dict(phase),
            "browser_pg15": dict(browser),
            "browser_pg18rc": dict(browser),
            "receipts": {"current_json_count": 4, "backup_count": 2, "verification_count": 2, "rollback_count": 0, "sha256": ["A" * 64, "B" * 64, "C" * 64, "D" * 64]},
            "image_metadata": {"count": 2, "result": "PASS"},
            "cleanup": {**phase, "evidence_reexecution": False},
            "postconditions": {"application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d", "application_dirty_count": 0, "environment": "BYTE_IDENTICAL", "control_stage_dirty_count": 0, "container_residue": 0, "network_residue": 0, "exact_volume_residue": 0, "lock_residue": 0, "screenshot_residue": 0, "total_residue_count": 0, "backup_evidence_preserved": True},
            "external_calls": {"provider": "NOT_EXECUTED", "telegram": "NOT_EXECUTED", "oracle_cloud": "NOT_EXECUTED"},
            "secret_safety": {"token": "MEMORY_ONLY", "credential_values": "OMITTED", "cookie_values": "OMITTED", "header_values": "OMITTED", "raw_urls": "OMITTED"},
        }

    def test_seq650_metadata_binds_architect_exact12_and_cumulative249(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_result_metadata()
        self.assertEqual((12, "AFA5519D9CC8F31C74009752367D4C69669F1F616ACDB92E8F7BD24010D61DFD", "1F17E1C320EA124C5648F32AB896AAD904EFF511F13F5D08F03CA2239074A7AD"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((249, "C4B351233E25AADB75F0534B2F8BE61AC2E4FB1E4B85CD7C05A6592F068A6B67", "4AB6817F0F43D1B1CD02A99F36AD8632647293387C49458239AF88EFC74F47A5"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq650_success_projection_is_strict_and_pending_independent_review(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._success()
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(result))
        for path, value in (
            (("deploy", "attempt_count"), 2),
            (("receipts", "rollback_count"), 1),
            (("browser_pg15", "same_origin"), "FAIL"),
            (("postconditions", "total_residue_count"), 1),
            (("external_calls", "provider"), "EXECUTED"),
            (("secret_safety", "token"), "RECORDED"),
        ):
            changed = copy.deepcopy(result); changed[path[0]][path[1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(changed), path)

    def test_seq650_failure_projection_stops_after_first_failure_and_cleans_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._success()
        result.update({"outcome": "FAILED", "deploy": {"attempt_count": 1, "result": "FAIL", "exit_code": 17, "failure_fingerprint": "TEST_FAILURE", "evidence_reexecution": False}, "verify": "NOT_EXECUTED", "browser_pg15": "NOT_EXECUTED", "browser_pg18rc": "NOT_EXECUTED", "receipts": {"current_json_count": 0, "backup_count": 0, "verification_count": 0, "rollback_count": 0, "sha256": []}, "image_metadata": "NOT_EXECUTED"})
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(result))
        changed = copy.deepcopy(result); changed["verify"] = {"attempt_count": 1, "result": "PASS", "exit_code": 0}
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(changed))

    def test_seq650_actual_pg15_dependency_failure_preserves_verify_receipts_without_pg18_retry(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._success()
        result.update({
            "outcome": "FAILED",
            "browser_pg15": {"attempt_count": 1, "result": "FAIL", "exit_code": 1, "failure_fingerprint": "PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5", "evidence_reexecution": False},
            "browser_pg18rc": "NOT_EXECUTED",
        })
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(result))
        changed = copy.deepcopy(result); changed["browser_pg18rc"] = self._success()["browser_pg18rc"]
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_runtime_result(changed))

    def test_seq650_builder_preserves_seq644_and_records_actual_r5_failure(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R5_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R5_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R5_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"48c34f8ef514e061f1cfa24e6d9f9f5bc0173bf1:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R5_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 644), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R5_RESULT_E], 644))
        self.assertEqual(list(range(645, 651)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R5_WSL_DEVELOPMENT_VALIDATION", progress["status"])
        self.assertEqual("FAILED", manifest["runtime_execution"])
        self.assertEqual("PLAYWRIGHT_MODULE_DEFAULT_PATH_MISSING_R5", manifest["runtime_result"]["browser_pg15"]["failure_fingerprint"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["browser_pg18rc"])
        self.assertEqual(1, manifest["runtime_result"]["cleanup"]["attempt_count"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_result_manifest(manifest))
        changed = copy.deepcopy(manifest); changed["runtime_result"]["browser_pg18rc"] = self._success()["browser_pg18rc"]
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r5_result_manifest(changed))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR6ResultTests(unittest.TestCase):
    def _runtime(self):
        phase = {"attempt_count": 1, "result": "PASS", "exit_code": 0}
        browser = {
            **phase,
            "viewport_count": 3,
            "provider_count": 9,
            "primary_provider": "UPSTAGE",
            "groq_click": "PASS",
            "authenticated_sse": "PASS",
            "last_event_id": "PASS",
            "same_origin": "PASS",
        }
        return {
            "attempt_number": 6,
            "outcome": "SUCCESS",
            "orchestration_failure": "NONE",
            "preflight": {
                "result": "PASS",
                "candidate_commit": "f0d4bc7badbdae69c2d2b21089667fdcc636518d",
                "runtime_control_commit": "fb311d456fe3cbb2e8439f39017356ddec6cf266",
                "manifest_ref": "refs/remotes/origin/candidates/c21-wsl-runtime-control-v2",
                "manifest_sha256": "3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329",
                "control_runtime_sha256": "D0FF497B22851DFC6CB3FA36C761D8BB69DED1CB7A838E81EF55C4A459570097",
                "application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d",
                "application_dirty_count": 0,
                "environment_mode": "600",
                "environment_sha256": "F" * 64,
                "required_names": "PRESENT",
                "provider_read_scope": True,
                "initial_residue_count": 0,
                "playwright_module": "PRESENT_PROCESS_LOCAL",
                "chromium_executable": "PRESENT_PROCESS_LOCAL",
                "environment_file_mutated": False,
                "secret_values": "OMITTED",
            },
            "deploy": dict(phase),
            "verify": dict(phase),
            "browser_pg15": dict(browser),
            "browser_pg18rc": dict(browser),
            "receipts": {"current_json_count": 4, "backup_count": 2, "verification_count": 2, "rollback_count": 0, "sha256": ["A" * 64, "B" * 64, "C" * 64, "D" * 64]},
            "image_metadata": {"count": 2, "result": "PASS"},
            "cleanup": {**phase, "evidence_reexecution": False},
            "postconditions": {"application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d", "application_dirty_count": 0, "environment": "BYTE_IDENTICAL", "control_stage_dirty_count": 0, "container_residue": 0, "network_residue": 0, "exact_volume_residue": 0, "lock_residue": 0, "screenshot_residue": 0, "total_residue_count": 0, "backup_evidence_preserved": True},
            "external_calls": {"provider": "NOT_EXECUTED", "telegram": "NOT_EXECUTED", "oracle_cloud": "NOT_EXECUTED"},
            "secret_safety": {"token": "MEMORY_ONLY", "credential_values": "OMITTED", "cookie_values": "OMITTED", "header_values": "OMITTED", "raw_urls": "OMITTED"},
        }

    def test_seq656_metadata_binds_architect_exact12_and_cumulative255(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_result_metadata()
        self.assertEqual((12, "58CE542C2E5F2946FDFC0D159D4E294AC50D9FFF1012CE86BE151F9724941975", "2FD1D089F870B271B0E97C21F675DAAC4DAD5A1923838E25446EC4B12FFE6DC3"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((255, "880C34EB128C6C44407AF05BC1692D7C0C6C99232EF1B89EA1BD2D9D0D584786", "CEEBA7C44B1AB182186202579F550791FBE9455AE3138DB3B0C66FCBCC5554F6"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq656_success_projection_requires_process_local_browser_runtime_and_cleanup_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._runtime()
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(result))
        for path, value in (
            (("preflight", "playwright_module"), "ABSENT"),
            (("preflight", "environment_file_mutated"), True),
            (("browser_pg18rc", "viewport_count"), 2),
            (("cleanup", "attempt_count"), 2),
            (("external_calls", "provider"), "EXECUTED"),
        ):
            changed = copy.deepcopy(result); changed[path[0]][path[1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(changed), path)

    def test_seq656_failure_projection_stops_after_first_failure_and_still_cleans_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._runtime()
        result.update({"outcome": "FAILED", "browser_pg15": {"attempt_count": 1, "result": "FAIL", "exit_code": 1, "failure_fingerprint": "TEST_FAILURE", "evidence_reexecution": False}, "browser_pg18rc": "NOT_EXECUTED"})
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(result))
        changed = copy.deepcopy(result); changed["browser_pg18rc"] = self._runtime()["browser_pg18rc"]
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(changed))

    def test_seq656_actual_controller_failure_is_not_misreported_as_deploy_failure(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._runtime()
        result.update({
            "outcome": "FAILED",
            "orchestration_failure": {"result": "FAIL", "after_phase": "deploy", "failure_fingerprint": "POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6", "controller_exit_code": 1, "runtime_action_reexecution": False, "product_failure": False},
            "verify": "NOT_EXECUTED",
            "browser_pg15": "NOT_EXECUTED",
            "browser_pg18rc": "NOT_EXECUTED",
            "receipts": {"current_json_count": 2, "backup_count": 2, "verification_count": 0, "rollback_count": 0, "sha256": ["A" * 64, "B" * 64]},
        })
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(result))
        changed = copy.deepcopy(result); changed["deploy"] = {"attempt_count": 1, "result": "FAIL", "exit_code": 1, "failure_fingerprint": "FALSE_DEPLOY_FAILURE", "evidence_reexecution": False}
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_runtime_result(changed))

    def test_seq656_builder_preserves_seq650_and_records_actual_controller_failure(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R6_RESULT_E])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R6_RESULT_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R6_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"4a30f234745677025a572beb2ec8dcad379ac193:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R6_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 650), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R6_RESULT_E], 650))
        self.assertEqual(list(range(651, 657)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R6_WSL_DEVELOPMENT_VALIDATION", progress["status"])
        self.assertEqual("FAILED", manifest["runtime_execution"])
        self.assertEqual("PASS", manifest["runtime_result"]["deploy"]["result"])
        self.assertEqual("POWERSHELL_FUNCTION_STDOUT_EXITCODE_CAPTURE_R6", manifest["runtime_result"]["orchestration_failure"]["failure_fingerprint"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["verify"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["browser_pg15"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["browser_pg18rc"])
        self.assertEqual(1, manifest["runtime_result"]["cleanup"]["attempt_count"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r6_result_manifest(manifest))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR7ResultTests(unittest.TestCase):
    def _runtime(self):
        phase = {"attempt_count": 1, "result": "PASS", "exit_code": 0}
        browser = {**phase, "viewport_count": 3, "provider_count": 9, "primary_provider": "UPSTAGE", "groq_click": "PASS", "authenticated_sse": "PASS", "last_event_id": "PASS", "same_origin": "PASS"}
        return {
            "attempt_number": 7,
            "outcome": "SUCCESS",
            "native_wrapper_self_check": {"result": "PASS", "stdout_lines": 1, "exit_code": 0, "exit_code_type": "INT32", "caller_field": ".ExitCode", "wsl_action": False},
            "preflight": {"result": "PASS", "candidate_commit": "f0d4bc7badbdae69c2d2b21089667fdcc636518d", "runtime_control_commit": "fb311d456fe3cbb2e8439f39017356ddec6cf266", "manifest_ref": "refs/remotes/origin/candidates/c21-wsl-runtime-control-v2", "manifest_sha256": "3D81F783969336ED83F83EAE4855EB881A1AABC14F18F6EF390E22C272B7B329", "control_runtime_sha256": "D0FF497B22851DFC6CB3FA36C761D8BB69DED1CB7A838E81EF55C4A459570097", "application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d", "application_dirty_count": 0, "environment_mode": "600", "environment_sha256": "F" * 64, "required_names": "PRESENT", "provider_read_scope": True, "initial_residue_count": 0, "playwright_module": "PRESENT_PROCESS_LOCAL", "chromium_executable": "PRESENT_PROCESS_LOCAL", "environment_file_mutated": False, "secret_values": "OMITTED"},
            "deploy": dict(phase), "verify": dict(phase), "browser_pg15": dict(browser), "browser_pg18rc": dict(browser),
            "receipts": {"current_json_count": 4, "backup_count": 2, "verification_count": 2, "rollback_count": 0, "sha256": ["A" * 64, "B" * 64, "C" * 64, "D" * 64]},
            "image_metadata": {"count": 2, "result": "PASS"}, "cleanup": {**phase, "evidence_reexecution": False},
            "postconditions": {"application_head": "f0d4bc7badbdae69c2d2b21089667fdcc636518d", "application_dirty_count": 0, "environment": "BYTE_IDENTICAL", "control_stage_dirty_count": 0, "container_residue": 0, "network_residue": 0, "exact_volume_residue": 0, "lock_residue": 0, "screenshot_residue": 0, "total_residue_count": 0, "backup_evidence_preserved": True},
            "external_calls": {"provider": "NOT_EXECUTED", "telegram": "NOT_EXECUTED", "oracle_cloud": "NOT_EXECUTED"},
            "secret_safety": {"token": "MEMORY_ONLY", "credential_values": "OMITTED", "cookie_values": "OMITTED", "header_values": "OMITTED", "raw_urls": "OMITTED"},
        }

    def test_seq662_metadata_binds_exact12_and_cumulative261(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_result_metadata()
        self.assertEqual((12, "335DD6D1A0DAE21EEF33E7ACC095757E5772DFBB158B3961EB74CA5DECF29C67", "1440E42A35D52FCC1924901F8665852ABCE928754003F34964507AE4B2D4AC77"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((261, "A3B103827529073532AF5208A8EB183D72411885F93EF6CCAD808CC084ADC29B", "AAAC92F5DAD74BF24485D35053509B7AACAC8C1A72199692A043D93290DBDEEE"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq662_native_wrapper_requires_separate_integer_exit_code(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._runtime()
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_runtime_result(result))
        for key, value in (("exit_code", ["line", 0]), ("exit_code_type", "ARRAY"), ("caller_field", "$result"), ("wsl_action", True)):
            changed = copy.deepcopy(result); changed["native_wrapper_self_check"][key] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_runtime_result(changed), key)

    def test_seq662_failure_stops_after_first_failure_and_cleans_once(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = self._runtime(); result.update({"outcome": "FAILED", "verify": {"attempt_count": 1, "result": "FAIL", "exit_code": 7, "failure_fingerprint": "TEST_FAILURE", "evidence_reexecution": False}, "browser_pg15": "NOT_EXECUTED", "browser_pg18rc": "NOT_EXECUTED"})
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_runtime_result(result))
        changed = copy.deepcopy(result); changed["browser_pg15"] = self._runtime()["browser_pg15"]
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_runtime_result(changed))

    def test_seq662_builder_preserves_seq656_and_records_runtime_result(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R7_RESULT_E])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R7_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"0e22a1d4e47cdff117b894dd885af816f354a550:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R7_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 656), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R7_RESULT_E], 656))
        self.assertEqual(list(range(657, 663)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(7, manifest["runtime_result"]["attempt_number"])
        self.assertEqual("FAILED_R7_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT", manifest["status"])
        self.assertEqual("PASS", manifest["runtime_result"]["deploy"]["result"])
        self.assertEqual("PASS", manifest["runtime_result"]["verify"]["result"])
        self.assertEqual("BROWSER_ACCEPTANCE_FAILED_R7", manifest["runtime_result"]["browser_pg15"]["failure_fingerprint"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["browser_pg18rc"])
        self.assertEqual(1, manifest["runtime_result"]["cleanup"]["attempt_count"])
        self.assertTrue(manifest["diagnosis"]["r6_stdout_capture_root_resolved"])
        self.assertEqual("BROWSER_RECEIPT_NOT_PERSISTED_R7", manifest["diagnosis"]["diagnostic_fingerprint"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r7_result_manifest(manifest))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR8ResultTests(unittest.TestCase):
    def _observation(self):
        return {
            "attempt_count": 1,
            "result": "PASS",
            "exit_code": 0,
            "stdout_line_count": 1,
            "stderr_line_count": 0,
            "stdout_sha256": "A" * 64,
            "stderr_sha256": "B" * 64,
            "canonical_receipt_sha256": "C" * 64,
            "stderr_category": "NONE",
            "secret_scan_count": 0,
            "false_predicates": [],
            "safe_receipt": {
                "schema_version": "1.0.0",
                "result": "PASS",
                "runtime_execution": "EXECUTED",
                "viewport_count": 3,
                "provider_list_visible": True,
                "provider_detail_visible": True,
                "run_event_action_visible": True,
                "status_alert_visible": True,
                "document_horizontal_overflow_zero": True,
                "keyboard_tab_focus_visible": True,
                "button_accessible_names": True,
                "sse_initial_connected": True,
                "last_event_id_reconnect": True,
                "provider_read_get_only": True,
                "provider_write_count": 0,
                "cross_origin_count": 0,
                "fixture_api_count": 0,
                "last_event_id_exact_match": True,
                "sentinel_occurrences": 0,
                "authorization_header_occurrences": 0,
                "cookie_occurrences": 0,
                "raw_url_occurrences": 0,
                "screenshot_storage": "MEMORY_ONLY",
                "files_created": 0,
                "directories_created": 0,
                "residue_count": 0,
            },
        }

    def test_seq668_metadata_binds_exact12_and_cumulative267(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_result_metadata()
        self.assertEqual((12, "151561FBBD5EAF89FC25E125D0E205B08ADBA99EADECB1E194D4D0DC0AEB3F25", "0373683DBDDB9B07FCFBA084F2F9BC164D7326EC3864FE616CE110B2D8FED172"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((267, "84F562328BC0C0EA7CEB2C9C15CD0728447140C8F67A7A9A5689973E4834374B", "6DE6BB7AB87178149F987475196D8EA30997DF57BE025E5F9453AD67DBCF590B"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq668_browser_observation_requires_strict_secret_safe_pass(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        observation = self._observation()
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_browser_observation(observation))
        for path, value in (
            (("stdout_line_count",), 2),
            (("secret_scan_count",), 1),
            (("false_predicates",), ["receipt.result==PASS"]),
            (("safe_receipt", "screenshot_storage"), "FILESYSTEM"),
            (("safe_receipt", "same_origin_count"), 1),
        ):
            changed = copy.deepcopy(observation)
            if len(path) == 1:
                changed[path[0]] = value
            else:
                changed[path[0]][path[1]] = value
            self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_browser_observation(changed), path)

    def test_seq668_browser_observation_accepts_exact_failure_predicates_without_raw_receipt(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        observation = self._observation()
        observation.update({
            "result": "FAIL",
            "exit_code": 1,
            "stderr_line_count": 1,
            "stderr_category": "REDACTED_NONEMPTY",
            "false_predicates": ["receipt.result==PASS", "viewports.count==3"],
        })
        observation["safe_receipt"].update({"result": "PROBE_ERROR", "viewport_count": 0})
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_browser_observation(observation))
        changed = copy.deepcopy(observation); changed["false_predicates"] = []
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_browser_observation(changed))

    def test_seq668_builder_preserves_seq662_and_records_controller_boundary_failure(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_result_from_root(ROOT)
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R8_RESULT_E])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R8_RESULT_M])
        historical = subprocess.check_output(["git", "show", f"a1b67f4f93d06e1b71f5bd05b9f66e404f10a039:{checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R8_RESULT_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 662), checker.raw_event_object_prefix_bytes(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R8_RESULT_E], 662))
        self.assertEqual(list(range(663, 669)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [row["event_type"] for row in events["events"][-6:]])
        self.assertEqual("FAILED_R8_WSL_DEVELOPMENT_VALIDATION_EVIDENCE_INSUFFICIENT", manifest["status"])
        self.assertEqual("PASS", manifest["runtime_result"]["deploy"]["result"])
        self.assertEqual("PASS", manifest["runtime_result"]["verify"]["result"])
        self.assertEqual("BROWSER_OBSERVATION_CONTROLLER_EXCEPTION_R8", manifest["runtime_result"]["browser_pg15"]["failure_fingerprint"])
        self.assertEqual("NOT_EXECUTED", manifest["runtime_result"]["browser_pg18rc"])
        self.assertEqual(1, manifest["runtime_result"]["cleanup"]["attempt_count"])
        self.assertEqual(0, manifest["runtime_result"]["retry_count"])
        self.assertFalse(manifest["diagnosis"]["product_failure_established"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r8_result_manifest(manifest))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR9ResultTests(unittest.TestCase):
    def _native(self, result="PASS"):
        raw = json.dumps({"result": result, "runtimeExecution": "EXECUTED" if result == "PASS" else "FAILED"}, separators=(",", ":"), sort_keys=True) + "\n"
        return {"stdout": raw, "stderr": "", "exit_code": 0 if result == "PASS" else 1, "process_started": True}

    @staticmethod
    def _safe(receipt):
        return {"result": receipt["result"], "runtime_execution": receipt["runtimeExecution"]}

    def _assert_secret_safe_one_object(self, envelope):
        self.assertIs(type(envelope), dict)
        rendered = json.dumps(envelope, sort_keys=True)
        self.assertNotIn("synthetic-secret-value", rendered)
        self.assertNotIn("stdout", envelope)
        self.assertNotIn("stderr", envelope)
        self.assertTrue(envelope["raw_cleared"])
        self.assertTrue(envelope["secret_cleared"])

    def test_seq674_metadata_binds_exact12_and_cumulative273(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_result_metadata()
        self.assertEqual((12, "C76DF85C02565072777A14B469396E5E56F001BD094051F546A9CF2C6AA3F003", "E52F1859A1643A060D3D680554B111E54D7DDC7F05C543E0EE39B8F2C50036D5"), (metadata["exact_path_count"], metadata["exact_path_list_sha256"], metadata["exact_path_list_ordinal_sha256"]))
        self.assertEqual((273, "BF167099DC8F21AC96258B041C333A9F19DC2426899EB140B48531FFA26A9D45", "797C222A29F7B7D6F729D6DC2C3F06CE55586705AA0C8C01A6E42D9708806338"), (metadata["cumulative_path_count"], metadata["cumulative_path_list_sha256"], metadata["cumulative_path_list_ordinal_sha256"]))

    def test_seq674_synthetic_pass_returns_one_safe_envelope(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_phase_envelope(lambda: self._native(), self._safe, ("synthetic-secret-value",))
        self._assert_secret_safe_one_object(envelope)
        self.assertEqual(("PASS", "COMPLETE", "NONE", "NONE"), (envelope["result"], envelope["observation_state"], envelope["failure_step"], envelope["exception_category"]))
        self.assertEqual((1, 0), (envelope["stdout_line_count"], envelope["stderr_line_count"]))
        self.assertEqual({"result": "PASS", "runtime_execution": "EXECUTED"}, envelope["safe_receipt"])

    def test_seq674_synthetic_probe_error_preserves_metadata_and_safe_receipt(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_phase_envelope(lambda: self._native("PROBE_ERROR"), self._safe, ("synthetic-secret-value",))
        self._assert_secret_safe_one_object(envelope)
        self.assertEqual("FAIL", envelope["result"])
        self.assertEqual("COMPLETE", envelope["observation_state"])
        self.assertEqual(1, envelope["exit_code"])
        self.assertRegex(envelope["stdout_sha256"], r"^[0-9A-F]{64}$")
        self.assertEqual("PROBE_ERROR", envelope["safe_receipt"]["result"])

    def test_seq674_synthetic_malformed_returns_parse_failure_envelope(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        native = {"stdout": "{malformed}\n", "stderr": "", "exit_code": 1, "process_started": True}
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_phase_envelope(lambda: native, self._safe, ("synthetic-secret-value",))
        self._assert_secret_safe_one_object(envelope)
        self.assertEqual(("FAIL", "STRICT_PARSE", "JSON_DECODE_ERROR", "STRICT_JSON_PARSE"), (envelope["result"], envelope["failure_step"], envelope["exception_category"], envelope["failure_statement"]))
        self.assertRegex(envelope["stdout_sha256"], r"^[0-9A-F]{64}$")

    def test_seq674_synthetic_throwing_transformer_returns_exception_envelope(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        def throwing(_receipt):
            raise RuntimeError("synthetic-secret-value")
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_phase_envelope(lambda: self._native(), throwing, ("synthetic-secret-value",))
        self._assert_secret_safe_one_object(envelope)
        self.assertEqual(("FAIL", "SAFE_TRANSFORM", "TRANSFORMER_RUNTIME_ERROR", "SAFE_RECEIPT_TRANSFORM"), (envelope["result"], envelope["failure_step"], envelope["exception_category"], envelope["failure_statement"]))
        self.assertEqual("NOT_AVAILABLE", envelope["safe_receipt"])

    def test_seq674_failure_projection_revokes_leases_and_hands_off_count3(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        generated = {
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_P,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_E,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_H,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_D,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_M,
        }
        historical = {
            path: subprocess.check_output(["git", "show", f"eadba5bad0df3ea4f52e28b847ab20957217b6c5:{path}"], cwd=ROOT)
            for path in (
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_P,
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_E,
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_H,
            )
        }
        files = {
            path: (ROOT / path).read_bytes()
            for path in set(checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_result_paths()) - generated
        }
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_result_artifacts(historical, files)
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_M])
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_E])
        self.assertEqual(list(range(669, 675)), [row["sequence"] for row in events["events"][-6:]])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"],
            [row["event_type"] for row in events["events"][-6:]],
        )
        self.assertEqual("FAILED_R9_CONTROLLER_EVIDENCE_CAPTURE_LINEAGE_COUNT3_TAKEOVER_REQUIRED", manifest["status"])
        self.assertEqual(3, manifest["diagnosis"]["evidence_capture_identical_root_count"])
        self.assertEqual("R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1", manifest["diagnosis"]["failure_fingerprint"])
        self.assertEqual((1, 0, 0, 0, 1), tuple(manifest["runtime_result"][name]["attempt_count"] if isinstance(manifest["runtime_result"][name], dict) else 0 for name in ("deploy", "verify", "browser_pg15", "browser_pg18rc", "cleanup")))
        self.assertEqual("REVOKED", manifest["takeover_packet"]["worker_lease_status"])
        self.assertEqual("REVOKED", manifest["takeover_packet"]["write_lease_status"])
        self.assertEqual("MAIN_AGENT_SEQUENTIAL_TAKEOVER", manifest["takeover_packet"]["next_owner"])
        self.assertFalse(manifest["diagnosis"]["product_failure_established"])
        self.assertFalse(manifest["accepted"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_result_manifest(manifest))


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR9TakeoverCorrectionTests(unittest.TestCase):
    PARENT = "5162d3581ac4c856a6a454ca4284b5191a1238b5"

    def _build(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        generated = {
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_E,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_H,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_D,
            checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_M,
        }
        historical = {
            path: subprocess.check_output(["git", "show", f"{self.PARENT}:{path}"], cwd=ROOT)
            for path in (
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P,
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_E,
                checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_H,
                "docs/04_test_reports/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_REPORT.md",
                "docs/evidence/manifests/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_MANIFEST.json",
                "docs/progress/progress-handoff-detached-digest-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result.json",
                "docs/validation/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_VALIDATION.md",
                "docs/work_orders/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_INVOCATION_PROMPT.md",
                "docs/work_orders/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_WORK_INSTRUCTION.md",
            )
        }
        files = {
            path: (ROOT / path).read_bytes()
            for path in set(checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_takeover_correction_paths()) - generated
        }
        artifacts = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_takeover_correction_artifacts(historical, files)
        return checker, historical, artifacts

    def test_seq680_metadata_binds_exact13_and_cumulative280(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        meta = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_takeover_correction_metadata()
        self.assertEqual((13, "0CF50BDA1B2C5E7D89C4C92DF6821EDFD4FD5488870A145733ABC9E3245CB159", "66B0CB35CDBB0E7630E79E2330F63A073A39DD6199F8D67588C78A8BB8D6AA9D"), (meta["exact_path_count"], meta["exact_path_list_sha256"], meta["exact_path_list_ordinal_sha256"]))
        self.assertEqual((280, "B40528446712F4211D3329093724E387E654BCEDE328395F3D0BF212995AEDFC", "C8EAF5D682D267502B04ABDDF17672C9F6331396DE97C0C87F66036B9633F136"), (meta["cumulative_path_count"], meta["cumulative_path_list_sha256"], meta["cumulative_path_list_ordinal_sha256"]))

    def test_seq680_historical_anchors_and_r9_unique_artifacts_are_exact(self):
        checker, historical, artifacts = self._build()
        events_raw = historical[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_E]
        self.assertEqual((1966883, "45D30AFFCE78BB8F93B58ADAF9B4D4491FEE6F70E2491C67939AA6BD6B400484"), (len(events_raw), hashlib.sha256(events_raw).hexdigest().upper()))
        prefix = checker.raw_event_object_prefix_bytes(events_raw, 674)
        self.assertEqual((1966643, "34FB962606BF12C750DB5761319D4962A7A3B4C938760F70429C11A8C213460C"), (len(prefix), hashlib.sha256(prefix).hexdigest().upper()))
        self.assertEqual("376E17C93B28E1625180A3F53EF4B17C2010B1DD94630E6F728FC8EE4E606314", hashlib.sha256(checker.canonical_json_bytes(json.loads(events_raw)["events"][:674])).hexdigest().upper())
        anchors = {
            "docs/04_test_reports/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_REPORT.md": "51638EC480304B0C634FB0776752B829A8B1B5C47E71C8015003A6CE28F11E02",
            "docs/evidence/manifests/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_MANIFEST.json": "90644BEFA6227D21A73ACC48FC9DE4DBA548CA4C719B46EBFFED49668FDB788A",
            "docs/progress/progress-handoff-detached-digest-c21-workbench-ui-wsl-auth-browser-runtime-retry-r9-result.json": "A4775604772E5C0244E813D57082B724C4EC65551959167DEF7889B674A875D2",
            "docs/validation/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_VALIDATION.md": "C60E21D81E39E278B80A0618E8BEEACF863BA7FC52FCD8A08E3AC96748266A93",
            "docs/work_orders/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_INVOCATION_PROMPT.md": "9B6D4C55CB23B5A254A6CD22596F661426E73F8DF7F5F0AC1E44419DC0C71B93",
            "docs/work_orders/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_WORK_INSTRUCTION.md": "8C1D85F26FFC47254A247D0C02AFAFBCBB336D6BD9FD27A16FCDF14C21774246",
        }
        self.assertEqual(anchors, json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_M])["historical_anchors"]["r9_unique_artifacts"])

    def test_seq680_current_roots_supersede_broad_diagnostic_without_takeover(self):
        checker, historical, artifacts = self._build()
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P])
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_M])
        historical_progress = json.loads(historical[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P])
        self.assertEqual(historical_progress["workbench_ui_wsl_auth_browser_runtime_retry_r9_result"], progress["workbench_ui_wsl_auth_browser_runtime_retry_r9_result"])
        self.assertNotIn("takeover_packet", progress)
        self.assertNotIn("takeover_packet", manifest)
        correction = manifest["correction"]
        self.assertEqual({"R7": {"fingerprint": "BROWSER_ACCEPTANCE_FAILED_R7", "count": 1}, "R8": {"fingerprint": "BROWSER_OBSERVATION_CONTROLLER_EXCEPTION_R8", "count": 1}, "R9": {"fingerprint": "R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1", "count": 1}}, correction["exact_roots"])
        self.assertEqual(("SUPERSEDED_BY_INDEPENDENT_REVIEW", "DIAGNOSTIC_SYMPTOM_ONLY_NOT_ROOT_IDENTITY", False), (correction["broad_grouping_status"], correction["broad_grouping_classification"], correction["policy_change"]))
        self.assertEqual((False, False, "NOT_TRIGGERED"), (correction["main_direct"], correction["developer_runtime_resume"], correction["main_takeover"]))

    def test_seq680_events_approval_status_and_next_are_strict(self):
        checker, _historical, artifacts = self._build()
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_E])["events"][-6:]
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_M])
        self.assertEqual(list(range(675, 681)), [event["sequence"] for event in events])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual(["CORRECTION_RESULT_HANDOFF", "CORRECTION_RESULT_HANDOFF"], [events[3]["details"]["reason"], events[4]["details"]["reason"]])
        self.assertEqual("READY_R9_TAKEOVER_CORRECTION_FOR_INDEPENDENT_REVIEW", manifest["status"])
        self.assertEqual("INDEPENDENT_REVIEW_R9_TAKEOVER_CORRECTION_BEFORE_R10", manifest["next_action"])
        approval = manifest["approval"]
        self.assertEqual(("APPROVAL-20260909-C21-R9-TAKEOVER-CORRECTION-001", "HUMAN_OVERRIDE", "30C93434E546AD91D8D2B1F4F8040A70DDC3FD136E15AFAB793E676DB5B9342D"), (approval["approval_id"], approval["mode"], approval["user_subject_sha256"]))
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r9_takeover_correction_manifest(manifest))

    def test_seq680_existing_seq674_checker_and_test_regions_are_byte_preserved(self):
        current_checker = CHECKER_PATH.read_bytes()
        old_checker = subprocess.check_output(["git", "show", f"{self.PARENT}:scripts/check_project_progress.py"], cwd=ROOT)
        checker_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_RESULT_P ="
        correction_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P ="
        self.assertEqual(old_checker[old_checker.index(checker_start):old_checker.index(b'if __name__ == "__main__":')].rstrip(), current_checker[current_checker.index(checker_start):current_checker.index(correction_start)].rstrip())
        current_test = Path(__file__).read_bytes()
        old_test = subprocess.check_output(["git", "show", f"{self.PARENT}:tests/tooling/test_project_progress.py"], cwd=ROOT)
        test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR9ResultTests"
        correction_test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR9TakeoverCorrectionTests"
        self.assertEqual(old_test[old_test.index(test_start):old_test.index(b'if __name__ == "__main__":')].rstrip(), current_test[current_test.index(test_start):current_test.index(correction_test_start)].rstrip())


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10ResultTests(unittest.TestCase):
    PARENT = "27406570cbfbb89f19ee3a5d746687125d043d7e"

    def _build(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        return checker, checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_result_from_root(ROOT)

    @staticmethod
    def _native(stdout, stderr="", exit_code=0):
        return {"stdout": stdout, "stderr": stderr, "exit_code": exit_code, "process_started": True}

    @staticmethod
    def _safe(receipt):
        return {"result": receipt["result"], "runtime_execution": receipt["runtimeExecution"]}

    def _assert_safe_envelope(self, envelope):
        self.assertIs(type(envelope), dict)
        self.assertNotIn("stdout", envelope)
        self.assertNotIn("stderr", envelope)
        self.assertTrue(envelope["raw_cleared"])
        self.assertTrue(envelope["secret_cleared"])
        self.assertNotIn("synthetic-secret-value", json.dumps(envelope, sort_keys=True))

    def test_seq686_metadata_binds_exact12_and_cumulative286(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        meta = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_result_metadata()
        self.assertEqual((12, "A517ED343E5509C56070AC53DFF2FA46DBF6E22AD0F87D4640A09EFBE748F39A", "BE98A5D1DB7ED066EB01888326947F65E72D87615E0FE076EE2DC6796DE86836"), (meta["exact_path_count"], meta["exact_path_list_sha256"], meta["exact_path_list_ordinal_sha256"]))
        self.assertEqual((286, "38CF5747CE85C17EB7DB259E12B86E65B5AB32743E298B3E4A5573D9D33EE335", "C67C1829358F575C435D47AD3953BDC636DD22F3CFF8CDDF9C2B816F72081ED2"), (meta["cumulative_path_count"], meta["cumulative_path_list_sha256"], meta["cumulative_path_list_ordinal_sha256"]))

    def test_seq686_phase_envelope_pass_and_known_native_hashes(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        raw = json.dumps({"result": "PASS", "runtimeExecution": "EXECUTED"}, separators=(",", ":"), sort_keys=True) + "\n"
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_phase_envelope(lambda: self._native(raw), self._safe, ("synthetic-secret-value",))
        self._assert_safe_envelope(envelope)
        self.assertEqual(("PASS", "COMPLETE", "NONE", "NONE"), (envelope["result"], envelope["observation_state"], envelope["failure_step"], envelope["exception_category"]))
        self.assertRegex(envelope["stdout_sha256"], r"^[0-9A-F]{64}$")
        node = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_native_self_check(self._native("R10-OUT\n", "R10-ERR\n", 23))
        self.assertEqual(("BDF41A72943B842E0FD1E6D2A44FDEFE52D8463FAD7EB08283F501CFEEA61058", "FE050FD63FC67571ABF6366E44B234A0D33F6B27FF7FAC235E482E43BC563F45", 1, 1, 23), (node["stdout_sha256"], node["stderr_sha256"], node["stdout_line_count"], node["stderr_line_count"], node["exit_code"]))

    def test_seq686_phase_envelope_probe_error_is_safe_and_exact(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        raw = json.dumps({"result": "PROBE_ERROR", "runtimeExecution": "FAILED"}, separators=(",", ":"), sort_keys=True) + "\n"
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_phase_envelope(lambda: self._native(raw, "redacted-category\n", 1), self._safe, ("synthetic-secret-value",))
        self._assert_safe_envelope(envelope)
        self.assertEqual(("FAIL", "COMPLETE", 1, "PROBE_ERROR"), (envelope["result"], envelope["observation_state"], envelope["exit_code"], envelope["safe_receipt"]["result"]))
        self.assertEqual(["receipt.result==PASS", "native.exit_code==0"], envelope["false_predicates"])

    def test_seq686_phase_envelope_malformed_and_transformer_exceptions_return_one_object(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        malformed = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_phase_envelope(lambda: self._native("{malformed}\n", exit_code=1), self._safe, ("synthetic-secret-value",))
        self._assert_safe_envelope(malformed)
        self.assertEqual(("STRICT_PARSE", "JSON_DECODE_ERROR", "STRICT_JSON_PARSE"), (malformed["failure_step"], malformed["exception_category"], malformed["failure_statement"]))
        def throwing(_receipt):
            raise RuntimeError("synthetic-secret-value")
        transformed = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_phase_envelope(lambda: self._native('{"result":"PASS","runtimeExecution":"EXECUTED"}\n'), throwing, ("synthetic-secret-value",))
        self._assert_safe_envelope(transformed)
        self.assertEqual(("SAFE_TRANSFORM", "TRANSFORMER_RUNTIME_ERROR", "SAFE_RECEIPT_TRANSFORM", "NOT_AVAILABLE"), (transformed["failure_step"], transformed["exception_category"], transformed["failure_statement"], transformed["safe_receipt"]))

    def test_seq686_runtime_validator_accepts_strict_success_and_failure_only(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        success = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime_fixture(True)
        failure = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime_fixture(False)
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime(success))
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime(failure))
        changed = copy.deepcopy(success); changed["retry_count"] = 1
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime(changed))
        changed = copy.deepcopy(success); changed["browser_pg15"]["false_predicates"] = ["receipt.result==PASS"]
        self.assertTrue(checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_runtime(changed))

    def test_seq686_builder_binds_actual_failure_approval_events_and_safe_evidence(self):
        checker, artifacts = self._build()
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_M])
        progress = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_P])
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_E])["events"][-6:]
        self.assertEqual(list(range(681, 687)), [event["sequence"] for event in events])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual(["FAILURE_RESULT_HANDOFF", "FAILURE_RESULT_HANDOFF"], [events[3]["details"]["reason"], events[4]["details"]["reason"]])
        approval = manifest["approval"]
        self.assertEqual(("DIRECT_USER_APPROVAL", "계속하자", "723A1D914C3540B7D4FF677C25C25DDA7CFF25ED7CD43ABF1E7D436D8B6426DC"), (approval["source"], approval["response"], approval["subject_sha256"]))
        runtime = manifest["runtime_result"]
        self.assertEqual((1, 1, 1, 0, 1, 0), tuple(runtime["action_counts"][key] for key in ("deploy", "verify", "pg15_browser", "pg18rc_browser", "cleanup", "retry")))
        self.assertEqual(("ACCEPTANCE_FAILED", "EXECUTED", 3, 2), (runtime["browser_pg15"]["safe_receipt"]["result"], runtime["browser_pg15"]["safe_receipt"]["runtime_execution"], runtime["browser_pg15"]["safe_receipt"]["viewport_count"], runtime["browser_pg15"]["safe_receipt"]["viewport_pass_count"]))
        self.assertEqual(["receipt.result==PASS", "viewports.all_acceptance_predicates==true", "native.exit_code==0"], runtime["browser_pg15"]["false_predicates"])
        self.assertEqual("UNAVAILABLE_NOT_PERSISTED", runtime["browser_pg15"]["failing_viewport_name"])
        self.assertEqual("UNAVAILABLE_NOT_PERSISTED", runtime["browser_pg15"]["individual_false_predicate_paths"])
        self.assertEqual({"fingerprint":"BROWSER_ACCEPTANCE_FAILED_R10","count":1}, manifest["diagnosis"]["primary_root"])
        self.assertEqual({"fingerprint":"R10_SAFE_RECEIPT_VIEWPORT_PREDICATE_DETAIL_INSUFFICIENT_R1","count":1}, manifest["diagnosis"]["capture_detail_root"])
        self.assertEqual(progress["workbench_ui_wsl_auth_browser_runtime_retry_r9_takeover_correction"]["correction"]["exact_roots"], manifest["historical_exact_roots"])
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_result_manifest(manifest))

    def test_seq686_existing_seq680_checker_and_test_regions_are_byte_preserved(self):
        current_checker = CHECKER_PATH.read_bytes()
        old_checker = subprocess.check_output(["git", "show", f"{self.PARENT}:scripts/check_project_progress.py"], cwd=ROOT)
        start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R9_TAKEOVER_CORRECTION_P ="
        next_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_P ="
        self.assertEqual(old_checker[old_checker.index(start):old_checker.index(b'if __name__ == "__main__":')].rstrip(), current_checker[current_checker.index(start):current_checker.index(next_start)].rstrip())
        current_test = Path(__file__).read_bytes()
        old_test = subprocess.check_output(["git", "show", f"{self.PARENT}:tests/tooling/test_project_progress.py"], cwd=ROOT)
        test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR9TakeoverCorrectionTests"
        next_test = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10ResultTests"
        self.assertEqual(old_test[old_test.index(test_start):old_test.rindex(b'if __name__ == "__main__":')].rstrip(), current_test[current_test.index(test_start):current_test.index(next_test)].rstrip())


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10EvidenceCorrectionTests(unittest.TestCase):
    PARENT = "c8c35cf92e72ea405b1a9171983c26407175c382"

    def _build(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        return checker, checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_evidence_correction_from_root(ROOT)

    def test_seq692_metadata_binds_exact12_and_cumulative292(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        meta = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_evidence_correction_metadata()
        self.assertEqual((12, "57AB57A282545B4BAC8FE729A04FE315DDDC6E58C69B30086093AFC5B60AC0EB", "384AFFDE81E005F3882CB839D0E0A0DE4AD44EB64EE21B8DAF18264B132BC8A5"), (meta["exact_path_count"], meta["exact_path_list_sha256"], meta["exact_path_list_ordinal_sha256"]))
        self.assertEqual((292, "8F4C7FE3DE09BE70264AB38C01969B8B9B58E1D8C7A8EF572205FB6547FCC9B6", "D814CFED8C979B0D89F90DA39497675578477C2FC5062585EB21F3480BE3913E"), (meta["cumulative_path_count"], meta["cumulative_path_list_sha256"], meta["cumulative_path_list_ordinal_sha256"]))

    def test_seq692_builder_preserves_historical_receipt_and_corrects_only_unsupported_fields(self):
        checker, artifacts = self._build()
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_EVIDENCE_CORRECTION_M])
        historical = json.loads(subprocess.check_output(["git", "show", f"{self.PARENT}:docs/evidence/manifests/C-21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_MANIFEST.json"], cwd=ROOT))
        self.assertEqual(historical["runtime_result"]["browser_pg15"], manifest["historical_browser_pg15"])
        effective = manifest["effective_browser_pg15"]
        historical_safe = historical["runtime_result"]["browser_pg15"]["safe_receipt"]
        self.assertEqual({key:value for key,value in historical_safe.items() if key not in {"provider_row_count","groq_detail_clicked"}}, {key:value for key,value in effective["safe_receipt"].items() if key not in {"provider_row_count","groq_detail_clicked"}})
        self.assertEqual(("UNAVAILABLE_NOT_PERSISTED", "UNAVAILABLE_NOT_PERSISTED"), (effective["safe_receipt"]["provider_row_count"], effective["safe_receipt"]["groq_detail_clicked"]))
        self.assertEqual(historical["runtime_result"]["browser_pg15"]["false_predicates"], effective["false_predicates"])
        self.assertEqual((1, "ACCEPTANCE_FAILED", "EXECUTED"), (effective["exit_code"], effective["safe_receipt"]["result"], effective["safe_receipt"]["runtime_execution"]))

    def test_seq692_review_resolution_events_status_and_zero_action_are_strict(self):
        checker, artifacts = self._build()
        manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_EVIDENCE_CORRECTION_M])
        events = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_EVIDENCE_CORRECTION_E])["events"][-6:]
        self.assertEqual(list(range(687, 693)), [event["sequence"] for event in events])
        self.assertEqual(["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"], [event["event_type"] for event in events])
        self.assertEqual(["CORRECTION_RESULT_HANDOFF", "CORRECTION_RESULT_HANDOFF"], [events[3]["details"]["reason"], events[4]["details"]["reason"]])
        self.assertEqual({"critical":0,"important":1,"minor":0}, manifest["review"]["findings"])
        self.assertEqual(("R10_SAFE_RECEIPT_UNSUPPORTED_FIELD_ASSERTION_R1", "RESOLVED_CURRENT_PROJECTION"), (manifest["review"]["fingerprint"], manifest["review"]["resolution"]))
        self.assertEqual((False, False, False, False, 0), tuple(manifest["change_boundary"][key] for key in ("product_change","runtime_change","policy_change","scope_change","runtime_action_count")))
        self.assertEqual(("READY_R10_EVIDENCE_CORRECTION_FOR_INDEPENDENT_REVIEW", "INDEPENDENT_REVIEW_R10_EVIDENCE_CORRECTION_BEFORE_R11"), (manifest["status"], manifest["next_action"]))
        self.assertEqual([], checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_evidence_correction_manifest(manifest))

    def test_seq692_existing_seq686_checker_and_test_regions_are_byte_preserved(self):
        checker_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_RESULT_P ="
        correction_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_EVIDENCE_CORRECTION_P ="
        old_checker = subprocess.check_output(["git", "show", f"{self.PARENT}:scripts/check_project_progress.py"], cwd=ROOT)
        current_checker = CHECKER_PATH.read_bytes()
        self.assertEqual(old_checker[old_checker.index(checker_start):old_checker.rindex(b'if __name__ == "__main__":')].rstrip(), current_checker[current_checker.index(checker_start):current_checker.index(correction_start)].rstrip())
        test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10ResultTests"
        correction_test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10EvidenceCorrectionTests"
        old_test = subprocess.check_output(["git", "show", f"{self.PARENT}:tests/tooling/test_project_progress.py"], cwd=ROOT)
        current_test = Path(__file__).read_bytes()
        self.assertEqual(old_test[old_test.index(test_start):old_test.rindex(b'if __name__ == "__main__":')].rstrip(), current_test[current_test.index(test_start):current_test.index(correction_test_start)].rstrip())


class C21WorkbenchUiWslAuthBrowserRuntimeRetryR11ResultTests(unittest.TestCase):
    PARENT = "da7ab71ea14bbe0db2c41d114ca4b97c1109404b"
    BOOL_FIELDS = ["providerListVisible", "providerDetailVisible", "runEventActionVisible", "statusAlertVisible", "documentHorizontalOverflowZero", "keyboardTabFocusVisible", "buttonAccessibleNames", "sseInitialConnected", "lastEventIdReconnect"]

    def _receipt(self):
        viewports = []
        for name, width, height in (("desktop-1920x1080",1920,1080),("desktop-1440x900",1440,900),("mobile-430x844",430,844)):
            row = {"name":name,"width":width,"height":height}
            row.update({field:True for field in self.BOOL_FIELDS})
            viewports.append(row)
        return {"schemaVersion":"1.0.0","project":"c21-workbench-ui-wsl-auth-browser-probe","result":"PASS","credentialInput":"ENVIRONMENT_ONLY","runtimeExecution":"EXECUTED","viewports":viewports,"requestContract":{"providerReadGetOnly":True,"providerWriteCount":0,"crossOriginCount":0,"fixtureApiCount":0,"lastEventIdExactMatch":True},"secretSafety":{"sentinelOccurrences":0,"authorizationHeaderOccurrences":0,"cookieOccurrences":0,"rawUrlOccurrences":0},"screenshotPolicy":{"storage":"MEMORY_ONLY","rootInput":"FAIL_CLOSED_IF_SUPPLIED"},"filesystemMutation":{"storage":"MEMORY_ONLY","filesCreated":0,"directoriesCreated":0,"residueCount":0}}

    def test_seq698_metadata_binds_exact12_and_cumulative298(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        meta = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_result_metadata()
        self.assertEqual((12,"BD8C7FF87D4FD1C49FE860678C0F7AD99EEF72F64BA21B7B66F3857486CA1FA4","234500925F1410C7F9F591950E1AAD03B0013E64E00CE092D07C3057832B319E"),(meta["exact_path_count"],meta["exact_path_list_sha256"],meta["exact_path_list_ordinal_sha256"]))
        self.assertEqual((298,"F573D2A1061D34AC512697AF6249D0CB0C0459F890B945B2B5225E20DBE39A35","7110CBD9CCB68D8785C80B8ECE96677FCAF4638DDB91D68CBFCDA3E2CAD5669C"),(meta["cumulative_path_count"],meta["cumulative_path_list_sha256"],meta["cumulative_path_list_ordinal_sha256"]))

    def test_seq698_safe_receipt_preserves_viewport_fields_without_screenshot_subtree(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        result = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_safe_transform(self._receipt(), 0)
        self.assertEqual([], result["receipt_false_predicates"]); self.assertEqual([], result["native_false_predicates"]); self.assertEqual([], result["consistency_false_predicates"])
        self.assertEqual([(row["name"],row["width"],row["height"]) for row in self._receipt()["viewports"]],[(row["name"],row["width"],row["height"]) for row in result["safe_receipt"]["viewports"]])
        for row in result["safe_receipt"]["viewports"]: self.assertEqual(self.BOOL_FIELDS, [field for field in self.BOOL_FIELDS if field in row])
        rendered = json.dumps(result, sort_keys=True)
        for forbidden in ("screenshotPolicy","screenshot","path","binary","base64"): self.assertNotIn(forbidden, rendered)

    def test_seq698_targeted_mobile_keyboard_false_is_exact_ordinal_unique(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        receipt = self._receipt(); receipt["result"] = "ACCEPTANCE_FAILED"; receipt["viewports"][2]["keyboardTabFocusVisible"] = False
        result = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_safe_transform(receipt, 1)
        self.assertEqual(["receipt.result==PASS","safe_receipt.viewports[2].keyboardTabFocusVisible==true"],result["receipt_false_predicates"])
        self.assertEqual(["native.exit_code==0"],result["native_false_predicates"])
        self.assertEqual([],result["consistency_false_predicates"])
        self.assertEqual(len(result["receipt_false_predicates"]),len(set(result["receipt_false_predicates"])))

    def test_seq698_reversed_multi_false_is_sorted_and_unique(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        receipt = self._receipt(); receipt["result"] = "ACCEPTANCE_FAILED"; receipt["viewports"][2]["statusAlertVisible"] = False; receipt["viewports"][0]["providerListVisible"] = False; receipt["viewports"][2]["keyboardTabFocusVisible"] = False
        result = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_safe_transform(receipt, 1)
        self.assertEqual(["receipt.result==PASS","safe_receipt.viewports[0].providerListVisible==true","safe_receipt.viewports[2].statusAlertVisible==true","safe_receipt.viewports[2].keyboardTabFocusVisible==true"],result["receipt_false_predicates"])
        self.assertEqual(4,len(set(result["receipt_false_predicates"])))

    def test_seq698_wrong_or_missing_schema_and_transform_exception_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        wrong = self._receipt(); wrong["schemaVersion"] = "0.9.0"
        self.assertEqual(["safe_receipt.schema_version==1.0.0"],checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_safe_transform(wrong,0)["consistency_false_predicates"])
        missing = self._receipt(); del missing["schemaVersion"]
        self.assertEqual(["safe_receipt.schema_version.present"],checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_safe_transform(missing,0)["consistency_false_predicates"])
        def throwing(_receipt): raise RuntimeError("must-not-persist")
        envelope = checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r10_phase_envelope(lambda:{"stdout":json.dumps(self._receipt())+"\n","stderr":"","exit_code":0,"process_started":True},throwing,("must-not-persist",))
        self.assertEqual(("FAIL","SAFE_TRANSFORM","TRANSFORMER_RUNTIME_ERROR","NOT_AVAILABLE"),(envelope["result"],envelope["failure_step"],envelope["exception_category"],envelope["safe_receipt"]))
        self.assertNotIn("must-not-persist",json.dumps(envelope,sort_keys=True))

    def test_seq698_existing_seq692_checker_and_test_regions_are_byte_preserved(self):
        checker_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R10_EVIDENCE_CORRECTION_P ="
        next_start = b"C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_P ="
        old_checker = subprocess.check_output(["git","show",f"{self.PARENT}:scripts/check_project_progress.py"],cwd=ROOT); current_checker = CHECKER_PATH.read_bytes()
        self.assertEqual(old_checker[old_checker.index(checker_start):old_checker.rindex(b'if __name__ == "__main__":')].rstrip(),current_checker[current_checker.index(checker_start):current_checker.index(next_start)].rstrip())
        test_start = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR10EvidenceCorrectionTests"; next_test = b"class C21WorkbenchUiWslAuthBrowserRuntimeRetryR11ResultTests"
        old_test = subprocess.check_output(["git","show",f"{self.PARENT}:tests/tooling/test_project_progress.py"],cwd=ROOT); current_test = Path(__file__).read_bytes()
        self.assertEqual(old_test[old_test.index(test_start):old_test.rindex(b'if __name__ == "__main__":')].rstrip(),current_test[current_test.index(test_start):current_test.index(next_test)].rstrip())

    def _build(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        return checker, checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_result_from_root(ROOT)

    def test_seq698_builder_persists_exact_actual_viewport_and_false_predicates(self):
        checker, artifacts = self._build(); manifest = json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_M]); browser = manifest["runtime_result"]["browser_pg15"]
        self.assertEqual((1,"FAIL",1,"ACCEPTANCE_FAILED","EXECUTED"),(browser["attempt_count"],browser["result"],browser["exit_code"],browser["safe_receipt"]["result"],browser["safe_receipt"]["runtime_execution"]))
        self.assertEqual(("mobile-430x844",430,844,False),(browser["safe_receipt"]["viewports"][2]["name"],browser["safe_receipt"]["viewports"][2]["width"],browser["safe_receipt"]["viewports"][2]["height"],browser["safe_receipt"]["viewports"][2]["documentHorizontalOverflowZero"]))
        self.assertEqual(["receipt.result==PASS","safe_receipt.viewports[2].documentHorizontalOverflowZero==true"],browser["receipt_false_predicates"])
        self.assertEqual(["native.exit_code==0"],browser["native_false_predicates"]); self.assertEqual([],browser["consistency_false_predicates"])
        rendered=json.dumps(browser,sort_keys=True)
        for forbidden in ("screenshotPolicy","screenshot","base64"): self.assertNotIn(forbidden,rendered)

    def test_seq698_builder_runtime_counts_events_status_and_roots_are_strict(self):
        checker, artifacts = self._build(); manifest=json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_M]); events=json.loads(artifacts[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_E])["events"][-6:]
        self.assertEqual({"deploy":1,"verify":1,"pg15_browser":1,"pg18rc_browser":0,"cleanup":1,"retry":0},manifest["runtime_result"]["action_counts"])
        self.assertEqual(list(range(693,699)),[event["sequence"] for event in events]); self.assertEqual(["WORKER_LEASE_ISSUED","WRITE_LEASE_ISSUED","PACKAGE_STARTED","WRITE_LEASE_REVOKED","WORKER_LEASE_REVOKED","PACKAGE_COMPLETED"],[event["event_type"] for event in events])
        self.assertEqual(["FAILURE_RESULT_HANDOFF","FAILURE_RESULT_HANDOFF"],[events[3]["details"]["reason"],events[4]["details"]["reason"]])
        self.assertEqual(("FAILED_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R11_WSL_DEVELOPMENT_VALIDATION","INDEPENDENT_REVIEW_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_R11_FAILURE_RESULT",False),(manifest["status"],manifest["next_action"],manifest["accepted"]))
        self.assertEqual({"R7":{"fingerprint":"BROWSER_ACCEPTANCE_FAILED_R7","count":1},"R8":{"fingerprint":"BROWSER_OBSERVATION_CONTROLLER_EXCEPTION_R8","count":1},"R9":{"fingerprint":"R9_ACTUAL_ENVELOPE_HASH_HELPER_RESOLUTION_R1","count":1}},manifest["historical_exact_roots"])
        self.assertEqual([],checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_result_manifest(manifest))

    def test_seq698_builder_is_deterministic_and_dispatcher_selects_r11_first(self):
        checker, first=self._build(); second=checker.c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_result_from_root(ROOT); self.assertEqual(first,second)
        manifest=json.loads(first[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_M]); bundle={"_root":ROOT,"progress":json.loads(first[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_P]),"events":json.loads(first[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_E]),"handoff":checker.extract_handoff_summary(first[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_H].decode()),"detached_digest":json.loads(first[checker.C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_RETRY_R11_RESULT_D])}
        self.assertEqual([],checker.validate_c21_workbench_ui_wsl_auth_browser_runtime_retry_r11_result_projection(bundle,manifest))
class C21FinalAcceptanceProjectionReconciliationTests(unittest.TestCase):
    def test_seq699_final_acceptance_projection_contract_is_available(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_final_acceptance_projection_reconciliation_metadata()
        self.assertEqual(699, metadata["sequence"])
        self.assertEqual("2db9eff352d32d60638ae9bf7c9dae153c862be8", metadata["record_candidate"])
        self.assertEqual("7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd", metadata["deployed_product_source"])
        self.assertEqual("MAIN_PACKAGE_ACCEPTED", metadata["event_type"])

    def test_seq699_exact15_adds_only_a14_scanner_test_and_successor_registry(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_final_acceptance_projection_reconciliation_metadata()
        self.assertEqual(15, metadata["exact_path_count"])
        self.assertEqual(
            {
                "scripts/check_a14_workbench_prototype.py",
                "tests/tooling/test_a14_workbench_prototype.py",
                "docs/evidence/manifests/A-14_A14_SUCCESSOR_R6.json",
            },
            set(metadata["exact_paths"]) - {
                "docs/04_test_reports/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_RESULT.md",
                "docs/WORK_STATUS.md",
                "docs/evidence/manifests/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_MANIFEST.json",
                "docs/progress/BUILD_HANDOFF.md",
                "docs/progress/build-progress.json",
                "docs/progress/progress-events.json",
                "docs/progress/progress-handoff-detached-digest-c21-final-acceptance-projection-reconciliation.json",
                "docs/validation/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_VALIDATION.md",
                "docs/work_orders/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_INVOCATION_PROMPT.md",
                "docs/work_orders/C-21_FINAL_ACCEPTANCE_PROJECTION_RECONCILIATION_WORK_INSTRUCTION.md",
                "scripts/check_project_progress.py",
                "tests/tooling/test_project_progress.py",
            },
        )

    def test_seq699_git_collector_accepts_only_precommit_exact15_or_clean_direct_child(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_final_acceptance_projection_reconciliation_metadata()
        record = checker.C21_FINAL_ACCEPTANCE_RECORD
        deployed = checker.C21_FINAL_ACCEPTANCE_DEPLOYED
        bundle = copy.deepcopy(checker.load_bundle(ROOT))
        bundle["progress"]["repository"] = {"validated_base_commit": record}
        private_url = checker.C21_WORKBENCH_UI_WSL_PRIVATE_URL
        development_ref = "refs/remotes/development/candidates/c21-wsl-acceptance-auth-r1"
        branch = "codex/c21-wsl-acceptance-auth-r1"
        status_key = ("status", "--porcelain", "--untracked-files=all")
        values = {
            ("rev-parse", "HEAD"): record,
            ("branch", "--show-current"): branch,
            ("rev-parse", record): record,
            ("show", "-s", "--format=%P", record): deployed,
            ("remote", "get-url", "development"): private_url,
            ("for-each-ref", "--format=%(refname) %(objectname)", development_ref): f"{development_ref} {record}",
            status_key: "\n".join(" M " + path for path in metadata["exact_paths"]),
        }
        def run(mapping, ancestors):
            with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: mapping.get(args)), mock.patch.object(
                checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in ancestors else 1
            ):
                return checker._collect_c21_final_acceptance_projection_reconciliation_git(bundle)
        precommit_ancestors = {
            ("merge-base", "--is-ancestor", deployed, record),
            ("diff", "--cached", "--check"),
        }
        self.assertEqual([], run(values, precommit_ancestors))

        child = "a" * 40
        post = values | {
            ("rev-parse", "HEAD"): child,
            ("show", "-s", "--format=%P", child): record,
            ("diff", "--name-only", record, child): "\n".join(metadata["exact_paths"]),
            status_key: "",
        }
        post_ancestors = {
            ("merge-base", "--is-ancestor", deployed, record),
            ("merge-base", "--is-ancestor", record, child),
            ("diff", "--check", record, child),
        }
        self.assertEqual([], run(post, post_ancestors))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", child): record + " " + deployed}, post_ancestors))
        self.assertTrue(run(post | {status_key: " M docs/WORK_STATUS.md"}, post_ancestors))
        self.assertTrue(run(post | {("rev-parse", record): None}, post_ancestors))
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(post | {("remote", "get-url", "development"): "https://example.invalid/Anvil.git"}, post_ancestors),
        )
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(post | {("for-each-ref", "--format=%(refname) %(objectname)", development_ref): f"{development_ref} {'0' * 40}"}, post_ancestors),
        )
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(post | {("for-each-ref", "--format=%(refname) %(objectname)", development_ref): None}, post_ancestors),
        )
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(post | {("remote", "get-url", "development"): None}, post_ancestors),
        )
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(
                post | {
                    ("for-each-ref", "--format=%(refname) %(objectname)", development_ref):
                        f"{development_ref} {record}\nrefs/remotes/development/contaminated {'0' * 40}"
                },
                post_ancestors,
            ),
        )

        self.assertTrue(run(values, precommit_ancestors - {("diff", "--cached", "--check")}))
        self.assertTrue(run(post, post_ancestors - {("diff", "--check", record, child)}))

    def test_seq699_builder_preserves_seq1_698_raw_prefix_and_projects_only_approved_evidence(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_final_acceptance_projection_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_M])
        progress = json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_P])
        prior = subprocess.check_output(["git", "show", "2db9eff352d32d60638ae9bf7c9dae153c862be8:docs/progress/progress-events.json"], cwd=ROOT)
        current = artifacts[checker.C21_FINAL_ACCEPTANCE_E]
        self.assertEqual(checker.raw_event_object_prefix_bytes(prior, 698), checker.raw_event_object_prefix_bytes(current, 698))
        self.assertEqual((699, "MAIN_PACKAGE_ACCEPTED", True, "READY_FOR_WORK_INSTRUCTION", "NOT_REACHED"), (manifest["event_sequence"], manifest["status"], manifest["accepted"], manifest["c01_status"], manifest["dir2_status"]))
        evidence = manifest["acceptance"]
        self.assertEqual(("USER_OWNED_NOT_EXECUTED", "USER_OWNED_NOT_EXECUTED"), (evidence["approval_binding"]["external_provider"], evidence["approval_binding"]["telegram"]))
        self.assertEqual((0, "NOT_CREATED"), (evidence["historical_authenticated_ui_api_sse"]["cross_origin_count"], evidence["current_same_origin_source_static"]["network_receipt"]))
        self.assertEqual(14, len(manifest["raw_checksums"]))
        self.assertEqual(
            {"package_id": "C-01", "status": "READY_FOR_WORK_INSTRUCTION"},
            {key: progress["next_work_package"][key] for key in ("package_id", "status")},
        )
        self.assertEqual(
            {"package_id": "C-01", "status": "READY_FOR_WORK_INSTRUCTION"},
            {key: progress["next_successor_work_package"][key] for key in ("package_id", "status")},
        )
        self.assertIn("C-21", progress["completed_packages"])
        self.assertEqual("POSTCOMMIT_EXACT15_SOLE_DIRECT_CHILD_OF_RECORD", progress["repository"]["head_relation"])
        self.assertEqual("CLEAN", progress["repository"]["worktree_status"])
        self.assertEqual([], checker.validate_c21_final_acceptance_projection_reconciliation_manifest(manifest))

    def test_seq699_canonical_progress_state_contradictions_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_final_acceptance_projection_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_M])
        progress = json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_P])
        base_bundle = {
            "_root": ROOT,
            "progress": progress,
            "events": json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C21_FINAL_ACCEPTANCE_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C21_FINAL_ACCEPTANCE_D]),
        }
        mutations = (
            ("next-work", lambda value: value["next_work_package"].update(status="BLOCKED_PENDING_C21_ACCEPTANCE")),
            ("next-successor", lambda value: value["next_successor_work_package"].update(status="BLOCKED_PENDING_PROVIDER_STATUS_READ")),
            ("completed", lambda value: value.update(completed_packages=[package for package in value["completed_packages"] if package != "C-21"])),
            ("stale-head-relation", lambda value: value["repository"].update(head_relation="PRECOMMIT_EXACT12_SUCCESSOR_PROJECTION")),
            ("stale-worktree-status", lambda value: value["repository"].update(worktree_status="SEQ698_R11_RESULT_EXACT12_DIRTY")),
        )
        for label, mutate in mutations:
            with self.subTest(label=label):
                bundle = json.loads(json.dumps({key: value for key, value in base_bundle.items() if key != "_root"}))
                bundle["_root"] = ROOT
                mutate(bundle["progress"])
                self.assertIn(
                    "C21_FINAL_ACCEPTANCE_CANONICAL_STATE_INVALID",
                    checker.validate_c21_final_acceptance_projection_reconciliation_projection(bundle, manifest),
                )

    def test_seq699_adversarial_user_owned_promotion_and_binding_mutation_fail_closed(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        manifest = json.loads(checker.c21_final_acceptance_projection_reconciliation_from_root(ROOT)[checker.C21_FINAL_ACCEPTANCE_M])
        promoted = json.loads(json.dumps(manifest)); promoted["acceptance"]["approval_binding"]["telegram"] = "PASS"
        self.assertEqual(["C21_FINAL_ACCEPTANCE_EVIDENCE_BOUNDARY_INVALID"], checker.validate_c21_final_acceptance_projection_reconciliation_manifest(promoted))
        rebound = json.loads(json.dumps(manifest)); rebound["deployed_product_source"] = "0" * 40
        self.assertEqual(["C21_FINAL_ACCEPTANCE_MANIFEST_INVALID"], checker.validate_c21_final_acceptance_projection_reconciliation_manifest(rebound))


class C21PostmergeDevelopmentAuthorityReconciliationTests(unittest.TestCase):
    def test_seq700_contract_builder_validator_and_dispatcher_are_available(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        metadata = checker.c21_postmerge_development_authority_reconciliation_metadata()
        self.assertEqual((700, "REPOSITORY_RECONCILED", "DEVELOPMENT_MAIN_AUTHORITY_RECONCILED", 12), (metadata["sequence"], metadata["event_type"], metadata["status"], metadata["exact_path_count"]))
        self.assertEqual("git@github-sinsan-develop:sinsan-develop/Anvil.git", metadata["development_remote_url"])
        self.assertEqual("refs/remotes/development/main", metadata["development_remote_ref"])
        first = checker.c21_postmerge_development_authority_reconciliation_from_root(ROOT)
        second = checker.c21_postmerge_development_authority_reconciliation_from_root(ROOT)
        self.assertEqual(first, second)
        manifest = json.loads(first[checker.C21_POSTMERGE_AUTHORITY_M])
        progress = json.loads(first[checker.C21_POSTMERGE_AUTHORITY_P])
        bundle = {
            "_root": ROOT,
            "progress": progress,
            "events": json.loads(first[checker.C21_POSTMERGE_AUTHORITY_E]),
            "handoff": checker.extract_handoff_summary(first[checker.C21_POSTMERGE_AUTHORITY_H].decode()),
            "detached_digest": json.loads(first[checker.C21_POSTMERGE_AUTHORITY_D]),
        }
        self.assertEqual([], checker.validate_c21_postmerge_development_authority_reconciliation_projection(bundle, manifest))
        self.assertEqual("C-21_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION", manifest["manifest_type"])
        self.assertEqual("READY_FOR_WORK_INSTRUCTION", progress["next_work_package"]["status"])
        self.assertEqual("C-01", progress["next_work_package"]["package_id"])
        self.assertIn("C-21", progress["completed_packages"])
        self.assertEqual(("USER_OWNED_NOT_EXECUTED", "USER_OWNED_NOT_EXECUTED"), (manifest["evidence_boundary"]["provider"], manifest["evidence_boundary"]["telegram"]))

    def test_seq700_preserves_seq1_699_raw_event_objects_and_rejects_boundary_tamper(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        artifacts = checker.c21_postmerge_development_authority_reconciliation_from_root(ROOT)
        prior = subprocess.check_output(["git", "show", f"{checker.C21_POSTMERGE_AUTHORITY_BASE}:docs/progress/progress-events.json"], cwd=ROOT)
        current = artifacts[checker.C21_POSTMERGE_AUTHORITY_E]
        self.assertEqual(checker.raw_event_object_prefix_bytes(prior, 699), checker.raw_event_object_prefix_bytes(current, 699))
        manifest = json.loads(artifacts[checker.C21_POSTMERGE_AUTHORITY_M])
        for label, mutate, expected in (
            ("url", lambda value: value.update(development_remote_url="https://example.invalid/Anvil.git"), "C21_POSTMERGE_AUTHORITY_MANIFEST_INVALID"),
            ("ref", lambda value: value.update(development_remote_ref="refs/remotes/development/candidates/deleted"), "C21_POSTMERGE_AUTHORITY_MANIFEST_INVALID"),
            ("merge-parent", lambda value: value["lineage"].update(baseline_merge_parents=["0" * 40]), "C21_POSTMERGE_AUTHORITY_LINEAGE_INVALID"),
            ("a03-parent", lambda value: value["lineage"].update(feature_parent="0" * 40), "C21_POSTMERGE_AUTHORITY_LINEAGE_INVALID"),
            ("provider", lambda value: value["evidence_boundary"].update(provider="PASS"), "C21_POSTMERGE_AUTHORITY_EVIDENCE_BOUNDARY_INVALID"),
            ("c01", lambda value: value.update(c01_status="BLOCKED"), "C21_POSTMERGE_AUTHORITY_MANIFEST_INVALID"),
        ):
            with self.subTest(label=label):
                changed = json.loads(json.dumps(manifest)); mutate(changed)
                self.assertIn(expected, checker.validate_c21_postmerge_development_authority_reconciliation_manifest(changed))

    def test_seq700_git_collector_accepts_precommit_postcommit_and_merged_main_without_deleted_candidate_ref(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        # This collector describes seq700, not the mutable current projection.
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": "931b32418924de11626949b9303360696d614fb0"}}}
        metadata = checker.c21_postmerge_development_authority_reconciliation_metadata()
        base = checker.C21_POSTMERGE_AUTHORITY_BASE; feature = "a" * 40; merged = "b" * 40
        devref = checker.C21_POSTMERGE_AUTHORITY_DEVELOPMENT_REF; status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", base): base,
            ("show", "-s", "--format=%P", base): "eef349682ff5598e3488c9e75163c5e0a99a0bdb a03aecc74b412515dab983148838c249fca62d3a",
            ("show", "-s", "--format=%P", "a03aecc74b412515dab983148838c249fca62d3a"): "2db9eff352d32d60638ae9bf7c9dae153c862be8",
            ("show", "-s", "--format=%P", "2db9eff352d32d60638ae9bf7c9dae153c862be8"): "7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd",
        }
        ancestors = {
            ("merge-base", "--is-ancestor", "7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd", "2db9eff352d32d60638ae9bf7c9dae153c862be8"),
            ("merge-base", "--is-ancestor", "2db9eff352d32d60638ae9bf7c9dae153c862be8", "a03aecc74b412515dab983148838c249fca62d3a"),
            ("merge-base", "--is-ancestor", "a03aecc74b412515dab983148838c249fca62d3a", base),
        }
        def run(values, accepted):
            with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in accepted else 1):
                return checker._collect_c21_postmerge_development_authority_reconciliation_git(bundle)
        pre = common | {
            ("rev-parse", "HEAD"): base, ("branch", "--show-current"): "codex/c21-postmerge-authority-reconcile",
            ("rev-parse", devref): base, ("rev-parse", "--abbrev-ref", "@{upstream}"): None,
            ("diff", "--cached", "--name-only"): "\n".join(metadata["exact_paths"]),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
            status_key: "\n".join("M  " + path for path in metadata["exact_paths"]),
        }
        self.assertEqual([], run(pre, ancestors | {("diff", "--cached", "--check")}))
        valid_precommit_checks = ancestors | {("diff", "--cached", "--check")}
        precommit_negatives = (
            (
                "cached-name-missing-one",
                pre | {("diff", "--cached", "--name-only"): "\n".join(metadata["exact_paths"][:-1])},
                valid_precommit_checks,
            ),
            (
                "unstaged-nonempty",
                pre | {("diff", "--name-only"): "docs/WORK_STATUS.md"},
                valid_precommit_checks,
            ),
            (
                "untracked-nonempty",
                pre | {("ls-files", "--others", "--exclude-standard"): "docs/validation/C-21_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_VALIDATION.md"},
                valid_precommit_checks,
            ),
            (
                "cached-diff-check-nonzero",
                pre,
                ancestors,
            ),
        )
        for label, changed, checks in precommit_negatives:
            with self.subTest(precommit_negative=label):
                self.assertEqual(
                    ["C21_POSTMERGE_AUTHORITY_PATH_OR_CLEAN_INVALID"],
                    run(changed, checks),
                )
        self.assertEqual(
            ["GIT_PRIVATE_AUTHORITY_MISMATCH"],
            run(pre | {("remote", "get-url", "development"): "https://example.invalid/Anvil.git"}, ancestors | {("diff", "--cached", "--check")}),
        )
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_BRANCH_OR_UPSTREAM_INVALID"],
            run(pre | {("rev-parse", "--abbrev-ref", "@{upstream}"): "development/unexpected"}, ancestors | {("diff", "--cached", "--check")}),
        )
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_GIT_LINEAGE_INVALID"],
            run(pre | {("show", "-s", "--format=%P", base): checker.C21_POSTMERGE_AUTHORITY_BASE_PARENTS[1] + " " + checker.C21_POSTMERGE_AUTHORITY_BASE_PARENTS[0]}, ancestors | {("diff", "--cached", "--check")}),
        )
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_GIT_LINEAGE_INVALID"],
            run(pre | {("show", "-s", "--format=%P", checker.C21_POSTMERGE_AUTHORITY_FEATURE): "0" * 40}, ancestors | {("diff", "--cached", "--check")}),
        )
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_GIT_LINEAGE_INVALID"],
            run(pre | {("show", "-s", "--format=%P", checker.C21_POSTMERGE_AUTHORITY_RECORD): "0" * 40}, ancestors | {("diff", "--cached", "--check")}),
        )
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_GIT_LINEAGE_INVALID"],
            run(pre, (ancestors - {("merge-base", "--is-ancestor", checker.C21_POSTMERGE_AUTHORITY_RECORD, checker.C21_POSTMERGE_AUTHORITY_FEATURE)}) | {("diff", "--cached", "--check")}),
        )
        post = common | {
            ("rev-parse", "HEAD"): feature, ("branch", "--show-current"): "codex/c21-postmerge-authority-reconcile",
            ("rev-parse", devref): base, ("rev-parse", "--abbrev-ref", "@{upstream}"): "development/codex/c21-postmerge-authority-reconcile",
            ("show", "-s", "--format=%P", feature): base,
            ("diff", "--name-only", base, feature): "\n".join(metadata["exact_paths"]), status_key: "",
        }
        post_checks = ancestors | {("merge-base", "--is-ancestor", base, feature), ("diff", "--check", base, feature)}
        self.assertEqual([], run(post, post_checks))
        self.assertEqual(["C21_POSTMERGE_AUTHORITY_PATH_OR_CLEAN_INVALID"], run(post | {status_key: " M docs/WORK_STATUS.md"}, post_checks))
        final = common | {
            ("rev-parse", "HEAD"): merged, ("branch", "--show-current"): "main", ("rev-parse", devref): merged,
            ("rev-parse", "--abbrev-ref", "@{upstream}"): "development/main", ("show", "-s", "--format=%P", merged): f"{base} {feature}",
            ("show", "-s", "--format=%P", feature): base,
            ("diff", "--name-only", base, feature): "\n".join(metadata["exact_paths"]),
            ("diff", "--name-only", base, merged): "\n".join(metadata["exact_paths"]), status_key: "",
        }
        final_checks = ancestors | {("merge-base", "--is-ancestor", base, feature), ("merge-base", "--is-ancestor", base, merged), ("diff", "--check", base, feature), ("diff", "--check", base, merged)}
        self.assertEqual([], run(final, final_checks))
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_BRANCH_OR_UPSTREAM_INVALID"],
            run(final | {("rev-parse", "--abbrev-ref", "@{upstream}"): "origin/main"}, final_checks),
        )
        self.assertTrue(run(pre | {status_key: " M docs/WORK_STATUS.md"}, ancestors | {("diff", "--cached", "--check")}))
        self.assertEqual(["GIT_PRIVATE_AUTHORITY_MISMATCH"], run(pre | {("rev-parse", devref): "0" * 40}, ancestors | {("diff", "--cached", "--check")}))
        self.assertTrue(run(final | {("show", "-s", "--format=%P", merged): feature + " " + base}, final_checks))
        self.assertEqual(
            ["C21_POSTMERGE_AUTHORITY_PATH_OR_CLEAN_INVALID"],
            run(final | {("diff", "--name-only", base, merged): "docs/WORK_STATUS.md"}, final_checks),
        )
        self.assertNotIn(("rev-parse", "refs/remotes/development/candidates/c21-wsl-acceptance-auth-r1"), final)

    def test_seq700_git_and_manifest_dispatchers_select_successor_first(self):
        checker = _load_checker_or_none(); self.assertIsNotNone(checker)
        bundle = {"_root": ROOT, "progress": {"event_sequence": 700}}
        with mock.patch.object(checker, "_collect_c21_postmerge_development_authority_reconciliation_git", return_value=["SEQ700_SELECTED"]) as selected:
            self.assertEqual(["SEQ700_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)
        mutated = copy.deepcopy(checker.load_bundle(ROOT))
        mutated["progress"]["repository"]["validated_base_commit"] = "0" * 40
        self.assertEqual(
            ["GIT_VALIDATED_BASE_NOT_ANCESTOR"],
            checker._collect_c21_postmerge_development_authority_reconciliation_git(mutated),
        )


class C01MainlineAcceptanceTests(unittest.TestCase):
    BASE = "e215c0612363050dbe20315646f1612f31b8cdc0"
    INITIAL_PRODUCT = "f56ac2514d0c5bca41768e456ed57f2036ab3137"
    PRODUCT = "66c0e43a092215ea2e9be24606d7a28e10dff359"

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c01_mainline_acceptance_from_root"), "C-01 acceptance builder missing")
        return checker

    def _with_historical_product_bytes(self, checker, action):
        """Run a seq715 fixture action against its reviewed product bytes."""
        frozen = {
            path: subprocess.check_output(["git", "show", f"{self.PRODUCT}:{path}"], cwd=ROOT)
            for path in checker.c01_mainline_acceptance_metadata()["product_paths"]
            if path != "docs/WORK_STATUS.md"
        }
        original_read_bytes = Path.read_bytes

        def read_frozen_product(path):
            try:
                relative = path.resolve().relative_to(ROOT.resolve()).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return frozen[relative] if relative in frozen else original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_frozen_product):
            return action()

    def _historical_artifacts(self, checker):
        return self._with_historical_product_bytes(
            checker,
            lambda: checker.c01_mainline_acceptance_from_root(ROOT),
        )

    def test_c01_builder_records_two_lifecycles_and_separate_review_judgment(self):
        checker = self._checker()
        first = self._historical_artifacts(checker)
        self.assertEqual(first, self._historical_artifacts(checker))
        events = json.loads(first[checker.C01_ACCEPTANCE_E])["events"]
        lifecycle = ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED", "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED"]
        self.assertEqual(lifecycle + ["INDEPENDENT_TEST_REVIEW_RECORDED", "INDEPENDENT_TEST_JUDGMENT_RECORDED"] + lifecycle + ["MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in events[700:]])
        self.assertEqual(list(range(701, 716)), [event["sequence"] for event in events[700:]])
        progress = json.loads(first[checker.C01_ACCEPTANCE_P])
        self.assertEqual((715, "C-01", "MAIN_PACKAGE_ACCEPTED", 1), (progress["event_sequence"], progress["current_work_package"], progress["status"], progress["completed_packages"].count("C-01")))
        self.assertEqual({"package_id": "C-02", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual(progress["next_work_package"], progress["next_successor_work_package"])
        self.assertEqual((None, None, None), tuple(progress[key] for key in ("active_agent", "worker_lease", "write_lease")))
        manifest = json.loads(first[checker.C01_ACCEPTANCE_M])
        self.assertEqual("NOT_REACHED", manifest["dir2_status"])
        self.assertEqual("LOCAL_FIXTURE_CONTRACT_SCOPE", manifest["acceptance_scope"])
        self.assertEqual({"NOT_EXECUTED"}, set(manifest["evidence_boundary"].values()))
        self.assertEqual(20, len(manifest["exact_paths"]))
        self.assertEqual(28, len(manifest["cumulative_paths"]))
        self.assertEqual([], checker.validate_c01_mainline_acceptance_manifest(manifest))
        prior = subprocess.check_output(["git", "show", f"{self.PRODUCT}:docs/progress/progress-events.json"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(prior, 700), checker.raw_event_object_prefix_bytes(first[checker.C01_ACCEPTANCE_E], 700))
        previous = checker._c21_resume_sha(checker.canonical_json_bytes(events[699]))
        for event in events[700:]:
            self.assertEqual(previous, event["previous_event_sha256"])
            previous = checker._c21_resume_sha(checker.canonical_json_bytes(event))

    def test_c01_fixture_receipts_are_actual_deterministic_local_outputs(self):
        checker = self._checker()
        raw = checker.c01_mainline_fixture_evidence(ROOT)
        self.assertEqual(raw, checker.c01_mainline_fixture_evidence(ROOT))
        backend = json.loads(raw[checker.C01_ACCEPTANCE_BACKEND])
        self.assertEqual(["claude", "codex", "local"], [case["backend"] for case in backend["cases"]])
        for case in backend["cases"]:
            self.assertEqual("task-graph:1", case["result"]["task_graph_ref"])
            self.assertEqual("permission:1", case["result"]["permission_ref"])
            self.assertEqual("evidence:1", case["result"]["evidence_ref"])
            self.assertEqual("checkpoint:1", case["result"]["resume_ref"])
        budget = json.loads(raw[checker.C01_ACCEPTANCE_BUDGET])
        self.assertEqual((0, 0), (budget["denied"]["adapter_calls"], budget["duplicate_step"]["additional_adapter_calls"]))
        for scenario, abort, provenance in (("success", "COMPLETED", "PROVIDER_FINAL"), ("abort", "ABORTED", "ABORT_CONFIRMED")):
            evidence = budget[scenario]["events"]
            self.assertEqual(["BUDGET_RESERVED", "USAGE_RECONCILED"], [event["event_type"] for event in evidence])
            self.assertEqual((abort, provenance), (evidence[-1]["abort_status"], evidence[-1]["usage_provenance"]))
            self.assertIsInstance(evidence[-1]["cost"], str)
        self.assertNotIn("secret-shaped prompt", json.dumps(budget))

    def test_c01_current_state_does_not_carry_old_package_failure_or_base_parents(self):
        checker = self._checker()
        progress = json.loads(self._historical_artifacts(checker)[checker.C01_ACCEPTANCE_P])
        self.assertEqual(["931b32418924de11626949b9303360696d614fb0", "ef973bb3e61df5a3acded215dbebe73a71f4f873"], progress["repository"]["baseline_merge_parents"])
        self.assertEqual((0, None), (progress["valid_failure_count"], progress["active_failure_lineage"]))
        self.assertEqual(32, progress["historical_accepted_failure_count"])
        self.assertEqual(2, progress["historical_failure_counts_by_lineage"]["C-21/LR-02C/OPS-R2"])
        self.assertEqual(32, sum(progress["historical_failure_counts_by_lineage"].values()))
        self.assertEqual(4, progress["completed_c01_acceptance_worker_lease"]["lease_epoch"])
        self.assertEqual("worker-lease-c01-mainline-acceptance-projection-r4-20260911-001", progress["completed_c01_acceptance_worker_lease"]["lease_id"])

    def test_c01_ledger_derived_historical_map_only_tamper_is_rejected(self):
        checker = self._checker()
        artifacts = self._historical_artifacts(checker)
        bundle = checker.load_bundle(ROOT)
        for key, path in (("progress", checker.C01_ACCEPTANCE_P), ("events", checker.C01_ACCEPTANCE_E), ("detached_digest", checker.C01_ACCEPTANCE_D)):
            bundle[key] = json.loads(artifacts[path])
        bundle["handoff"] = checker.extract_handoff_summary(artifacts[checker.C01_ACCEPTANCE_H].decode())
        manifest = json.loads(artifacts[checker.C01_ACCEPTANCE_M])
        self.assertEqual(2, bundle["progress"]["historical_failure_counts_by_lineage"]["C-21/LR-02C/OPS-R2"])
        validate = lambda: checker.validate_c01_mainline_acceptance_projection(bundle, manifest)
        self.assertNotIn(
            "C01_ACCEPTANCE_PROJECTION_INVALID",
            self._with_historical_product_bytes(checker, validate),
        )
        bundle["progress"]["historical_failure_counts_by_lineage"]["C-21/LR-02C/OPS-R2"] = 1
        bundle["progress"]["snapshot_hash"] = checker.compute_snapshot_hash(bundle["progress"])
        self.assertIn(
            "C01_ACCEPTANCE_PROJECTION_INVALID",
            self._with_historical_product_bytes(checker, validate),
        )

    def test_c01_fix_chain_and_independent_design_scenarios_are_bound_without_hiding_round_one(self):
        checker = self._checker()
        metadata = checker.c01_mainline_acceptance_metadata()
        self.assertEqual(self.PRODUCT, metadata["product_commit"])
        self.assertEqual(self.INITIAL_PRODUCT, metadata["product_parent"])
        self.assertEqual((9, 2, 11, 20, 28), (metadata["product_path_count"], len(metadata["product_fix_paths"]), metadata["product_path_occurrence_count"], metadata["exact_path_count"], metadata["cumulative_path_count"]))
        artifacts = self._historical_artifacts(checker)
        basis = json.loads(artifacts[checker.C01_ACCEPTANCE_M])["acceptance_basis"]
        self.assertEqual((18, self.INITIAL_PRODUCT), (basis["developer_test_rerun"]["passed"], basis["developer_test_rerun"]["product_commit"]))
        scenarios = basis["independent_design_scenarios"]
        self.assertEqual((0, 9, 0), (scenarios["implementation_read_before_authoring"], scenarios["round2"]["passed"], scenarios["round2"]["failed"]))
        self.assertEqual((8, 1, self.INITIAL_PRODUCT), (scenarios["round1"]["passed"], scenarios["round1"]["failed"], scenarios["round1"]["product_commit"]))
        self.assertEqual(self.PRODUCT, scenarios["round2"]["bound_product_commit"])
        self.assertEqual("C01-UNKNOWN-USAGE-CONSUMED-ZERO-RELEASE-v1", scenarios["finding"]["fingerprint"])
        self.assertEqual("RESOLVED_INDEPENDENT_ROUND2", scenarios["finding"]["resolution"])
        self.assertEqual("RESOLVED_BY_DESIGN_DERIVED_SCENARIOS", basis["projection_review_finding"]["resolution"])
        budget = json.loads(artifacts[checker.C01_ACCEPTANCE_BUDGET])
        unknown = budget["independent_design_scenarios"]["unknown_usage"]
        self.assertEqual(("USAGE_RECONCILIATION_REQUIRED", 1, [], "unknown"), (unknown["reconciliation_status"], unknown["remaining_reservations"], unknown["events"], unknown["usage_provenance"]))
        self.assertEqual(0, json.loads(artifacts[checker.C01_ACCEPTANCE_BACKEND])["external_calls"])

    def test_c01_current_event_effect_is_exact_and_future_projection_is_not_relaxed(self):
        checker = self._checker()
        artifacts = self._historical_artifacts(checker)
        progress = json.loads(artifacts[checker.C01_ACCEPTANCE_P])
        stream = json.loads(artifacts[checker.C01_ACCEPTANCE_E])
        contract = checker.load_bundle(ROOT)["event_contract"]
        self.assertEqual([], checker.validate_event_stream(stream, contract, progress))
        wrong = copy.deepcopy(progress)
        wrong["repository"]["local_head"] = "0" * 40
        self.assertIn("EVENT_EFFECT_MISMATCH", checker.validate_event_stream(stream, contract, wrong))
        future = copy.deepcopy(progress)
        future["event_sequence"] = 716
        self.assertIn("EVENT_EFFECT_MISMATCH", checker.validate_event_stream(stream, contract, future))

    def test_c01_manifest_rejects_scope_promotion_and_wrong_binding(self):
        checker = self._checker()
        manifest = json.loads(self._historical_artifacts(checker)[checker.C01_ACCEPTANCE_M])
        mutations = (
            lambda m: m["evidence_boundary"].update(provider="PASS"),
            lambda m: m.update(product_commit="0" * 40),
            lambda m: m.update(development_remote_ref="refs/remotes/origin/main"),
            lambda m: m["product_work_instruction"].update(sha256="0" * 64),
            lambda m: m["raw_checksums"].pop(),
            lambda m: m.update(dir2_status="CLEARED"),
            lambda m: m["acceptance_basis"]["independent_test"].update(verdict="FAIL"),
        )
        for mutate in mutations:
            changed = copy.deepcopy(manifest)
            mutate(changed)
            self.assertTrue(checker.validate_c01_mainline_acceptance_manifest(changed))

    def test_c01_rehashed_manifest_rejects_regression_only_acceptance_and_erased_findings(self):
        checker = self._checker()
        manifest = json.loads(self._historical_artifacts(checker)[checker.C01_ACCEPTANCE_M])
        mutations = (
            lambda b: b["independent_test"].update(passed=18, role="REGRESSION_ONLY"),
            lambda b: b["independent_design_scenarios"].update(implementation_read_before_authoring=1),
            lambda b: b["independent_design_scenarios"]["round1"].update(failed=0),
            lambda b: b["independent_design_scenarios"]["round2"].update(bound_product_commit=self.INITIAL_PRODUCT),
            lambda b: b["independent_design_scenarios"]["finding"].update(fingerprint="ERASED"),
            lambda b: b["projection_review_finding"].update(important_findings=0),
            lambda b: b["product_fix"]["review"].update(important_findings=1),
            lambda b: b["developer_test_rerun"].update(acceptance_authority=True),
        )
        for mutate in mutations:
            changed = copy.deepcopy(manifest)
            mutate(changed["acceptance_basis"])
            changed["acceptance_basis_sha256"] = checker._c21_resume_sha(checker.canonical_json_bytes(changed["acceptance_basis"]))
            self.assertTrue(checker.validate_c01_mainline_acceptance_manifest(changed))

    def _git_case(self, checker, state):
        meta = checker.c01_mainline_acceptance_metadata()
        projection, merged = "a" * 40, "b" * 40
        feature = "codex/c01-mainline-reconciliation"
        values = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", self.BASE): self.BASE,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("rev-parse", self.INITIAL_PRODUCT): self.INITIAL_PRODUCT,
            ("show", "-s", "--format=%P", self.BASE): "931b32418924de11626949b9303360696d614fb0 ef973bb3e61df5a3acded215dbebe73a71f4f873",
            ("show", "-s", "--format=%P", self.INITIAL_PRODUCT): self.BASE,
            ("show", "-s", "--format=%P", self.PRODUCT): self.INITIAL_PRODUCT,
            ("diff", "--name-only", self.BASE, self.INITIAL_PRODUCT): "\n".join(meta["initial_product_paths"]),
            ("diff", "--name-only", self.INITIAL_PRODUCT, self.PRODUCT): "\n".join(meta["product_fix_paths"]),
            ("diff", "--name-only", self.BASE, self.PRODUCT): "\n".join(meta["product_paths"]),
            ("diff", "--cached", "--name-only"): "",
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
            ("status", "--porcelain", "--untracked-files=all"): "",
            ("branch", "--show-current"): feature,
            ("rev-parse", "--abbrev-ref", "@{upstream}"): None,
            ("rev-parse", "refs/remotes/development/main"): self.BASE,
            ("rev-parse", "HEAD"): self.PRODUCT,
        }
        checks = {("merge-base", "--is-ancestor", self.BASE, self.PRODUCT), ("diff", "--check", self.BASE, self.PRODUCT), ("diff", "--cached", "--check")}
        checks |= {("merge-base", "--is-ancestor", self.BASE, self.INITIAL_PRODUCT), ("merge-base", "--is-ancestor", self.INITIAL_PRODUCT, self.PRODUCT), ("diff", "--check", self.BASE, self.INITIAL_PRODUCT), ("diff", "--check", self.INITIAL_PRODUCT, self.PRODUCT)}
        if state == "precommit":
            values[("diff", "--cached", "--name-only")] = "\n".join(meta["exact_paths"])
            values[("diff", "--cached", "--name-only", self.BASE)] = "\n".join(meta["cumulative_paths"])
            values[("status", "--porcelain", "--untracked-files=all")] = "\n".join("M  " + path for path in meta["exact_paths"])
        else:
            values[("rev-parse", "HEAD")] = projection
            values[("show", "-s", "--format=%P", projection)] = self.PRODUCT
            values[("diff", "--name-only", self.PRODUCT, projection)] = "\n".join(meta["exact_paths"])
            values[("diff", "--name-only", self.BASE, projection)] = "\n".join(meta["cumulative_paths"])
            checks |= {("merge-base", "--is-ancestor", self.PRODUCT, projection), ("diff", "--check", self.PRODUCT, projection), ("diff", "--check", self.BASE, projection)}
            if state == "merged":
                values.update({("rev-parse", "HEAD"): merged, ("branch", "--show-current"): "main", ("rev-parse", "--abbrev-ref", "@{upstream}"): "development/main", ("rev-parse", "refs/remotes/development/main"): merged, ("show", "-s", "--format=%P", merged): f"{self.BASE} {projection}", ("diff", "--name-only", self.BASE, merged): "\n".join(meta["cumulative_paths"]), ("diff", "--name-only", projection, merged): ""})
                checks |= {("merge-base", "--is-ancestor", projection, merged), ("diff", "--check", self.BASE, merged)}
        return values, checks

    def _run_git(self, checker, values, checks):
        bundle = {"_root": ROOT, "progress": {"event_sequence": 715, "repository": {"validated_base_commit": self.BASE, "product_commit": self.PRODUCT}}}
        with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in checks else 1):
            return checker._validate_git_projection(bundle)

    def test_c01_git_accepts_only_three_exact_states(self):
        checker = self._checker()
        for state in ("precommit", "feature", "merged"):
            values, checks = self._git_case(checker, state)
            self.assertEqual([], self._run_git(checker, values, checks), state)

    def test_c01_git_rejects_each_wrong_authority_lineage_scope_and_cleanliness(self):
        checker = self._checker()
        for state in ("precommit", "feature", "merged"):
            values, checks = self._git_case(checker, state)
            changes = [
                (("remote", "get-url", "development"), "https://github.com/cyhuh7950/anvil.git"),
                (("rev-parse", "refs/remotes/development/main"), "c" * 40),
                (("rev-parse", self.BASE), "c" * 40),
                (("rev-parse", self.PRODUCT), "c" * 40),
                (("rev-parse", self.INITIAL_PRODUCT), "c" * 40),
                (("show", "-s", "--format=%P", self.INITIAL_PRODUCT), "c" * 40),
                (("show", "-s", "--format=%P", self.PRODUCT), self.BASE + " " + "c" * 40),
                (("diff", "--name-only", self.BASE, self.INITIAL_PRODUCT), "packages/orchestration/kernel.py"),
                (("diff", "--name-only", self.INITIAL_PRODUCT, self.PRODUCT), "packages/orchestration/kernel.py"),
                (("show", "-s", "--format=%P", self.BASE), "ef973bb3e61df5a3acded215dbebe73a71f4f873 931b32418924de11626949b9303360696d614fb0"),
                (("diff", "--name-only", self.BASE, self.PRODUCT), "packages/orchestration/kernel.py"),
                (("diff", "--name-only"), "docs/WORK_STATUS.md"),
                (("ls-files", "--others", "--exclude-standard"), "unexpected.txt"),
                (("rev-parse", "--abbrev-ref", "@{upstream}"), "origin/main"),
            ]
            if state == "precommit":
                changes += [(("diff", "--cached", "--name-only"), "docs/WORK_STATUS.md"), (("diff", "--cached", "--name-only", self.BASE), "docs/WORK_STATUS.md")]
            else:
                changes += [(("show", "-s", "--format=%P", "a" * 40), self.BASE), (("diff", "--name-only", self.PRODUCT, "a" * 40), "docs/WORK_STATUS.md"), (("diff", "--name-only", self.BASE, "a" * 40), "docs/WORK_STATUS.md"), (("diff", "--cached", "--name-only"), "docs/WORK_STATUS.md"), (("status", "--porcelain", "--untracked-files=all"), " M docs/WORK_STATUS.md")]
            if state == "merged":
                changes += [(("show", "-s", "--format=%P", "b" * 40), "a" * 40 + " " + self.BASE), (("diff", "--name-only", self.BASE, "b" * 40), "docs/WORK_STATUS.md"), (("diff", "--name-only", "a" * 40, "b" * 40), "docs/WORK_STATUS.md")]
            for key, changed in changes:
                with self.subTest(state=state, key=key):
                    self.assertTrue(self._run_git(checker, values | {key: changed}, checks))
            for check in checks:
                with self.subTest(state=state, check=check):
                    self.assertTrue(self._run_git(checker, values, checks - {check}))


class C01L3ReworkControlTests(unittest.TestCase):
    BASE = "0f39bad30e7f4ab865077530cbbd29d902d1485d"

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c01_l3_rework_control_from_root"),
            "C-01 L3 rework control builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        bundle = checker.load_bundle(ROOT)
        bundle["progress"] = json.loads(artifacts[checker.C01_L3_REWORK_P])
        bundle["events"] = json.loads(artifacts[checker.C01_L3_REWORK_E])
        bundle["handoff"] = checker.extract_handoff_summary(
            artifacts[checker.C01_L3_REWORK_H].decode()
        )
        bundle["detached_digest"] = json.loads(artifacts[checker.C01_L3_REWORK_D])
        return bundle

    def test_seq721_builder_reopens_c01_and_preserves_seq715_bytes(self):
        checker = self._checker()
        artifacts = checker.c01_l3_rework_control_from_root(ROOT)
        self.assertEqual(artifacts, checker.c01_l3_rework_control_from_root(ROOT))
        progress = json.loads(artifacts[checker.C01_L3_REWORK_P])
        events = json.loads(artifacts[checker.C01_L3_REWORK_E])["events"]
        manifest = json.loads(artifacts[checker.C01_L3_REWORK_M])

        self.assertEqual(
            [
                "INDEPENDENT_TEST_REVIEW_RECORDED",
                "EVIDENCE_MANIFEST_INVALIDATED",
                "WORKER_LEASE_ISSUED",
                "WRITE_LEASE_ISSUED",
                "PACKAGE_REWORK_REQUESTED",
                "PACKAGE_RESUMED",
            ],
            [event["event_type"] for event in events[715:]],
        )
        self.assertEqual(list(range(716, 722)), [event["sequence"] for event in events[715:]])
        self.assertEqual((721, "C-01", "REWORK_IN_PROGRESS"), (
            progress["event_sequence"], progress["current_work_package"], progress["status"]
        ))
        self.assertNotIn("C-01", progress["completed_packages"])
        self.assertEqual({"package_id": "C-01", "status": "ACTIVE"}, progress["next_work_package"])
        self.assertEqual(
            {"package_id": "C-02", "status": "BLOCKED_PENDING_C01_ACCEPTANCE"},
            progress["next_successor_work_package"],
        )
        self.assertFalse(progress["c01_mainline_acceptance"]["accepted"])
        self.assertEqual("INVALIDATED_BY_FINAL_INDEPENDENT_REVIEW", progress["c01_mainline_acceptance"]["status"])
        self.assertEqual(
            {"step_lineage_id": "C-01", "valid_failure_count": 0, "status": "REWORK_REQUIRED"},
            progress["active_failure_lineage"],
        )
        self.assertEqual(0, progress["valid_failure_count"])
        self.assertEqual(17, len(progress["write_lease"]["path_scope"]))
        self.assertEqual(10, manifest["control_exact_path_count"])
        original_read_bytes = Path.read_bytes

        def read_seq721_projection(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return artifacts.get(relative, original_read_bytes(path))

        with mock.patch.object(Path, "read_bytes", read_seq721_projection):
            self.assertEqual([], checker.validate_c01_l3_rework_control_projection(
                self._bundle(checker, artifacts), manifest
            ))
        contract = checker.load_bundle(ROOT)["event_contract"]
        self.assertEqual([], checker.validate_event_stream(
            json.loads(artifacts[checker.C01_L3_REWORK_E]), contract, progress
        ))

        prior = subprocess.check_output(
            ["git", "show", f"{self.BASE}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 715),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C01_L3_REWORK_E], 715),
        )

    def test_seq721_predicate_fails_closed_on_each_control_boundary(self):
        checker = self._checker()
        artifacts = checker.c01_l3_rework_control_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C01_L3_REWORK_M])
        mutations = (
            lambda bundle, m: bundle["progress"]["completed_packages"].append("C-01"),
            lambda bundle, m: bundle["progress"]["next_successor_work_package"].update(status="READY"),
            lambda bundle, m: bundle["progress"]["c01_mainline_acceptance"].update(accepted=True),
            lambda bundle, m: bundle["events"]["events"][716].update(event_type="PACKAGE_RESUMED"),
            lambda bundle, m: bundle["progress"]["write_lease"].update(write_fencing_token="stale"),
            lambda bundle, m: m["external_execution"].update(provider="EXECUTED"),
            lambda bundle, m: m["product_exact_paths"].append("packages/forbidden.py"),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                bundle = self._bundle(checker, artifacts)
                changed_manifest = copy.deepcopy(manifest)
                mutate(bundle, changed_manifest)
                self.assertTrue(
                    checker.validate_c01_l3_rework_control_projection(bundle, changed_manifest)
                )

    def test_seq721_git_requires_exact_single_child_control_commit(self):
        checker = self._checker()
        meta = checker.c01_l3_rework_control_metadata()
        child = "a" * 40
        values = {
            ("rev-parse", "HEAD"): child,
            ("show", "-s", "--format=%P", child): self.BASE,
            ("diff", "--name-only", self.BASE, child): "\n".join(meta["control_exact_paths"]),
            ("diff", "--cached", "--name-only"): "",
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
            ("status", "--porcelain", "--untracked-files=all"): "",
            ("branch", "--show-current"): "codex/c01-mainline-reconciliation",
        }
        checks = {
            ("merge-base", "--is-ancestor", self.BASE, child),
            ("diff", "--check", self.BASE, child),
        }
        bundle = {"_root": ROOT, "progress": {"event_sequence": 721}}
        with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
            checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in checks else 1
        ):
            self.assertEqual([], checker._validate_git_projection(bundle))
            values[("show", "-s", "--format=%P", child)] = self.BASE + " " + "b" * 40
            self.assertIn("C01_L3_REWORK_GIT_PROJECTION_INVALID", checker._validate_git_projection(bundle))

    def test_seq721_git_decodes_quoted_utf8_report_path(self):
        checker = self._checker()
        quoted = r'".superpowers/sdd/Anvil_\354\236\221\354\227\205\352\263\204\355\232\215\354\204\234_v1/task-C-01-l3-rework-control-report.md"'
        self.assertEqual(checker.C01_L3_REWORK_REPORT, checker._c01_l3_decode_git_path(quoted))

    def test_seq721_git_accepts_only_exact_report_binding_correction_child(self):
        checker = self._checker()
        meta = checker.c01_l3_rework_control_metadata()
        control = "c80c40e2842b5e78d4475e804c8e3639169ce918"
        correction = "b" * 40
        self.assertEqual(control, meta["control_commit"])
        self.assertEqual(6, meta["correction_exact_path_count"])
        values = {
            ("rev-parse", "HEAD"): correction,
            ("show", "-s", "--format=%P", control): self.BASE,
            ("show", "-s", "--format=%P", correction): control,
            ("diff", "--name-only", self.BASE, control): "\n".join(meta["control_exact_paths"]),
            ("diff", "--name-only", control, correction): "\n".join(meta["correction_exact_paths"]),
            ("diff", "--cached", "--name-only"): "",
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
            ("status", "--porcelain", "--untracked-files=all"): "",
            ("branch", "--show-current"): "codex/c01-mainline-reconciliation",
        }
        checks = {
            ("merge-base", "--is-ancestor", self.BASE, control),
            ("merge-base", "--is-ancestor", control, correction),
            ("diff", "--check", self.BASE, control),
            ("diff", "--check", control, correction),
        }
        bundle = {"_root": ROOT, "progress": {"event_sequence": 721}}
        with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
            checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in checks else 1
        ):
            self.assertEqual([], checker._validate_git_projection(bundle))
            values[("show", "-s", "--format=%P", correction)] = self.BASE
            self.assertIn("C01_L3_REWORK_GIT_PROJECTION_INVALID", checker._validate_git_projection(bundle))


class C01L3FinalAcceptanceProjectionTests(unittest.TestCase):
    HISTORICAL = "a34d12da5f504a5d2694fc04f0924082cb1fc1d9"
    TEST_BASELINE = "fd3c89665629addd78e74c2fe946fb9dfc893c36"
    PRODUCT = "bb2ff4374c81865cab127eca14d3d4c9de575465"
    CONTROL = "2eba71ec37183ef6062157d7491ee48cb1fab6ba"
    EXACT15 = sorted([
        "docs/04_test_reports/C-01_L3_FINAL_ACCEPTANCE_REPORT.md",
        "docs/04_test_reports/C-01_WSL_FORMAL_SINGLE_RUNTIME_IMPLEMENTATION.md",
        "docs/WORK_STATUS.md",
        "docs/completion_reports/C-01_completion.md",
        "docs/evidence/manifests/C-01_L3_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/evidence/raw/C-01_L3_FINAL_OPERATIONAL_EVIDENCE.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c01-l3-final-acceptance.json",
        "docs/validation/C-01_L3_FINAL_ACCEPTANCE_VALIDATION.md",
        "docs/work_orders/C-01_L3_FINAL_ACCEPTANCE_PROJECTION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-01_L3_FINAL_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c01_l3_final_acceptance_from_root"),
            "C-01 L3 final acceptance builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C01_L3_FINAL_P]),
            "events": json.loads(artifacts[checker.C01_L3_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C01_L3_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C01_L3_FINAL_D]),
        }

    def test_seq727_builder_is_deterministic_and_preserves_seq721_raw_objects(self):
        checker = self._checker()
        first = checker.c01_l3_final_acceptance_from_root(ROOT)
        self.assertEqual(first, checker.c01_l3_final_acceptance_from_root(ROOT))
        self.assertEqual(set(self.EXACT15), set(first))
        stream = json.loads(first[checker.C01_L3_FINAL_E])
        progress = json.loads(first[checker.C01_L3_FINAL_P])
        manifest = json.loads(first[checker.C01_L3_FINAL_M])
        historical = subprocess.check_output(["git", "show", f"{self.HISTORICAL}:{checker.C01_L3_FINAL_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 721),
            checker.raw_event_object_prefix_bytes(first[checker.C01_L3_FINAL_E], 721),
        )
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED",
             "INDEPENDENT_TEST_JUDGMENT_RECORDED", "DEPLOYMENT_VERIFIED", "MAIN_PACKAGE_ACCEPTED"],
            [event["event_type"] for event in stream["events"][721:]],
        )
        self.assertEqual((727, "C-01", "ACCEPTED", None, None), (
            progress["event_sequence"], progress["current_work_package"], progress["status"],
            progress["write_lease"], progress["worker_lease"],
        ))
        self.assertEqual({"package_id": "C-02", "status": "READY_NOT_STARTED"}, progress["next_work_package"])
        self.assertEqual((True, "ACCEPTED"), (manifest["accepted"], manifest["status"]))
        self.assertEqual("NOT_EXECUTED", manifest["external_execution"]["provider"])
        self.assertEqual("NOT_EXECUTED", manifest["external_execution"]["telegram"])
        self.assertEqual(self.EXACT15, manifest["final_record_exact_paths"])
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT15) - {checker.C01_L3_FINAL_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])

    def test_seq727_projection_rejects_history_state_evidence_and_checksum_mutations(self):
        checker = self._checker()
        artifacts = checker.c01_l3_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C01_L3_FINAL_M])
        mutations = []
        history = self._bundle(checker, artifacts)
        history["events"]["events"][720]["event_id"] = "tampered"
        mutations.append(history)
        active_lease = self._bundle(checker, artifacts)
        active_lease["progress"]["worker_lease"] = {"status": "ACTIVE"}
        mutations.append(active_lease)
        c02_started = self._bundle(checker, artifacts)
        c02_started["progress"]["next_work_package"]["status"] = "ACTIVE"
        mutations.append(c02_started)
        for changed in mutations:
            self.assertTrue(checker.validate_c01_l3_final_acceptance_projection(changed, manifest))
        provider = copy.deepcopy(manifest)
        provider["external_execution"]["provider"] = "PASS"
        self.assertTrue(checker.validate_c01_l3_final_acceptance_manifest(provider))
        checksum = copy.deepcopy(manifest)
        checksum["raw_checksums"][0]["sha256"] = "0" * 64
        self.assertTrue(checker.validate_c01_l3_final_acceptance_projection(self._bundle(checker, artifacts), checksum))

    def test_seq727_git_accepts_only_exact_staged_or_direct_child_record(self):
        checker = self._checker()
        meta = checker.c01_l3_final_acceptance_metadata()
        staged_status = "\n".join(f"M  {path}" for path in self.EXACT15)
        values = {
            ("rev-parse", "HEAD"): self.CONTROL,
            ("branch", "--show-current"): "codex/c01-mainline-reconciliation-r5",
            ("status", "--porcelain", "--untracked-files=all"): staged_status,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT15),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
            ("show", "-s", "--format=%P", self.TEST_BASELINE): self.HISTORICAL,
            ("show", "-s", "--format=%P", self.PRODUCT): self.TEST_BASELINE,
            ("show", "-s", "--format=%P", self.CONTROL): self.PRODUCT,
            ("diff", "--name-only", self.HISTORICAL, self.TEST_BASELINE): "\n".join(meta["test_exact_paths"]),
            ("diff", "--name-only", self.TEST_BASELINE, self.PRODUCT): "\n".join(meta["product_exact_paths"]),
            ("diff", "--name-only", self.PRODUCT, self.CONTROL): "\n".join(meta["control_exact_paths"]),
        }
        checks = {
            ("diff", "--cached", "--check"),
            ("merge-base", "--is-ancestor", self.HISTORICAL, self.TEST_BASELINE),
            ("merge-base", "--is-ancestor", self.TEST_BASELINE, self.PRODUCT),
            ("merge-base", "--is-ancestor", self.PRODUCT, self.CONTROL),
        }
        bundle = {"_root": ROOT, "progress": {"event_sequence": 727}}
        with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
            checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in checks else 1
        ):
            self.assertEqual([], checker._validate_git_projection(bundle))
            values[("diff", "--cached", "--name-only")] = "\n".join(self.EXACT15[:-1])
            self.assertIn("C01_L3_FINAL_GIT_PROJECTION_INVALID", checker._validate_git_projection(bundle))

            record = "c" * 40
            values[("rev-parse", "HEAD")] = record
            values[("status", "--porcelain", "--untracked-files=all")] = ""
            values[("diff", "--cached", "--name-only")] = ""
            values[("show", "-s", "--format=%P", record)] = self.CONTROL
            values[("diff", "--name-only", self.CONTROL, record)] = "\n".join(self.EXACT15)
            checks.update({
                ("merge-base", "--is-ancestor", self.CONTROL, record),
                ("diff", "--check", self.CONTROL, record),
            })
            self.assertEqual([], checker._validate_git_projection(bundle))

            for key, bad_value, expected in (
                (("show", "-s", "--format=%P", record), self.PRODUCT, "C01_L3_FINAL_GIT_PROJECTION_INVALID"),
                (("diff", "--name-only", self.CONTROL, record), "\n".join(self.EXACT15[:-1]), "C01_L3_FINAL_GIT_PROJECTION_INVALID"),
                (("branch", "--show-current"), "main", "C01_L3_FINAL_GIT_LINEAGE_INVALID"),
                (("show", "-s", "--format=%P", self.TEST_BASELINE), self.PRODUCT, "C01_L3_FINAL_GIT_LINEAGE_INVALID"),
            ):
                original = values[key]
                values[key] = bad_value
                self.assertIn(expected, checker._validate_git_projection(bundle))
                values[key] = original

    def test_seq727_git_predicate_precedes_frozen_seq721_predicate(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 727}}
        with mock.patch.object(checker, "_collect_c01_l3_final_acceptance_git", return_value=["final-called"]) as final, mock.patch.object(
            checker, "_collect_c01_l3_rework_control_git", side_effect=AssertionError("seq721 predicate must not run")
        ):
            self.assertEqual(["final-called"], checker._validate_git_projection(bundle))
            final.assert_called_once_with(bundle)

    def test_seq727_live_bundle_satisfies_common_recovery_contract(self):
        checker = self._checker()
        artifacts = checker.c01_l3_final_acceptance_from_root(ROOT)
        bundle = self._bundle(checker, artifacts)
        contract = json.loads((ROOT / "docs/progress/progress-event-contract.json").read_text(encoding="utf-8"))
        self.assertEqual(
            [],
            checker.validate_event_stream(bundle["events"], contract, bundle["progress"])
            + checker._validate_handoff(bundle),
        )


class C01PostmergeDevelopmentAuthorityReconciliationTests(unittest.TestCase):
    BASE = "b0e70278d3799860beb1eef94c382def53a45057"
    BASE_PARENTS = [
        "e215c0612363050dbe20315646f1612f31b8cdc0",
        "5d4a78555110dee16fce01e512a367524ba1eeec",
    ]
    RECORD = "5d4a78555110dee16fce01e512a367524ba1eeec"
    CONTROL = "2eba71ec37183ef6062157d7491ee48cb1fab6ba"
    PRODUCT = "bb2ff4374c81865cab127eca14d3d4c9de575465"
    EXACT12 = sorted([
        "docs/04_test_reports/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_RESULT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c01-postmerge-development-authority-reconciliation.json",
        "docs/validation/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_VALIDATION.md",
        "docs/work_orders/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-01_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c01_postmerge_development_authority_reconciliation_from_root"),
            "C-01 postmerge authority builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C01_POSTMERGE_AUTHORITY_P]),
            "events": json.loads(artifacts[checker.C01_POSTMERGE_AUTHORITY_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C01_POSTMERGE_AUTHORITY_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C01_POSTMERGE_AUTHORITY_D]),
        }

    def test_seq728_builder_is_deterministic_and_preserves_seq727_raw_objects(self):
        checker = self._checker()
        first = checker.c01_postmerge_development_authority_reconciliation_from_root(ROOT)
        self.assertEqual(first, checker.c01_postmerge_development_authority_reconciliation_from_root(ROOT))
        self.assertEqual(set(self.EXACT12), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.BASE}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 727),
            checker.raw_event_object_prefix_bytes(first[checker.C01_POSTMERGE_AUTHORITY_E], 727),
        )
        progress = json.loads(first[checker.C01_POSTMERGE_AUTHORITY_P])
        events = json.loads(first[checker.C01_POSTMERGE_AUTHORITY_E])["events"]
        manifest = json.loads(first[checker.C01_POSTMERGE_AUTHORITY_M])
        self.assertEqual((728, "REPOSITORY_RECONCILED"), (events[-1]["sequence"], events[-1]["event_type"]))
        self.assertEqual(("C-01", "ACCEPTED", None, None), (
            progress["current_work_package"], progress["status"],
            progress["worker_lease"], progress["write_lease"],
        ))
        self.assertEqual({"package_id": "C-02", "status": "READY_NOT_STARTED"}, progress["next_work_package"])
        self.assertEqual("DEVELOPMENT_MAIN_AUTHORITY_RECONCILED", manifest["status"])
        self.assertIn(
            checker.C01_POSTMERGE_AUTHORITY_STATUS,
            {row["path"] for row in progress["latest_evidence_refs"]},
        )
        self.assertEqual(("USER_OWNED_NOT_EXECUTED", "USER_OWNED_NOT_EXECUTED"), (
            manifest["evidence_boundary"]["provider"], manifest["evidence_boundary"]["telegram"],
        ))
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT12) - {checker.C01_POSTMERGE_AUTHORITY_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])
        original_read_bytes = Path.read_bytes

        def read_frozen_seq728(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return first.get(relative, original_read_bytes(path))

        with mock.patch.object(Path, "read_bytes", read_frozen_seq728):
            self.assertEqual([], checker.validate_c01_postmerge_development_authority_reconciliation_projection(
                self._bundle(checker, first), manifest
            ))

    def test_seq728_projection_rejects_history_state_boundary_and_checksum_mutations(self):
        checker = self._checker()
        artifacts = checker.c01_postmerge_development_authority_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C01_POSTMERGE_AUTHORITY_M])
        for label, mutate in (
            ("history", lambda bundle: bundle["events"]["events"][726].update(event_id="tampered")),
            ("c01", lambda bundle: bundle["progress"].update(status="BLOCKED")),
            ("c02", lambda bundle: bundle["progress"]["next_work_package"].update(status="ACTIVE")),
            ("lease", lambda bundle: bundle["progress"].update(worker_lease={"status": "ACTIVE"})),
        ):
            with self.subTest(label=label):
                changed = self._bundle(checker, artifacts)
                mutate(changed)
                self.assertTrue(checker.validate_c01_postmerge_development_authority_reconciliation_projection(changed, manifest))
        for label, mutate in (
            ("provider", lambda value: value["evidence_boundary"].update(provider="PASS")),
            ("parents", lambda value: value["lineage"].update(baseline_merge_parents=list(reversed(self.BASE_PARENTS)))),
            ("checksum", lambda value: value["raw_checksums"][0].update(sha256="0" * 64)),
        ):
            with self.subTest(label=label):
                changed = copy.deepcopy(manifest)
                mutate(changed)
                self.assertTrue(checker.validate_c01_postmerge_development_authority_reconciliation_projection(
                    self._bundle(checker, artifacts), changed
                ))

        original_read_bytes = Path.read_bytes
        mutated_raw = artifacts[checker.C01_POSTMERGE_AUTHORITY_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )
        self.assertNotEqual(artifacts[checker.C01_POSTMERGE_AUTHORITY_E], mutated_raw)

        def read_mutated_event_file(path):
            if path == ROOT / checker.C01_POSTMERGE_AUTHORITY_E:
                return mutated_raw
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_mutated_event_file):
            self.assertEqual(
                [
                    "C01_POSTMERGE_AUTHORITY_HISTORY_MUTATED",
                    "C01_POSTMERGE_AUTHORITY_RAW_BYTES_INVALID",
                ],
                checker.validate_c01_postmerge_development_authority_reconciliation_projection(
                    self._bundle(checker, artifacts), manifest
                ),
            )

        mutated_status = artifacts[checker.C01_POSTMERGE_AUTHORITY_STATUS] + b"\nbyte-only mutation\n"

        def read_mutated_status_file(path):
            if path == ROOT / checker.C01_POSTMERGE_AUTHORITY_STATUS:
                return mutated_status
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_mutated_status_file):
            self.assertEqual(
                ["C01_POSTMERGE_AUTHORITY_RAW_BYTES_INVALID"],
                checker.validate_c01_postmerge_development_authority_reconciliation_projection(
                    self._bundle(checker, artifacts), manifest
                ),
            )

    def test_seq728_git_accepts_only_precommit_postcommit_merge_and_detached_smoke(self):
        checker = self._checker()
        meta = checker.c01_postmerge_development_authority_reconciliation_metadata()
        feature = "a" * 40
        merged = "b" * 40
        devref = "refs/remotes/development/main"
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", self.BASE): self.BASE,
            ("show", "-s", "--format=%P", self.BASE): " ".join(self.BASE_PARENTS),
            ("show", "-s", "--format=%P", self.RECORD): self.CONTROL,
            ("show", "-s", "--format=%P", self.CONTROL): self.PRODUCT,
        }
        ancestors = {
            ("merge-base", "--is-ancestor", self.PRODUCT, self.CONTROL),
            ("merge-base", "--is-ancestor", self.CONTROL, self.RECORD),
            ("merge-base", "--is-ancestor", self.RECORD, self.BASE),
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}

        def run(values, checks):
            with mock.patch.object(checker, "_git_value", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in checks else 1
            ):
                return checker._collect_c01_postmerge_development_authority_reconciliation_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): "codex/c01-postmerge-authority-reconcile-r1",
            ("rev-parse", devref): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/codex/c01-postmerge-authority-reconcile-r1"): "",
            status_key: "\n".join("M  " + path for path in self.EXACT12),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT12),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        pre_checks = ancestors | {("diff", "--cached", "--check")}
        self.assertEqual([], run(pre, pre_checks))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT12[:-1])}, pre_checks))
        self.assertTrue(run(pre | {("remote", "get-url", "development"): "https://example.invalid/Anvil.git"}, pre_checks))
        self.assertTrue(run(pre | {("show", "-s", "--format=%P", self.BASE): " ".join(reversed(self.BASE_PARENTS))}, pre_checks))
        self.assertEqual(
            ["GIT_REQUIRED_COLLECTION_FAILED"],
            run(pre | {("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/codex/c01-postmerge-authority-reconcile-r1"): None}, pre_checks),
        )

        post = common | {
            ("rev-parse", "HEAD"): feature,
            ("branch", "--show-current"): "codex/c01-postmerge-authority-reconcile-r1",
            ("rev-parse", devref): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/codex/c01-postmerge-authority-reconcile-r1"): "development/codex/c01-postmerge-authority-reconcile-r1",
            ("show", "-s", "--format=%P", feature): self.BASE,
            ("diff", "--name-only", self.BASE, feature): "\n".join(self.EXACT12),
            status_key: "",
        }
        post_checks = ancestors | {
            ("merge-base", "--is-ancestor", self.BASE, feature),
            ("diff", "--check", self.BASE, feature),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {status_key: " M docs/WORK_STATUS.md"}, post_checks))
        self.assertEqual(
            ["GIT_REQUIRED_COLLECTION_FAILED"],
            run(post | {status_key: "??"}, post_checks),
        )

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("branch", "--show-current"): "main",
            ("rev-parse", devref): merged,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): "development/main",
            ("show", "-s", "--format=%P", merged): f"{self.BASE} {feature}",
            ("show", "-s", "--format=%P", feature): self.BASE,
            ("diff", "--name-only", self.BASE, feature): "\n".join(self.EXACT12),
            ("diff", "--name-only", self.BASE, merged): "\n".join(self.EXACT12),
            status_key: "",
        }
        merge_checks = ancestors | {
            ("merge-base", "--is-ancestor", self.BASE, feature),
            ("merge-base", "--is-ancestor", self.BASE, merged),
            ("diff", "--check", self.BASE, feature),
            ("diff", "--check", self.BASE, merged),
            ("diff", "--quiet", feature, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{feature} {self.BASE}"}, merge_checks))
        self.assertTrue(run(merge | {("diff", "--name-only", self.BASE, merged): self.EXACT12[0]}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", feature, merged)}))
        self.assertEqual(
            ["GIT_REQUIRED_COLLECTION_FAILED"],
            run(merge | {("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): None}, merge_checks),
        )

        detached = merge | {
            ("branch", "--show-current"): "",
        }
        self.assertEqual([], run(detached, merge_checks))
        self.assertTrue(run(detached | {("rev-parse", devref): self.BASE}, merge_checks))
        self.assertTrue(run(detached | {("rev-parse", "HEAD"): "c" * 40}, merge_checks))
        with mock.patch.object(
            checker,
            "_git_value",
            side_effect=lambda root, *args: (
                (_ for _ in ()).throw(AssertionError("detached state must not query a branch upstream"))
                if args and args[0] == "for-each-ref"
                else detached.get(args)
            ),
        ), mock.patch.object(
            checker, "_git_returncode", side_effect=lambda root, *args: 0 if args in merge_checks else 1
        ):
            self.assertEqual([], checker._collect_c01_postmerge_development_authority_reconciliation_git(bundle))

    def test_seq728_dispatchers_select_postmerge_successor_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 728}}
        with mock.patch.object(
            checker,
            "_collect_c01_postmerge_development_authority_reconciliation_git",
            return_value=["SEQ728_SELECTED"],
        ) as selected, mock.patch.object(
            checker,
            "_collect_c01_l3_final_acceptance_git",
            side_effect=AssertionError("seq727 predicate must not run"),
        ):
            self.assertEqual(["SEQ728_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C02StartProjectionTests(unittest.TestCase):
    CONTROL = "2eedcfa6b15594c2daa29bb52a5c10694c826776"
    CONTROL_PARENT = "4619ee132ced203780bb0ec615088add661ec802"
    DEVELOPMENT_MAIN = "d55763bdfe4595ce35ec1fce4da8aa0a0157afa5"
    BRANCH = "codex/c02-delegation-contract-r1"
    EXACT10 = sorted([
        "docs/04_test_reports/C-02_START_PROJECTION_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-02_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c02-start.json",
        "docs/validation/C-02_START_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c02_start_projection_from_root"),
            "C-02 start projection builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C02_START_P]),
            "events": json.loads(artifacts[checker.C02_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C02_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C02_START_D]),
        }

    def test_seq731_builder_is_deterministic_and_preserves_seq728_raw_objects(self):
        checker = self._checker()
        first = checker.c02_start_projection_from_root(ROOT)
        self.assertEqual(first, checker.c02_start_projection_from_root(ROOT))
        self.assertEqual(set(self.EXACT10), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.CONTROL}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 728),
            checker.raw_event_object_prefix_bytes(first[checker.C02_START_E], 728),
        )
        progress = json.loads(first[checker.C02_START_P])
        events = json.loads(first[checker.C02_START_E])["events"]
        manifest = json.loads(first[checker.C02_START_M])
        self.assertEqual(
            [(729, "WORKER_LEASE_ISSUED"), (730, "WRITE_LEASE_ISSUED"), (731, "PACKAGE_STARTED")],
            [(row["sequence"], row["event_type"]) for row in events[-3:]],
        )
        self.assertTrue(all(row["actor"] == "developer-primary" for row in events[-3:]))
        self.assertEqual(("C-02", "ACTIVE", "developer-primary"), (
            progress["current_work_package"], progress["status"], progress["active_agent"]["actor_id"],
        ))
        self.assertEqual(
            "c02-delegation-execution-fence-epoch-1-2eedcfa",
            progress["worker_lease"]["execution_fencing_token"],
        )
        self.assertEqual(
            "c02-delegation-write-fence-epoch-1-2eedcfa",
            progress["write_lease"]["write_fencing_token"],
        )
        self.assertEqual({"package_id": "C-03", "status": "BLOCKED_PENDING_C02_ACCEPTANCE"}, progress["next_work_package"])
        self.assertIn("C-01", progress["completed_packages"])
        self.assertEqual("DEVELOPER_IMPLEMENT_C02_DELEGATION_AUTHORITY_R1", progress["next_safe_action"])
        self.assertEqual(("ACCEPTED", "NOT_REACHED"), (manifest["c01_status"], manifest["dir2_status"]))
        handoff = checker.extract_handoff_summary(first[checker.C02_START_H].decode())
        self.assertEqual(("CLEARED", "NOT_REACHED"), (handoff["dir_status"], handoff["dir2_status"]))
        self.assertEqual(("USER_OWNED_NOT_EXECUTED", "USER_OWNED_NOT_EXECUTED"), (
            manifest["evidence_boundary"]["provider"], manifest["evidence_boundary"]["telegram"],
        ))
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT10) - {checker.C02_START_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])
        event_contract = json.loads((ROOT / "docs/progress/progress-event-contract.json").read_bytes())
        self.assertEqual([], checker.validate_event_stream(
            json.loads(first[checker.C02_START_E]), event_contract, progress
        ))
        original_read_bytes = Path.read_bytes

        def read_frozen_seq731(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            return first.get(relative, original_read_bytes(path))

        with mock.patch.object(Path, "read_bytes", read_frozen_seq731):
            self.assertEqual([], checker.validate_c02_start_projection(self._bundle(checker, first), manifest))

    def test_seq731_projection_rejects_history_hash_lease_token_path_and_checksum_mutations(self):
        checker = self._checker()
        artifacts = checker.c02_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C02_START_M])
        mutations = (
            ("history", lambda bundle: bundle["events"]["events"][727].update(event_id="tampered")),
            ("work-instruction", lambda bundle: bundle["progress"]["active_work_instruction"].update(artifact_sha256="0" * 64)),
            ("worker-token", lambda bundle: bundle["progress"]["worker_lease"].update(execution_fencing_token="wrong")),
            ("write-token", lambda bundle: bundle["progress"]["write_lease"].update(write_fencing_token="wrong")),
            ("write-path", lambda bundle: bundle["progress"]["write_lease"]["path_scope"].append("forbidden/**")),
        )
        for label, mutate in mutations:
            with self.subTest(label=label):
                changed = self._bundle(checker, artifacts)
                mutate(changed)
                self.assertTrue(checker.validate_c02_start_projection(changed, manifest))
        for label, mutate in (
            ("manifest-token", lambda value: value["worker_lease"].update(execution_fencing_token="wrong")),
            ("manifest-hash", lambda value: value.update(work_instruction_sha256="0" * 64)),
            ("manifest-path", lambda value: value["exact_paths"].append("extra")),
            ("checksum", lambda value: value["raw_checksums"][0].update(sha256="0" * 64)),
        ):
            with self.subTest(label=label):
                changed = copy.deepcopy(manifest)
                mutate(changed)
                self.assertTrue(checker.validate_c02_start_projection(self._bundle(checker, artifacts), changed))

        original_read_bytes = Path.read_bytes
        mutated_raw = artifacts[checker.C02_START_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )

        def read_mutated_event_file(path):
            if path == ROOT / checker.C02_START_E:
                return mutated_raw
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_mutated_event_file):
            errors = checker.validate_c02_start_projection(self._bundle(checker, artifacts), manifest)
        self.assertIn("C02_START_HISTORY_MUTATED", errors)
        self.assertIn("C02_START_RAW_BYTES_INVALID", errors)

    def test_seq731_git_accepts_only_exact10_staged_or_clean_sole_direct_child(self):
        checker = self._checker()
        meta = checker.c02_start_projection_metadata()
        child = "a" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", "development/main"): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.CONTROL): self.CONTROL,
            ("show", "-s", "--format=%P", self.CONTROL): self.CONTROL_PARENT,
            ("show", "-s", "--format=%P", self.CONTROL_PARENT): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "development/main",
        }
        ancestry = {("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.CONTROL)}
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.CONTROL}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c02_start_projection_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.CONTROL,
            status_key: "\n".join("M  " + path for path in self.EXACT10),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT10),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        pre_checks = ancestry | {("diff", "--cached", "--check")}
        self.assertEqual([], run(pre, pre_checks))
        malformed = (
            ("short-status-suffix", pre | {status_key: pre[status_key] + "\nx"}),
            ("tab-only-status-suffix", pre | {status_key: pre[status_key] + "\t\n"}),
            ("formfeed-status-separator", pre | {status_key: pre[status_key].replace("\n", "\f", 1)}),
            (
                "unknown-status-code",
                pre | {status_key: pre[status_key].replace("M  " + self.EXACT10[0], "ZZ " + self.EXACT10[0], 1)},
            ),
            (
                "duplicate-cached-path",
                pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT10 + [self.EXACT10[0]])},
            ),
            (
                "cached-final-trailing-space",
                pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT10) + " \n"},
            ),
        )
        for label, values in malformed:
            with self.subTest(label=label):
                self.assertTrue(run(values, pre_checks), label)
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT10[:-1])}, pre_checks))
        self.assertTrue(run(pre | {status_key: pre[status_key] + "\nM  extra.txt"}, pre_checks))
        self.assertTrue(run(pre | {("branch", "--show-current"): "wrong"}, pre_checks))
        self.assertTrue(run(pre | {("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "origin/main"}, pre_checks))
        self.assertTrue(run(pre | {("rev-parse", "development/main"): "b" * 40}, pre_checks))

        post = common | {
            ("rev-parse", "HEAD"): child,
            status_key: "",
            ("show", "-s", "--format=%P", child): self.CONTROL,
            ("diff", "--name-only", self.CONTROL, child): "\n".join(self.EXACT10),
        }
        post_checks = ancestry | {
            ("merge-base", "--is-ancestor", self.CONTROL, child),
            ("diff", "--check", self.CONTROL, child),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {status_key: " M docs/WORK_STATUS.md"}, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", child): f"{self.CONTROL} {'c' * 40}"}, post_checks))
        self.assertEqual(
            ["GIT_REQUIRED_COLLECTION_FAILED"],
            run(post | {("show", "-s", "--format=%P", child): None}, post_checks),
        )

    def test_seq731_raw_git_stdout_collection_fails_closed_on_process_anomalies(self):
        checker = self._checker()

        def collect(*, returncode=0, stdout=b"value\r\n", stderr=b""):
            result = subprocess.CompletedProcess(["git", "synthetic"], returncode, stdout, stderr)
            with mock.patch.object(checker.subprocess, "run", return_value=result) as invoked:
                collected = checker._c02_git_raw_stdout(ROOT, "synthetic")
            invoked.assert_called_once_with(
                ["git", "synthetic"], cwd=ROOT, capture_output=True, check=False
            )
            return collected

        self.assertTrue(hasattr(checker, "_c02_git_raw_stdout"), "C-02 raw collector is required")
        self.assertEqual("value\r\n", collect())
        self.assertIsNone(collect(returncode=1))
        self.assertIsNone(collect(stderr=b"warning"))
        self.assertIsNone(collect(stdout="not-bytes"))
        self.assertIsNone(collect(stderr="not-bytes"))
        self.assertIsNone(collect(stdout=b"\xff"))

        def quiet(*, returncode=0, stdout=b"", stderr=b""):
            result = subprocess.CompletedProcess(["git", "synthetic"], returncode, stdout, stderr)
            with mock.patch.object(checker.subprocess, "run", return_value=result) as invoked:
                accepted = checker._c02_git_quiet_check(ROOT, "synthetic")
            invoked.assert_called_once_with(
                ["git", "synthetic"], cwd=ROOT, capture_output=True, check=False
            )
            return accepted

        self.assertTrue(hasattr(checker, "_c02_git_quiet_check"), "C-02 quiet raw checker is required")
        self.assertTrue(quiet())
        self.assertFalse(quiet(returncode=1))
        self.assertFalse(quiet(stderr=b"warning"))
        self.assertFalse(quiet(stdout=b"warning"))
        self.assertFalse(quiet(stdout=b"\xff"))
        self.assertFalse(quiet(stdout=b"\0"))
        self.assertFalse(quiet(stdout="not-bytes"))
        self.assertFalse(quiet(stderr="not-bytes"))

    def test_seq731_dispatchers_select_c02_predicates_before_generic_git(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 731}}
        with mock.patch.object(
            checker, "_collect_c02_start_projection_git", return_value=["SEQ731_SELECTED"]
        ) as selected, mock.patch.object(
            checker,
            "_collect_c01_postmerge_development_authority_reconciliation_git",
            side_effect=AssertionError("seq728 predicate must not run"),
        ):
            self.assertEqual(["SEQ731_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C02FinalAcceptanceProjectionTests(unittest.TestCase):
    PRODUCT = "db2b52fc85d022c5af51a1927a0133bf081f4586"
    PRODUCT_PARENT = "5179870e6e9f9e2c62afaa4ada9383936d0a7036"
    START_CONTROL = "2eedcfa6b15594c2daa29bb52a5c10694c826776"
    START_CONTROL_PARENT = "4619ee132ced203780bb0ec615088add661ec802"
    DEVELOPMENT_MAIN = "d55763bdfe4595ce35ec1fce4da8aa0a0157afa5"
    BRANCH = "codex/c02-delegation-contract-r1"
    PRODUCT_EXACT8 = sorted([
        "packages/e2e/harness.py",
        "packages/orchestration/__init__.py",
        "packages/orchestration/delegation.py",
        "packages/orchestration/developer_lifecycle.py",
        "tests/orchestration/test_delegation_packet.py",
        "tests/orchestration/test_developer_lifecycle.py",
        "tests/orchestration/test_developer_lifecycle_c04.py",
        "tests/orchestration/test_takeover_c13.py",
    ])
    EXACT16 = sorted([
        "docs/04_test_reports/C-02_FINAL_ACCEPTANCE_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/completion_reports/C-02_completion.md",
        "docs/evidence/manifests/C-02_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/evidence/raw/C-02_DELEGATION_AUTHORITY_EVIDENCE.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c02-final-acceptance.json",
        "docs/test_reports/C-02_INDEPENDENT_TEST_REPORT.md",
        "docs/validation/C-02_FINAL_ACCEPTANCE_VALIDATION.md",
        "docs/work_orders/C-02_FINAL_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md",
        "docs/work_orders/C-02_FINAL_ACCEPTANCE_PROJECTION_INVOCATION_PROMPT.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
        "tests/verification/test_c02_independent_acceptance.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c02_final_acceptance_from_root"),
            "C-02 final acceptance projection builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C02_FINAL_P]),
            "events": json.loads(artifacts[checker.C02_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C02_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C02_FINAL_D]),
        }

    def test_seq736_builder_is_deterministic_and_preserves_seq731_raw_objects(self):
        checker = self._checker()
        first = checker.c02_final_acceptance_from_root(ROOT)
        self.assertEqual(first, checker.c02_final_acceptance_from_root(ROOT))
        self.assertEqual(set(self.EXACT16), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.PRODUCT}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 731),
            checker.raw_event_object_prefix_bytes(first[checker.C02_FINAL_E], 731),
        )
        progress = json.loads(first[checker.C02_FINAL_P])
        events = json.loads(first[checker.C02_FINAL_E])["events"]
        manifest = json.loads(first[checker.C02_FINAL_M])
        raw = json.loads(first[checker.C02_FINAL_RAW])
        self.assertEqual(
            [
                (732, "WRITE_LEASE_REVOKED"),
                (733, "WORKER_LEASE_REVOKED"),
                (734, "PACKAGE_COMPLETED"),
                (735, "INDEPENDENT_TEST_JUDGMENT_RECORDED"),
                (736, "MAIN_PACKAGE_ACCEPTED"),
            ],
            [(row["sequence"], row["event_type"]) for row in events[-5:]],
        )
        self.assertEqual(("C-02", "ACCEPTED"), (progress["current_work_package"], progress["status"]))
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertIn("C-02", progress["completed_packages"])
        self.assertEqual({"package_id": "C-03", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C03_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("AUTO_CONTINUE", progress["reporting_decision"]["decision"])
        self.assertEqual(("ACCEPTED", "READY_FOR_WORK_INSTRUCTION", "NOT_REACHED"), (
            manifest["c02_status"], manifest["c03_status"], manifest["dir2_status"],
        ))
        self.assertEqual(("PASS", "PASS", 1468, 1458, 193), (
            raw["independent_tester"]["validation_results"]["AV-AGT-001"],
            raw["independent_tester"]["validation_results"]["AV-SAFE-022"],
            raw["independent_tester"]["hostile_case_count"],
            raw["independent_tester"]["runner_zero_case_count"],
            raw["independent_tester"]["regression_pass_count"],
        ))
        self.assertEqual("NOT_COMPLETED", raw["full_repository_suite"]["status"])
        self.assertEqual(7, raw["full_repository_suite"]["collection_error_count"])
        self.assertEqual({
            "C02-PRODUCT-SURROGATE-HASH-EXCEPTION-ESCAPE-v1": 3,
            "C02-START-MALFORMED-GIT-COLLECTION-FAILOPEN-v1": 3,
        }, raw["main_takeover_lineages"])
        self.assertFalse(any(".superpowers/" in value for value in json.dumps(raw).split('"')))
        self.assertTrue(all(value == "NOT_EXECUTED" for value in raw["external_validation"].values()))
        self.assertEqual(self.PRODUCT_EXACT8, raw["product"]["exact_paths"])
        self.assertEqual(
            [self.DEVELOPMENT_MAIN, self.START_CONTROL_PARENT, self.START_CONTROL, self.PRODUCT_PARENT, self.PRODUCT],
            raw["product"]["ancestor_chain"],
        )
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT16) - {checker.C02_FINAL_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])
        event_contract = json.loads((ROOT / "docs/progress/progress-event-contract.json").read_bytes())
        self.assertEqual([], checker.validate_event_stream(
            json.loads(first[checker.C02_FINAL_E]), event_contract, progress
        ))
        original_read_bytes = Path.read_bytes

        def read_frozen_seq736(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in first:
                return first[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_frozen_seq736):
            self.assertEqual(
                [],
                checker.validate_c02_final_acceptance_projection(self._bundle(checker, first), manifest),
            )

    def test_seq736_projection_rejects_history_state_evidence_and_checksum_mutations(self):
        checker = self._checker()
        artifacts = checker.c02_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C02_FINAL_M])
        mutations = (
            ("history", lambda bundle: bundle["events"]["events"][730].update(event_id="tampered")),
            ("lease", lambda bundle: bundle["progress"].update(worker_lease={"status": "ACTIVE"})),
            ("next", lambda bundle: bundle["progress"].update(next_work_package={"package_id": "C-03", "status": "BLOCKED"})),
            ("dir", lambda bundle: bundle["progress"]["c02_final_acceptance"].update(dir2_status="REACHED")),
        )
        for label, mutate in mutations:
            with self.subTest(label=label):
                changed = self._bundle(checker, artifacts)
                mutate(changed)
                self.assertTrue(checker.validate_c02_final_acceptance_projection(changed, manifest))
        for label, mutate in (
            ("product", lambda value: value.update(product_commit="0" * 40)),
            ("suite", lambda value: value.update(full_repository_suite_status="COMPLETED")),
            ("checksum", lambda value: value["raw_checksums"][0].update(sha256="0" * 64)),
        ):
            with self.subTest(label=label):
                changed = copy.deepcopy(manifest)
                mutate(changed)
                self.assertTrue(checker.validate_c02_final_acceptance_projection(self._bundle(checker, artifacts), changed))

        original_read_bytes = Path.read_bytes
        mutated_raw = artifacts[checker.C02_FINAL_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )

        def read_mutated_event_file(path):
            if path == ROOT / checker.C02_FINAL_E:
                return mutated_raw
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_mutated_event_file):
            errors = checker.validate_c02_final_acceptance_projection(self._bundle(checker, artifacts), manifest)
        self.assertIn("C02_FINAL_HISTORY_MUTATED", errors)
        self.assertIn("C02_FINAL_RAW_BYTES_INVALID", errors)

    def test_seq736_git_accepts_only_exact16_staged_or_clean_sole_direct_child(self):
        checker = self._checker()
        meta = checker.c02_final_acceptance_metadata()
        child = "a" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", "development/main"): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.PRODUCT_PARENT,
            ("show", "-s", "--format=%P", self.PRODUCT_PARENT): self.START_CONTROL,
            ("show", "-s", "--format=%P", self.START_CONTROL): self.START_CONTROL_PARENT,
            ("show", "-s", "--format=%P", self.START_CONTROL_PARENT): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.PRODUCT_PARENT, self.PRODUCT): "\n".join(self.PRODUCT_EXACT8),
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "development/main",
        }
        ancestry = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START_CONTROL_PARENT),
            ("merge-base", "--is-ancestor", self.START_CONTROL_PARENT, self.START_CONTROL),
            ("merge-base", "--is-ancestor", self.START_CONTROL, self.PRODUCT_PARENT),
            ("merge-base", "--is-ancestor", self.PRODUCT_PARENT, self.PRODUCT),
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c02_final_acceptance_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.PRODUCT,
            status_key: "\n".join("M  " + path for path in self.EXACT16),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT16),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        pre_checks = ancestry | {("diff", "--cached", "--check")}
        self.assertEqual([], run(pre, pre_checks))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT16[:-1])}, pre_checks))
        self.assertTrue(run(pre | {status_key: pre[status_key] + "\nM  extra.txt"}, pre_checks))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT16 + [self.EXACT16[0]])}, pre_checks))
        self.assertTrue(run(pre | {status_key: pre[status_key].replace("\n", "\f", 1)}, pre_checks))
        self.assertTrue(run(pre | {("show", "-s", "--format=%P", self.PRODUCT_PARENT): None}, pre_checks))
        self.assertTrue(run(pre | {("diff", "--name-only", self.PRODUCT_PARENT, self.PRODUCT): "\n".join(self.PRODUCT_EXACT8[:-1])}, pre_checks))
        self.assertTrue(run(pre | {("branch", "--show-current"): "main"}, pre_checks))
        self.assertTrue(run(pre | {("rev-parse", "development/main"): "b" * 40}, pre_checks))

        post = common | {
            ("rev-parse", "HEAD"): child,
            status_key: "",
            ("show", "-s", "--format=%P", child): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, child): "\n".join(self.EXACT16),
        }
        post_checks = ancestry | {
            ("merge-base", "--is-ancestor", self.PRODUCT, child),
            ("diff", "--check", self.PRODUCT, child),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {status_key: " M docs/WORK_STATUS.md"}, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", child): f"{self.PRODUCT} {'c' * 40}"}, post_checks))

    def test_seq736_dispatcher_selects_c02_final_before_seq731_and_generic_git(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 736}}
        with mock.patch.object(
            checker, "_collect_c02_final_acceptance_git", return_value=["SEQ736_SELECTED"]
        ) as selected, mock.patch.object(
            checker, "_collect_c02_start_projection_git", side_effect=AssertionError("seq731 predicate must not run")
        ):
            self.assertEqual(["SEQ736_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C02PostmergeDevelopmentAuthorityReconciliationTests(unittest.TestCase):
    BASE = "a0cdc6aabcca14ae36ce6077bf9d2f0d89a70658"
    BASE_PARENTS = [
        "d55763bdfe4595ce35ec1fce4da8aa0a0157afa5",
        "fdb68e96e96057bc9d6d988d1f1e25a0506b67b0",
    ]
    FINAL = "fdb68e96e96057bc9d6d988d1f1e25a0506b67b0"
    PRODUCT = "db2b52fc85d022c5af51a1927a0133bf081f4586"
    START_PROJECTION = "5179870e6e9f9e2c62afaa4ada9383936d0a7036"
    CONTROL = "2eedcfa6b15594c2daa29bb52a5c10694c826776"
    AUTHORITY = "4619ee132ced203780bb0ec615088add661ec802"
    DEVELOPMENT_PARENT = "d55763bdfe4595ce35ec1fce4da8aa0a0157afa5"
    BRANCH = "codex/c02-postmerge-authority-reconcile-r1"
    DEVELOPMENT_REF = "refs/remotes/development/main"
    EXACT12 = sorted([
        "docs/04_test_reports/C-02_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_RESULT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-02_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c02-postmerge-development-authority-reconciliation.json",
        "docs/validation/C-02_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_VALIDATION.md",
        "docs/work_orders/C-02_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-02_POSTMERGE_DEVELOPMENT_AUTHORITY_RECONCILIATION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c02_postmerge_development_authority_reconciliation_from_root"),
            "C-02 postmerge authority builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C02_POSTMERGE_AUTHORITY_P]),
            "events": json.loads(artifacts[checker.C02_POSTMERGE_AUTHORITY_E]),
            "handoff": checker.extract_handoff_summary(
                artifacts[checker.C02_POSTMERGE_AUTHORITY_H].decode()
            ),
            "detached_digest": json.loads(artifacts[checker.C02_POSTMERGE_AUTHORITY_D]),
        }

    def test_seq737_builder_is_deterministic_and_preserves_seq736_raw_objects(self):
        checker = self._checker()
        first = checker.c02_postmerge_development_authority_reconciliation_from_root(ROOT)
        self.assertEqual(
            first,
            checker.c02_postmerge_development_authority_reconciliation_from_root(ROOT),
        )
        self.assertEqual(set(self.EXACT12), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.BASE}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 736),
            checker.raw_event_object_prefix_bytes(
                first[checker.C02_POSTMERGE_AUTHORITY_E], 736
            ),
        )
        progress = json.loads(first[checker.C02_POSTMERGE_AUTHORITY_P])
        events = json.loads(first[checker.C02_POSTMERGE_AUTHORITY_E])["events"]
        manifest = json.loads(first[checker.C02_POSTMERGE_AUTHORITY_M])
        self.assertEqual(
            (737, "REPOSITORY_RECONCILED"),
            (events[-1]["sequence"], events[-1]["event_type"]),
        )
        self.assertEqual(
            ("C-02", "ACCEPTED", None, None, None),
            (
                progress["current_work_package"],
                progress["status"],
                progress["active_agent"],
                progress["worker_lease"],
                progress["write_lease"],
            ),
        )
        self.assertEqual(
            {"package_id": "C-03", "status": "READY_FOR_WORK_INSTRUCTION"},
            progress["next_work_package"],
        )
        self.assertEqual("ISSUE_C03_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", progress["c02_postmerge_development_authority_reconciliation"]["dir2_status"])
        self.assertEqual(
            ("ACCEPTED", "READY_FOR_WORK_INSTRUCTION", "NOT_REACHED"),
            (manifest["c02_status"], manifest["c03_status"], manifest["dir2_status"]),
        )
        self.assertTrue(all(value == "NOT_EXECUTED" for value in manifest["external_validation"].values()))
        tooling = manifest["tooling_validation"]
        self.assertEqual(
            (
                "INTERRUPTED_ENVIRONMENT_PERFORMANCE_FAILURE",
                "C02-TOOLING-SANDBOX-TMPDIR-PERMISSION-RETRY-v1",
                False,
                False,
            ),
            (
                tooling["monolithic"]["status"],
                tooling["monolithic"]["fingerprint"],
                tooling["monolithic"]["assertion_failure"],
                tooling["monolithic"]["product_failure"],
            ),
        )
        self.assertEqual(220, tooling["monolithic"]["elapsed_approx_minutes"])
        self.assertEqual("PASS", tooling["partitioned_full"]["status"])
        self.assertEqual(347, tooling["partitioned_full"]["total_passed"])
        self.assertEqual(
            [151, 82, 114],
            [row["passed"] for row in tooling["partitioned_full"]["partitions"]],
        )
        self.assertEqual(
            [
                None,
                "954F68C8045759DE112568BE8FBED75A9058257D35D1B22709DBF6CA9206C10B",
                "064D08FF09B714675766C3C59FBCBDCA5EA5A22870D1EC7D0A99088A0A0A1213",
            ],
            [row["node_sha256"] for row in tooling["partitioned_full"]["partitions"]],
        )
        self.assertEqual(
            "NOT_COMPLETED_EVIDENCE",
            tooling["sandbox_diagnostic_partial_batches"],
        )
        self.assertEqual(self.BASE_PARENTS, manifest["lineage"]["baseline_merge_parents"])
        self.assertEqual(
            [
                self.DEVELOPMENT_PARENT,
                self.AUTHORITY,
                self.CONTROL,
                self.START_PROJECTION,
                self.PRODUCT,
                self.FINAL,
                self.BASE,
            ],
            manifest["lineage"]["ancestor_chain"],
        )
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT12) - {checker.C02_POSTMERGE_AUTHORITY_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])
        original_read_bytes = Path.read_bytes

        def read_frozen_seq737(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in first:
                return first[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_frozen_seq737):
            self.assertEqual(
                [],
                checker.validate_c02_postmerge_development_authority_reconciliation_projection(
                    self._bundle(checker, first), manifest
                ),
            )

    def test_seq737_projection_rejects_history_state_boundary_and_raw_mutations(self):
        checker = self._checker()
        artifacts = checker.c02_postmerge_development_authority_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C02_POSTMERGE_AUTHORITY_M])
        original_read_bytes = Path.read_bytes

        def read_frozen_seq737(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in artifacts:
                return artifacts[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_frozen_seq737):
            for label, mutate in (
                ("history", lambda bundle: bundle["events"]["events"][735].update(event_id="tampered")),
                ("c02", lambda bundle: bundle["progress"].update(status="BLOCKED")),
                ("c03", lambda bundle: bundle["progress"]["next_work_package"].update(status="ACTIVE")),
                ("lease", lambda bundle: bundle["progress"].update(worker_lease={"status": "ACTIVE"})),
            ):
                with self.subTest(label=label):
                    changed = self._bundle(checker, artifacts)
                    mutate(changed)
                    self.assertTrue(
                        checker.validate_c02_postmerge_development_authority_reconciliation_projection(
                            changed, manifest
                        )
                    )
            for label, mutate in (
                ("provider", lambda value: value["external_validation"].update(provider="PASS")),
                ("tooling", lambda value: value["tooling_validation"]["partitioned_full"].update(total_passed=346)),
                ("parents", lambda value: value["lineage"].update(baseline_merge_parents=list(reversed(self.BASE_PARENTS)))),
                ("checksum", lambda value: value["raw_checksums"][0].update(sha256="0" * 64)),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest)
                    mutate(changed)
                    self.assertTrue(
                        checker.validate_c02_postmerge_development_authority_reconciliation_projection(
                            self._bundle(checker, artifacts), changed
                        )
                    )

        mutated_events = artifacts[checker.C02_POSTMERGE_AUTHORITY_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )

        def read_mutated_events(path):
            if path == ROOT / checker.C02_POSTMERGE_AUTHORITY_E:
                return mutated_events
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in artifacts:
                return artifacts[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", read_mutated_events):
            errors = checker.validate_c02_postmerge_development_authority_reconciliation_projection(
                self._bundle(checker, artifacts), manifest
            )
        self.assertIn("C02_POSTMERGE_AUTHORITY_HISTORY_MUTATED", errors)
        self.assertIn("C02_POSTMERGE_AUTHORITY_RAW_BYTES_INVALID", errors)

    def test_seq737_git_accepts_only_precommit_postcommit_merge_and_detached_main(self):
        checker = self._checker()
        meta = checker.c02_postmerge_development_authority_reconciliation_metadata()
        feature = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", self.BASE): self.BASE,
            ("rev-parse", self.FINAL): self.FINAL,
            ("rev-parse", self.DEVELOPMENT_REF): self.BASE,
            ("show", "-s", "--format=%P", self.BASE): " ".join(self.BASE_PARENTS),
            ("show", "-s", "--format=%P", self.FINAL): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.START_PROJECTION,
            ("show", "-s", "--format=%P", self.START_PROJECTION): self.CONTROL,
            ("show", "-s", "--format=%P", self.CONTROL): self.AUTHORITY,
            ("show", "-s", "--format=%P", self.AUTHORITY): self.DEVELOPMENT_PARENT,
        }
        lineage_checks = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_PARENT, self.AUTHORITY),
            ("merge-base", "--is-ancestor", self.AUTHORITY, self.CONTROL),
            ("merge-base", "--is-ancestor", self.CONTROL, self.START_PROJECTION),
            ("merge-base", "--is-ancestor", self.START_PROJECTION, self.PRODUCT),
            ("merge-base", "--is-ancestor", self.PRODUCT, self.FINAL),
            ("merge-base", "--is-ancestor", self.FINAL, self.BASE),
            ("diff", "--quiet", self.FINAL, self.BASE),
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}

        def run(values, checks):
            with mock.patch.object(
                checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)
            ), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c02_postmerge_development_authority_reconciliation_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "development/main",
            status_key: "\n".join("M  " + path for path in self.EXACT12),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT12),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        pre_checks = lineage_checks | {("diff", "--cached", "--check")}
        self.assertEqual([], run(pre, pre_checks))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT12[:-1])}, pre_checks))
        self.assertEqual(["GIT_REQUIRED_COLLECTION_FAILED"], run(pre | {("show", "-s", "--format=%P", self.FINAL): None}, pre_checks))
        self.assertTrue(run(pre | {("show", "-s", "--format=%P", self.BASE): " ".join(reversed(self.BASE_PARENTS))}, pre_checks))
        self.assertTrue(run(pre | {("remote", "get-url", "development"): "https://example.invalid/Anvil.git"}, pre_checks))
        self.assertTrue(run(pre, pre_checks - {("diff", "--quiet", self.FINAL, self.BASE)}))

        post = common | {
            ("rev-parse", "HEAD"): feature,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            ("show", "-s", "--format=%P", feature): self.BASE,
            ("diff", "--name-only", self.BASE, feature): "\n".join(self.EXACT12),
            status_key: "",
        }
        post_checks = lineage_checks | {
            ("merge-base", "--is-ancestor", self.BASE, feature),
            ("diff", "--check", self.BASE, feature),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {status_key: " M docs/WORK_STATUS.md"}, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", feature): f"{self.BASE} {'c' * 40}"}, post_checks))

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", self.DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): "development/main",
            ("show", "-s", "--format=%P", merged): f"{self.BASE} {feature}",
            ("show", "-s", "--format=%P", feature): self.BASE,
            ("diff", "--name-only", self.BASE, feature): "\n".join(self.EXACT12),
            ("diff", "--name-only", self.BASE, merged): "\n".join(self.EXACT12),
            status_key: "",
        }
        merge_checks = lineage_checks | {
            ("merge-base", "--is-ancestor", self.BASE, feature),
            ("merge-base", "--is-ancestor", self.BASE, merged),
            ("diff", "--check", self.BASE, feature),
            ("diff", "--check", self.BASE, merged),
            ("diff", "--quiet", feature, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{feature} {self.BASE}"}, merge_checks))
        self.assertTrue(run(merge | {("diff", "--name-only", self.BASE, merged): self.EXACT12[0]}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", feature, merged)}))

        detached = merge | {("branch", "--show-current"): ""}
        with mock.patch.object(
            checker,
            "_c02_git_raw_stdout",
            side_effect=lambda root, *args: (
                (_ for _ in ()).throw(AssertionError("detached state must not query a branch upstream"))
                if args and args[0] == "for-each-ref"
                else detached.get(args)
            ),
        ), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in merge_checks
        ):
            self.assertEqual(
                [],
                checker._collect_c02_postmerge_development_authority_reconciliation_git(bundle),
            )

    def test_seq737_dispatchers_select_postmerge_successor_before_seq736(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 737}}
        with mock.patch.object(
            checker,
            "_collect_c02_postmerge_development_authority_reconciliation_git",
            return_value=["SEQ737_SELECTED"],
        ) as selected, mock.patch.object(
            checker,
            "_collect_c02_final_acceptance_git",
            side_effect=AssertionError("seq736 predicate must not run"),
        ):
            self.assertEqual(["SEQ737_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C03StartProjectionTests(unittest.TestCase):
    BASE = "1c3948ff1a741832a2f012f464f1a301490356c1"
    BRANCH = "codex/c03-developer-lifecycle-r1"
    EXACT12 = sorted([
        "docs/04_test_reports/C-03_START_PROJECTION_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-03_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c03-start.json",
        "docs/validation/C-03_START_VALIDATION.md",
        "docs/work_orders/C-03_INVOCATION_PROMPT.md",
        "docs/work_orders/C-03_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT3 = [
        "packages/orchestration/developer_lifecycle.py",
        "packages/orchestration/__init__.py",
        "tests/orchestration/test_developer_lifecycle.py",
    ]

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c03_start_projection_from_root"), "C-03 start builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C03_START_P]),
            "events": json.loads(artifacts[checker.C03_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C03_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C03_START_D]),
        }

    def test_seq740_builder_is_deterministic_and_preserves_seq737_raw_objects(self):
        checker = self._checker()
        first = checker.c03_start_projection_from_root(ROOT)
        self.assertEqual(first, checker.c03_start_projection_from_root(ROOT))
        self.assertEqual(set(self.EXACT12), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.BASE}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 737),
            checker.raw_event_object_prefix_bytes(first[checker.C03_START_E], 737),
        )
        progress = json.loads(first[checker.C03_START_P])
        events = json.loads(first[checker.C03_START_E])["events"]
        manifest = json.loads(first[checker.C03_START_M])
        self.assertEqual(
            ["WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED", "PACKAGE_STARTED"],
            [event["event_type"] for event in events[-3:]],
        )
        self.assertEqual((738, 739, 740), tuple(event["sequence"] for event in events[-3:]))
        self.assertEqual(
            ("C-03", "IN_PROGRESS", {"package_id": "C-04", "status": "NOT_READY"}),
            (progress["current_work_package"], progress["status"], progress["next_work_package"]),
        )
        self.assertEqual("NOT_REACHED", progress["c03_start_projection"]["dir2_status"])
        self.assertEqual(self.PRODUCT3, progress["write_lease"]["path_scope"])
        self.assertEqual(["AV-AGT-004"], manifest["acceptance_binding"]["requirement_ids"])
        self.assertEqual("L3", manifest["acceptance_binding"]["verification_level"])
        self.assertEqual("AI", manifest["acceptance_binding"]["method"])
        self.assertEqual(["E-GIT", "E-ART"], manifest["acceptance_binding"]["evidence_types"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["actual_runner"])

    def test_seq740_binds_fail_closed_session_path_and_raw_freeze_contracts(self):
        checker = self._checker()
        artifacts = checker.c03_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_START_M])
        lifecycle = manifest["lifecycle_contract"]
        self.assertTrue(lifecycle["same_session_reuse_requires_identical_packet_and_baseline"])
        self.assertTrue(lifecycle["runner_session_id_must_equal_requested_session_id"])
        self.assertEqual(self.PRODUCT3, lifecycle["exact_product_paths"])
        self.assertEqual("SEGMENT_AWARE_EXACT_PATH", lifecycle["path_match_mode"])
        self.assertTrue(lifecycle["raw_freeze"]["string_keys_only"])
        self.assertTrue(lifecycle["raw_freeze"]["sets_rejected"])
        self.assertEqual(b'{"a":1,"b":2}', checker.c03_freeze_raw({"b": 2, "a": 1}))
        with self.assertRaisesRegex(ValueError, "C03_RAW_KEY_NOT_STRING"):
            checker.c03_freeze_raw({1: "bad"})
        with self.assertRaisesRegex(ValueError, "C03_RAW_UNSUPPORTED_TYPE"):
            checker.c03_freeze_raw({"bad": {"nondeterministic"}})

    def test_seq740_validator_rejects_state_contract_and_historical_mutation(self):
        checker = self._checker()
        artifacts = checker.c03_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_START_M])
        original_read_bytes = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in artifacts:
                return artifacts[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c03_start_projection(self._bundle(checker, artifacts), manifest))
            for label, mutate in (
                ("session", lambda value: value["lifecycle_contract"].update(runner_session_id_must_equal_requested_session_id=False)),
                ("prefix", lambda value: value["lifecycle_contract"].update(path_match_mode="STRING_PREFIX")),
                ("raw", lambda value: value["lifecycle_contract"]["raw_freeze"].update(sets_rejected=False)),
                ("scope", lambda value: value["lifecycle_contract"].update(exact_product_paths=["packages_evil/orchestration.py"])),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest)
                    mutate(changed)
                    self.assertTrue(checker.validate_c03_start_projection(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C03_START_E].replace(
            b'"event_id": "evt_g05_legacy_migration"', b'"event_id": "xvt_g05_legacy_migration"', 1
        )

        def mutated_history(path):
            if path == ROOT / checker.C03_START_E:
                return mutated
            return frozen(path)

        with mock.patch.object(Path, "read_bytes", mutated_history):
            errors = checker.validate_c03_start_projection(self._bundle(checker, artifacts), manifest)
        self.assertIn("C03_START_HISTORY_MUTATED", errors)

    def test_seq740_git_and_dispatch_are_fail_closed(self):
        checker = self._checker()
        meta = checker.c03_start_projection_metadata()
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("remote", "get-url", "development"): checker.C03_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C03_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "development/main",
            status_key: "\n".join("M  " + path for path in self.EXACT12),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT12),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: common.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in {("diff", "--cached", "--check")}
        ):
            self.assertEqual([], checker._collect_c03_start_projection_git(bundle))
            common[("diff", "--cached", "--name-only")] = "\n".join(self.EXACT12[:-1])
            self.assertTrue(checker._collect_c03_start_projection_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 740}}
        with mock.patch.object(checker, "_collect_c03_start_projection_git", return_value=["SEQ740_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c02_postmerge_development_authority_reconciliation_git", side_effect=AssertionError("seq737 must not run")
        ):
            self.assertEqual(["SEQ740_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C03ControlR2Tests(unittest.TestCase):
    BASE = "2dcd4da89e92425be52b570ae2110f60dfcc29de"
    DEVELOPMENT_MAIN = "1c3948ff1a741832a2f012f464f1a301490356c1"
    PRODUCT_BRANCH = "codex/c03-developer-lifecycle-r1"
    EXACT12 = sorted([
        "docs/04_test_reports/C-03_CONTROL_R2_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-03_CONTROL_R2_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c03-control-r2.json",
        "docs/validation/C-03_CONTROL_R2_VALIDATION.md",
        "docs/work_orders/C-03_INVOCATION_PROMPT.md",
        "docs/work_orders/C-03_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT4 = [
        "packages/orchestration/developer_lifecycle.py",
        "packages/orchestration/__init__.py",
        "tests/orchestration/test_developer_lifecycle.py",
        "packages/e2e/harness.py",
    ]

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c03_control_r2_from_root"), "C-03 R2 builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C03_R2_P]),
            "events": json.loads(artifacts[checker.C03_R2_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C03_R2_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C03_R2_D]),
        }

    def test_seq743_builder_preserves_seq740_and_reissues_only_write_lease(self):
        checker = self._checker()
        first = checker.c03_control_r2_from_root(ROOT)
        self.assertEqual(first, checker.c03_control_r2_from_root(ROOT))
        self.assertEqual(set(self.EXACT12), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.BASE}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 740),
            checker.raw_event_object_prefix_bytes(first[checker.C03_R2_E], 740),
        )
        progress = json.loads(first[checker.C03_R2_P])
        events = json.loads(first[checker.C03_R2_E])["events"]
        manifest = json.loads(first[checker.C03_R2_M])
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WRITE_LEASE_ISSUED", "PACKAGE_RESUMED"],
            [event["event_type"] for event in events[-3:]],
        )
        self.assertEqual((741, 742, 743), tuple(event["sequence"] for event in events[-3:]))
        self.assertEqual(checker.C03_START_WORKER_LEASE_ID, progress["worker_lease"]["lease_id"])
        self.assertEqual(2, progress["write_lease"]["write_epoch"])
        self.assertEqual(self.PRODUCT4, progress["write_lease"]["path_scope"])
        self.assertEqual("REVOKED_SUPERSEDED_BY_WI_R2", progress["retired_c03_r1_write_lease"]["status"])
        self.assertEqual(
            ("C-03", "IN_PROGRESS", {"package_id": "C-04", "status": "NOT_READY"}),
            (progress["current_work_package"], progress["status"], progress["next_work_package"]),
        )
        self.assertEqual("NOT_REACHED", progress["c03_control_r2"]["dir2_status"])
        self.assertEqual(["packages/e2e/harness.py"], manifest["revision_binding"]["scope_added"])
        self.assertEqual("UNCHANGED", manifest["revision_binding"]["functional_scope_change"])
        self.assertEqual("UNCHANGED", manifest["revision_binding"]["important_risk_change"])
        self.assertEqual("INVALIDATED_BY_WI_CONTENT_HASH_CHANGE", manifest["revision_binding"]["prior_binding_status"])

    def test_seq743_contract_limits_harness_to_ordered_takeover_compatibility(self):
        checker = self._checker()
        artifacts = checker.c03_control_r2_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_R2_M])
        compatibility = manifest["compatibility_contract"]
        self.assertEqual("SyntheticE2EHarness.record_takeover", compatibility["only_symbol"])
        self.assertEqual(["START", "WAIT_OR_PUBLIC_STATE_TRANSITION", "STOP"], compatibility["required_order"])
        self.assertEqual("FORBIDDEN", compatibility["lifecycle_caller_exception"])
        self.assertEqual("FORBIDDEN", compatibility["other_e2e_changes"])
        self.assertEqual(self.PRODUCT4, manifest["product_write_scope"])

    def test_seq743_validator_rejects_revision_scope_and_history_mutation(self):
        checker = self._checker()
        artifacts = checker.c03_control_r2_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_R2_M])
        original_read_bytes = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in artifacts:
                return artifacts[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c03_control_r2(self._bundle(checker, artifacts), manifest))
            for label, mutate in (
                ("approval", lambda value: value["revision_binding"].update(parent_human_approval_id="invented")),
                ("scope", lambda value: value["revision_binding"].update(scope_added=["tests/e2e/test_takeover.py"])),
                ("risk", lambda value: value["revision_binding"].update(important_risk_change="EXPANDED")),
                ("caller exception", lambda value: value["compatibility_contract"].update(lifecycle_caller_exception="ALLOWED")),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest)
                    mutate(changed)
                    self.assertTrue(checker.validate_c03_control_r2(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C03_R2_E].replace(
            b'"event_id": "evt_g05_legacy_migration"', b'"event_id": "xvt_g05_legacy_migration"', 1
        )

        def mutated_history(path):
            if path == ROOT / checker.C03_R2_E:
                return mutated
            return frozen(path)

        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn(
                "C03_R2_HISTORY_MUTATED",
                checker.validate_c03_control_r2(self._bundle(checker, artifacts), manifest),
            )

    def test_seq743_git_accepts_detached_precommit_and_exact_direct_child_product_branch(self):
        checker = self._checker()
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C03_R2_DEVELOPMENT_URL,
            ("rev-parse", checker.C03_R2_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.BASE): self.BASE,
            ("show", "-s", "--format=%P", self.BASE): self.DEVELOPMENT_MAIN,
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c03_control_r2_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): "",
            status_key: "\n".join("M  " + path for path in self.EXACT12),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT12),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        lineage = {("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.BASE)}
        self.assertEqual([], run(pre, lineage | {("diff", "--cached", "--check")}))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT12[:-1])}, lineage | {("diff", "--cached", "--check")}))

        child = "a" * 40
        post = common | {
            ("rev-parse", "HEAD"): child,
            ("branch", "--show-current"): self.PRODUCT_BRANCH,
            ("show", "-s", "--format=%P", child): self.BASE,
            ("diff", "--name-only", self.BASE, child): "\n".join(self.EXACT12),
            status_key: "",
        }
        post_checks = lineage | {
            ("merge-base", "--is-ancestor", self.BASE, child),
            ("diff", "--check", self.BASE, child),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {("branch", "--show-current"): "codex/unrelated"}, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", child): f"{self.BASE} {'b' * 40}"}, post_checks))

        dispatch = {"_root": ROOT, "progress": {"event_sequence": 743}}
        with mock.patch.object(checker, "_collect_c03_control_r2_git", return_value=["SEQ743_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c03_start_projection_git", side_effect=AssertionError("seq740 must not run")
        ):
            self.assertEqual(["SEQ743_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C03FinalAcceptanceProjectionTests(unittest.TestCase):
    PRODUCT = "219eedd7adf287c55818eab930d6a665a2fc0980"
    CONTROL_R2 = "e778a0c0d4152a7e164e2f016994595dee4b7274"
    START = "2dcd4da89e92425be52b570ae2110f60dfcc29de"
    DEVELOPMENT_MAIN = "1c3948ff1a741832a2f012f464f1a301490356c1"
    BRANCH = "codex/c03-developer-lifecycle-r1"
    EXACT15 = sorted([
        "docs/04_test_reports/C-03_FINAL_ACCEPTANCE_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/completion_reports/C-03_completion.md",
        "docs/evidence/manifests/C-03_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/evidence/raw/C-03_DEVELOPER_LIFECYCLE_EVIDENCE.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c03-final-acceptance.json",
        "docs/test_reports/C-03_INDEPENDENT_TEST_REPORT.md",
        "docs/validation/C-03_FINAL_ACCEPTANCE_VALIDATION.md",
        "docs/work_orders/C-03_FINAL_ACCEPTANCE_PROJECTION_INVOCATION_PROMPT.md",
        "docs/work_orders/C-03_FINAL_ACCEPTANCE_PROJECTION_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT4 = [
        "packages/orchestration/developer_lifecycle.py",
        "packages/orchestration/__init__.py",
        "tests/orchestration/test_developer_lifecycle.py",
        "packages/e2e/harness.py",
    ]

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c03_final_acceptance_from_root"), "C-03 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C03_FINAL_P]),
            "events": json.loads(artifacts[checker.C03_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C03_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C03_FINAL_D]),
        }

    def test_seq748_builder_preserves_seq743_and_accepts_c03(self):
        checker = self._checker()
        first = checker.c03_final_acceptance_from_root(ROOT)
        self.assertEqual(first, checker.c03_final_acceptance_from_root(ROOT))
        self.assertEqual(set(self.EXACT15), set(first))
        prior = subprocess.check_output(
            ["git", "show", f"{self.PRODUCT}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(prior, 743),
            checker.raw_event_object_prefix_bytes(first[checker.C03_FINAL_E], 743),
        )
        progress = json.loads(first[checker.C03_FINAL_P])
        events = json.loads(first[checker.C03_FINAL_E])["events"]
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED", "INDEPENDENT_TEST_JUDGMENT_RECORDED", "MAIN_PACKAGE_ACCEPTED"],
            [event["event_type"] for event in events[-5:]],
        )
        self.assertEqual((744, 745, 746, 747, 748), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual(
            ("C-03", "ACCEPTED", None, None, None, {"package_id": "C-04", "status": "READY_FOR_WORK_INSTRUCTION"}),
            (progress["current_work_package"], progress["status"], progress["active_agent"], progress["worker_lease"], progress["write_lease"], progress["next_work_package"]),
        )
        self.assertEqual("ISSUE_C04_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", progress["c03_final_acceptance"]["dir2_status"])
        self.assertIn("C-03", progress["completed_packages"])

    def test_seq748_evidence_binds_exact_product_tests_reviews_and_external_boundary(self):
        checker = self._checker()
        artifacts = checker.c03_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_FINAL_M])
        raw = json.loads(artifacts[checker.C03_FINAL_RAW])
        self.assertEqual([self.DEVELOPMENT_MAIN, self.START, self.CONTROL_R2, self.PRODUCT], manifest["lineage"]["ancestor_chain"])
        self.assertEqual(self.PRODUCT4, manifest["product_exact_paths"])
        self.assertEqual((241, 78), (raw["tests"]["main_full"]["passed"], raw["tests"]["focused_c03_c04"]["passed"]))
        self.assertEqual((23, 66, 0), (raw["independent_acceptance"]["nodes"], raw["independent_acceptance"]["cases"], raw["independent_acceptance"]["external_io_count"]))
        self.assertEqual({"critical": 0, "important": 4, "minor": 1}, raw["reviews"]["product_initial"]["findings"])
        self.assertEqual("ADDRESSED", raw["reviews"]["product_round1"]["disposition"])
        self.assertEqual({"critical": 0, "important": 0, "minor": 0}, raw["reviews"]["product_round2"]["findings"])
        self.assertEqual("ADDRESSED", raw["reviews"]["product_round2"]["new_findings_disposition"])
        self.assertEqual({"critical": 0, "important": 0, "minor": 0}, raw["reviews"]["control_r2"]["findings"])
        self.assertTrue(all(value == "NOT_EXECUTED" for value in manifest["external_validation"].values()))

    def test_seq748_independent_evidence_is_self_contained_and_recoverable(self):
        checker = self._checker()
        artifacts = checker.c03_final_acceptance_from_root(ROOT)
        raw = json.loads(artifacts[checker.C03_FINAL_RAW])
        trace = raw["independent_trace"]
        self.assertEqual(
            "D:\\tmp\\anvil-main-integration\\.venv\\Scripts\\python.exe "
            "D:\\tmp\\anvil-c03-independent-evidence-r2\\c03_independent_acceptance.py",
            trace["result"]["content"]["exact_command"],
        )
        self.assertEqual((43781, "5027C870EAE6D573ECF8C35FA9641179C85E44DDF92572F05A3012D74B5F6487"),
                         (trace["harness"]["bytes"], trace["harness"]["sha256"]))
        self.assertEqual((52027, "773B9F38677C254CC312A3FF424137245459987ECB8A96B6516987F8166575AB"),
                         (trace["result"]["bytes"], trace["result"]["sha256"]))
        self.assertEqual((23, 66), (len(trace["result"]["content"]["nodes"]), len(trace["result"]["content"]["cases"])))
        self.assertEqual("SUPERSEDED", trace["result"]["content"]["supersedes"]["disposition"])
        self.assertFalse(trace["result"]["content"]["evidence_finalizer"]["executed"])
        self.assertEqual([], checker._validate_c03_independent_trace(trace))

    def test_seq748_rejects_independent_evidence_omission_or_tampering(self):
        checker = self._checker()
        trace = json.loads(checker.c03_final_acceptance_from_root(ROOT)[checker.C03_FINAL_RAW])["independent_trace"]
        def finding(value, fingerprint):
            return next(row for row in value["result"]["content"]["findings"] if row["fingerprint"] == fingerprint)
        mutations = {
            "harness": lambda value: value["harness"].pop("canonical_bytes_base64"),
            "cases": lambda value: value["result"]["content"]["cases"].pop(),
            "git_raw": lambda value: value["result"]["content"]["git"]["pre"]["rev_parse_head"].update(stdout="tampered\n"),
            "io": lambda value: value["result"]["content"]["io_spy"]["subject_counts"].update(network=1),
            "raw_artifact": lambda value: value["result"].update(canonical_bytes_base64="AA=="),
            "finding": lambda value: value["result"]["content"]["findings"].pop(),
            "finding_id_swap": lambda value: finding(value, "C03-FROZEN-PAYLOAD-REENVELOPE-v1").update(fingerprint="C03-FROZEN-PAYLOAD-REENVELOPE-v2"),
            "cause_mismatch": lambda value: finding(value, "C03-FROZEN-PAYLOAD-REENVELOPE-v1").update(cause="wrong cause"),
            "fix_mismatch": lambda value: finding(value, "C03-AMBIGUOUS-START-UNTRACKED-v1").update(product_fix="wrong fix"),
            "node_mismatch": lambda value: finding(value, "C03-CHILD-ACTION-AUTHORITY-NOT-CONSUMED-v1")["revalidation_node_ids"].append("C03-NODE-09"),
            "i2_dual_path_missing": lambda value: finding(value, "C03-LIFECYCLE-LINEARIZATION-RACE-v1")["required_paths"].pop(),
            "stop_nodes_missing": lambda value: finding(value, "C03-STOP-DELIVERY-FAILURE-UNRETRYABLE-v1")["revalidation_node_ids"].pop(),
        }
        for label, mutate in mutations.items():
            with self.subTest(label=label):
                changed = copy.deepcopy(trace)
                mutate(changed)
                self.assertTrue(checker._validate_c03_independent_trace(changed))

    def test_seq748_validator_rejects_evidence_state_and_history_mutation(self):
        checker = self._checker()
        artifacts = checker.c03_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C03_FINAL_M])
        original_read_bytes = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original_read_bytes(path)
            if relative in artifacts:
                return artifacts[relative]
            return original_read_bytes(path)

        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c03_final_acceptance(self._bundle(checker, artifacts), manifest))
            for label, mutate in (
                ("product", lambda value: value.update(product_commit="0" * 40)),
                ("tests", lambda value: value["test_evidence"].update(main_full_passed=240)),
                ("review", lambda value: value["review_evidence"]["product_round2"].update(important_findings=1)),
                ("external", lambda value: value["external_validation"].update(provider="PASS")),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest)
                    mutate(changed)
                    self.assertTrue(checker.validate_c03_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C03_FINAL_E].replace(
            b'"event_id": "evt_g05_legacy_migration"', b'"event_id": "xvt_g05_legacy_migration"', 1
        )

        def mutated_history(path):
            if path == ROOT / checker.C03_FINAL_E:
                return mutated
            return frozen(path)

        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C03_FINAL_HISTORY_MUTATED", checker.validate_c03_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq748_git_accepts_precommit_child_reviewed_merge_and_detached_main(self):
        checker = self._checker()
        completion = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C03_FINAL_DEVELOPMENT_URL,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("rev-parse", checker.C03_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("show", "-s", "--format=%P", self.PRODUCT): self.CONTROL_R2,
            ("show", "-s", "--format=%P", self.CONTROL_R2): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
        }
        lineage = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.CONTROL_R2),
            ("merge-base", "--is-ancestor", self.CONTROL_R2, self.PRODUCT),
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c03_final_acceptance_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            status_key: "\n".join("M  " + path for path in self.EXACT15),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT15),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        self.assertEqual([], run(pre, lineage | {("diff", "--cached", "--check")}))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT15[:-1])}, lineage | {("diff", "--cached", "--check")}))

        post = common | {
            ("rev-parse", "HEAD"): completion,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT15),
            status_key: "",
        }
        post_checks = lineage | {("merge-base", "--is-ancestor", self.PRODUCT, completion), ("diff", "--check", self.PRODUCT, completion)}
        self.assertEqual([], run(post, post_checks))

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C03_FINAL_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): "development/main",
            ("show", "-s", "--format=%P", merged): f"{self.DEVELOPMENT_MAIN} {completion}",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT15),
            ("diff", "--name-only", self.PRODUCT, merged): "\n".join(self.EXACT15),
            status_key: "",
        }
        merge_checks = lineage | {
            ("merge-base", "--is-ancestor", self.PRODUCT, completion),
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--check", self.PRODUCT, completion),
            ("diff", "--check", self.PRODUCT, merged),
            ("diff", "--quiet", completion, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{completion} {self.DEVELOPMENT_MAIN}"}, merge_checks))
        detached = merge | {("branch", "--show-current"): ""}
        self.assertEqual([], run(detached, merge_checks))

        dispatch = {"_root": ROOT, "progress": {"event_sequence": 748}}
        with mock.patch.object(checker, "_collect_c03_final_acceptance_git", return_value=["SEQ748_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c03_control_r2_git", side_effect=AssertionError("seq743 must not run")
        ):
            self.assertEqual(["SEQ748_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C04StartProjectionTests(unittest.TestCase):
    BASE = "028765cea128c73fb2404e6cefefce12175cb9f4"
    EXACT12 = sorted([
        "docs/04_test_reports/C-04_START_PROJECTION_REPORT.md",
        "docs/WORK_STATUS.md",
        "docs/evidence/manifests/C-04_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c04-start.json",
        "docs/validation/C-04_START_VALIDATION.md",
        "docs/work_orders/C-04_INVOCATION_PROMPT.md",
        "docs/work_orders/C-04_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        loaded = _load_checker_or_none()
        self.assertIsNotNone(loaded)
        self.assertTrue(hasattr(loaded, "c04_start_projection_from_root"))
        return loaded

    def test_c04_start_materialization_is_deterministic_and_exact(self):
        checker = self._checker()
        generated = checker.c04_start_projection_from_root(ROOT)
        self.assertEqual(self.EXACT12, sorted(generated))
        self.assertEqual(generated, checker.c04_start_projection_from_root(ROOT))
        progress = json.loads(generated[checker.C04_START_P])
        events = json.loads(generated[checker.C04_START_E])["events"]
        self.assertEqual(751, progress["event_sequence"])
        self.assertEqual("C-04", progress["current_work_package"])
        self.assertEqual("IN_PROGRESS", progress["status"])
        self.assertEqual({"package_id": "C-05", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual(["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"], [e["event_type"] for e in events[-3:]])
        self.assertEqual("developer-primary", progress["worker_lease"]["actor_id"])
        self.assertEqual(2, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(3, progress["write_lease"]["write_epoch"])
        self.assertEqual(checker.c04_start_product_write_scope(), progress["write_lease"]["path_scope"])

    def test_c04_contract_is_fail_closed_and_boundary_truthful(self):
        checker = self._checker()
        generated = checker.c04_start_projection_from_root(ROOT)
        manifest = json.loads(generated[checker.C04_START_M])
        contract = manifest["lifecycle_contract"]
        self.assertEqual("SEGMENT_AWARE_EXACT_IDENTITY", contract["path_match_mode"])
        self.assertTrue(contract["human_input_priority"])
        self.assertTrue(contract["terminal_observation_preserved"])
        self.assertEqual(3, contract["crash_recreate_cycles"])
        self.assertEqual(["GET", "STEER", "CANCEL", "RESUME"], contract["canonical_delegation_operations"])
        self.assertEqual("DEFERRED_U02", manifest["external_validation"]["browser"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["provider"])
        mutated = copy.deepcopy(manifest)
        mutated["lifecycle_contract"]["human_input_priority"] = False
        with mock.patch.object(checker, "c04_start_projection_from_root", return_value=generated):
            bundle = checker.load_bundle(ROOT)
            self.assertIn("C04_START_PROJECTION_INVALID", checker.validate_c04_start_projection(bundle, mutated))

    def test_c04_preserves_seq748_raw_prefix_and_dispatches_first(self):
        checker = self._checker()
        generated = checker.c04_start_projection_from_root(ROOT)
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C04_START_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 748), checker.raw_event_object_prefix_bytes(generated[checker.C04_START_E], 748))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 751}}
        with mock.patch.object(checker, "_collect_c04_start_projection_git", return_value=["SEQ751_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c03_final_acceptance_git", side_effect=AssertionError("seq748 must not run")
        ):
            self.assertEqual(["SEQ751_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)

    def test_c04_git_predicate_accepts_exact_precommit_and_sole_child_only(self):
        checker = self._checker()
        generated = checker.c04_start_projection_from_root(ROOT)
        bundle = {"_root": ROOT, "progress": json.loads(generated[checker.C04_START_P])}
        self.assertIn("C04_START_PATH_OR_CLEAN_INVALID", checker._collect_c04_start_projection_git(bundle))
        completion = "a" * 40
        rows = {
            ("rev-parse", "HEAD"): completion,
            ("branch", "--show-current"): checker.C04_START_BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "",
            ("remote", "get-url", "development"): checker.C04_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C04_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
            ("show", "-s", "--format=%P", completion): self.BASE,
            ("diff", "--name-only", self.BASE, completion): "\n".join(self.EXACT12),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{checker.C04_START_BRANCH}"): f"development/{checker.C04_START_BRANCH}",
        }

        def raw(_root, *args):
            if args == ("rev-parse", "--path-format=absolute", "--git-path", "info/exclude"):
                return "D:/Project/Anvil/.git/info/exclude\n"
            if args[:2] == ("-c", "core.excludesFile=D:/Project/Anvil/.git/info/exclude"):
                return rows.get(args[2:], "")
            return None

        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=raw), mock.patch.object(
            checker, "_c02_git_quiet_check", return_value=True
        ):
            self.assertEqual([], checker._collect_c04_start_projection_git(bundle))
            rows[("show", "-s", "--format=%P", completion)] = "b" * 40
            self.assertIn("C04_START_PATH_OR_CLEAN_INVALID", checker._collect_c04_start_projection_git(bundle))

    def test_c04_start_git_collector_treats_detached_empty_branch_as_collected(self):
        checker = self._checker()
        bundle = {
            "_root": ROOT,
            "progress": {"repository": {"validated_base_commit": checker.C04_START_BASE}},
        }
        with tempfile.TemporaryDirectory() as tmp:
            exclude_path = Path(tmp) / "exclude"
            exclude_path.write_text("", encoding="utf-8")
            rows = {
                ("rev-parse", "HEAD"): checker.C04_START_BASE,
                ("branch", "--show-current"): "",
                ("status", "--porcelain", "--untracked-files=all"): "",
                ("remote", "get-url", "development"): checker.C04_START_DEVELOPMENT_URL,
                ("rev-parse", checker.C04_START_DEVELOPMENT_REF): checker.C04_START_BASE,
                ("rev-parse", checker.C04_START_BASE): checker.C04_START_BASE,
                ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{checker.C04_START_BRANCH}"): checker.C04_START_DEVELOPMENT_REF,
                ("diff", "--cached", "--name-only"): "\n".join(self.EXACT12),
                ("diff", "--name-only"): "",
                ("ls-files", "--others", "--exclude-standard"): "",
            }

            def raw(_root, *args):
                if args == ("rev-parse", "--path-format=absolute", "--git-path", "info/exclude"):
                    return f"{exclude_path}\n"
                if args[:2] == ("-c", f"core.excludesFile={exclude_path}"):
                    return rows.get(args[2:], "")
                return None

            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=raw), mock.patch.object(
                checker, "_c02_git_quiet_check", return_value=True
            ):
                self.assertEqual(
                    ["C04_START_PATH_OR_CLEAN_INVALID"],
                    checker._collect_c04_start_projection_git(bundle),
                )


class C04FinalAcceptanceProjectionTests(unittest.TestCase):
    PRODUCT = "9e7248320aeaf465debd176354c4fad82f97c35c"
    START = "be827a302b08ab0365dff2977c951e1005d30fe8"
    DEVELOPMENT_MAIN = "028765cea128c73fb2404e6cefefce12175cb9f4"
    BRANCH = "codex/c04-steer-resume-r1"
    EXACT7 = sorted([
        "docs/evidence/manifests/C-04_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c04-final-acceptance.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c04_final_acceptance_from_root"), "C-04 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C04_FINAL_P]),
            "events": json.loads(artifacts[checker.C04_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C04_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C04_FINAL_D]),
        }

    def test_seq756_builder_is_exact_append_only_and_accepts_c04(self):
        checker = self._checker()
        artifacts = checker.c04_final_acceptance_from_root(ROOT)
        self.assertEqual(artifacts, checker.c04_final_acceptance_from_root(ROOT))
        self.assertEqual(self.EXACT7, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.PRODUCT}:{checker.C04_FINAL_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(historical, 751), checker.raw_event_object_prefix_bytes(artifacts[checker.C04_FINAL_E], 751))
        progress = json.loads(artifacts[checker.C04_FINAL_P])
        events = json.loads(artifacts[checker.C04_FINAL_E])["events"]
        self.assertEqual((752, 753, 754, 755, 756), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED", "INDEPENDENT_TEST_JUDGMENT_RECORDED", "MAIN_PACKAGE_ACCEPTED"],
            [event["event_type"] for event in events[-5:]],
        )
        self.assertEqual(("C-04", "ACCEPTED", None, None, None), (progress["current_work_package"], progress["status"], progress["active_agent"], progress["worker_lease"], progress["write_lease"]))
        self.assertEqual({"package_id": "C-05", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C05_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", progress["c04_final_acceptance"]["dir2_status"])

    def test_seq756_manifest_binds_product_evidence_reviews_and_truthful_boundary(self):
        checker = self._checker()
        artifacts = checker.c04_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C04_FINAL_M])
        self.assertEqual([self.DEVELOPMENT_MAIN, self.START, self.PRODUCT], manifest["lineage"]["ancestor_chain"])
        self.assertEqual(checker.c04_start_product_write_scope(), manifest["product_exact_paths"])
        self.assertEqual((460, 460), (manifest["test_evidence"]["main_precommit"]["passed"], manifest["test_evidence"]["main_postcommit"]["passed"]))
        self.assertEqual({"spec": "PASS", "quality": "APPROVED", "critical": 0, "important": 0, "minor": 0}, manifest["final_reviewer_r6"])
        self.assertEqual((45, 353, 0), (manifest["independent_acceptance_r6"]["nodes"], manifest["independent_acceptance_r6"]["cases"], manifest["independent_acceptance_r6"]["external_io_count"]))
        self.assertEqual("7950C856DDA2287638DF6D4756AE0138AECDF19F79D1F246BD8B293BC729CA70", manifest["independent_acceptance_r6"]["artifact_manifest_sha256"])
        fingerprints = {row["fingerprint"] for row in manifest["non_product_tool_errors"]}
        self.assertTrue({"C04_START_PATH_OR_CLEAN_INVALID", "POWERSHELL_SELECT_STRING_DOLLAR_QUESTION_FALSE_POSITIVE", "MAIN_COORDINATION_SEND_MESSAGE_SCHEMA_PARSE", "C03_START_WORK_INSTRUCTION_HASH_INVALID"}.issubset(fingerprints))
        broad = manifest["test_evidence"]["broad_tooling_non_authoritative"]
        self.assertEqual((366, 3, "PRE_EXISTING_C03_HISTORICAL_FIXTURE_DRIFT_OUTSIDE_C04_SCOPE"), (broad["passed"], broad["failed"], broad["classification"]))
        self.assertEqual("DEFERRED_U02", manifest["external_validation"]["browser"])
        for key in ("ui", "fastapi_binding", "database", "external_developer_backend", "provider", "telegram", "wsl", "deployment", "network"):
            self.assertEqual("NOT_EXECUTED", manifest["external_validation"][key])

    def test_seq756_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c04_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C04_FINAL_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c04_final_acceptance(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest); changed["product_commit"] = "0" * 40
            self.assertIn("C04_FINAL_PROJECTION_INVALID", checker.validate_c04_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C04_FINAL_E].replace(b'"event_id": "evt_g05_legacy_migration"', b'"event_id": "xvt_g05_legacy_migration"', 1)
        def mutated_history(path):
            if path == ROOT / checker.C04_FINAL_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C04_FINAL_HISTORY_MUTATED", checker.validate_c04_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq756_git_accepts_exact_precommit_and_binds_direct_lineage(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        completion = "a" * 40
        rows = {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT7),
            ("remote", "get-url", "development"): checker.C04_FINAL_DEVELOPMENT_URL,
            ("rev-parse", checker.C04_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.START, self.PRODUCT): "\n".join(checker.c04_start_product_write_scope()),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT7),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        checks = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.PRODUCT),
            ("diff", "--cached", "--check"),
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks):
            self.assertEqual([], checker._collect_c04_final_acceptance_git(bundle))
            rows[("show", "-s", "--format=%P", self.PRODUCT)] = "b" * 40
            self.assertIn("C04_FINAL_GIT_LINEAGE_INVALID", checker._collect_c04_final_acceptance_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 756}}
        with mock.patch.object(checker, "_collect_c04_final_acceptance_git", return_value=["SEQ756_SELECTED"]) as selected, mock.patch.object(checker, "_collect_c04_start_projection_git", side_effect=AssertionError("seq751 must not run")):
            self.assertEqual(["SEQ756_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C04DetachedSmokePortabilityReconciliationTests(unittest.TestCase):
    FIX = "1cc8f2803a362b01f294590dacf173dd4e98f60a"
    MERGED_MAIN = "36cf22d41d260e0d3275bc231bb67a4a8f0b6a11"
    FEATURE_ACCEPTANCE = "d70e149edd99d3a09073970d913288ca4ab44d9c"
    DEVELOPMENT_MAIN = "028765cea128c73fb2404e6cefefce12175cb9f4"
    BRANCH = "codex/c04-detached-smoke-portability-r1"
    FIX_PATHS = sorted([
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    EXACT9 = sorted([
        "docs/04_test_reports/C-04_DETACHED_SMOKE_PORTABILITY_RECONCILIATION_RESULT.md",
        "docs/evidence/manifests/C-04_DETACHED_SMOKE_PORTABILITY_RECONCILIATION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c04-detached-smoke-portability-reconciliation.json",
        "docs/validation/C-04_DETACHED_SMOKE_PORTABILITY_RECONCILIATION_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(
            hasattr(checker, "c04_detached_smoke_portability_reconciliation_from_root"),
            "C-04 portability reconciliation builder missing",
        )
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C04_PORTABILITY_P]),
            "events": json.loads(artifacts[checker.C04_PORTABILITY_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C04_PORTABILITY_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C04_PORTABILITY_D]),
        }

    def test_seq757_builder_is_exact_deterministic_and_preserves_seq756_raw_objects(self):
        checker = self._checker()
        first = checker.c04_detached_smoke_portability_reconciliation_from_root(ROOT)
        self.assertEqual(first, checker.c04_detached_smoke_portability_reconciliation_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(first))
        historical = subprocess.check_output(
            ["git", "show", f"{self.FIX}:docs/progress/progress-events.json"], cwd=ROOT
        )
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 756),
            checker.raw_event_object_prefix_bytes(first[checker.C04_PORTABILITY_E], 756),
        )
        progress = json.loads(first[checker.C04_PORTABILITY_P])
        events = json.loads(first[checker.C04_PORTABILITY_E])["events"]
        manifest = json.loads(first[checker.C04_PORTABILITY_M])
        self.assertEqual((757, "REPOSITORY_RECONCILED"), (events[-1]["sequence"], events[-1]["event_type"]))
        self.assertEqual(
            ("C-04", "ACCEPTED", None, None, None),
            (progress["current_work_package"], progress["status"], progress["active_agent"], progress["worker_lease"], progress["write_lease"]),
        )
        self.assertEqual({"package_id": "C-05", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C05_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", manifest["dir2_status"])
        self.assertEqual("MAIN_INTERNAL_TECHNICAL_CORRECTION", manifest["authority_classification"])
        self.assertEqual(self.FIX_PATHS, manifest["lineage"]["fix_exact_paths"])
        rows = {row["path"]: row for row in manifest["raw_checksums"]}
        self.assertEqual(set(self.EXACT9) - {checker.C04_PORTABILITY_M}, set(rows))
        for path, row in rows.items():
            self.assertEqual(len(first[path]), row["bytes"])
            self.assertEqual(hashlib.sha256(first[path]).hexdigest().upper(), row["sha256"])

    def test_seq757_projection_rejects_history_state_lineage_and_checksum_mutations(self):
        checker = self._checker()
        artifacts = checker.c04_detached_smoke_portability_reconciliation_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C04_PORTABILITY_M])
        original = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)

        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c04_detached_smoke_portability_reconciliation(self._bundle(checker, artifacts), manifest))
            for label, mutate in (
                ("c04", lambda bundle: bundle["progress"].update(status="BLOCKED")),
                ("c05", lambda bundle: bundle["progress"]["next_work_package"].update(status="ACTIVE")),
                ("lease", lambda bundle: bundle["progress"].update(worker_lease={"status": "ACTIVE"})),
            ):
                with self.subTest(label=label):
                    changed = self._bundle(checker, artifacts); mutate(changed)
                    self.assertTrue(checker.validate_c04_detached_smoke_portability_reconciliation(changed, manifest))
            for label, mutate in (
                ("authority", lambda value: value.update(authority_classification="HUMAN_APPROVAL")),
                ("fix", lambda value: value["lineage"].update(fix_commit="0" * 40)),
                ("paths", lambda value: value["lineage"].update(fix_exact_paths=self.FIX_PATHS[:-1])),
                ("checksum", lambda value: value["raw_checksums"][0].update(sha256="0" * 64)),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest); mutate(changed)
                    self.assertTrue(checker.validate_c04_detached_smoke_portability_reconciliation(self._bundle(checker, artifacts), changed))

        mutated_events = artifacts[checker.C04_PORTABILITY_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C04_PORTABILITY_E:
                return mutated_events
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            errors = checker.validate_c04_detached_smoke_portability_reconciliation(self._bundle(checker, artifacts), manifest)
        self.assertIn("C04_PORTABILITY_HISTORY_MUTATED", errors)
        self.assertIn("C04_PORTABILITY_RAW_BYTES_INVALID", errors)

    def test_seq757_git_accepts_only_precommit_direct_child_and_reviewed_merge(self):
        checker = self._checker()
        meta = checker.c04_detached_smoke_portability_reconciliation_metadata()
        successor = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C04_PORTABILITY_DEVELOPMENT_URL,
            ("rev-parse", checker.C04_PORTABILITY_DEVELOPMENT_REF): self.MERGED_MAIN,
            ("rev-parse", self.FIX): self.FIX,
            ("rev-parse", self.MERGED_MAIN): self.MERGED_MAIN,
            ("rev-parse", self.FEATURE_ACCEPTANCE): self.FEATURE_ACCEPTANCE,
            ("rev-parse", self.DEVELOPMENT_MAIN): self.DEVELOPMENT_MAIN,
            ("show", "-s", "--format=%P", self.FIX): self.MERGED_MAIN,
            ("show", "-s", "--format=%P", self.MERGED_MAIN): f"{self.DEVELOPMENT_MAIN} {self.FEATURE_ACCEPTANCE}",
            ("diff", "--name-only", self.MERGED_MAIN, self.FIX): "\n".join(self.FIX_PATHS),
        }
        lineage_checks = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.FEATURE_ACCEPTANCE),
            ("merge-base", "--is-ancestor", self.FEATURE_ACCEPTANCE, self.MERGED_MAIN),
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.MERGED_MAIN),
            ("merge-base", "--is-ancestor", self.MERGED_MAIN, self.FIX),
            ("diff", "--quiet", self.FEATURE_ACCEPTANCE, self.MERGED_MAIN),
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.FIX}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c04_detached_smoke_portability_reconciliation_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.FIX,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "",
            status_key: "\n".join("M  " + path for path in self.EXACT9),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        pre_checks = lineage_checks | {("diff", "--cached", "--check")}
        self.assertEqual([], run(pre, pre_checks))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT9[:-1])}, pre_checks))
        self.assertTrue(run(pre | {("show", "-s", "--format=%P", self.FIX): self.FEATURE_ACCEPTANCE}, pre_checks))

        post = common | {
            ("rev-parse", "HEAD"): successor,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            ("show", "-s", "--format=%P", successor): self.FIX,
            ("diff", "--name-only", self.FIX, successor): "\n".join(self.EXACT9),
            status_key: "",
        }
        post_checks = lineage_checks | {
            ("merge-base", "--is-ancestor", self.FIX, successor),
            ("diff", "--check", self.FIX, successor),
        }
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", successor): f"{self.FIX} {'c' * 40}"}, post_checks))

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C04_PORTABILITY_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): "development/main",
            ("show", "-s", "--format=%P", merged): f"{self.MERGED_MAIN} {successor}",
            ("show", "-s", "--format=%P", successor): self.FIX,
            ("diff", "--name-only", self.FIX, successor): "\n".join(self.EXACT9),
            ("diff", "--name-only", self.FIX, merged): "\n".join(self.EXACT9),
            status_key: "",
        }
        merge_checks = lineage_checks | {
            ("merge-base", "--is-ancestor", self.FIX, successor),
            ("merge-base", "--is-ancestor", self.MERGED_MAIN, merged),
            ("diff", "--check", self.FIX, successor),
            ("diff", "--check", self.FIX, merged),
            ("diff", "--quiet", successor, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{successor} {self.MERGED_MAIN}"}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", successor, merged)}))
        self.assertTrue(run(merge | {("diff", "--name-only", self.FIX, merged): self.EXACT9[0]}, merge_checks))
        self.assertEqual([], run(merge | {("branch", "--show-current"): ""}, merge_checks))

    def test_seq757_dispatches_before_seq756(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 757}}
        with mock.patch.object(
            checker,
            "_collect_c04_detached_smoke_portability_reconciliation_git",
            return_value=["SEQ757_SELECTED"],
        ) as selected, mock.patch.object(
            checker,
            "_collect_c04_final_acceptance_git",
            side_effect=AssertionError("seq756 predicate must not run"),
        ):
            self.assertEqual(["SEQ757_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C05StartProjectionTests(unittest.TestCase):
    BASE = "7182e056b577689c77bf26f2c394e7cfa7211129"
    BRANCH = "codex/c05-result-envelope-revalidation-r1"
    PRODUCT_SCOPE = sorted([
        "packages/orchestration/result_envelope.py",
        "packages/orchestration/__init__.py",
        "tests/orchestration/test_result_envelope_c05.py",
    ])
    EXACT11 = sorted([
        "docs/04_test_reports/C-05_START_PROJECTION_REPORT.md",
        "docs/evidence/manifests/C-05_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c05-start.json",
        "docs/validation/C-05_START_VALIDATION.md",
        "docs/work_orders/C-05_INVOCATION_PROMPT.md",
        "docs/work_orders/C-05_WORK_INSTRUCTION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c05_start_projection_from_root"), "C-05 start builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C05_START_P]),
            "events": json.loads(artifacts[checker.C05_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C05_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C05_START_D]),
        }

    def test_seq760_builder_is_exact_deterministic_and_preserves_seq757_raw_objects(self):
        checker = self._checker()
        first = checker.c05_start_projection_from_root(ROOT)
        self.assertEqual(first, checker.c05_start_projection_from_root(ROOT))
        self.assertEqual(self.EXACT11, sorted(first))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C05_START_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 757),
            checker.raw_event_object_prefix_bytes(first[checker.C05_START_E], 757),
        )
        progress = json.loads(first[checker.C05_START_P])
        events = json.loads(first[checker.C05_START_E])["events"]
        self.assertEqual(
            [(758, "WORK_INSTRUCTION_ISSUED"), (759, "WORKER_LEASE_ISSUED"), (760, "WRITE_LEASE_ISSUED")],
            [(event["sequence"], event["event_type"]) for event in events[-3:]],
        )
        self.assertEqual(("C-05", "IN_PROGRESS"), (progress["current_work_package"], progress["status"]))
        self.assertEqual({"package_id": "C-06", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual("DEVELOPER_IMPLEMENT_C05_RESULT_ENVELOPE_R2", progress["next_safe_action"])
        self.assertEqual(self.PRODUCT_SCOPE, sorted(progress["write_lease"]["path_scope"]))

    def test_seq760_contract_and_manifest_fail_closed_without_expanding_c06_or_c07(self):
        checker = self._checker()
        artifacts = checker.c05_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C05_START_M])
        contract = manifest["result_envelope_contract"]
        self.assertEqual(
            ["RESULT_CONTRACT_INCOMPLETE", "TRANSIENT_EXECUTION_ERROR", "CHECKPOINTED_INTERRUPTION"],
            contract["reason_codes"]["INCOMPLETE"],
        )
        self.assertEqual([], contract["reason_codes"]["COMPLETED"])
        self.assertEqual([], contract["reason_codes"]["FAILURE_REPORT"])
        self.assertEqual("REQUIRED", contract["checkpointed_interruption_checkpoint_ref"])
        self.assertEqual("C06", contract["failure_fingerprint_validity_owner"])
        self.assertEqual("C07", contract["transition_owner"])
        self.assertEqual("CANONICAL_NON_EMPTY_TEXT_NO_AD_HOC_REGEX", contract["identifier_authority"])
        self.assertEqual("FORBIDDEN_FAIL_CLOSED", contract["handoff_inline_raw_policy"])
        self.assertEqual("CHECKSUM_BOUND_EVIDENCE_REFS_ONLY", contract["handoff_raw_material_transport"])
        self.assertEqual(
            ["TRANSCRIPT", "TRANSCRIPTS", "STDOUT", "STDERR", "RAW_LOG", "RAW_LOGS", "RAW_TRANSCRIPT", "RAW_TRANSCRIPTS"],
            contract["handoff_forbidden_key_semantics"],
        )
        self.assertEqual(
            "CASE_INSENSITIVE_REMOVE_UNDERSCORE_HYPHEN_WHITESPACE_CONTAINS_RAW_LOG_OR_RAW_TRANSCRIPT",
            contract["handoff_key_match"],
        )
        self.assertEqual(
            {"canonical_json_bytes": 65536, "max_depth": 8, "max_object_keys": 128, "max_array_items": 256, "max_string_utf8_bytes": 16384},
            contract["handoff_bounds"],
        )
        self.assertEqual(
            "FA57250A558B503DBFB0C6CA7AEB72B2E8017B0D8664EEB050ADABC10ECB678E",
            manifest["authority"]["superseded_work_instruction_sha256"],
        )
        self.assertEqual(
            "7201AD35D34371EA4F0D379B64027F68AAE1B262FA70F15D88369E56790C9327",
            manifest["authority"]["superseded_invocation_sha256"],
        )
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("NOT_MUTATED_BY_CONTROL", manifest["external_validation"]["product_code"])
        mutated = copy.deepcopy(manifest)
        mutated["result_envelope_contract"]["transition_owner"] = "C05"
        original = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)

        with mock.patch.object(Path, "read_bytes", frozen), mock.patch.object(
            checker, "c05_start_projection_from_root", return_value=artifacts
        ):
            self.assertIn("C05_START_PROJECTION_INVALID", checker.validate_c05_start_projection(self._bundle(checker, artifacts), mutated))

    def test_seq760_git_accepts_only_exact_precommit_direct_child_and_reviewed_merge(self):
        checker = self._checker()
        successor = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C05_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C05_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c05_start_projection_git(bundle)

        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C05_START_DEVELOPMENT_REF,
            status_key: "\n".join("M  " + path for path in self.EXACT11),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT11),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        self.assertEqual([], run(pre, {("diff", "--cached", "--check")}))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT11[:-1])}, {("diff", "--cached", "--check")}))

        post = common | {
            ("rev-parse", "HEAD"): successor,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): f"development/{self.BRANCH}",
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT11),
            status_key: "",
        }
        post_checks = {("merge-base", "--is-ancestor", self.BASE, successor), ("diff", "--check", self.BASE, successor)}
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", successor): f"{self.BASE} {chr(99) * 40}"}, post_checks))

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C05_START_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): checker.C05_START_DEVELOPMENT_REF,
            ("show", "-s", "--format=%P", merged): f"{self.BASE} {successor}",
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT11),
            ("diff", "--name-only", self.BASE, merged): "\n".join(self.EXACT11),
            status_key: "",
        }
        merge_checks = post_checks | {
            ("merge-base", "--is-ancestor", self.BASE, merged),
            ("diff", "--check", self.BASE, merged),
            ("diff", "--quiet", successor, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{successor} {self.BASE}"}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", successor, merged)}))
        self.assertTrue(run(merge | {("diff", "--name-only", self.BASE, merged): self.EXACT11[0]}, merge_checks))
        self.assertEqual([], run(merge | {("branch", "--show-current"): ""}, merge_checks))

    def test_seq760_dispatches_before_seq757(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"event_sequence": 760}}
        with mock.patch.object(checker, "_collect_c05_start_projection_git", return_value=["SEQ760_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c04_detached_smoke_portability_reconciliation_git", side_effect=AssertionError("seq757 must not run")
        ):
            self.assertEqual(["SEQ760_SELECTED"], checker._validate_git_projection(bundle))
            selected.assert_called_once_with(bundle)


class C05ScopeRevisionProjectionTests(unittest.TestCase):
    BASE = "c62d07327f09280951e591b5d726b0ca5ae5b8ef"
    DEVELOPMENT_MAIN = "7182e056b577689c77bf26f2c394e7cfa7211129"
    BRANCH = "codex/c05-result-envelope-revalidation-r1"
    EXACT9 = sorted([
        "docs/04_test_reports/C-05_SCOPE_REVISION_REPORT.md",
        "docs/evidence/manifests/C-05_SCOPE_REVISION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c05-scope-revision.json",
        "docs/validation/C-05_SCOPE_REVISION_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT4 = sorted([
        "packages/orchestration/result_envelope.py",
        "packages/orchestration/__init__.py",
        "tests/orchestration/test_result_envelope_c05.py",
        "tests/orchestration/test_failure_report_c06.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c05_scope_revision_from_root"), "C-05 scope revision builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C05_SCOPE_P]),
            "events": json.loads(artifacts[checker.C05_SCOPE_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C05_SCOPE_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C05_SCOPE_D]),
        }

    def test_seq763_builder_preserves_seq760_and_reissues_only_write_lease(self):
        checker = self._checker()
        first = checker.c05_scope_revision_from_root(ROOT)
        self.assertEqual(first, checker.c05_scope_revision_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(first))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C05_SCOPE_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 760),
            checker.raw_event_object_prefix_bytes(first[checker.C05_SCOPE_E], 760),
        )
        progress = json.loads(first[checker.C05_SCOPE_P])
        events = json.loads(first[checker.C05_SCOPE_E])["events"]
        self.assertEqual(
            [(761, "WRITE_LEASE_REVOKED"), (762, "WRITE_LEASE_ISSUED"), (763, "PACKAGE_RESUMED")],
            [(event["sequence"], event["event_type"]) for event in events[-3:]],
        )
        self.assertEqual(checker.C05_START_WORKER_LEASE_ID, progress["worker_lease"]["lease_id"])
        self.assertEqual(3, progress["worker_lease"]["lease_epoch"])
        self.assertEqual(5, progress["write_lease"]["write_epoch"])
        self.assertEqual(self.PRODUCT4, sorted(progress["write_lease"]["path_scope"]))
        self.assertEqual("REVOKED_SUPERSEDED_BY_COMPATIBILITY_SCOPE", progress["retired_c05_epoch4_write_lease"]["status"])
        self.assertEqual(("C-05", "IN_PROGRESS", {"package_id": "C-06", "status": "NOT_READY"}),
                         (progress["current_work_package"], progress["status"], progress["next_work_package"]))
        handoff = checker.extract_handoff_summary(first[checker.C05_SCOPE_H].decode())
        self.assertEqual(progress["dir_review"]["status"], handoff["dir_status"])

    def test_seq763_contract_adds_only_c06_fixture_compatibility(self):
        checker = self._checker()
        artifacts = checker.c05_scope_revision_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C05_SCOPE_M])
        binding = manifest["revision_binding"]
        compatibility = manifest["fixture_compatibility_contract"]
        self.assertEqual(["tests/orchestration/test_failure_report_c06.py"], binding["scope_added"])
        self.assertEqual("UNCHANGED", binding["functional_scope_change"])
        self.assertEqual("UNCHANGED", binding["requirement_change"])
        self.assertEqual("UNCHANGED", binding["important_risk_change"])
        self.assertEqual("test_other_result_status_is_never_failure_report", compatibility["only_test"])
        self.assertEqual("ADD_VALID_INCOMPLETE_REASON_CODE", compatibility["only_change"])
        self.assertEqual("FORBIDDEN", compatibility["c06_validator_implementation"])
        self.assertEqual("FORBIDDEN", compatibility["other_c06_changes"])
        self.assertEqual(self.PRODUCT4, sorted(manifest["product_write_scope"]))

    def test_seq763_validator_rejects_scope_epoch_contract_and_history_mutation(self):
        checker = self._checker()
        artifacts = checker.c05_scope_revision_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C05_SCOPE_M])
        original = Path.read_bytes

        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)

        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c05_scope_revision(self._bundle(checker, artifacts), manifest))
            for label, mutate in (
                ("scope", lambda value: value["revision_binding"].update(scope_added=["tests/orchestration/evil.py"])),
                ("epoch", lambda value: value["write_lease"].update(write_epoch=4)),
                ("validator", lambda value: value["fixture_compatibility_contract"].update(c06_validator_implementation="ALLOWED")),
            ):
                with self.subTest(label=label):
                    changed = copy.deepcopy(manifest)
                    mutate(changed)
                    self.assertTrue(checker.validate_c05_scope_revision(self._bundle(checker, artifacts), changed))
        old_marker = bytes.fromhex("226576656e745f6964223a20226576745f6730355f6c65676163795f6d6967726174696f6e22")
        new_marker = bytes.fromhex("226576656e745f6964223a20227876745f6730355f6c65676163795f6d6967726174696f6e22")
        mutated = artifacts[checker.C05_SCOPE_E].replace(old_marker, new_marker, 1)

        def changed_history(path):
            if path == ROOT / checker.C05_SCOPE_E:
                return mutated
            return frozen(path)

        with mock.patch.object(Path, "read_bytes", changed_history):
            self.assertIn("C05_SCOPE_HISTORY_MUTATED", checker.validate_c05_scope_revision(self._bundle(checker, artifacts), manifest))

    def test_seq763_git_accepts_exact_precommit_direct_child_and_reviewed_merge(self):
        checker = self._checker()
        successor = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C05_SCOPE_DEVELOPMENT_URL,
            ("rev-parse", self.BASE): self.BASE,
            ("show", "-s", "--format=%P", self.BASE): self.DEVELOPMENT_MAIN,
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}

        def run(values, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: values.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c05_scope_revision_git(bundle)

        lineage = {("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.BASE)}
        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("rev-parse", checker.C05_SCOPE_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C05_SCOPE_DEVELOPMENT_REF,
            status_key: "\n".join("M  " + path for path in self.EXACT9),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        self.assertEqual([], run(pre, lineage | {("diff", "--cached", "--check")}))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT9[:-1])}, lineage | {("diff", "--cached", "--check")}))

        post = common | {
            ("rev-parse", "HEAD"): successor,
            ("rev-parse", checker.C05_SCOPE_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C05_SCOPE_DEVELOPMENT_REF,
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT9),
            status_key: "",
        }
        post_checks = lineage | {("merge-base", "--is-ancestor", self.BASE, successor), ("diff", "--check", self.BASE, successor)}
        self.assertEqual([], run(post, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", successor): f"{self.BASE} {chr(99) * 40}"}, post_checks))

        cumulative = checker.c05_scope_reviewed_merge_paths()
        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C05_SCOPE_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): checker.C05_SCOPE_DEVELOPMENT_REF,
            ("show", "-s", "--format=%P", merged): f"{self.DEVELOPMENT_MAIN} {successor}",
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT9),
            ("diff", "--name-only", self.DEVELOPMENT_MAIN, merged): "\n".join(cumulative),
            status_key: "",
        }
        merge_checks = post_checks | {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, merged),
            ("merge-base", "--is-ancestor", self.BASE, merged),
            ("diff", "--check", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--quiet", successor, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertEqual([], run(merge | {("branch", "--show-current"): ""}, merge_checks))
        self.assertTrue(run(merge | {("show", "-s", "--format=%P", merged): f"{successor} {self.DEVELOPMENT_MAIN}"}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", successor, merged)}))

        dispatch = {"_root": ROOT, "progress": {"event_sequence": 763}}
        with mock.patch.object(checker, "_collect_c05_scope_revision_git", return_value=["SEQ763_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c05_start_projection_git", side_effect=AssertionError("seq760 must not run")
        ):
            self.assertEqual(["SEQ763_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C05FinalAcceptanceProjectionTests(unittest.TestCase):
    PRODUCT = "695779fda8e4f56a09ff5b7a42c162a35b486c39"
    SCOPE = "79d6d73eec0daebe6969b161afff0c98121b68ae"
    START = "c62d07327f09280951e591b5d726b0ca5ae5b8ef"
    DEVELOPMENT_MAIN = "7182e056b577689c77bf26f2c394e7cfa7211129"
    BRANCH = "codex/c05-result-envelope-revalidation-r1"
    EXACT7 = sorted([
        "docs/evidence/manifests/C-05_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c05-final-acceptance.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c05_final_acceptance_from_root"), "C-05 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C05_FINAL_P]),
            "events": json.loads(artifacts[checker.C05_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C05_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C05_FINAL_D]),
        }

    def test_seq768_builder_is_exact_append_only_and_accepts_c05(self):
        checker = self._checker()
        artifacts = checker.c05_final_acceptance_from_root(ROOT)
        self.assertEqual(artifacts, checker.c05_final_acceptance_from_root(ROOT))
        self.assertEqual(self.EXACT7, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.PRODUCT}:{checker.C05_FINAL_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 763),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C05_FINAL_E], 763),
        )
        progress = json.loads(artifacts[checker.C05_FINAL_P])
        events = json.loads(artifacts[checker.C05_FINAL_E])["events"]
        self.assertEqual(tuple(range(764, 769)), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED",
             "INDEPENDENT_TEST_JUDGMENT_RECORDED", "MAIN_PACKAGE_ACCEPTED"],
            [event["event_type"] for event in events[-5:]],
        )
        self.assertEqual(
            ("C-05", "ACCEPTED", None, None, None),
            (progress["current_work_package"], progress["status"], progress["active_agent"],
             progress["worker_lease"], progress["write_lease"]),
        )
        self.assertEqual({"package_id": "C-06", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C06_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", progress["c05_final_acceptance"]["dir2_status"])

    def test_seq768_manifest_binds_product_review_and_truthful_boundary(self):
        checker = self._checker()
        artifacts = checker.c05_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C05_FINAL_M])
        self.assertEqual(
            [self.DEVELOPMENT_MAIN, self.START, self.SCOPE, self.PRODUCT],
            manifest["lineage"]["ancestor_chain"],
        )
        self.assertEqual(checker.c05_scope_product_write_scope(), manifest["product_exact_paths"])
        self.assertEqual((562, 562), (
            manifest["test_evidence"]["main_precommit"]["passed"],
            manifest["test_evidence"]["main_postcommit"]["passed"],
        ))
        self.assertEqual(
            {"spec": "PASS", "quality": "APPROVED", "critical": 0, "important": 0, "minor": 0},
            manifest["independent_product_review"],
        )
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["provider"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["telegram"])
        hashes = manifest["product_file_sha256"]
        self.assertEqual("794059B98F3F282B4545CCC3CCC618DF69BB34AE482371D09C7E8007095067FA", hashes["packages/orchestration/result_envelope.py"])
        self.assertEqual("2FFEB7822770B2F4D2A4304651944BBDAC84CF7FB791F2E80D95BE82B8C9D20E", hashes["tests/orchestration/test_failure_report_c06.py"])

    def test_seq768_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c05_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C05_FINAL_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c05_final_acceptance(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["product_commit"] = "0" * 40
            self.assertIn("C05_FINAL_PROJECTION_INVALID", checker.validate_c05_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C05_FINAL_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C05_FINAL_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C05_FINAL_HISTORY_MUTATED", checker.validate_c05_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq768_git_accepts_exact_precommit_and_binds_full_lineage(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        rows = {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT7),
            ("remote", "get-url", "development"): checker.C05_FINAL_DEVELOPMENT_URL,
            ("rev-parse", checker.C05_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.SCOPE,
            ("show", "-s", "--format=%P", self.SCOPE): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.SCOPE, self.PRODUCT): "\n".join(checker.c05_scope_product_write_scope()),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C05_FINAL_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT7),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        checks = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.SCOPE),
            ("merge-base", "--is-ancestor", self.SCOPE, self.PRODUCT),
            ("diff", "--cached", "--check"),
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
        ):
            self.assertEqual([], checker._collect_c05_final_acceptance_git(bundle))
            rows[("show", "-s", "--format=%P", self.PRODUCT)] = "b" * 40
            self.assertIn("C05_FINAL_GIT_LINEAGE_INVALID", checker._collect_c05_final_acceptance_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 768}}
        with mock.patch.object(checker, "_collect_c05_final_acceptance_git", return_value=["SEQ768_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c05_scope_revision_git", side_effect=AssertionError("seq763 must not run")
        ):
            self.assertEqual(["SEQ768_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)

    def test_seq768_git_accepts_only_direct_child_or_reviewed_merge(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        completion = "a" * 40
        merged = "c" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C05_FINAL_DEVELOPMENT_URL,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.SCOPE,
            ("show", "-s", "--format=%P", self.SCOPE): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.SCOPE, self.PRODUCT): "\n".join(checker.c05_scope_product_write_scope()),
        }
        lineage = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.SCOPE),
            ("merge-base", "--is-ancestor", self.SCOPE, self.PRODUCT),
        }
        def run(rows, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c05_final_acceptance_git(bundle)

        direct = common | {
            ("rev-parse", "HEAD"): completion,
            ("rev-parse", checker.C05_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            status_key: "",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT7),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C05_FINAL_DEVELOPMENT_REF,
        }
        direct_checks = lineage | {
            ("merge-base", "--is-ancestor", self.PRODUCT, completion),
            ("diff", "--check", self.PRODUCT, completion),
        }
        self.assertEqual([], run(direct, direct_checks))
        self.assertTrue(run(direct | {("show", "-s", "--format=%P", completion): f"{self.PRODUCT} {self.START}"}, direct_checks))

        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C05_FINAL_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            status_key: "",
            ("show", "-s", "--format=%P", merged): f"{self.DEVELOPMENT_MAIN} {completion}",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT7),
            ("diff", "--name-only", self.DEVELOPMENT_MAIN, merged): "\n".join(checker.c05_final_reviewed_merge_paths()),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): checker.C05_FINAL_DEVELOPMENT_REF,
        }
        merge_checks = lineage | {
            ("merge-base", "--is-ancestor", self.PRODUCT, completion),
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--check", self.PRODUCT, completion),
            ("diff", "--check", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--quiet", completion, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertEqual([], run(merge | {("branch", "--show-current"): ""}, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", completion, merged)}))


class C06StartProjectionTests(unittest.TestCase):
    BASE = "042bd4050a3c826996a104b5219f8a1a9ba5a972"
    BRANCH = "codex/c06-failure-report-revalidation-r1"
    EXACT9 = sorted([
        "docs/04_test_reports/C-06_START_PROJECTION_REPORT.md",
        "docs/evidence/manifests/C-06_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c06-start.json",
        "docs/validation/C-06_START_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c06_start_projection_from_root"), "C-06 start builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C06_START_P]),
            "events": json.loads(artifacts[checker.C06_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C06_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C06_START_D]),
        }

    def test_seq771_builder_is_exact_deterministic_and_preserves_history(self):
        checker = self._checker()
        artifacts = checker.c06_start_projection_from_root(ROOT)
        self.assertEqual(artifacts, checker.c06_start_projection_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C06_START_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 768),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C06_START_E], 768),
        )
        progress = json.loads(artifacts[checker.C06_START_P])
        events = json.loads(artifacts[checker.C06_START_E])["events"]
        self.assertEqual((769, 770, 771), tuple(event["sequence"] for event in events[-3:]))
        self.assertEqual(
            ["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"],
            [event["event_type"] for event in events[-3:]],
        )
        self.assertEqual(("C-06", "IN_PROGRESS", "developer-primary"), (
            progress["current_work_package"], progress["status"], progress["active_agent"]["actor_id"]))
        self.assertEqual("ACTIVE", progress["worker_lease"]["status"])
        self.assertEqual("ACTIVE", progress["write_lease"]["status"])
        self.assertEqual({"package_id": "C-07", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual("NOT_REACHED", progress["c06_start_projection"]["dir2_status"])

    def test_seq771_manifest_binds_existing_wi_exact5_and_truth_boundary(self):
        checker = self._checker()
        artifacts = checker.c06_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_START_M])
        self.assertEqual("2CAF6BE8B2AEBB012939363B13C6B44B3BDD5302374C495ED4D034FED662FE57", manifest["work_instruction_sha256"])
        self.assertEqual("BE3E51945F91B4A25DB7617904906D8A68F9FFDC02A56DBF1F4BEF12D5AF1493", manifest["invocation_sha256"])
        self.assertEqual(checker.c06_start_product_write_scope(), manifest["product_exact_paths"])
        self.assertEqual("UNCHANGED", manifest["authority"]["requirements_change"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["provider"])

    def test_seq771_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c06_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_START_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c06_start_projection(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["work_instruction_sha256"] = "0" * 64
            self.assertIn("C06_START_PROJECTION_INVALID", checker.validate_c06_start_projection(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C06_START_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C06_START_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C06_START_HISTORY_MUTATED", checker.validate_c06_start_projection(self._bundle(checker, artifacts), manifest))

    def test_seq771_git_accepts_exact_precommit_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        rows = {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT9),
            ("remote", "get-url", "development"): checker.C06_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C06_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C06_START_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args == ("diff", "--cached", "--check")
        ):
            self.assertEqual([], checker._collect_c06_start_projection_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 771}}
        with mock.patch.object(checker, "_collect_c06_start_projection_git", return_value=["SEQ771_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c05_final_acceptance_git", side_effect=AssertionError("seq768 must not run")
        ):
            self.assertEqual(["SEQ771_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C06ScopeRevisionProjectionTests(unittest.TestCase):
    BASE = "7c719063c31530bc33ffff23fd5d72371ae28057"
    DEVELOPMENT_MAIN = "042bd4050a3c826996a104b5219f8a1a9ba5a972"
    BRANCH = "codex/c06-failure-report-revalidation-r1"
    EXACT9 = sorted([
        "docs/04_test_reports/C-06_SCOPE_REVISION_REPORT.md",
        "docs/evidence/manifests/C-06_SCOPE_REVISION_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c06-scope-revision.json",
        "docs/validation/C-06_SCOPE_REVISION_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT6 = sorted([
        "packages/e2e/harness.py",
        "packages/orchestration/failure_ledger.py",
        "packages/orchestration/failure_report.py",
        "tests/orchestration/test_failure_ledger_c12.py",
        "tests/orchestration/test_failure_report_c06.py",
        "tests/orchestration/test_takeover_c13.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c06_scope_revision_from_root"), "C-06 scope revision builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C06_SCOPE_P]),
            "events": json.loads(artifacts[checker.C06_SCOPE_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C06_SCOPE_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C06_SCOPE_D]),
        }

    def test_seq774_builder_is_exact_append_only_and_reissues_exact6_write_lease(self):
        checker = self._checker()
        artifacts = checker.c06_scope_revision_from_root(ROOT)
        self.assertEqual(artifacts, checker.c06_scope_revision_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C06_SCOPE_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 771),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C06_SCOPE_E], 771),
        )
        progress = json.loads(artifacts[checker.C06_SCOPE_P])
        events = json.loads(artifacts[checker.C06_SCOPE_E])["events"]
        self.assertEqual(
            [(772, "WRITE_LEASE_REVOKED"), (773, "WRITE_LEASE_ISSUED"), (774, "PACKAGE_RESUMED")],
            [(event["sequence"], event["event_type"]) for event in events[-3:]],
        )
        self.assertEqual(checker._c06_start_worker_lease(), progress["worker_lease"])
        self.assertEqual(self.PRODUCT6, sorted(progress["write_lease"]["path_scope"]))
        self.assertEqual(("C-06", "IN_PROGRESS", {"package_id": "C-07", "status": "NOT_READY"}),
                         (progress["current_work_package"], progress["status"], progress["next_work_package"]))

    def test_seq774_manifest_binds_review_findings_without_scope_or_risk_change(self):
        checker = self._checker()
        artifacts = checker.c06_scope_revision_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_SCOPE_M])
        self.assertEqual(self.PRODUCT6, sorted(manifest["product_write_scope"]))
        self.assertEqual(["packages/orchestration/failure_ledger.py"], manifest["revision_binding"]["scope_added"])
        self.assertEqual("UNCHANGED", manifest["revision_binding"]["functional_scope_change"])
        self.assertEqual("UNCHANGED", manifest["revision_binding"]["requirement_change"])
        self.assertEqual("UNCHANGED", manifest["revision_binding"]["important_risk_change"])
        self.assertEqual(
            ["C06-INVALID-LEDGER-MUTATION-v1", "C06-FINGERPRINT-EVIDENCE-UNBOUND-v1", "C06-C05-VALID-TEST-MATRIX-FALSE-NEGATIVE-v1"],
            manifest["review_rework_contract"]["finding_ids"],
        )
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])

    def test_seq774_validator_rejects_manifest_history_and_scope_tampering(self):
        checker = self._checker()
        artifacts = checker.c06_scope_revision_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_SCOPE_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c06_scope_revision(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["product_write_scope"].append("packages/evil.py")
            self.assertIn("C06_SCOPE_PROJECTION_INVALID", checker.validate_c06_scope_revision(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C06_SCOPE_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C06_SCOPE_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C06_SCOPE_HISTORY_MUTATED", checker.validate_c06_scope_revision(self._bundle(checker, artifacts), manifest))

    def test_seq774_git_accepts_only_exact_precommit_or_sole_direct_child_and_dispatches_first(self):
        checker = self._checker()
        successor = "a" * 40
        merged = "b" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C06_SCOPE_DEVELOPMENT_URL,
            ("rev-parse", checker.C06_SCOPE_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.BASE): self.BASE,
            ("show", "-s", "--format=%P", self.BASE): self.DEVELOPMENT_MAIN,
        }
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        def run(rows, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c06_scope_revision_git(bundle)
        lineage = {("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.BASE)}
        pre = common | {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C06_SCOPE_DEVELOPMENT_REF,
            status_key: "\n".join("M  " + path for path in self.EXACT9),
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        self.assertEqual([], run(pre, lineage | {("diff", "--cached", "--check")}))
        self.assertTrue(run(pre | {("diff", "--cached", "--name-only"): "\n".join(self.EXACT9[:-1])}, lineage | {("diff", "--cached", "--check")}))
        post = common | {
            ("rev-parse", "HEAD"): successor,
            ("branch", "--show-current"): self.BRANCH,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C06_SCOPE_DEVELOPMENT_REF,
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT9),
            status_key: "",
        }
        post_checks = lineage | {("merge-base", "--is-ancestor", self.BASE, successor), ("diff", "--check", self.BASE, successor)}
        self.assertEqual([], run(post, post_checks))
        self.assertEqual([], run(post | {("branch", "--show-current"): ""}, post_checks))
        self.assertTrue(run(post | {("show", "-s", "--format=%P", successor): f"{self.BASE} {self.DEVELOPMENT_MAIN}"}, post_checks))
        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C06_SCOPE_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): checker.C06_SCOPE_DEVELOPMENT_REF,
            ("show", "-s", "--format=%P", merged): f"{self.DEVELOPMENT_MAIN} {successor}",
            ("show", "-s", "--format=%P", successor): self.BASE,
            ("diff", "--name-only", self.BASE, successor): "\n".join(self.EXACT9),
            ("diff", "--name-only", self.DEVELOPMENT_MAIN, merged): "\n".join(checker.c06_scope_reviewed_merge_paths()),
            status_key: "",
        }
        merge_checks = lineage | {
            ("merge-base", "--is-ancestor", self.BASE, successor),
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--check", self.BASE, successor),
            ("diff", "--check", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--quiet", successor, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", successor, merged)}))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 774}}
        with mock.patch.object(checker, "_collect_c06_scope_revision_git", return_value=["SEQ774_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c06_start_projection_git", side_effect=AssertionError("seq771 must not run")
        ):
            self.assertEqual(["SEQ774_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)

class C06FinalAcceptanceProjectionTests(unittest.TestCase):
    PRODUCT = "b952b56eacd69da271475ff439919d60a592c70c"
    SCOPE = "0709051933e62a43d6c400071fadc62cf85b801e"
    START = "7c719063c31530bc33ffff23fd5d72371ae28057"
    DEVELOPMENT_MAIN = "042bd4050a3c826996a104b5219f8a1a9ba5a972"
    BRANCH = "codex/c06-failure-report-revalidation-r1"
    EXACT7 = sorted([
        "docs/evidence/manifests/C-06_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c06-final-acceptance.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c06_final_acceptance_from_root"), "C-06 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C06_FINAL_P]),
            "events": json.loads(artifacts[checker.C06_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C06_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C06_FINAL_D]),
        }

    def test_seq779_builder_is_exact_append_only_and_accepts_c06(self):
        checker = self._checker()
        artifacts = checker.c06_final_acceptance_from_root(ROOT)
        self.assertEqual(artifacts, checker.c06_final_acceptance_from_root(ROOT))
        self.assertEqual(self.EXACT7, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.PRODUCT}:{checker.C06_FINAL_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 774),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C06_FINAL_E], 774),
        )
        progress = json.loads(artifacts[checker.C06_FINAL_P])
        events = json.loads(artifacts[checker.C06_FINAL_E])["events"]
        self.assertEqual(tuple(range(775, 780)), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual(
            ["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED",
             "INDEPENDENT_TEST_JUDGMENT_RECORDED", "MAIN_PACKAGE_ACCEPTED"],
            [event["event_type"] for event in events[-5:]],
        )
        self.assertEqual(("C-06", "ACCEPTED", None, None, None), (
            progress["current_work_package"], progress["status"], progress["active_agent"],
            progress["worker_lease"], progress["write_lease"],
        ))
        self.assertEqual({"package_id": "C-07", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C07_WORK_INSTRUCTION", progress["next_safe_action"])
        self.assertEqual("NOT_REACHED", progress["c06_final_acceptance"]["dir2_status"])

    def test_seq779_manifest_binds_c02_contract_product_review_and_truthful_boundary(self):
        checker = self._checker()
        artifacts = checker.c06_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_FINAL_M])
        self.assertEqual(
            [self.DEVELOPMENT_MAIN, self.START, self.SCOPE, self.PRODUCT],
            manifest["lineage"]["ancestor_chain"],
        )
        self.assertEqual(checker.c06_scope_product_write_scope(), manifest["product_exact_paths"])
        self.assertEqual("C02_DELEGATION_PACKET_AUTHORITATIVE", manifest["identifier_validation_authority"])
        self.assertEqual("FAIL_CLOSED", manifest["c02_invalid_behavior"])
        self.assertEqual("RAW_AND_CANONICAL", manifest["c02_valid_projection"])
        self.assertEqual({"spec": "PASS", "quality": "APPROVED", "critical": 0, "important": 0, "minor": 0},
                         manifest["independent_product_review"])
        self.assertEqual((661, 661), (
            manifest["test_evidence"]["main_precommit"]["passed"],
            manifest["test_evidence"]["main_postcommit"]["passed"],
        ))
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["provider"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["telegram"])

    def test_seq779_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c06_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C06_FINAL_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c06_final_acceptance(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["identifier_validation_authority"] = "AD_HOC_REGEX"
            self.assertIn("C06_FINAL_PROJECTION_INVALID", checker.validate_c06_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C06_FINAL_E].replace(
            b'"event_id": "evt_g05_legacy_migration"',
            b'"event_id": "xvt_g05_legacy_migration"',
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C06_FINAL_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C06_FINAL_HISTORY_MUTATED", checker.validate_c06_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq779_git_accepts_only_exact_precommit_direct_child_or_reviewed_merge_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        completion = "a" * 40
        merged = "c" * 40
        status_key = ("status", "--porcelain", "--untracked-files=all")
        common = {
            ("remote", "get-url", "development"): checker.C06_FINAL_DEVELOPMENT_URL,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.SCOPE,
            ("show", "-s", "--format=%P", self.SCOPE): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.SCOPE, self.PRODUCT): "\n".join(checker.c06_scope_product_write_scope()),
        }
        lineage = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.SCOPE),
            ("merge-base", "--is-ancestor", self.SCOPE, self.PRODUCT),
        }
        def run(rows, checks):
            with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
                checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
            ):
                return checker._collect_c06_final_acceptance_git(bundle)
        pre = common | {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("rev-parse", checker.C06_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            status_key: "\n".join("M  " + path for path in self.EXACT7),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C06_FINAL_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT7),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        self.assertEqual([], run(pre, lineage | {("diff", "--cached", "--check")}))
        direct = common | {
            ("rev-parse", "HEAD"): completion,
            ("rev-parse", checker.C06_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("branch", "--show-current"): self.BRANCH,
            status_key: "",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT7),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C06_FINAL_DEVELOPMENT_REF,
        }
        direct_checks = lineage | {("merge-base", "--is-ancestor", self.PRODUCT, completion), ("diff", "--check", self.PRODUCT, completion)}
        self.assertEqual([], run(direct, direct_checks))
        self.assertTrue(run(direct | {("show", "-s", "--format=%P", completion): f"{self.PRODUCT} {self.START}"}, direct_checks))
        merge = common | {
            ("rev-parse", "HEAD"): merged,
            ("rev-parse", checker.C06_FINAL_DEVELOPMENT_REF): merged,
            ("branch", "--show-current"): "main",
            status_key: "",
            ("show", "-s", "--format=%P", merged): f"{self.DEVELOPMENT_MAIN} {completion}",
            ("show", "-s", "--format=%P", completion): self.PRODUCT,
            ("diff", "--name-only", self.PRODUCT, completion): "\n".join(self.EXACT7),
            ("diff", "--name-only", self.DEVELOPMENT_MAIN, merged): "\n".join(checker.c06_final_reviewed_merge_paths()),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): checker.C06_FINAL_DEVELOPMENT_REF,
        }
        merge_checks = lineage | {
            ("merge-base", "--is-ancestor", self.PRODUCT, completion),
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--check", self.PRODUCT, completion),
            ("diff", "--check", self.DEVELOPMENT_MAIN, merged),
            ("diff", "--quiet", completion, merged),
        }
        self.assertEqual([], run(merge, merge_checks))
        self.assertTrue(run(merge, merge_checks - {("diff", "--quiet", completion, merged)}))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 779}}
        with mock.patch.object(checker, "_collect_c06_final_acceptance_git", return_value=["SEQ779_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c06_scope_revision_git", side_effect=AssertionError("seq774 must not run")
        ):
            self.assertEqual(["SEQ779_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)

class C07StartProjectionTests(unittest.TestCase):
    BASE = "99cf0e8f232dd861f17b87aa2b7f4f4b8c0af0cf"
    BRANCH = "codex/c07-outcome-resolver-atomic-r1"
    EXACT9 = sorted([
        "docs/04_test_reports/C-07_START_PROJECTION_REPORT.md",
        "docs/evidence/manifests/C-07_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c07-start.json",
        "docs/validation/C-07_START_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT3 = sorted([
        "packages/orchestration/__init__.py",
        "packages/orchestration/outcome_resolver.py",
        "tests/orchestration/test_outcome_resolver_c07.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c07_start_projection_from_root"), "C-07 start builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C07_START_P]),
            "events": json.loads(artifacts[checker.C07_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C07_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C07_START_D]),
        }

    def test_seq782_builder_is_exact_deterministic_and_preserves_history(self):
        checker = self._checker()
        artifacts = checker.c07_start_projection_from_root(ROOT)
        self.assertEqual(artifacts, checker.c07_start_projection_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C07_START_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 779),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C07_START_E], 779),
        )
        progress = json.loads(artifacts[checker.C07_START_P])
        events = json.loads(artifacts[checker.C07_START_E])["events"]
        self.assertEqual((780, 781, 782), tuple(event["sequence"] for event in events[-3:]))
        self.assertEqual(
            ["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"],
            [event["event_type"] for event in events[-3:]],
        )
        self.assertEqual(("C-07", "IN_PROGRESS", "developer-primary"), (
            progress["current_work_package"], progress["status"], progress["active_agent"]["actor_id"]))
        self.assertEqual(self.PRODUCT3, progress["write_lease"]["path_scope"])
        self.assertEqual({"package_id": "C-08", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual("NOT_REACHED", progress["c07_start_projection"]["dir2_status"])

    def test_seq782_manifest_binds_existing_wi_exact3_and_c12_boundary(self):
        checker = self._checker()
        artifacts = checker.c07_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C07_START_M])
        self.assertEqual("22D19D1FC23319BEC1E4D6CD69A437BDA0A7CE66F804024655FDF2EF518DE041", manifest["work_instruction_sha256"])
        self.assertEqual("3F289C89D11CFF7BF3C1C73B747A983A956018AAED79FC63B26A7A54CA6A6053", manifest["invocation_sha256"])
        self.assertEqual(self.PRODUCT3, manifest["product_exact_paths"])
        self.assertEqual("EXTERNAL_CANONICAL_INPUT_ONLY", manifest["authority"]["valid_failure_count_ownership"])
        self.assertEqual("C12_NOT_IMPLEMENTED", manifest["external_validation"]["failure_count_accumulation"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])

    def test_seq782_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c07_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C07_START_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c07_start_projection(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["authority"]["valid_failure_count_ownership"] = "C07_ACCUMULATES"
            self.assertIn("C07_START_PROJECTION_INVALID", checker.validate_c07_start_projection(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C07_START_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C07_START_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C07_START_HISTORY_MUTATED", checker.validate_c07_start_projection(self._bundle(checker, artifacts), manifest))

    def test_seq782_git_accepts_exact_precommit_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        rows = {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT9),
            ("remote", "get-url", "development"): checker.C07_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C07_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C07_START_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args == ("diff", "--cached", "--check")
        ):
            self.assertEqual([], checker._collect_c07_start_projection_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 782}}
        with mock.patch.object(checker, "_collect_c07_start_projection_git", return_value=["SEQ782_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c06_final_acceptance_git", side_effect=AssertionError("seq779 must not run")
        ):
            self.assertEqual(["SEQ782_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C07FinalAcceptanceProjectionTests(unittest.TestCase):
    DEVELOPMENT_MAIN = "99cf0e8f232dd861f17b87aa2b7f4f4b8c0af0cf"
    START = "ef73c70e8b6c508027ba75e8ccfba59ff67d2cd6"
    PRODUCT = "9102c87ae8738a7c497b3f0b7c0b935f166e44f6"
    BRANCH = "codex/c07-outcome-resolver-atomic-r1"
    EXACT7 = sorted([
        "docs/evidence/manifests/C-07_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c07-final-acceptance.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT3 = C07StartProjectionTests.PRODUCT3

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c07_final_acceptance_from_root"), "C-07 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C07_FINAL_P]),
            "events": json.loads(artifacts[checker.C07_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C07_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C07_FINAL_D]),
        }

    def test_seq787_builder_is_exact_append_only_and_accepts_c07(self):
        checker = self._checker()
        artifacts = checker.c07_final_acceptance_from_root(ROOT)
        self.assertEqual(artifacts, checker.c07_final_acceptance_from_root(ROOT))
        self.assertEqual(self.EXACT7, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.PRODUCT}:{checker.C07_FINAL_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 782),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C07_FINAL_E], 782),
        )
        progress = json.loads(artifacts[checker.C07_FINAL_P])
        events = json.loads(artifacts[checker.C07_FINAL_E])["events"]
        self.assertEqual((783, 784, 785, 786, 787), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual("ACCEPTED", progress["status"])
        self.assertIsNone(progress["active_agent"])
        self.assertIsNone(progress["worker_lease"])
        self.assertIsNone(progress["write_lease"])
        self.assertIn("C-07", progress["completed_packages"])
        self.assertEqual({"package_id": "C-08", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C08_WORK_INSTRUCTION", progress["next_safe_action"])

    def test_seq787_manifest_binds_product_review_tests_and_truth_boundary(self):
        checker = self._checker()
        manifest = json.loads(checker.c07_final_acceptance_from_root(ROOT)[checker.C07_FINAL_M])
        self.assertEqual(self.PRODUCT, manifest["product_commit"])
        self.assertEqual(self.PRODUCT3, manifest["product_exact_paths"])
        self.assertEqual("F31C4A0073BE6E95518C6AB1CA50EE51149E9F3F2A4239681DFC41C645C4C31E", manifest["independent_review_report_sha256"])
        self.assertEqual({"critical": 0, "important": 0, "minor": 0, "quality": "APPROVED", "spec": "PASS"}, manifest["independent_product_review"])
        self.assertEqual(521, manifest["test_evidence"]["main_postcommit"]["passed"])
        self.assertEqual("EXTERNAL_CANONICAL_INPUT_ONLY", manifest["contract"]["valid_failure_count_ownership"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("C13_NOT_IMPLEMENTED", manifest["external_validation"]["takeover_execution"])

    def test_seq787_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c07_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C07_FINAL_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c07_final_acceptance(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["product_file_sha256"]["packages/orchestration/outcome_resolver.py"] = "0" * 64
            self.assertIn("C07_FINAL_PROJECTION_INVALID", checker.validate_c07_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C07_FINAL_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C07_FINAL_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C07_FINAL_HISTORY_MUTATED", checker.validate_c07_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq787_git_accepts_exact_precommit_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        rows = {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT7),
            ("remote", "get-url", "development"): checker.C07_FINAL_DEVELOPMENT_URL,
            ("rev-parse", checker.C07_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", self.PRODUCT): self.START,
            ("show", "-s", "--format=%P", self.START): self.DEVELOPMENT_MAIN,
            ("diff", "--name-only", self.START, self.PRODUCT): "\n".join(self.PRODUCT3),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C07_FINAL_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT7),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        checks = {
            ("merge-base", "--is-ancestor", self.DEVELOPMENT_MAIN, self.START),
            ("merge-base", "--is-ancestor", self.START, self.PRODUCT),
            ("diff", "--cached", "--check"),
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args in checks
        ):
            self.assertEqual([], checker._collect_c07_final_acceptance_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 787}}
        with mock.patch.object(checker, "_collect_c07_final_acceptance_git", return_value=["SEQ787_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c07_start_projection_git", side_effect=AssertionError("seq782 must not run")
        ):
            self.assertEqual(["SEQ787_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C08StartProjectionTests(unittest.TestCase):
    BASE = "5529fe5261744e42227fcb3444952cf18e8114ec"
    BRANCH = "codex/c08-repository-intelligence-r1"
    EXACT9 = sorted([
        "docs/04_test_reports/C-08_START_PROJECTION_REPORT.md",
        "docs/evidence/manifests/C-08_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c08-start.json",
        "docs/validation/C-08_START_VALIDATION.md",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT9 = sorted([
        "docs/04_test_reports/C-08_COMPLETION_REPORT.md",
        "packages/repository_intelligence/indexes.py",
        "packages/repository_intelligence/models.py",
        "packages/repository_intelligence/scanner.py",
        "tests/repository_intelligence/fixtures/app.py",
        "tests/repository_intelligence/fixtures/tests/spec_app.py",
        "tests/repository_intelligence/fixtures/ui.ts",
        "tests/repository_intelligence/fixtures/util.py",
        "tests/repository_intelligence/test_indexes.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c08_start_projection_from_root"), "C-08 start builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C08_START_P]),
            "events": json.loads(artifacts[checker.C08_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C08_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C08_START_D]),
        }

    def test_seq790_builder_is_exact_deterministic_and_preserves_history(self):
        checker = self._checker()
        artifacts = checker.c08_start_projection_from_root(ROOT)
        self.assertEqual(artifacts, checker.c08_start_projection_from_root(ROOT))
        self.assertEqual(self.EXACT9, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C08_START_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 787),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C08_START_E], 787),
        )
        progress = json.loads(artifacts[checker.C08_START_P])
        events = json.loads(artifacts[checker.C08_START_E])["events"]
        self.assertEqual((788, 789, 790), tuple(event["sequence"] for event in events[-3:]))
        self.assertEqual(
            ["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"],
            [event["event_type"] for event in events[-3:]],
        )
        self.assertEqual(("C-08", "IN_PROGRESS", "developer-primary"), (
            progress["current_work_package"], progress["status"], progress["active_agent"]["actor_id"]))
        self.assertEqual(self.PRODUCT9, progress["write_lease"]["path_scope"])
        self.assertEqual({"package_id": "C-09", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual("NOT_REACHED", progress["c08_start_projection"]["dir2_status"])

    def test_seq790_manifest_binds_existing_wi_product_scope_and_fixture_boundary(self):
        checker = self._checker()
        artifacts = checker.c08_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C08_START_M])
        self.assertEqual("D02670D73F12B574136EF27D99C336600B45F864E00A344CC306FAADEE81EC3C", manifest["work_instruction_sha256"])
        self.assertEqual("D74DDD5969200A6FD7DDB9AAA2C6A218E98C8F3500E6423FEBF89FFAECCB4C37", manifest["invocation_sha256"])
        self.assertEqual(self.PRODUCT9, manifest["product_exact_paths"])
        self.assertEqual(["AV-GATE-006", "AV-GATE-009", "AV-GATE-023"], [row["requirement_id"] for row in manifest["authority"]["acceptance"]])
        self.assertEqual("PREEXISTING_PRODUCT_UNDER_REVALIDATION", manifest["external_validation"]["product_code"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])

    def test_seq790_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c08_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C08_START_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c08_start_projection(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["authority"]["requirements_change"] = "CHANGED"
            self.assertIn("C08_START_PROJECTION_INVALID", checker.validate_c08_start_projection(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C08_START_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C08_START_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C08_START_HISTORY_MUTATED", checker.validate_c08_start_projection(self._bundle(checker, artifacts), manifest))

    def test_seq790_git_accepts_exact_precommit_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        rows = {
            ("rev-parse", "HEAD"): self.BASE,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT9),
            ("remote", "get-url", "development"): checker.C08_START_DEVELOPMENT_URL,
            ("rev-parse", checker.C08_START_DEVELOPMENT_REF): self.BASE,
            ("rev-parse", self.BASE): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C08_START_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT9),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args == ("diff", "--cached", "--check")
        ):
            self.assertEqual([], checker._collect_c08_start_projection_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 790}}
        with mock.patch.object(checker, "_collect_c08_start_projection_git", return_value=["SEQ790_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c07_final_acceptance_git", side_effect=AssertionError("seq787 must not run")
        ):
            self.assertEqual(["SEQ790_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C08FinalAcceptanceProjectionTests(unittest.TestCase):
    DEVELOPMENT_MAIN = "5529fe5261744e42227fcb3444952cf18e8114ec"
    START = "f7931944d894990ec1dff01cf14a47e5384209c8"
    PRODUCT = "8095981d33deef082fe646495a2cbc80841839c3"
    BRANCH = "codex/c08-repository-intelligence-r1"
    EXACT7 = sorted([
        "docs/evidence/manifests/C-08_FINAL_ACCEPTANCE_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md",
        "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c08-final-acceptance.json",
        "scripts/check_project_progress.py",
        "tests/tooling/test_project_progress.py",
    ])
    PRODUCT8 = sorted([
        "docs/04_test_reports/C-08_COMPLETION_REPORT.md",
        "packages/repository_intelligence/indexes.py",
        "packages/repository_intelligence/models.py",
        "packages/repository_intelligence/scanner.py",
        "tests/repository_intelligence/fixtures/app.py",
        "tests/repository_intelligence/fixtures/tests/spec_app.py",
        "tests/repository_intelligence/fixtures/ui.ts",
        "tests/repository_intelligence/test_indexes.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c08_final_acceptance_from_root"), "C-08 final builder missing")
        return checker

    def _bundle(self, checker, artifacts):
        return {
            "_root": ROOT,
            "progress": json.loads(artifacts[checker.C08_FINAL_P]),
            "events": json.loads(artifacts[checker.C08_FINAL_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C08_FINAL_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C08_FINAL_D]),
        }

    def test_seq795_builder_is_exact_append_only_and_accepts_c08(self):
        checker = self._checker()
        artifacts = checker.c08_final_acceptance_from_root(ROOT)
        self.assertEqual(artifacts, checker.c08_final_acceptance_from_root(ROOT))
        self.assertEqual(self.EXACT7, sorted(artifacts))
        historical = subprocess.check_output(["git", "show", f"{self.PRODUCT}:{checker.C08_FINAL_E}"], cwd=ROOT)
        self.assertEqual(
            checker.raw_event_object_prefix_bytes(historical, 790),
            checker.raw_event_object_prefix_bytes(artifacts[checker.C08_FINAL_E], 790),
        )
        progress = json.loads(artifacts[checker.C08_FINAL_P])
        events = json.loads(artifacts[checker.C08_FINAL_E])["events"]
        self.assertEqual(tuple(range(791, 796)), tuple(event["sequence"] for event in events[-5:]))
        self.assertEqual(["WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED", "PACKAGE_COMPLETED", "INDEPENDENT_TEST_JUDGMENT_RECORDED", "MAIN_PACKAGE_ACCEPTED"], [event["event_type"] for event in events[-5:]])
        self.assertEqual("TEST_REVIEW", events[-3]["details"]["package_status"])
        self.assertFalse(events[-3]["details"]["accepted"])
        self.assertEqual("PASS", events[-2]["details"]["verdict"])
        self.assertTrue(events[-1]["details"]["accepted"])
        self.assertEqual(("C-08", "ACCEPTED", None, None), (progress["current_work_package"], progress["status"], progress["worker_lease"], progress["write_lease"]))
        self.assertEqual({"package_id": "C-09", "status": "READY_FOR_WORK_INSTRUCTION"}, progress["next_work_package"])
        self.assertEqual("ISSUE_C09_WORK_INSTRUCTION", progress["next_safe_action"])

    def test_seq795_builder_is_portable_without_ignored_review_report(self):
        checker = self._checker()
        original = Path.read_bytes

        def without_ignored_review(path):
            if path == Path(checker.C08_FINAL_REVIEW_REPORT):
                raise FileNotFoundError(path)
            return original(path)

        with mock.patch.object(Path, "read_bytes", without_ignored_review):
            artifacts = checker.c08_final_acceptance_from_root(ROOT)
        self.assertEqual(self.EXACT7, sorted(artifacts))

    def test_seq795_manifest_binds_lineage_exact8_review_and_boundary(self):
        checker = self._checker()
        manifest = json.loads(checker.c08_final_acceptance_from_root(ROOT)[checker.C08_FINAL_M])
        self.assertEqual(self.PRODUCT8, manifest["product_exact_paths"])
        self.assertEqual("0E53D351A7BF9704036BAF803191794FAC6E530A89186DE3FA1DFAE0BE09C48A", manifest["product_exact_path_list_sha256"])
        self.assertEqual(self.PRODUCT, manifest["lineage"]["product_commit"])
        self.assertEqual([self.DEVELOPMENT_MAIN, self.START, "5d0cd330f3e336be2ac6ba59d605280aa286feba", "7e73e442171f32dc65c82268e88d015e2156c7df", "b74c9e1713b4234b51942b69438f0398ba27c2c5", self.PRODUCT], manifest["lineage"]["ancestor_chain"])
        self.assertEqual({"spec": "PASS", "quality": "APPROVED", "critical": 0, "important": 0, "minor": 0}, manifest["independent_product_review"])
        self.assertEqual(20, manifest["test_evidence"]["repository_intelligence"]["passed"])
        self.assertEqual(65, manifest["test_evidence"]["a13_regression"]["passed"])
        self.assertEqual("NOT_EXECUTED", manifest["external_validation"]["database"])
        self.assertEqual("NOT_REACHED", manifest["dir2_status"])

    def test_seq795_validator_rejects_manifest_and_history_tampering(self):
        checker = self._checker()
        artifacts = checker.c08_final_acceptance_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C08_FINAL_M])
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c08_final_acceptance(self._bundle(checker, artifacts), manifest))
            changed = copy.deepcopy(manifest)
            changed["independent_product_review"]["important"] = 1
            self.assertIn("C08_FINAL_PROJECTION_INVALID", checker.validate_c08_final_acceptance(self._bundle(checker, artifacts), changed))
        mutated = artifacts[checker.C08_FINAL_E].replace(
            b"\"event_id\": \"evt_g05_legacy_migration\"",
            b"\"event_id\": \"xvt_g05_legacy_migration\"",
            1,
        )
        def mutated_history(path):
            if path == ROOT / checker.C08_FINAL_E:
                return mutated
            return frozen(path)
        with mock.patch.object(Path, "read_bytes", mutated_history):
            self.assertIn("C08_FINAL_HISTORY_MUTATED", checker.validate_c08_final_acceptance(self._bundle(checker, artifacts), manifest))

    def test_seq795_git_accepts_exact_precommit_and_dispatches_first(self):
        checker = self._checker()
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.PRODUCT}}}
        rows = {
            ("rev-parse", "HEAD"): self.PRODUCT,
            ("branch", "--show-current"): self.BRANCH,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + path for path in self.EXACT7),
            ("remote", "get-url", "development"): checker.C08_FINAL_DEVELOPMENT_URL,
            ("rev-parse", checker.C08_FINAL_DEVELOPMENT_REF): self.DEVELOPMENT_MAIN,
            ("rev-parse", self.PRODUCT): self.PRODUCT,
            ("show", "-s", "--format=%P", "f7931944d894990ec1dff01cf14a47e5384209c8"): self.DEVELOPMENT_MAIN,
            ("show", "-s", "--format=%P", "5d0cd330f3e336be2ac6ba59d605280aa286feba"): "f7931944d894990ec1dff01cf14a47e5384209c8",
            ("show", "-s", "--format=%P", "7e73e442171f32dc65c82268e88d015e2156c7df"): "5d0cd330f3e336be2ac6ba59d605280aa286feba",
            ("show", "-s", "--format=%P", "b74c9e1713b4234b51942b69438f0398ba27c2c5"): "7e73e442171f32dc65c82268e88d015e2156c7df",
            ("show", "-s", "--format=%P", self.PRODUCT): "b74c9e1713b4234b51942b69438f0398ba27c2c5",
            ("diff", "--name-only", "f7931944d894990ec1dff01cf14a47e5384209c8", self.PRODUCT): "\n".join(self.PRODUCT8),
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): checker.C08_FINAL_DEVELOPMENT_REF,
            ("diff", "--cached", "--name-only"): "\n".join(self.EXACT7),
            ("diff", "--name-only"): "",
            ("ls-files", "--others", "--exclude-standard"): "",
        }
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(
            checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args == ("diff", "--cached", "--check") or args[:2] == ("merge-base", "--is-ancestor")
        ):
            self.assertEqual([], checker._collect_c08_final_acceptance_git(bundle))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 795}}
        with mock.patch.object(checker, "_collect_c08_final_acceptance_git", return_value=["SEQ795_SELECTED"]) as selected, mock.patch.object(
            checker, "_collect_c08_start_projection_git", side_effect=AssertionError("seq790 must not run")
        ):
            self.assertEqual(["SEQ795_SELECTED"], checker._validate_git_projection(dispatch))
            selected.assert_called_once_with(dispatch)


class C09StartProjectionTests(unittest.TestCase):
    BASE = "08aae12fdc4f8bd2d38b455f23408796ab4b8c82"
    BRANCH = "codex/c09-execution-backends-r1"
    EXACT11 = sorted([
        "docs/04_test_reports/C-09_START_PROJECTION_REPORT.md",
        "docs/evidence/manifests/C-09_START_MANIFEST.json",
        "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json",
        "docs/progress/progress-events.json",
        "docs/progress/progress-handoff-detached-digest-c09-start.json",
        "docs/validation/C-09_START_VALIDATION.md",
        "docs/work_orders/C-09_INVOCATION_PROMPT_R2.md",
        "docs/work_orders/C-09_WORK_INSTRUCTION_R2.md",
        "scripts/check_project_progress.py", "tests/tooling/test_project_progress.py",
    ])

    def _checker(self):
        checker = _load_checker_or_none()
        self.assertIsNotNone(checker)
        self.assertTrue(hasattr(checker, "c09_start_projection_from_root"), "C-09 start builder missing")
        return checker

    def test_seq798_builder_preserves_prefix_and_issues_exact_leases(self):
        checker = self._checker()
        artifacts = checker.c09_start_projection_from_root(ROOT)
        self.assertEqual(artifacts, checker.c09_start_projection_from_root(ROOT))
        self.assertEqual(self.EXACT11, sorted(artifacts))
        history = subprocess.check_output(["git", "show", f"{self.BASE}:{checker.C09_START_E}"], cwd=ROOT)
        self.assertEqual(checker.raw_event_object_prefix_bytes(history, 795), checker.raw_event_object_prefix_bytes(artifacts[checker.C09_START_E], 795))
        events = json.loads(artifacts[checker.C09_START_E])["events"]
        self.assertEqual([796, 797, 798], [e["sequence"] for e in events[-3:]])
        self.assertEqual(["WORK_INSTRUCTION_ISSUED", "WORKER_LEASE_ISSUED", "WRITE_LEASE_ISSUED"], [e["event_type"] for e in events[-3:]])
        for before, after in zip(events[-4:], events[-3:]):
            self.assertEqual(hashlib.sha256(checker.canonical_json_bytes(before)).hexdigest().upper(), after["previous_event_sha256"])
        progress = json.loads(artifacts[checker.C09_START_P])
        self.assertEqual(("C-09", "IN_PROGRESS", "developer-primary", "DISPATCH_C09_DEVELOPER"), (progress["current_work_package"], progress["status"], progress["active_agent"]["actor_id"], progress["next_safe_action"]))
        self.assertEqual({"package_id": "C-10", "status": "NOT_READY"}, progress["next_work_package"])
        self.assertEqual("NOT_REACHED", progress["c09_start_projection"]["dir2_status"])
        self.assertEqual(18, len(progress["write_lease"]["path_scope"]))
        self.assertEqual(progress["worker_lease"]["execution_fencing_token"], progress["write_lease"]["execution_fencing_token"])
        manifest = json.loads(artifacts[checker.C09_START_M])
        self.assertEqual("43F5AA046BF2F43FA6E84C4BC64325FDC20BBE2A4882D40722B60CAF8D512C52", manifest["exact_path_list_sha256"])
        self.assertEqual("57A7D45027FC24930F013C7EB0AB85B81B45E6A174B2DA9ADD90ECE95FA6F3D5", manifest["product_exact_path_list_sha256"])
        self.assertEqual(["AV-SAFE-010", "AV-SAFE-011", "AV-STAT-021"], [x["requirement_id"] for x in manifest["authority"]["acceptance"]])
        self.assertEqual(["AV-SAFE-028"], manifest["authority"]["carry_forward_regression"])
        self.assertFalse(manifest["accepted"])

    def test_seq798_builder_does_not_read_ignored_inputs(self):
        checker = self._checker()
        original = Path.read_bytes
        def bounded(path):
            if ".superpowers" in path.parts:
                raise AssertionError("ignored input is not portable")
            return original(path)
        with mock.patch.object(Path, "read_bytes", bounded):
            self.assertEqual(self.EXACT11, sorted(checker.c09_start_projection_from_root(ROOT)))

    def test_seq798_validator_rejects_each_projection_authority_and_raw_history_tamper(self):
        checker = self._checker()
        artifacts = checker.c09_start_projection_from_root(ROOT)
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        bundle = {
            "_root": ROOT, "progress": json.loads(artifacts[checker.C09_START_P]),
            "events": json.loads(artifacts[checker.C09_START_E]),
            "handoff": checker.extract_handoff_summary(artifacts[checker.C09_START_H].decode()),
            "detached_digest": json.loads(artifacts[checker.C09_START_D]),
        }
        manifest = json.loads(artifacts[checker.C09_START_M])
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c09_start_projection(bundle, manifest))
            for field in ("progress", "events", "handoff", "detached_digest"):
                bad = copy.deepcopy(bundle)
                bad[field] = {}
                with self.subTest(field=field):
                    self.assertIn("C09_START_PROJECTION_INVALID", checker.validate_c09_start_projection(bad, manifest))
            for field, value in (("accepted", True), ("authority", {}), ("worker_lease", {}),
                                 ("write_lease", {}), ("raw_checksums", []), ("product_exact_paths", []),
                                 ("external_validation", {"docker": "PASS"})):
                bad = copy.deepcopy(manifest)
                bad[field] = value
                with self.subTest(field=field):
                    self.assertIn("C09_START_PROJECTION_INVALID", checker.validate_c09_start_projection(bundle, bad))
            artifacts[checker.C09_START_E] = artifacts[checker.C09_START_E].replace(
                b"evt_g05_legacy_migration", b"xvt_g05_legacy_migration", 1)
            self.assertIn("C09_START_HISTORY_MUTATED", checker.validate_c09_start_projection(bundle, manifest))

    def test_seq798_predecessor_manifest_is_hash_bound(self):
        checker = self._checker()
        manifest = json.loads(checker.c09_start_projection_from_root(ROOT)[checker.C09_START_M])
        self.assertEqual("ED2A84BE9B1924A9254D8D44BB99679FFA2EB0A7DC8091DCED24470CF16EA493",
                         manifest["authority"]["predecessor"].get("manifest_sha256"))
        original = Path.read_bytes
        def corrupt(path):
            if path == ROOT / checker.C08_FINAL_M:
                return b"{}"
            return original(path)
        with mock.patch.object(Path, "read_bytes", corrupt):
            with self.assertRaisesRegex(ValueError, "C09_START_AUTHORITY_HASH_INVALID"):
                checker.c09_start_projection_from_root(ROOT)

    def test_seq798_review_r1_stat021_requires_l5_and_rejects_downgrade(self):
        checker = self._checker()
        artifacts = checker.c09_start_projection_from_root(ROOT)
        manifest = json.loads(artifacts[checker.C09_START_M])
        progress = json.loads(artifacts[checker.C09_START_P])
        events = json.loads(artifacts[checker.C09_START_E])
        handoff = checker.extract_handoff_summary(artifacts[checker.C09_START_H].decode())
        for authority in (manifest["authority"], progress["active_work_instruction"]["acceptance_binding"],
                          progress["c09_start_projection"]["authority"], events["events"][-3]["details"],
                          handoff["acceptance_binding"]):
            stat = [row for row in authority["acceptance"] if row["requirement_id"] == "AV-STAT-021"]
            self.assertEqual(1, len(stat))
            self.assertEqual("L5", stat[0]["level"])
        bundle = {"_root": ROOT, "progress": progress, "events": events, "handoff": handoff,
                  "detached_digest": json.loads(artifacts[checker.C09_START_D])}
        original = Path.read_bytes
        def frozen(path):
            try:
                relative = path.relative_to(ROOT).as_posix()
            except ValueError:
                return original(path)
            return artifacts[relative] if relative in artifacts else original(path)
        downgraded = copy.deepcopy(manifest)
        for row in downgraded["authority"]["acceptance"]:
            if row["requirement_id"] == "AV-STAT-021":
                row["level"] = "L3"
        with mock.patch.object(Path, "read_bytes", frozen):
            self.assertEqual([], checker.validate_c09_start_projection(bundle, manifest))
            self.assertIn("C09_START_PROJECTION_INVALID", checker.validate_c09_start_projection(bundle, downgraded))

    def test_seq798_review_r1_reads_and_verifies_parent_approval_file(self):
        checker = self._checker()
        approval = ROOT / "docs/approvals/APPROVAL-20260814-WORKPLAN-V16-001.md"
        original = Path.read_bytes
        reads = []
        def corrupted(path):
            if path == approval:
                reads.append(path)
                return original(path) + b"\nchanged approval"
            return original(path)
        with mock.patch.object(Path, "read_bytes", corrupted):
            with self.assertRaisesRegex(ValueError, "C09_START_AUTHORITY_HASH_INVALID"):
                checker.c09_start_projection_from_root(ROOT)
        self.assertEqual([approval], reads)

    def _git_rows(self, mode="staged"):
        child, merge = "1" * 40, "2" * 40
        head = self.BASE if mode == "staged" else child if mode == "child" else merge
        branch = self.BRANCH if mode in ("staged", "child") else "main" if mode == "merge" else ""
        paths = "\n".join(self.EXACT11)
        return {
            ("rev-parse", "HEAD"): head, ("branch", "--show-current"): branch,
            ("status", "--porcelain", "--untracked-files=all"): "\n".join("M  " + p for p in self.EXACT11) if mode == "staged" else "",
            ("remote", "get-url", "development"): "git@github-sinsan-develop:sinsan-develop/Anvil.git",
            ("rev-parse", "development/main"): self.BASE if mode in ("staged", "child") else merge,
            ("rev-parse", self.BASE): self.BASE,
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"): "development/main",
            ("for-each-ref", "--format=%(upstream:short)", "--count=1", "refs/heads/main"): "development/main",
            ("diff", "--cached", "--name-only"): paths if mode == "staged" else "",
            ("diff", "--name-only"): "", ("ls-files", "--others", "--exclude-standard"): "",
            ("show", "-s", "--format=%P", child): self.BASE,
            ("show", "-s", "--format=%P", merge): self.BASE + " " + child,
            ("diff", "--name-only", self.BASE, child): paths,
            ("diff", "--name-only", self.BASE, merge): paths,
        }

    def _git_errors(self, checker, rows, failed=()):
        bundle = {"_root": ROOT, "progress": {"repository": {"validated_base_commit": self.BASE}}}
        with mock.patch.object(checker, "_c02_git_raw_stdout", side_effect=lambda root, *args: rows.get(args)), mock.patch.object(checker, "_c02_git_quiet_check", side_effect=lambda root, *args: args not in failed):
            return checker._collect_c09_start_projection_git(bundle)

    def test_seq798_git_positive_and_first_dispatch(self):
        checker = self._checker()
        for mode in ("staged", "child", "merge", "detached"):
            with self.subTest(mode=mode):
                self.assertEqual([], self._git_errors(checker, self._git_rows(mode)))
        dispatch = {"_root": ROOT, "progress": {"event_sequence": 798}}
        with mock.patch.object(checker, "_collect_c09_start_projection_git", return_value=["SEQ798_SELECTED"]), mock.patch.object(checker, "_collect_c08_final_acceptance_git", side_effect=AssertionError("seq795 must not run")):
            self.assertEqual(["SEQ798_SELECTED"], checker._validate_git_projection(dispatch))

    def test_seq798_git_rejects_untrusted_collection_and_changed_paths(self):
        checker = self._checker()
        changes = [
            (("remote", "get-url", "development"), "git@other:other/Anvil.git"),
            (("rev-parse", "development/main"), "3" * 40), (("rev-parse", self.BASE), "3" * 40),
            (("branch", "--show-current"), "main"),
            (("for-each-ref", "--format=%(upstream:short)", "--count=1", f"refs/heads/{self.BRANCH}"), "origin/main"),
            (("diff", "--name-only"), self.EXACT11[0]),
            (("ls-files", "--others", "--exclude-standard"), "untracked.txt"),
            (("diff", "--cached", "--name-only"), "\n".join(self.EXACT11[:-1])),
            (("diff", "--cached", "--name-only"), "\n".join(self.EXACT11 + [self.EXACT11[0]])),
            (("diff", "--cached", "--name-only"), "../escape"),
            (("status", "--porcelain", "--untracked-files=all"), "M  ./docs/progress/build-progress.json"),
            (("status", "--porcelain", "--untracked-files=all"), None),
        ]
        for key, value in changes:
            rows = self._git_rows()
            rows[key] = value
            with self.subTest(key=key, value=value):
                self.assertTrue(self._git_errors(checker, rows))
        child, merge = "1" * 40, "2" * 40
        for mode, key, value in [
            ("child", ("show", "-s", "--format=%P", child), "3" * 40),
            ("child", ("show", "-s", "--format=%P", child), self.BASE + " " + "3" * 40),
            ("child", ("status", "--porcelain", "--untracked-files=all"), " M " + self.EXACT11[0]),
            ("merge", ("show", "-s", "--format=%P", merge), self.BASE + " " + child + " " + "3" * 40),
            ("merge", ("show", "-s", "--format=%P", child), "3" * 40),
            ("merge", ("diff", "--name-only", self.BASE, merge), "\n".join(self.EXACT11[:-1])),
        ]:
            rows = self._git_rows(mode)
            rows[key] = value
            with self.subTest(mode=mode, key=key):
                self.assertTrue(self._git_errors(checker, rows))
        self.assertTrue(self._git_errors(checker, self._git_rows("merge"), failed=[("diff", "--quiet", child, merge)]))
        self.assertTrue(checker._collect_c09_start_projection_git({"_root": ROOT, "progress": {"repository": {"validated_base_commit": "3" * 40}}}))


if __name__ == "__main__":
    unittest.main()
