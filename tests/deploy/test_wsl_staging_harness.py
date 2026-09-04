import json
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]
DEPLOY = ROOT / "deploy" / "wsl"
GUARD = DEPLOY / "candidate-manifest-guard.sh"


@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslCandidateManifestGuardTests(unittest.TestCase):
    def _git(self, cwd: Path, *args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()

    @staticmethod
    def _posix(path: Path) -> str:
        value = str(path).replace("\\", "/")
        if len(value) > 1 and value[1] == ":":
            return f"/{value[0].lower()}{value[2:]}"
        return value

    def _repo(self):
        temp = tempfile.TemporaryDirectory()
        repo = Path(temp.name)
        self._git(repo, "init", "-b", "main")
        self._git(repo, "config", "user.email", "test@example.invalid")
        self._git(repo, "config", "user.name", "wsl-harness-test")
        (repo / "payload.txt").write_text("candidate\n", encoding="utf-8")
        self._git(repo, "add", ".")
        self._git(repo, "commit", "-m", "candidate")
        candidate = self._git(repo, "rev-parse", "HEAD")
        candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact34"
        control_ref = "refs/remotes/origin/codex/c21-operational-execution"
        self._git(repo, "update-ref", candidate_ref, candidate)
        manifest = {
            "schema_version": 1,
            "manifest_type": "WSL_STAGING_CANDIDATE",
            "status": "APPROVED_FOR_STAGING_VALIDATION",
            "source": {
                "commit": candidate,
                "remote_ref": candidate_ref,
                "working_tree": "CLEAN",
            },
            "environment": {
                "name": "WSL_SERVER_TEST_STAGING",
                "postgres_targets": ["15", "18-rc"],
            },
            "authority": {
                "approval_id": "APPROVAL-C21-WSL-TEST",
                "approval_binding_sha256": "a" * 64,
            },
            "exclusions": ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"],
            "cleanup": {
                "exact_named_volumes": [
                    "anvil-wsl-pg15_anvil-db-data",
                    "anvil-wsl-pg18rc_anvil-db-data",
                ],
                "required_labels": {
                    "com.anvil.environment": "WSL_SERVER_TEST_STAGING",
                    "com.anvil.cleanup-scope": "C21_WSL_ISOLATED_TEST",
                },
            },
            "rollback": {"approved_commits": [candidate]},
        }
        (repo / "deploy" / "wsl").mkdir(parents=True)
        (repo / "deploy" / "wsl" / "CandidateReleaseManifest.json").write_text(
            json.dumps(manifest) + "\n", encoding="utf-8"
        )
        self._git(repo, "add", ".")
        self._git(repo, "commit", "-m", "approve candidate")
        control = self._git(repo, "rev-parse", "HEAD")
        self._git(repo, "update-ref", control_ref, control)
        blob = subprocess.check_output(
            ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo
        )
        checksum = hashlib.sha256(blob).hexdigest()
        return temp, repo, candidate, control_ref, checksum

    def _validate(self, repo: Path, control_ref: str, candidate: str, checksum: str):
        command = (
            f"source '{self._posix(GUARD)}'; "
            f"validate_wsl_candidate_manifest '{self._posix(repo)}' {control_ref} {candidate}"
        )
        return subprocess.run(
            ["bash", "-c", command],
            env=os.environ | {
                "ANVIL_PYTHON": self._posix(Path(sys.executable)),
                "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum,
            },
            text=True,
            capture_output=True,
        )

    def test_feature_candidate_is_accepted_without_origin_main_ancestry(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertEqual(0, result.returncode, result.stderr)

    def test_manifest_checksum_hashes_exact_git_blob_bytes_and_rejects_one_byte_change(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            accepted = self._validate(repo, control_ref, candidate, checksum)
            self.assertEqual(0, accepted.returncode, accepted.stderr)
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            raw = path.read_bytes()
            path.write_bytes(raw.replace(b"APPROVED", b"BPPROVED", 1))
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "tamper one byte")
            self._git(repo, "update-ref", control_ref, self._git(repo, "rev-parse", "HEAD"))
            rejected = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, rejected.returncode)
            self.assertIn("checksum mismatch", rejected.stderr)

    def test_candidate_must_equal_the_manifest_feature_remote(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            (repo / "other.txt").write_text("unapproved\n", encoding="utf-8")
            self._git(repo, "add", ".")
            self._git(repo, "commit", "-m", "unapproved descendant")
            unapproved = self._git(repo, "rev-parse", "HEAD")
            self._git(repo, "update-ref", "refs/remotes/origin/candidates/c21-wsl-exact34", unapproved)
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("feature remote", result.stderr)

    def test_control_ref_is_exact_successor_and_candidate_is_its_distinct_ancestor(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            wrong_control = self._validate(repo, candidate, candidate, checksum)
            self.assertNotEqual(0, wrong_control.returncode)
            self.assertIn("control ref", wrong_control.stderr)
            same_commit = self._validate(repo, control_ref, self._git(repo, "rev-parse", control_ref), checksum)
            self.assertNotEqual(0, same_commit.returncode)
            self.assertIn("distinct", same_commit.stderr)


@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslScriptFailClosedTests(unittest.TestCase):
    def test_entrypoints_reject_non_exact_sha_before_creating_runtime_state(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            env = os.environ | {"ANVIL_WSL_DEPLOY_ROOT": self._posix(root)}
            for script in ("bootstrap.sh", "deploy.sh", "verify.sh", "rollback.sh"):
                with self.subTest(script=script):
                    result = subprocess.run(
                        ["bash", str(DEPLOY / script), "not-a-sha"],
                        env=env,
                        text=True,
                        capture_output=True,
                    )
                    self.assertEqual(2, result.returncode, result.stderr)
            self.assertEqual([], list(root.iterdir()))

    @staticmethod
    def _posix(path: Path) -> str:
        value = str(path).replace("\\", "/")
        if len(value) > 1 and value[1] == ":":
            return f"/{value[0].lower()}{value[2:]}"
        return value

    def test_repository_candidate_manifest_is_bound_to_approved_exact_candidate(self):
        manifest = json.loads((DEPLOY / "CandidateReleaseManifest.json").read_text(encoding="utf-8"))
        candidate = "93c58f7a8eaf803e4c3e56b9f03df0f70674a4ad"
        self.assertEqual("APPROVED_FOR_STAGING_VALIDATION", manifest["status"])
        self.assertEqual(candidate, manifest["source"]["commit"])
        self.assertEqual([candidate], manifest["rollback"]["approved_commits"])
        self.assertEqual(64, len(manifest["authority"]["approval_binding_sha256"]))
        self.assertEqual(
            ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"], manifest["exclusions"]
        )

    def test_backup_receipt_gate_precedes_migration(self):
        deploy = (DEPLOY / "deploy.sh").read_text(encoding="utf-8")
        self.assertLess(deploy.index("verify_backup_receipt"), deploy.index("alembic upgrade head"))
        common = (DEPLOY / "common.sh").read_text(encoding="utf-8")
        self.assertIn("backup receipt binding mismatch", common)

    def test_cleanup_is_exact_manifest_and_multilabel_guarded(self):
        manifest = json.loads((DEPLOY / "CandidateReleaseManifest.json").read_text(encoding="utf-8"))
        self.assertEqual(
            ["anvil-wsl-pg15_anvil-db-data", "anvil-wsl-pg18rc_anvil-db-data"],
            manifest["cleanup"]["exact_named_volumes"],
        )
        cleanup = (DEPLOY / "common.sh").read_text(encoding="utf-8")
        first_delete = min(cleanup.index("wsl_compose rm"), cleanup.index('docker volume rm "$volume"'))
        for guard in (
            "com.docker.compose.project",
            "com.anvil.environment",
            "com.anvil.cleanup-scope",
        ):
            self.assertLess(cleanup.index(guard), first_delete)
        self.assertNotIn("rm -rf", cleanup)
        self.assertNotIn("down --volumes", cleanup)

    def test_verify_requires_manifest_guard_before_runtime_state_write(self):
        verify = (DEPLOY / "verify.sh").read_text(encoding="utf-8")
        guard = verify.index("validate_wsl_candidate_manifest")
        self.assertLess(guard, verify.index("mkdir -p"))
        self.assertIn("ANVIL_CANDIDATE_MANIFEST_SHA256", verify[:guard])


class WslCleanupExecutionTests(WslCandidateManifestGuardTests):
    def _run_cleanup(self, repo: Path, candidate: str, control_ref: str, checksum: str, mismatch: str = ""):
        log = repo / "docker.log"
        command = f'''
source '{self._posix(DEPLOY / "common.sh")}'
docker() {{
  echo "docker:$*" >> '{self._posix(log)}'
  if [[ "$1 $2" == "volume inspect" ]]; then
    volume="${{@: -1}}"
    case "$*" in
      *com.docker.compose.project*) key=project; [[ "$volume" == anvil-wsl-pg15_anvil-db-data ]] && value=anvil-wsl-pg15 || value=anvil-wsl-pg18rc ;;
      *com.anvil.environment*) key=environment; value=WSL_SERVER_TEST_STAGING ;;
      *com.anvil.cleanup-scope*) key=scope; value=C21_WSL_ISOLATED_TEST ;;
    esac
    [[ "${{key}}:${{volume}}" == "{mismatch}" ]] && value=WRONG
    echo "$value"
  fi
}}
wsl_compose() {{ echo "compose:$*" >> '{self._posix(log)}'; }}
cleanup_wsl_test_volumes {candidate} '{self._posix(repo)}' {control_ref}
'''
        result = subprocess.run(
            ["bash", "-c", command], text=True, capture_output=True,
            env=os.environ | {
                "ANVIL_PYTHON": self._posix(Path(sys.executable)),
                "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum,
            },
        )
        calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
        return result, calls

    def test_each_label_and_second_volume_mismatch_delete_nothing(self):
        for mismatch in (
            "project:anvil-wsl-pg15_anvil-db-data",
            "environment:anvil-wsl-pg15_anvil-db-data",
            "scope:anvil-wsl-pg15_anvil-db-data",
            "scope:anvil-wsl-pg18rc_anvil-db-data",
        ):
            with self.subTest(mismatch=mismatch):
                temp, repo, candidate, control_ref, checksum = self._repo()
                with temp:
                    result, calls = self._run_cleanup(repo, candidate, control_ref, checksum, mismatch)
                    self.assertNotEqual(0, result.returncode)
                    self.assertFalse(any(call.startswith("compose:rm") for call in calls))
                    self.assertFalse(any(call.startswith("docker:volume rm") for call in calls))

    def test_success_deletes_only_two_exact_allowlisted_volumes(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            result, calls = self._run_cleanup(repo, candidate, control_ref, checksum)
            self.assertEqual(0, result.returncode, result.stderr)
            removed = [call.removeprefix("docker:volume rm ") for call in calls if call.startswith("docker:volume rm ")]
            self.assertEqual(
                ["anvil-wsl-pg15_anvil-db-data", "anvil-wsl-pg18rc_anvil-db-data"], removed
            )




if __name__ == "__main__":
    unittest.main()
