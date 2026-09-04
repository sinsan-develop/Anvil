import json
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import time
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

    def test_manifest_rejects_rollback_without_the_exact_candidate_approval(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8")); manifest["rollback"]["approved_commits"] = []
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            self._git(repo, "add", str(path.relative_to(repo))); self._git(repo, "commit", "-m", "remove rollback approval")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(subprocess.check_output(["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo)).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("rollback approval binding", result.stderr)


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


@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslControlRuntimeTests(unittest.TestCase):
    def _git(self, cwd: Path, *args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()

    @staticmethod
    def _posix(path: Path) -> str:
        value = str(path).replace("\\", "/")
        if os.name == "nt" and shutil.which("cygpath"):
            return subprocess.check_output(
                ["bash", "-c", 'cygpath -u "$1"', "--", str(path)], text=True
            ).strip()
        if len(value) > 1 and value[1] == ":":
            return f"/{value[0].lower()}{value[2:]}"
        return value

    def test_fresh_no_checkout_clone_reaches_manifest_guard_with_a_clean_worktree(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            application = root / "repo"
            control = root / "control"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            manifest = source / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text("{}\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate")
            candidate = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact34", candidate)
            (source / "control-marker.txt").write_text("control\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "control")
            control_sha = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", control_sha)
            shutil.copytree(DEPLOY, control / "deploy" / "wsl")
            application.mkdir()
            env_file = root / ".env"
            env_file.write_text("\n".join([
                "ANVIL_WSL_PG_PASSWORD=" + "a" * 48,
                "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=" + "b" * 64,
                "ANVIL_TEST_SESSION_ACTOR_ID=x", "ANVIL_TEST_SESSION_PROJECT_ID=x",
                "ANVIL_TEST_SESSION_ENVIRONMENT_ID=x", "ANVIL_TEST_SESSION_RUN_IDS=x",
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read", ""
            ]), encoding="utf-8")
            bin_dir = root / "bin"
            bin_dir.mkdir()
            stat = bin_dir / "stat"
            stat.write_text("#!/usr/bin/env bash\necho 600\n", encoding="utf-8")
            subprocess.run(["bash", "-c", f"chmod +x '{self._posix(stat)}'"], check=True)
            checksum = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{control_sha}:deploy/wsl/CandidateReleaseManifest.json"], cwd=source
            )).hexdigest()

            result = subprocess.run(
                ["bash", str(control / "deploy" / "wsl" / "deploy.sh"), candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_APPLICATION_REPO": self._posix(application),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum,
                    "ANVIL_PYTHON": self._posix(Path(sys.executable)),
                    "PATH": self._posix(bin_dir) + ":" + os.environ["PATH"],
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("candidate manifest contract mismatch", result.stderr)
            self.assertEqual("", self._git(application, "status", "--porcelain"))

            (application / "untracked.txt").write_text("dirty\n", encoding="utf-8")
            rejected = subprocess.run(
                ["bash", str(control / "deploy" / "wsl" / "deploy.sh"), candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_APPLICATION_REPO": self._posix(application),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum,
                    "ANVIL_PYTHON": self._posix(Path(sys.executable)),
                    "PATH": self._posix(bin_dir) + ":" + os.environ["PATH"],
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertEqual(3, rejected.returncode)
            self.assertIn("checkout is dirty", rejected.stderr)

    def test_verify_after_candidate_checkout_executes_the_separate_control_script(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            application = root / "repo"
            control = root / "control"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            candidate_verify = source / "deploy" / "wsl" / "verify.sh"
            candidate_verify.parent.mkdir(parents=True)
            candidate_verify.write_text(
                "#!/usr/bin/env bash\nprintf 'CANDIDATE_ERA_VERIFY\\n'\nexit 79\n",
                encoding="utf-8",
            )
            manifest = source / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest.write_text("{}\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate verification")
            candidate = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact34", candidate)

            control_verify = source / "deploy" / "wsl" / "verify.sh"
            control_verify.write_text(
                "#!/usr/bin/env bash\nprintf 'CONTROL_VERIFY:%s\\n' \"${BASH_SOURCE[0]}\"\n",
                encoding="utf-8",
            )
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "control verification")
            control_sha = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", control_sha)
            manifest_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{control_sha}:deploy/wsl/CandidateReleaseManifest.json"], cwd=source
            )).hexdigest()
            verify_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{control_sha}:deploy/wsl/verify.sh"], cwd=source
            )).hexdigest()

            self._git(root, "clone", str(source), str(application))
            self._git(application, "checkout", "--detach", candidate)
            stale = subprocess.run(
                ["bash", str(application / "deploy" / "wsl" / "verify.sh"), candidate],
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertEqual(79, stale.returncode)
            self.assertIn("CANDIDATE_ERA_VERIFY", stale.stdout)

            result = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_APPLICATION_REPO": self._posix(application),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": control_sha,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": manifest_sha,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": verify_sha,
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("CONTROL_VERIFY:", result.stdout)
            self.assertIn(self._posix(control), result.stdout.replace("\\", "/"))
            self.assertNotIn("CANDIDATE_ERA_VERIFY", result.stdout)

            rejected = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=os.environ | {
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(application),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": control_sha,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": manifest_sha,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": verify_sha,
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(0, rejected.returncode)
            self.assertIn("separate from candidate", rejected.stderr)

    def test_rollback_pg18_preflight_failure_makes_zero_compose_mutations(self):
        temp, repo, candidate, control_ref, checksum = WslCandidateManifestGuardTests()._repo()
        with temp, tempfile.TemporaryDirectory() as raw:
            root = Path(raw); control = root / "control"; shutil.copytree(DEPLOY, control / "deploy" / "wsl")
            for slug, previous in (("pg15", "a" * 40), ("pg18rc", "b" * 40)):
                path = root / "runtime" / slug; path.mkdir(parents=True, exist_ok=True); (path / "previous.sha").write_text(previous + "\n")
            env_file = root / ".env"
            env_file.write_text("\n".join([
                "ANVIL_WSL_PG_PASSWORD=" + "a" * 48,
                "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=" + "b" * 64,
                "ANVIL_TEST_SESSION_ACTOR_ID=x", "ANVIL_TEST_SESSION_PROJECT_ID=x",
                "ANVIL_TEST_SESSION_ENVIRONMENT_ID=x", "ANVIL_TEST_SESSION_RUN_IDS=x",
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read", ""
            ]), encoding="utf-8")
            subprocess.run(["bash", "-c", f"chmod 600 '{self._posix(env_file)}'"], check=True)
            bin_dir = root / "bin"; bin_dir.mkdir(); log = root / "docker.log"
            docker = bin_dir / "docker"
            docker.write_text("#!/usr/bin/env bash\necho \"$*\" >> \"$ANVIL_DOCKER_LOG\"\n[[ \"$*\" == *anvil-wsl-web:bbbb* ]] && exit 1\nexit 0\n", encoding="utf-8")
            curl = bin_dir / "curl"; curl.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            stat = bin_dir / "stat"; stat.write_text("#!/usr/bin/env bash\necho 600\n", encoding="utf-8")
            os.chmod(docker, 0o755); os.chmod(curl, 0o755); os.chmod(stat, 0o755)
            result = subprocess.run(["bash", str(control / "deploy" / "wsl" / "rollback.sh"), candidate], text=True, capture_output=True,
                env=os.environ | {"PATH": self._posix(bin_dir) + ":" + os.environ["PATH"], "ANVIL_DOCKER_LOG": self._posix(log), "ANVIL_WSL_DEPLOY_ROOT": self._posix(root), "ANVIL_WSL_CONTROL_REPO": self._posix(control), "ANVIL_WSL_APPLICATION_REPO": self._posix(repo), "ANVIL_CANDIDATE_MANIFEST_REF": control_ref, "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum, "ANVIL_PYTHON": self._posix(Path(sys.executable))})
            self.assertNotEqual(0, result.returncode)
            self.assertTrue(log.exists(), result.stderr)
            calls = log.read_text(encoding="utf-8").splitlines()
            self.assertTrue(any("anvil-wsl-web:aaaaaaaa" in call for call in calls))
            self.assertTrue(any("anvil-wsl-web:bbbbbbbb" in call for call in calls))
            self.assertFalse(any(call.startswith("compose") for call in calls))

    def test_rejects_descendant_that_retains_candidate_era_verify_script(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            application = root / "repo"
            control = root / "control"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            verify = source / "deploy" / "wsl" / "verify.sh"
            verify.parent.mkdir(parents=True)
            verify.write_text(
                "#!/usr/bin/env bash\nprintf 'CANDIDATE_ERA_VERIFY\\n'\nexit 79\n",
                encoding="utf-8",
            )
            manifest = source / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest.write_text("{}\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate verification")
            candidate = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact34", candidate)
            (source / "control-marker.txt").write_text("descendant\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "stale control descendant")
            control_sha = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", control_sha)
            self._git(root, "clone", str(source), str(application))
            self._git(application, "checkout", "--detach", candidate)
            trusted_verify_sha = hashlib.sha256(
                b'#!/usr/bin/env bash\nprintf "CONTROL_VERIFY\\n"\n'
            ).hexdigest()
            result = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_APPLICATION_REPO": self._posix(application),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": control_sha,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": trusted_verify_sha,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": hashlib.sha256(subprocess.check_output(
                        ["git", "show", f"{control_sha}:deploy/wsl/CandidateReleaseManifest.json"], cwd=source
                    )).hexdigest(),
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("control script checksum mismatch", result.stderr)
            self.assertNotIn("CANDIDATE_ERA_VERIFY", result.stdout)

    def test_failed_validation_removes_current_and_preexisting_non_active_stages(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            application = root / "repo"
            control = root / "control"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            script = source / "deploy" / "wsl" / "verify.sh"
            script.parent.mkdir(parents=True)
            script.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            (script.parent / "CandidateReleaseManifest.json").write_text("{}\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate")
            candidate = self._git(source, "rev-parse", "HEAD")
            (source / "control-marker.txt").write_text("control\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "control")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", "HEAD")
            (control / "stage.abandoned").mkdir(parents=True)

            result = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_APPLICATION_REPO": self._posix(application),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": "0" * 40,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": "0" * 64,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": "0" * 64,
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("trusted control commit mismatch", result.stderr)
            self.assertEqual([], sorted(path.name for path in control.glob("stage.*")))

    def test_exact_control_commit_rejects_sourced_dependency_only_descendant(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            control = root / "control"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            scripts = source / "deploy" / "wsl"
            scripts.mkdir(parents=True)
            (scripts / "verify.sh").write_text(
                "#!/usr/bin/env bash\nsource \"$(dirname \"${BASH_SOURCE[0]}\")/common.sh\"\nprintf 'SAFE_VERIFY\\n'\n",
                encoding="utf-8",
            )
            (scripts / "common.sh").write_text("#!/usr/bin/env bash\ntrue\n", encoding="utf-8")
            (scripts / "CandidateReleaseManifest.json").write_text("{}\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate")
            candidate = self._git(source, "rev-parse", "HEAD")
            (source / "control-marker.txt").write_text("trusted\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "trusted control")
            trusted_control = self._git(source, "rev-parse", "HEAD")
            manifest_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{trusted_control}:deploy/wsl/CandidateReleaseManifest.json"], cwd=source
            )).hexdigest()
            script_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{trusted_control}:deploy/wsl/verify.sh"], cwd=source
            )).hexdigest()
            (scripts / "common.sh").write_text(
                "#!/usr/bin/env bash\nprintf 'UNTRUSTED_DEPENDENCY\\n'\n",
                encoding="utf-8",
            )
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "dependency-only descendant")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", "HEAD")

            result = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": trusted_control,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": manifest_sha,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": script_sha,
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("trusted control commit mismatch", result.stderr)
            self.assertNotIn("UNTRUSTED_DEPENDENCY", result.stdout)

    def test_concurrent_invocation_cannot_replace_the_validated_stage_before_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            control = root / "control"
            started = root / "started"
            release = root / "release"
            self._git(root, "init", "-b", "main", str(source))
            self._git(source, "config", "user.email", "test@example.invalid")
            self._git(source, "config", "user.name", "wsl-harness-test")
            scripts = source / "deploy" / "wsl"
            scripts.mkdir(parents=True)
            manifest = scripts / "CandidateReleaseManifest.json"
            manifest.write_text("{}\n", encoding="utf-8")
            verify = scripts / "verify.sh"
            verify.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "candidate")
            candidate = self._git(source, "rev-parse", "HEAD")
            verify.write_text(
                "#!/usr/bin/env bash\nprintf x > \"$ANVIL_TEST_STARTED\"\n"
                "while [[ ! -f \"$ANVIL_TEST_RELEASE\" ]]; do sleep 0.05; done\n"
                "printf 'CONTROL_ONE:%s\\n' \"${BASH_SOURCE[0]}\"\n",
                encoding="utf-8",
            )
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "control one")
            control_one = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", control_one)

            def trusted_env(control_sha: str, script_sha: str):
                return os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(source),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": control_sha,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": hashlib.sha256(subprocess.check_output(
                        ["git", "show", f"{control_sha}:deploy/wsl/CandidateReleaseManifest.json"], cwd=source
                    )).hexdigest(),
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": script_sha,
                    "ANVIL_TEST_STARTED": self._posix(started),
                    "ANVIL_TEST_RELEASE": self._posix(release),
                }

            one_script_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{control_one}:deploy/wsl/verify.sh"], cwd=source
            )).hexdigest()
            first = subprocess.Popen(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=trusted_env(control_one, one_script_sha),
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            deadline = time.time() + 10
            while not started.exists() and time.time() < deadline:
                time.sleep(0.05)
            self.assertTrue(started.exists(), "first control action did not start")

            verify.write_text("#!/usr/bin/env bash\nprintf 'CONTROL_TWO:%s\\n' \"${BASH_SOURCE[0]}\"\n", encoding="utf-8")
            self._git(source, "add", ".")
            self._git(source, "commit", "-m", "control two")
            control_two = self._git(source, "rev-parse", "HEAD")
            self._git(source, "update-ref", "refs/heads/codex/c21-operational-execution", control_two)
            two_script_sha = hashlib.sha256(subprocess.check_output(
                ["git", "show", f"{control_two}:deploy/wsl/verify.sh"], cwd=source
            )).hexdigest()
            second = subprocess.Popen(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", candidate],
                env=trusted_env(control_two, two_script_sha),
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            time.sleep(0.3)
            self.assertIsNone(second.poll(), "second invocation bypassed the publication lock")
            release.write_text("go\n", encoding="utf-8")
            first_out, first_err = first.communicate(timeout=15)
            second_out, second_err = second.communicate(timeout=15)
            self.assertEqual(0, first.returncode, first_err)
            self.assertEqual(0, second.returncode, second_err)
            self.assertIn("CONTROL_ONE:", first_out)
            self.assertNotIn("CONTROL_TWO:", first_out)
            self.assertIn("CONTROL_TWO:", second_out)
            active = control / (control / "active").read_text(encoding="utf-8").strip()
            self.assertTrue(active.exists())
            self.assertEqual([active.name], sorted(path.name for path in control.glob("stage.*")))

    def test_preexisting_publish_lock_fails_within_the_configured_timeout(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            control = root / "control"
            (control / ".publish.lock").mkdir(parents=True)
            started = time.monotonic()
            result = subprocess.run(
                ["bash", str(DEPLOY / "control-runtime.sh"), "verify", "0" * 40],
                env=os.environ | {
                    "ANVIL_GIT_REMOTE_URL": self._posix(root / "unused"),
                    "ANVIL_WSL_DEPLOY_ROOT": self._posix(root),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(control),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "refs/remotes/origin/codex/c21-operational-execution",
                    "ANVIL_WSL_CONTROL_COMMIT": "1" * 40,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": "2" * 64,
                    "ANVIL_WSL_CONTROL_VERIFY_SHA256": "3" * 64,
                    "ANVIL_WSL_CONTROL_LOCK_TIMEOUT_SECONDS": "1",
                },
                text=True,
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=3,
            )
            elapsed = time.monotonic() - started
            self.assertNotEqual(0, result.returncode)
            self.assertIn("control publication lock timeout", result.stderr)
            self.assertLess(elapsed, 3)


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
