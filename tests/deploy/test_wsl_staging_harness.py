import json
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
        self._git(repo, "update-ref", "refs/remotes/origin/codex/c21", candidate)
        manifest = {
            "schema_version": 1,
            "manifest_type": "WSL_STAGING_CANDIDATE",
            "status": "APPROVED_FOR_STAGING_VALIDATION",
            "source": {
                "commit": candidate,
                "remote_ref": "refs/remotes/origin/codex/c21",
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
            json.dumps(manifest), encoding="utf-8"
        )
        self._git(repo, "add", ".")
        self._git(repo, "commit", "-m", "approve candidate")
        control = self._git(repo, "rev-parse", "HEAD")
        return temp, repo, candidate, control

    def _validate(self, repo: Path, control: str, candidate: str):
        command = (
            f"source '{self._posix(GUARD)}'; "
            f"validate_wsl_candidate_manifest '{self._posix(repo)}' {control} {candidate}"
        )
        return subprocess.run(
            ["bash", "-c", command],
            env=os.environ | {"ANVIL_PYTHON": self._posix(Path(sys.executable))},
            text=True,
            capture_output=True,
        )

    def test_feature_candidate_is_accepted_without_origin_main_ancestry(self):
        temp, repo, candidate, control = self._repo()
        with temp:
            result = self._validate(repo, control, candidate)
            self.assertEqual(0, result.returncode, result.stderr)

    def test_candidate_must_equal_the_manifest_feature_remote(self):
        temp, repo, candidate, control = self._repo()
        with temp:
            (repo / "other.txt").write_text("unapproved\n", encoding="utf-8")
            self._git(repo, "add", ".")
            self._git(repo, "commit", "-m", "unapproved descendant")
            unapproved = self._git(repo, "rev-parse", "HEAD")
            self._git(repo, "update-ref", "refs/remotes/origin/codex/c21", unapproved)
            result = self._validate(repo, control, candidate)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("feature remote", result.stderr)


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

    def test_repository_candidate_manifest_is_draft_until_exact_sha_binding(self):
        manifest = json.loads((DEPLOY / "CandidateReleaseManifest.json").read_text(encoding="utf-8"))
        self.assertEqual("DRAFT_REQUIRES_EXACT_SHA_BINDING", manifest["status"])
        self.assertEqual("PENDING_EXACT_SHA", manifest["source"]["commit"])
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




if __name__ == "__main__":
    unittest.main()
