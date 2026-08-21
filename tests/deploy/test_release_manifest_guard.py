import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]
GUARD = ROOT / "deploy" / "ysna" / "manifest-guard.sh"


@unittest.skipUnless(shutil.which("bash"), "bash is required for deployment guard tests")
class ReleaseManifestReferenceTests(unittest.TestCase):
    def _git(self, cwd, *args):
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()

    def _repo_with_control_manifest(self):
        temp = tempfile.TemporaryDirectory()
        repo = Path(temp.name)
        self._git(repo, "init", "-b", "main")
        self._git(repo, "config", "user.email", "test@example.invalid")
        self._git(repo, "config", "user.name", "release-test")
        (repo / "deploy" / "ysna").mkdir(parents=True)
        (repo / "deploy" / "ysna" / "payload.txt").write_text("earlier target\n", encoding="utf-8")
        self._git(repo, "add", ".")
        self._git(repo, "commit", "-m", "target")
        target = self._git(repo, "rev-parse", "HEAD")
        manifest = {
            "status": "APPROVED_FOR_DEPLOYMENT",
            "source": {"commit": target, "working_tree": "CLEAN"},
            "authority": {
                "successor_binding": "binding",
                "successor_binding_sha256": "a" * 64,
            },
            "rollback": {"approved_commits": [target]},
        }
        (repo / "deploy" / "ysna" / "ReleaseManifest.json").write_text(
            json.dumps(manifest), encoding="utf-8"
        )
        self._git(repo, "add", ".")
        self._git(repo, "commit", "-m", "control manifest")
        control = self._git(repo, "rev-parse", "HEAD")
        self._git(repo, "update-ref", "refs/remotes/origin/main", control)
        return temp, repo, target, control

    def _validate(self, repo, ref, target, mode="deploy"):
        guard = str(GUARD).replace("\\", "/")
        if len(guard) > 1 and guard[1] == ":":
            guard = "/mnt/" + guard[0].lower() + guard[2:]
        repo_arg = str(repo).replace("\\", "/")
        if len(repo_arg) > 1 and repo_arg[1] == ":":
            repo_arg = "/mnt/" + repo_arg[0].lower() + repo_arg[2:]
        command = f"source '{guard}'; validate_release_manifest '{repo_arg}' {ref} {target} {mode}"
        return subprocess.run(["bash", "-c", command], text=True, capture_output=True)

    def test_control_commit_can_approve_earlier_target(self):
        temp, repo, target, control = self._repo_with_control_manifest()
        with temp:
            result = self._validate(repo, "origin/main", target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertNotEqual(target, control)

    def test_rollback_requires_manifest_allowlist(self):
        temp, repo, target, _ = self._repo_with_control_manifest()
        with temp:
            result = self._validate(repo, "origin/main", target, "rollback")
            self.assertEqual(result.returncode, 0, result.stderr)
            result = self._validate(repo, "origin/main", "0" * 40, "rollback")
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
