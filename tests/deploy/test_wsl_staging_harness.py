import base64
import hashlib
import json
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
    @staticmethod
    def _canonical(value: object) -> bytes:
        return json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")

    def _git(self, cwd: Path, *args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()

    @staticmethod
    def _posix(path: Path) -> str:
        value = str(path).replace("\\", "/")
        if len(value) > 1 and value[1] == ":":
            return f"/{value[0].lower()}{value[2:]}"
        return value

    def _repo(self, historical=False):
        temp = tempfile.TemporaryDirectory()
        repo = Path(temp.name) / "repo"
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
        self._git(repo, "config", "user.email", "test@example.invalid")
        self._git(repo, "config", "user.name", "wsl-harness-test")
        candidate = "5f8c301e18c332e3353092dab9efe5c32d0fda84" if historical else "a342d62391a44b349733d1468ac3b180761155ab"
        candidate_ref = "refs/remotes/origin/candidates/c21-wsl-exact54" if historical else "refs/remotes/origin/candidates/c21-wsl-exact56"
        control_ref = "refs/remotes/origin/codex/c21-operational-execution"
        self._git(repo, "checkout", "-B", "test-control", candidate)
        shutil.copy2(
            DEPLOY / "CandidateReleaseManifest.json",
            repo / "deploy" / "wsl" / "CandidateReleaseManifest.json",
        )
        if historical:
            (repo / "deploy/wsl/CandidateReleaseManifest.json").write_bytes(subprocess.check_output(
                ["git", "show", "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo))
        approval_relative = 'docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md'
        (repo / approval_relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / approval_relative, repo / approval_relative)
        self._git(repo, "add", approval_relative)
        self._git(repo, "add", "deploy/wsl/CandidateReleaseManifest.json")
        self._git(repo, "commit", "--allow-empty", "-m", "seq494 fixture record")
        source_head = self._git(repo, "rev-parse", "HEAD")
        self._git(repo, "update-ref", candidate_ref, candidate)
        self._git(repo, "update-ref", control_ref, source_head)
        blob = subprocess.check_output(
            ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo
        )
        checksum = hashlib.sha256(blob).hexdigest()
        return temp, repo, candidate, control_ref, checksum

    def _validate(self, repo: Path, control_ref: str, candidate: str, checksum: str, guard=GUARD):
        command = (
            f"source '{self._posix(guard)}'; "
            f"validate_wsl_candidate_binding '{self._posix(repo)}' {control_ref} {candidate}"
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

    def test_ingress_approval_and_derived_coherent_rewrite_is_rejected(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            relative = "docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md"
            approval = repo / relative
            approval.write_bytes(approval.read_bytes() + b"\nUNAPPROVED_EGRESS_EXTENSION\n")
            path = repo / "deploy/wsl/CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            derived = manifest["authority"]["derived_binding"]
            derived["exception_approval"]["sha256"] = hashlib.sha256(approval.read_bytes()).hexdigest().upper()
            manifest["authority"]["derived_binding_sha256"] = hashlib.sha256(self._canonical(derived)).hexdigest().upper()
            path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            self._git(repo, "add", relative, "deploy/wsl/CandidateReleaseManifest.json")
            self._git(repo, "commit", "--amend", "--no-edit")
            self._git(repo, "update-ref", control_ref, self._git(repo, "rev-parse", "HEAD"))
            checksum = hashlib.sha256(subprocess.check_output(["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo)).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("ingress exception approval checksum mismatch", result.stderr)

    def test_binding_pass_does_not_authorize_runtime_execution(self):
        temp, repo, candidate, control_ref, checksum = self._repo(historical=True)
        with temp:
            historical_guard = repo / "historical-guard.sh"
            historical_guard.write_bytes(subprocess.check_output(["git", "show", "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994:deploy/wsl/candidate-manifest-guard.sh"], cwd=repo))
            self.assertEqual(0, self._validate(repo, control_ref, candidate, checksum, historical_guard).returncode)
            command = f"source '{self._posix(historical_guard)}'; docker() {{ echo UNEXPECTED_DOCKER; return 97; }}; validate_wsl_candidate_manifest '{self._posix(repo)}' {control_ref} {candidate}"
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": self._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum})
            self.assertEqual(22, result.returncode, result.stderr)
            self.assertIn("BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", result.stderr)
            self.assertNotIn("UNEXPECTED_DOCKER", result.stdout + result.stderr)

    def test_cleanup_entrypoint_external_scope_hold_prevents_docker_and_file_mutations(self):
        temp, repo, candidate, control_ref, checksum = self._repo(historical=True)
        with temp:
            control = repo / "entry-control" / "deploy" / "wsl"
            control.mkdir(parents=True)
            for name in ("cleanup.sh", "common.sh", "candidate-manifest-guard.sh"):
                (control / name).write_bytes(subprocess.check_output(["git", "show", "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994:deploy/wsl/" + name], cwd=repo))
            before = {str(path.relative_to(repo)): path.read_bytes() for path in repo.rglob("*") if path.is_file() and ".git" not in path.parts}
            command = f"docker() {{ echo UNEXPECTED_DOCKER; return 97; }}; export -f docker; bash '{self._posix(control / 'cleanup.sh')}' {candidate}"
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": self._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum,
                    "ANVIL_CANDIDATE_MANIFEST_REF": control_ref, "ANVIL_WSL_DEPLOY_ROOT": self._posix(repo),
                    "ANVIL_WSL_CONTROL_REPO": self._posix(repo / "entry-control"), "ANVIL_WSL_APPLICATION_REPO": self._posix(repo)})
            self.assertEqual(22, result.returncode, result.stderr)
            self.assertIn("BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", result.stderr)
            self.assertNotIn("UNEXPECTED_DOCKER", result.stdout + result.stderr)
            after = {str(path.relative_to(repo)): path.read_bytes() for path in repo.rglob("*") if path.is_file() and ".git" not in path.parts}
            self.assertEqual(before, after)

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
            self._git(repo, "update-ref", "refs/remotes/origin/candidates/c21-wsl-exact56", unapproved)
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

    def test_control_ref_rejects_two_commit_descendant(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            (repo / "extra.txt").write_text("second descendant\n", encoding="utf-8")
            self._git(repo, "add", "extra.txt")
            self._git(repo, "commit", "-m", "second descendant")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("single-parent direct child", result.stderr)

    def test_control_ref_rejects_merge_child(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            self._git(repo, "checkout", "-b", "side", candidate)
            self._git(repo, "commit", "--allow-empty", "-m", "side parent")
            self._git(repo, "checkout", "test-control")
            self._git(repo, "merge", "--no-ff", "side", "-m", "merge child")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("single-parent direct child", result.stderr)

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

    def test_manifest_rejects_derived_binding_payload_or_hash_tamper(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["authority"]["derived_binding"]["review"]["quality"] = "REJECTED"
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "tamper derived binding")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("derived binding", result.stderr)

    def test_manifest_rejects_private_push_policy_tamper(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["authority"]["private_push_policy"] = (
                "BLOCKED_PENDING_SEPARATE_PROJECT_APPROVAL"
            )
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "tamper private push policy")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("private push policy", result.stderr)

    def test_manifest_rejects_old_candidate_ref(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            manifest["source"]["remote_ref"] = (
                "refs/remotes/origin/candidates/c21-wsl-exact34"
            )
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "use old candidate ref")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("exact candidate remote-tracking ref", result.stderr)

    def test_manifest_rejects_wrong_candidate_parent(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            manifest = json.loads(path.read_text(encoding="utf-8"))
            binding = manifest["authority"]["derived_binding"]
            binding["candidate_parent_commit"] = "0" * 40
            manifest["authority"]["derived_binding_sha256"] = hashlib.sha256(
                self._canonical(binding)
            ).hexdigest().upper()
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "wrong candidate parent")
            self._git(repo, "update-ref", control_ref, "HEAD")
            checksum = hashlib.sha256(
                subprocess.check_output(
                    ["git", "show", f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],
                    cwd=repo,
                )
            ).hexdigest()
            result = self._validate(repo, control_ref, candidate, checksum)
            self.assertNotEqual(0, result.returncode)
            self.assertIn("candidate parent", result.stderr)

    def test_manifest_rejects_coherently_rebound_candidate_parent_and_hash(self):
        temp, repo, candidate, control_ref, _ = self._repo()
        with temp:
            candidate_parent = self._git(repo, "rev-parse", f"{candidate}^")
            self._git(repo, "checkout", "-b", "coherent-tamper", candidate_parent)
            self._git(repo, "commit", "--allow-empty", "-m", "alternate parent")
            tampered_parent = self._git(repo, "rev-parse", "HEAD")
            (repo / "deploy" / "wsl" / "common.sh").write_text(
                "coherently tampered common\n", encoding="utf-8"
            )
            (repo / "tests" / "deploy" / "test_wsl_staging_harness.py").write_text(
                "coherently tampered test\n", encoding="utf-8"
            )
            self._git(repo, "add", ".")
            self._git(repo, "commit", "-m", "alternate exact2 candidate")
            tampered_candidate = self._git(repo, "rev-parse", "HEAD")

            manifest = json.loads(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json",
                    ],
                    cwd=repo,
                    text=True,
                    encoding="utf-8",
                )
            )
            binding = manifest["authority"]["derived_binding"]
            binding["candidate_parent_commit"] = tampered_parent
            binding["candidate_commit"] = tampered_candidate
            manifest["authority"]["derived_binding_sha256"] = hashlib.sha256(
                self._canonical(binding)
            ).hexdigest().upper()
            manifest["source"]["commit"] = tampered_candidate
            manifest["rollback"]["approved_commits"] = [tampered_candidate]
            path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
            path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
            approval_relative = "docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md"
            (repo / approval_relative).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / approval_relative, repo / approval_relative)
            self._git(repo, "add", approval_relative)
            self._git(repo, "add", str(path.relative_to(repo)))
            self._git(repo, "commit", "-m", "coherently rebound manifest")
            self._git(repo, "update-ref", control_ref, "HEAD")
            self._git(
                repo,
                "update-ref",
                "refs/remotes/origin/candidates/c21-wsl-exact56",
                tampered_candidate,
            )
            checksum = hashlib.sha256(
                subprocess.check_output(
                    [
                        "git",
                        "show",
                        f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json",
                    ],
                    cwd=repo,
                )
            ).hexdigest()

            result = self._validate(
                repo, control_ref, tampered_candidate, checksum
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("exact derived binding", result.stderr)

    def test_manifest_rejects_correction_path_subset_or_superset(self):
        for correction_paths in (
            ["deploy/wsl/common.sh"],
            [
                "deploy/wsl/common.sh",
                "tests/deploy/test_wsl_staging_harness.py",
                "arbitrary.txt",
            ],
        ):
            with self.subTest(correction_paths=correction_paths):
                temp, repo, candidate, control_ref, _ = self._repo()
                with temp:
                    path = repo / "deploy" / "wsl" / "CandidateReleaseManifest.json"
                    manifest = json.loads(path.read_text(encoding="utf-8"))
                    binding = manifest["authority"]["derived_binding"]
                    binding["correction_paths"] = correction_paths
                    binding["correction_path_count"] = len(correction_paths)
                    binding["correction_path_list_sha256"] = hashlib.sha256(
                        self._canonical(sorted(correction_paths))
                    ).hexdigest().upper()
                    manifest["authority"]["derived_binding_sha256"] = hashlib.sha256(
                        self._canonical(binding)
                    ).hexdigest().upper()
                    path.write_text(json.dumps(manifest) + "\n", encoding="utf-8")
                    self._git(repo, "add", str(path.relative_to(repo)))
                    self._git(repo, "commit", "-m", "wrong correction paths")
                    self._git(repo, "update-ref", control_ref, "HEAD")
                    checksum = hashlib.sha256(
                        subprocess.check_output(
                            [
                                "git",
                                "show",
                                f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json",
                            ],
                            cwd=repo,
                        )
                    ).hexdigest()
                    result = self._validate(repo, control_ref, candidate, checksum)
                    self.assertNotEqual(0, result.returncode)
                    self.assertIn("correction path", result.stderr)

    def _runtime(self, repo, control_ref, candidate, checksum):
        # Actual public guard: both binding and execution resume run unchanged.
        command = f"source '{self._posix(GUARD)}'; validate_wsl_candidate_manifest '{self._posix(repo)}' {control_ref} {candidate}"
        return subprocess.run(["bash", "-c", command], text=True, capture_output=True,
            env=os.environ | {"ANVIL_PYTHON": self._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum})

    def test_seq494_actual_git_public_ready_without_helper_stub(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            result = self._runtime(repo, control_ref, candidate, checksum)
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual([candidate], self._git(repo, "show", "-s", "--format=%P", control_ref).split())
            self.assertEqual("", self._git(repo, "status", "--porcelain"))
            # A second fresh local clone verifies immutable Git blobs, not the writer tree.
            fresh = repo.parent / "fresh"
            subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--no-hardlinks", str(repo), str(fresh)], check=True)
            self._git(fresh, "update-ref", control_ref, self._git(repo, "rev-parse", control_ref))
            self._git(fresh, "update-ref", "refs/remotes/origin/candidates/c21-wsl-exact56", candidate)
            accepted = self._runtime(fresh, control_ref, candidate, checksum)
            self.assertEqual(0, accepted.returncode, accepted.stderr)

    def test_seq494_public_coherent_resume_or_work_instruction_rewrite_rejected(self):
        for scenario in ("missing_resume", "actions", "exclusions", "predecessor", "wi_blob", "gate", "unbound_gate_env"):
            with self.subTest(scenario=scenario):
                temp, repo, candidate, control_ref, checksum = self._repo()
                with temp:
                    path = repo / "deploy/wsl/CandidateReleaseManifest.json"
                    doc = json.loads(path.read_bytes()); derived = doc["authority"]["derived_binding"]
                    if scenario == "missing_resume": derived.pop("execution_resume")
                    elif scenario == "actions": derived["execution_resume"]["actions"].append("ysna_deploy")
                    elif scenario == "exclusions": derived["execution_resume"]["exclusions"] = []
                    elif scenario == "predecessor": derived["execution_resume"]["predecessor_control_commit"] = "0" * 40
                    elif scenario == "wi_blob":
                        wi = repo / derived["execution_resume"]["work_instruction_path"]
                        wi.write_bytes(wi.read_bytes() + b"\nUNAPPROVED\n")
                        self._git(repo, "add", str(wi.relative_to(repo)))
                    elif scenario in ("gate", "unbound_gate_env"): doc["runtime_safety_gate"] = "BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE"
                    doc["authority"]["derived_binding_sha256"] = hashlib.sha256(self._canonical(derived)).hexdigest().upper()
                    path.write_bytes((json.dumps(doc,ensure_ascii=False,indent=2)+"\n").encode())
                    self._git(repo,"add",str(path.relative_to(repo)));self._git(repo,"commit","--amend","--no-edit")
                    self._git(repo,"update-ref",control_ref,self._git(repo,"rev-parse","HEAD"))
                    checksum=hashlib.sha256(subprocess.check_output(["git","show",f"{control_ref}:deploy/wsl/CandidateReleaseManifest.json"],cwd=repo)).hexdigest()
                    before={str(p.relative_to(repo)):p.read_bytes() for p in repo.rglob("*") if p.is_file() and ".git" not in p.parts}
                    prior_env=os.environ.get("ANVIL_RUNTIME_SAFETY_GATE")
                    try:
                        os.environ["ANVIL_RUNTIME_SAFETY_GATE"]="READY_FOR_APPROVED_WSL_QA"
                        result=self._runtime(repo,control_ref,candidate,checksum)
                    finally:
                        if prior_env is None: os.environ.pop("ANVIL_RUNTIME_SAFETY_GATE",None)
                        else: os.environ["ANVIL_RUNTIME_SAFETY_GATE"]=prior_env
                    self.assertNotEqual(0,result.returncode,result.stderr)
                    after={str(p.relative_to(repo)):p.read_bytes() for p in repo.rglob("*") if p.is_file() and ".git" not in p.parts}
                    self.assertEqual(before,after)



@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslScriptFailClosedTests(unittest.TestCase):
    @staticmethod
    def _canonical(value: object) -> bytes:
        return json.dumps(
            value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")

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
        candidate = "a342d62391a44b349733d1468ac3b180761155ab"
        self.assertEqual("APPROVED_FOR_STAGING_VALIDATION", manifest["status"])
        self.assertEqual(candidate, manifest["source"]["commit"])
        self.assertEqual(
            "refs/remotes/origin/candidates/c21-wsl-exact56",
            manifest["source"]["remote_ref"],
        )
        self.assertEqual([candidate, "324eb169fedbce958d2e8cc29362deb7af433677"], manifest["rollback"]["approved_commits"])
        binding = manifest["authority"]["derived_binding"]
        self.assertEqual(2320, len(self._canonical(binding)))
        self.assertEqual(
            "2A57298FA53B8D16AA399DEB9DE695620A20581B5FA85845B4C0EEE573647BE6",
            manifest["authority"]["derived_binding_sha256"],
        )
        self.assertEqual(
            manifest["authority"]["derived_binding_sha256"],
            hashlib.sha256(self._canonical(binding)).hexdigest().upper(),
        )
        self.assertEqual(
            ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION"], manifest["exclusions"]
        )

    def test_postgres_volume_target_is_exported_and_resets_between_versions(self):
        result = subprocess.run(
            ["bash", "-c", (
                'source "$1"; '
                'for version in 15 18-rc 15; do '
                'configure_wsl_target "$version" || exit; '
                'bash -c \'printf "%s\\n" "$ANVIL_POSTGRES_VOLUME_TARGET"\'; '
                'done'
            ), "volume-target-test", self._posix(DEPLOY / "common.sh")],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual([
            "/var/lib/postgresql/data", "/var/lib/postgresql", "/var/lib/postgresql/data",
        ], result.stdout.splitlines())
        compose = (DEPLOY / "compose.wsl.yml").read_text(encoding="utf-8")
        self.assertIn("anvil-db-data:${ANVIL_POSTGRES_VOLUME_TARGET:?", compose)

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
class WslColdStartTests(unittest.TestCase):
    def test_web_tmpfs_is_one_mount_with_all_security_options(self):
        runner = None
        if shutil.which("docker") and subprocess.run(["docker", "compose", "version"], capture_output=True).returncode == 0:
            runner = ["docker", "compose"]
        elif shutil.which("docker-compose"):
            runner = ["docker-compose"]
        if runner is None:
            self.skipTest("Compose parser is required; run this contract on WSL")
        env = os.environ | {"ANVIL_COMPOSE_PROJECT_NAME": "anvil-fixture", "ANVIL_POSTGRES_IMAGE": "postgres:15",
            "ANVIL_WSL_PG_PASSWORD": "synthetic", "ANVIL_RELEASE_COMMIT": "a" * 40, "ANVIL_WSL_HTTP_PORT": "13770"}
        result = subprocess.run([*runner, "-f", str(DEPLOY / "compose.wsl.yml"), "config", "--format", "json"],
                                env=env, text=True, capture_output=True)
        self.assertEqual(0, result.returncode, result.stderr)
        compose = json.loads(result.stdout)
        self.assertEqual(["/tmp:rw,noexec,nosuid,size=32m"], compose["services"]["anvil-web"]["tmpfs"])

    def test_bootstrap_rebind_preserves_bytes_secure_mode_and_cleans_failed_temp_on_posix_permissions(self):
        script = r'''set -euo pipefail
root="$(mktemp -d)"
trap 'rm -rf -- "$root"' EXIT
cp "$1" "$root/bootstrap.sh"
printf '#!/usr/bin/env bash\nexit 37\n' > "$root/control-runtime.sh"
printf '%s' "$2" | base64 -d > "$root/.env"
chmod "$4" "$root/.env"
[[ "$(stat -c '%a' "$root/.env")" == "$4" ]] || exit 78
printf '%s' "$3" | base64 -d > "$root/expected"
mkdir "$root/bin"
cat > "$root/bin/mv" <<'SH'
#!/usr/bin/env bash
if [[ "$1" == -f && "$3" == "$ANVIL_WSL_DEPLOY_ROOT/.env" ]]; then
  stat -c '%a' "$2" > "$ANVIL_TEST_MOVE_LOG"
  [[ "${ANVIL_TEST_MV_EXIT:-0}" == 0 ]] || exit "$ANVIL_TEST_MV_EXIT"
fi
exec /usr/bin/mv "$@"
SH
chmod 755 "$root/bin/mv"
export ANVIL_WSL_DEPLOY_ROOT="$root" ANVIL_TEST_MOVE_LOG="$root/move-mode"
set +e
PATH="$root/bin:$PATH" bash "$root/bootstrap.sh" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
status=$?
set -e
[[ "$status" == 37 ]]
cmp -s "$root/expected" "$root/.env"
[[ "$(cat "$root/move-mode")" == "$4" ]]
[[ "$(stat -c '%a' "$root/.env")" == "$4" ]]
cp "$root/.env" "$root/before-failure"
set +e
ANVIL_TEST_MV_EXIT=93 PATH="$root/bin:$PATH" bash "$root/bootstrap.sh" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
status=$?
set -e
[[ "$status" == 93 ]]
cmp -s "$root/before-failure" "$root/.env"
[[ -z "$(find "$root" -maxdepth 1 -name '.env.tmp.*' -print -quit)" ]]
'''
        for ending in (b"\n", b"\r\n"):
            for final_newline in (False, True):
                for mode in ("600", "400"):
                    with self.subTest(ending=ending, final_newline=final_newline, mode=mode):
                        original = (
                            b"ANVIL_WSL_PG_PASSWORD=preserve=this=byte" + ending
                            + b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read" + ending
                            + b"UNRELATED_SECRET=preserve=all=bytes"
                            + (ending if final_newline else b"")
                        )
                        expected = original.replace(
                            b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read",
                            b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read,provider:read",
                        )
                        result = subprocess.run(
                            [
                                "bash", "-c", script, "--",
                                WslControlRuntimeTests._posix(DEPLOY / "bootstrap.sh"),
                                base64.b64encode(original).decode("ascii"),
                                base64.b64encode(expected).decode("ascii"), mode,
                            ],
                            capture_output=True,
                            text=True,
                        )
                        if result.returncode == 78:
                            self.skipTest("Git Bash/NTFS cannot represent POSIX 0600/0400 modes; run on candidate WSL")
                        self.assertEqual(0, result.returncode, result.stderr)

    def test_bootstrap_temp_security_contract_is_ordered_before_secret_writes(self):
        source = (DEPLOY / "bootstrap.sh").read_text(encoding="utf-8")

        trap_index = source.index("trap cleanup_temp EXIT")
        signal_cleanup_index = source.index("trap 'cleanup_temp; exit 130' HUP INT TERM")
        secure_temp_index = source.index("create_secure_temp()")
        first_secret_write = source.index('cat > "$TEMP_FILE"')
        existing_env_transform = source.index('"$python_bin" - "$ENV_FILE" "$TEMP_FILE"')

        self.assertLess(trap_index, secure_temp_index)
        self.assertLess(signal_cleanup_index, secure_temp_index)
        self.assertLess(trap_index, first_secret_write)
        self.assertLess(trap_index, existing_env_transform)
        self.assertIn("  umask 077\n  TEMP_FILE=\"$(mktemp \"$ENV_FILE.tmp.XXXXXX\")\"", source)
        new_file_chmod = source.index('chmod 600 "$TEMP_FILE"')
        self.assertLess(new_file_chmod, source.index('mv -f "$TEMP_FILE" "$ENV_FILE"', new_file_chmod))
        chmod_index = source.index('chmod "$mode" "$TEMP_FILE"')
        self.assertLess(chmod_index, source.index('mv -f "$TEMP_FILE" "$ENV_FILE"', chmod_index))

    def test_bootstrap_scope_transform_preserves_lf_crlf_and_final_newline_bytes(self):
        source = (DEPLOY / "bootstrap.sh").read_text(encoding="utf-8")
        transform = source.split("<<'PY'\n", 1)[1].split("\nPY\n", 1)[0]
        scope = b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read,provider:read"

        for ending in (b"\n", b"\r\n"):
            for final_newline in (False, True):
                for contains_scope in (False, True):
                    with self.subTest(ending=ending, final_newline=final_newline, contains_scope=contains_scope):
                        original_lines = [b"ANVIL_WSL_PG_PASSWORD=preserve=this=byte"]
                        if contains_scope:
                            original_lines.append(b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read")
                        original_lines.append(b"UNRELATED_SECRET=preserve=all=bytes")
                        original = ending.join(original_lines) + (ending if final_newline else b"")
                        expected = (
                            original.replace(
                                b"ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read",
                                scope,
                            )
                            if contains_scope
                            else original + (ending if original and not original.endswith(b"\n") else b"") + scope + ending
                        )
                        with tempfile.TemporaryDirectory() as temp:
                            source_path = Path(temp) / ".env"
                            target_path = Path(temp) / ".env.tmp"
                            source_path.write_bytes(original)
                            result = subprocess.run(
                                [sys.executable, "-c", transform, str(source_path), str(target_path)],
                                capture_output=True,
                                text=True,
                            )
                            self.assertEqual(0, result.returncode, result.stderr)
                            self.assertEqual(expected, target_path.read_bytes())

    def test_database_readiness_failure_prevents_backup_and_build(self):
        self._deploy_readiness(False)

    def test_database_readiness_success_precedes_backup(self):
        self._deploy_readiness(True)

    def _deploy_readiness(self, ready):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            scripts = root / "scripts"
            scripts.mkdir()
            shutil.copyfile(DEPLOY / "deploy.sh", scripts / "deploy.sh")
            (root / "repo" / ".git").mkdir(parents=True)
            (scripts / "candidate-manifest-guard.sh").write_text("validate_wsl_candidate_manifest() { :; }\n", encoding="utf-8")
            (scripts / "common.sh").write_text('''require_exact_sha() { :; }
require_control_utility_checkout() { :; }
load_server_environment() { :; }
configure_wsl_target() { ANVIL_TARGET_SLUG=pg15; }
git() { [[ "$*" == *'rev-parse HEAD'* ]] && printf '%s\\n' "$EXPECTED"; return 0; }
wsl_compose() {
  printf '%s\\n' "$*" >> "$ANVIL_TEST_LOG"
  case "$1" in
    images|pull) return 0;;
    up)
      [[ " $* " == *' --wait '* && " $* " == *' --wait-timeout '* ]] || return 0
      [[ "$ANVIL_TEST_READY" == yes ]] || return 17
      touch "$ROOT/ready";;
    exec) [[ -f "$ROOT/ready" ]] || return 19; return 23;;
    *) return 29;;
  esac
}
''', encoding="utf-8")
            log = root / "calls"
            result = subprocess.run(["bash", str(scripts / "deploy.sh"), "a" * 40],
                env=os.environ | {"ANVIL_WSL_DEPLOY_ROOT": WslControlRuntimeTests._posix(root),
                    "ANVIL_CANDIDATE_MANIFEST_REF": "fixture", "ANVIL_TEST_LOG": WslControlRuntimeTests._posix(log),
                    "ANVIL_TEST_READY": "yes" if ready else "no"}, capture_output=True, text=True)
            calls = log.read_text().splitlines()
            if ready:
                self.assertEqual(23, result.returncode, result.stderr)
                self.assertTrue((root / "ready").exists())
                self.assertTrue(any("pg_dump" in call for call in calls))
            else:
                self.assertEqual(17, result.returncode, result.stderr)
                self.assertFalse(any("pg_dump" in call or "build" in call for call in calls))


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
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact56", candidate)
            (source / "control-marker.txt").write_text("control\n", encoding="utf-8")
            approval_relative = "docs/approvals/APPROVAL-20260905-C21-WSL-INGRESS-EXCEPTION-001.md"
            (source / approval_relative).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / approval_relative, source / approval_relative)
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
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read,provider:read", ""
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
                    "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
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
                    "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
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
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact56", candidate)

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

    def test_rollback_unit_pg18_preflight_failure_makes_zero_compose_mutations(self):
        temp, repo, candidate, control_ref, checksum = WslCandidateManifestGuardTests()._repo()
        with temp, tempfile.TemporaryDirectory() as raw:
            root = Path(raw); control = root / "control"; shutil.copytree(DEPLOY, control / "deploy" / "wsl")
            # Isolate the existing rollback algorithm from runtime authorization.
            # Product files remain unchanged; real runtime I-3 exit 22 is tested separately.
            fixture_rollback = control / "deploy" / "wsl" / "rollback.sh"
            fixture_rollback.write_text(fixture_rollback.read_text(encoding="utf-8").replace(
                'validate_wsl_candidate_manifest "$REPO" "$MANIFEST_REF" "$EXPECTED"',
                'validate_wsl_candidate_binding "$REPO" "$MANIFEST_REF" "$EXPECTED"'), encoding="utf-8")
            for slug, previous in (("pg15", "324eb169fedbce958d2e8cc29362deb7af433677"), ("pg18rc", "324eb169fedbce958d2e8cc29362deb7af433677")):
                path = root / "runtime" / slug; path.mkdir(parents=True, exist_ok=True); (path / "previous.sha").write_text(previous + "\n")
                (path / "current.sha").write_text(candidate + "\n")
            env_file = root / ".env"
            env_file.write_text("\n".join([
                "ANVIL_WSL_PG_PASSWORD=" + "a" * 48,
                "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=" + "b" * 64,
                "ANVIL_TEST_SESSION_ACTOR_ID=x", "ANVIL_TEST_SESSION_PROJECT_ID=x",
                "ANVIL_TEST_SESSION_ENVIRONMENT_ID=x", "ANVIL_TEST_SESSION_RUN_IDS=x",
                "ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read,provider:read", ""
            ]), encoding="utf-8")
            subprocess.run(["bash", "-c", f"chmod 600 '{self._posix(env_file)}'"], check=True)
            bin_dir = root / "bin"; bin_dir.mkdir(); log = root / "docker.log"
            docker = bin_dir / "docker"
            docker.write_text("#!/usr/bin/env bash\necho \"$ANVIL_TARGET_SLUG:$*\" >> \"$ANVIL_DOCKER_LOG\"\n[[ \"$ANVIL_TARGET_SLUG\" == pg18rc ]] && exit 1\necho 324eb169fedbce958d2e8cc29362deb7af433677\nexit 0\n", encoding="utf-8")
            curl = bin_dir / "curl"; curl.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            stat = bin_dir / "stat"; stat.write_text("#!/usr/bin/env bash\necho 600\n", encoding="utf-8")
            os.chmod(docker, 0o755); os.chmod(curl, 0o755); os.chmod(stat, 0o755)
            result = subprocess.run(["bash", str(control / "deploy" / "wsl" / "rollback.sh"), candidate], text=True, capture_output=True,
                env=os.environ | {"PATH": str(bin_dir) + os.pathsep + os.environ["PATH"], "ANVIL_DOCKER_LOG": self._posix(log), "ANVIL_WSL_DEPLOY_ROOT": self._posix(root), "ANVIL_WSL_CONTROL_REPO": self._posix(control), "ANVIL_WSL_APPLICATION_REPO": self._posix(repo), "ANVIL_CANDIDATE_MANIFEST_REF": control_ref, "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum, "ANVIL_PYTHON": self._posix(Path(sys.executable))})
            self.assertNotEqual(0, result.returncode)
            self.assertTrue(log.exists(), result.stderr)
            calls = log.read_text(encoding="utf-8").splitlines()
            self.assertTrue(any(call.startswith("pg15:image inspect") for call in calls))
            self.assertTrue(any(call.startswith("pg18rc:image inspect") for call in calls))
            self.assertFalse(any(":compose" in call for call in calls))

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
            self._git(source, "update-ref", "refs/heads/candidates/c21-wsl-exact56", candidate)
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


@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslComposeRunnerTests(unittest.TestCase):
    @staticmethod
    def _posix(path: Path) -> str:
        value = str(path).replace("\\", "/")
        if len(value) > 1 and value[1] == ":":
            return f"/{value[0].lower()}{value[2:]}"
        return value

    def _run_compose(
        self, docker_script: str, standalone_script: str | None = None
    ) -> tuple[subprocess.CompletedProcess[str], list[str], str]:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            log = root / "compose.log"
            repo = root / "repo"
            compose_file = repo / "deploy" / "wsl" / "compose.wsl.yml"
            compose_file.parent.mkdir(parents=True)
            compose_file.write_text("services: {}\n", encoding="utf-8")

            bash = shutil.which("bash")
            assert bash is not None
            docker = bin_dir / "docker"
            docker.write_text(f"#!/bin/bash\n{docker_script}", encoding="utf-8")
            os.chmod(docker, 0o755)
            if standalone_script is not None:
                standalone = bin_dir / "docker-compose"
                standalone.write_text(
                    f"#!/bin/bash\n{standalone_script}", encoding="utf-8"
                )
                os.chmod(standalone, 0o755)

            result = subprocess.run(
                [
                    bash,
                    "-c",
                    (
                        f"source '{self._posix(DEPLOY / 'common.sh')}'; "
                        f"REPO='{self._posix(repo)}'; "
                        "ANVIL_RELEASE_COMMIT='a'$(printf 'a%.0s' {1..39}); "
                        "wsl_compose config"
                    ),
                ],
                env=os.environ
                | {
                    "ANVIL_COMPOSE_LOG": self._posix(log),
                    "PATH": self._posix(bin_dir),
                },
                text=True,
                capture_output=True,
            )
            calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
            return result, calls, self._posix(compose_file)

    def test_falls_back_to_standalone_compose_when_plugin_is_unavailable(self):
        result, calls, compose_file = self._run_compose(
            'printf "docker:%s\\n" "$*" >> "$ANVIL_COMPOSE_LOG"\n'
            '[[ "$1 $2" == "compose version" ]] && exit 1\n'
            "exit 97\n",
            'printf "standalone:%s:%s\\n" "$ANVIL_RELEASE_COMMIT" "$*" >> "$ANVIL_COMPOSE_LOG"\n',
        )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("docker:compose version", calls)
        self.assertEqual(
            [
                "docker:compose version",
                f"standalone:{'a' * 40}:-f {compose_file} config",
            ],
            calls,
        )

    def test_prefers_the_docker_compose_plugin_when_available(self):
        result, calls, compose_file = self._run_compose(
            'if [[ "$1 $2" == "compose version" ]]; then\n'
            '  printf "docker:%s\\n" "$*" >> "$ANVIL_COMPOSE_LOG"\n'
            "  exit 0\n"
            "fi\n"
            'printf "docker-runner:%s:%s\\n" "$ANVIL_RELEASE_COMMIT" "$*" >> "$ANVIL_COMPOSE_LOG"\n'
        )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            [
                "docker:compose version",
                f"docker-runner:{'a' * 40}:compose -f {compose_file} config",
            ],
            calls,
        )

    def test_fails_closed_when_no_compose_runner_is_available(self):
        result, calls, _ = self._run_compose(
            'printf "docker:%s\\n" "$*" >> "$ANVIL_COMPOSE_LOG"\n'
            '[[ "$1 $2" == "compose version" ]] && exit 1\n'
            "exit 97\n"
        )

        self.assertEqual(127, result.returncode)
        self.assertIn("neither docker compose nor docker-compose is available", result.stderr)
        self.assertEqual(["docker:compose version"], calls)


class WslIngressTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("bash"), "bash is required")
    def test_cleanup_entrypoint_loads_private_environment_before_compose(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            control = root / "control" / "deploy" / "wsl"
            control.mkdir(parents=True)
            (root / "repo").mkdir()
            shutil.copy2(DEPLOY / "cleanup.sh", control / "cleanup.sh")
            common = (DEPLOY / "common.sh").read_text(encoding="utf-8")
            common += '\nstat() { echo 600; }\ncleanup_wsl_test_volumes() { [[ "${ANVIL_WSL_PG_PASSWORD:-}" == ' + 'a' * 48 + ' && "${ANVIL_TEST_SESSION_PERMISSION_SCOPES:-}" == tasks:write,tasks:read,run:events:read,provider:read && "${AUTHORITY_CHECKED:-}" == yes ]]; }\n'
            (control / "common.sh").write_text(common, encoding="utf-8")
            (control / "candidate-manifest-guard.sh").write_text('validate_wsl_candidate_manifest() { AUTHORITY_CHECKED=yes; }\n', encoding="utf-8")
            values = {"ANVIL_WSL_PG_PASSWORD": "a" * 48, "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN": "b" * 64,
                      "ANVIL_TEST_SESSION_ACTOR_ID": "x", "ANVIL_TEST_SESSION_PROJECT_ID": "x",
                      "ANVIL_TEST_SESSION_ENVIRONMENT_ID": "x", "ANVIL_TEST_SESSION_RUN_IDS": "x",
                      "ANVIL_TEST_SESSION_PERMISSION_SCOPES": "tasks:write,tasks:read,run:events:read,provider:read"}
            (root / ".env").write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
            result = subprocess.run(["bash", WslCandidateManifestGuardTests._posix(control / "cleanup.sh"), "c" * 40], capture_output=True, text=True,
                                    env={key: value for key, value in os.environ.items() if key not in values} | {
                                        "ANVIL_WSL_DEPLOY_ROOT": WslCandidateManifestGuardTests._posix(root),
                                        "ANVIL_WSL_CONTROL_REPO": WslCandidateManifestGuardTests._posix(root / "control"),
                                        "ANVIL_WSL_APPLICATION_REPO": WslCandidateManifestGuardTests._posix(root / "repo"),
                                        "ANVIL_CANDIDATE_MANIFEST_REF": "fixture-control"})
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertNotIn("a" * 48, result.stdout + result.stderr)
            self.assertNotIn("b" * 64, result.stdout + result.stderr)

    def test_ingress_configuration_preserves_application_isolation_and_origin(self):
        compose = (DEPLOY / "compose.wsl.yml").read_text(encoding="utf-8")
        self.assertIn("  anvil-ingress:", compose)
        web = compose.split("  anvil-web:", 1)[1].split("  anvil-ingress:", 1)[0]
        self.assertNotIn("    ports:", web)
        self.assertIn("networks: [anvil-wsl]", web)
        ingress = compose.split("  anvil-ingress:", 1)[1].split("\nvolumes:", 1)[0]
        self.assertIn("networks: [anvil-ingress, anvil-wsl]", ingress)
        self.assertNotIn("TELEGRAM", ingress)
        self.assertNotIn("ANVIL_DATABASE_URL", ingress)
        self.assertIn("nginx@sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236", ingress)
        config = (DEPLOY / "nginx-wsl.conf").read_text(encoding="utf-8")
        self.assertIn("proxy_set_header Host $http_host;", config)
        self.assertIn("server anvil-web:3770;", config)
        self.assertIn("proxy_buffering off;", config)
        self.assertIn("proxy_cache off;", config)
        self.assertIn("$request_method = CONNECT", config)

    def test_all_nginx_temp_paths_use_writable_tmpfs(self):
        config = (DEPLOY / "nginx-wsl.conf").read_text(encoding="utf-8")
        for module in ("client_body", "proxy", "fastcgi", "uwsgi", "scgi"):
            self.assertRegex(config, rf"{module}_temp_path /tmp/[a-z_]+;")

    @unittest.skipUnless(shutil.which("bash"), "bash is required")
    def test_ingress_is_recreated_before_bounded_host_readiness(self):
        with tempfile.TemporaryDirectory() as raw:
            log = Path(raw) / "calls"
            common = WslCandidateManifestGuardTests._posix(DEPLOY / "common.sh")
            log_path = WslCandidateManifestGuardTests._posix(log)
            command = f'''
source '{common}'
configure_wsl_target 15
wsl_compose() {{ printf 'compose:%s\\n' "$*" >> '{log_path}'; }}
curl() {{ printf 'curl:%s\\n' "$*" >> '{log_path}'; echo '{{"status":"ready","migration_head":"0013_task_bootstrap_authority"}}'; }}
start_wsl_ingress
'''
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True)
            self.assertEqual(0, result.returncode, result.stderr)
            calls = log.read_text().splitlines()
            self.assertIn("--entrypoint nginx anvil-ingress -t", calls[0])
            self.assertEqual("compose:up -d --no-build --force-recreate anvil-ingress", calls[1])
            self.assertIn("http://127.0.0.1:4770/health/ready", calls[2])

    @unittest.skipUnless(shutil.which("bash"), "bash is required")
    def test_ingress_readiness_failure_is_bounded(self):
        command = f'''
source '{WslCandidateManifestGuardTests._posix(DEPLOY / "common.sh")}'
configure_wsl_target 18-rc
wsl_compose() {{ return 0; }}
curl() {{ return 7; }}
sleep() {{ return 0; }}
start_wsl_ingress
'''
        result = subprocess.run(["bash", "-c", command], text=True, capture_output=True, timeout=5)
        self.assertEqual(6, result.returncode, result.stderr)
        self.assertIn("ingress readiness timeout", result.stderr)


class WslCleanupExecutionTests(WslCandidateManifestGuardTests):
    def _run_cleanup(self, repo: Path, candidate: str, control_ref: str, checksum: str, mismatch: str = ""):
        log = repo / "docker.log"
        # Exercise cleanup algorithm in an isolated fixture, not runtime authorization.
        # The real public guard is separately proven to stop before Docker with exit 22.
        fixture_common = repo / "cleanup-unit" / "common.sh"
        fixture_common.parent.mkdir()
        fixture_common.write_text((DEPLOY / "common.sh").read_text(encoding="utf-8").replace(
            'validate_wsl_candidate_manifest "$repo" "$manifest_ref" "$expected"',
            'validate_wsl_candidate_binding "$repo" "$manifest_ref" "$expected"'), encoding="utf-8")
        shutil.copy2(GUARD, fixture_common.parent / "candidate-manifest-guard.sh")
        command = f'''
source '{self._posix(fixture_common)}'
docker() {{
  echo "docker:$*" >> '{self._posix(log)}'
  if [[ "$1 $2" == "volume ls" ]]; then
    [[ '{mismatch}' == absent ]] && return 0
    printf '%s\\n' anvil-wsl-pg15_anvil-db-data anvil-wsl-pg18rc_anvil-db-data
  fi
  if [[ "$1 $2" == "network ls" && '{mismatch}' != absent ]]; then
    printf '%s\\n' anvil-wsl-pg15_anvil-ingress anvil-wsl-pg18rc_anvil-ingress unrelated-network
  fi
  if [[ "$1 $2" == "network inspect" ]]; then
    network="${{@: -1}}"
    case "$*" in
      *com.docker.compose.project*) [[ "$network" == anvil-wsl-pg15_* ]] && echo anvil-wsl-pg15 || echo anvil-wsl-pg18rc ;;
      *com.docker.compose.network*) [[ '{mismatch}' == network-label ]] && echo WRONG || echo anvil-ingress ;;
      *com.anvil.environment*) echo WSL_SERVER_TEST_STAGING ;;
      *com.anvil.cleanup-scope*) echo C21_WSL_ISOLATED_TEST ;;
      *'.Internal'*) echo false ;;
      *'len .Containers'*) echo 0 ;;
      *'range $id'*) [[ '{mismatch}' == unrelated-endpoint ]] && echo other-container ;;
    esac
    return 0
  fi
  if [[ "$1" == inspect ]]; then echo unrelated-project; fi
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
            "network-label",
            "unrelated-endpoint",
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
            removed_networks = [call.removeprefix("docker:network rm ") for call in calls if call.startswith("docker:network rm ")]
            self.assertEqual(["anvil-wsl-pg15_anvil-ingress", "anvil-wsl-pg18rc_anvil-ingress"], removed_networks)

    def test_already_absent_resources_are_idempotent(self):
        temp, repo, candidate, control_ref, checksum = self._repo()
        with temp:
            result, calls = self._run_cleanup(repo, candidate, control_ref, checksum, "absent")
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertFalse(any(call.startswith(("docker:volume rm", "docker:network rm")) for call in calls))




class WslRollbackAllowlistUnitTests(unittest.TestCase):
    PREVIOUS = "324eb169fedbce958d2e8cc29362deb7af433677"
    EXPECTED = "ccf5109d0640bf28c461e7754ad56e0821fd77be"

    def _case(self, scenario):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw); repo = root / "repo"; repo.mkdir()
            control = root / "control" / "deploy" / "wsl"; control.mkdir(parents=True)
            helper = WslCandidateManifestGuardTests()
            git = lambda *args: helper._git(repo, *args)
            git("init", "-b", "test-control"); git("config", "user.name", "Anvil Unit"); git("config", "user.email", "unit@example.invalid")
            path = repo / "deploy/wsl/CandidateReleaseManifest.json"; path.parent.mkdir(parents=True)
            doc = {"source": {"commit": self.EXPECTED}, "rollback": {"approved_commits": [self.EXPECTED, self.PREVIOUS]}}
            if scenario == "malformed_allowlist": doc["rollback"]["approved_commits"] = "not-a-list"
            if scenario == "malformed_sha": doc["rollback"]["approved_commits"] = [self.EXPECTED, "bad-sha"]
            payload = b"not-json\n" if scenario == "malformed_json" else (json.dumps(doc) + "\n").encode()
            if scenario != "missing_manifest": path.write_bytes(payload)
            (repo / "fixture.txt").write_text("unit\n")
            git("add", "."); git("commit", "-m", "immutable control")
            ref = "refs/heads/test-control"; immutable = git("rev-parse", "HEAD")
            checksum = "0" * 64 if scenario == "checksum_tamper" else hashlib.sha256(payload).hexdigest()
            shutil.copy2(DEPLOY / "rollback.sh", control / "rollback.sh")
            # Only the authorization/runtime gate is substituted in this isolated unit.
            # Actual production guard exit22 and no-side-effect entrypoint tests remain separate.
            (control / "candidate-manifest-guard.sh").write_text("validate_wsl_candidate_manifest() { return 0; }\n")
            if scenario == "control_ref_race":
                alternate = git("commit-tree", git("rev-parse", "HEAD^{tree}"), "-p", immutable, "-m", "racing control")
                (control / "candidate-manifest-guard.sh").write_text(f'validate_wsl_candidate_manifest() {{ git -C "$1" update-ref "$2" {alternate}; }}\n')
            common = (DEPLOY / "common.sh").read_text(encoding="utf-8")
            common += '\nload_server_environment() { return 0; }\nstart_wsl_ingress() { return 0; }\nwsl_compose() { echo "compose:$ANVIL_TARGET_SLUG:$*" >> "$ANVIL_UNIT_LOG"; }\ndocker() { local image="${@: -1}"; printf "%s\\n" "${image#anvil-wsl-web:}"; }\n'
            (control / "common.sh").write_text(common, encoding="utf-8")
            for slug in ("pg15", "pg18rc"):
                runtime = root / "runtime" / slug; runtime.mkdir(parents=True)
                previous = "d" * 40 if scenario == "unapproved" or (scenario == "second_unapproved" and slug == "pg18rc") else self.PREVIOUS
                (runtime / "previous.sha").write_text(previous + "\n"); (runtime / "current.sha").write_text(self.EXPECTED + "\n")
            evidence = root / "evidence"; evidence.mkdir(); (evidence / "preserved.json").write_text("{}\n")
            snapshot = lambda: {str(p.relative_to(root)): p.read_bytes() for directory in (root / "runtime", evidence) for p in directory.rglob("*") if p.is_file()}
            before = snapshot(); log = root / "calls.log"
            result = subprocess.run(["bash", helper._posix(control / "rollback.sh"), self.EXPECTED], text=True, capture_output=True,
                env=os.environ | {"ANVIL_WSL_DEPLOY_ROOT": helper._posix(root), "ANVIL_WSL_CONTROL_REPO": helper._posix(root / "control"),
                    "ANVIL_WSL_APPLICATION_REPO": helper._posix(repo), "ANVIL_CANDIDATE_MANIFEST_REF": ref,
                    "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum, "ANVIL_PYTHON": helper._posix(Path(sys.executable)), "ANVIL_UNIT_LOG": helper._posix(log)})
            calls = log.read_text().splitlines() if log.exists() else []
            if scenario == "approved":
                self.assertEqual(0, result.returncode, result.stderr); self.assertEqual(2, len(calls))
                for slug in ("pg15", "pg18rc"): self.assertEqual(self.PREVIOUS, (root / "runtime" / slug / "current.sha").read_text().strip())
            else:
                self.assertNotEqual(0, result.returncode, scenario)
                self.assertEqual([], calls, scenario); self.assertEqual(before, snapshot(), scenario)

    def test_approved_previous_is_accepted(self): self._case("approved")
    def test_unapproved_well_formed_image_is_rejected(self): self._case("unapproved")
    def test_second_target_unapproved_preserves_both_targets(self): self._case("second_unapproved")
    def test_missing_manifest_is_rejected(self): self._case("missing_manifest")
    def test_malformed_manifest_is_rejected(self): self._case("malformed_json")
    def test_malformed_allowlist_is_rejected(self): self._case("malformed_allowlist")
    def test_manifest_checksum_tamper_is_rejected(self): self._case("checksum_tamper")
    def test_malformed_sha_allowlist_is_rejected(self): self._case("malformed_sha")
    def test_control_ref_change_during_validation_is_rejected(self): self._case("control_ref_race")

@unittest.skipUnless(shutil.which("bash"), "bash is required")
class WslExecutionResumeStateUnitTests(unittest.TestCase):
    """State helper fixtures only: not full READY guard or actual WSL execution."""
    WI = "docs/work_orders/C-21_WSL_EARLY_VALIDATION_WORK_INSTRUCTION.md"
    EXPECTED = "a" * 40
    CONTRACT = {
        "work_instruction_path": WI,
        "work_instruction_sha256": "52AA197F724F1D0AB59F061D187EFE3744ED86AFC52E5E504DA0E26C4BE04FF8",
        "predecessor_control_commit": "ad3355baf0aa94da27b8cb6b5ee5a90215ee5994",
        "environment": "WSL_SERVER_TEST_STAGING",
        "postgres_targets": ["15", "18-rc"],
        "actions": ["deploy", "verify", "rollback", "cleanup"],
        "exclusions": ["TELEGRAM_EXECUTION", "PROVIDER_EXECUTION", "YSNA_EXECUTION", "MAIN_MERGE"],
    }

    def _case(self, scenario):
        with tempfile.TemporaryDirectory() as raw:
            repo = Path(raw) / "repo"
            repo.mkdir()
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=repo).decode().strip()
            git("init", "--quiet")
            git("config", "core.autocrlf", "false")
            git("config", "user.name", "Anvil State Unit")
            git("config", "user.email", "state-unit@example.invalid")
            wi = repo / self.WI
            wi.parent.mkdir(parents=True)
            wi.write_bytes((ROOT / self.WI).read_bytes())
            doc = json.loads((DEPLOY / "CandidateReleaseManifest.json").read_text(encoding="utf-8"))
            doc["source"]["commit"] = self.EXPECTED
            doc["runtime_safety_gate"] = "READY_FOR_APPROVED_WSL_QA"
            binding = doc["authority"]["derived_binding"]
            binding["candidate_commit"] = self.EXPECTED
            binding["execution_resume"] = json.loads(json.dumps(self.CONTRACT))
            if scenario in ("BLOCKED_IMPORTANT_I3", "BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", "UNKNOWN"):
                doc["runtime_safety_gate"] = scenario
            elif scenario == "missing_gate": del doc["runtime_safety_gate"]
            elif scenario == "gate_only": del binding["execution_resume"]
            elif scenario == "parent": binding["execution_resume"]["predecessor_control_commit"] = "b" * 40
            elif scenario == "actions": binding["execution_resume"]["actions"].append("publish")
            elif scenario == "exclusions": binding["execution_resume"]["exclusions"] = []
            elif scenario == "environment": binding["execution_resume"]["environment"] = "YSNA"
            elif scenario == "targets": binding["execution_resume"]["postgres_targets"] = ["15"]
            elif scenario == "wi_hash": binding["execution_resume"]["work_instruction_sha256"] = "F" * 64
            elif scenario == "wi_blob": wi.write_bytes(wi.read_bytes() + b"\nUNAPPROVED\n")
            doc["authority"]["derived_binding_sha256"] = hashlib.sha256(WslCandidateManifestGuardTests._canonical(binding)).hexdigest().upper()
            if scenario == "derived_hash": doc["authority"]["derived_binding_sha256"] = "0" * 64
            manifest = repo / "deploy/wsl/CandidateReleaseManifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            git("add", ".")
            git("commit", "--quiet", "-m", "isolated state fixture")
            control = git("rev-parse", "HEAD")
            checksum = hashlib.sha256(subprocess.check_output(["git", "show", f"{control}:deploy/wsl/CandidateReleaseManifest.json"], cwd=repo)).hexdigest()
            if scenario == "raw_checksum": checksum = "0" * 64
            posix = WslCandidateManifestGuardTests._posix
            command = f"source '{posix(GUARD)}'; validate_wsl_execution_resume '{posix(repo)}' {control} {self.EXPECTED}"
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum})
            self.assertEqual(0 if scenario == "ready" else 22, result.returncode, result.stderr)

    def test_ready_state_requires_exact_existing_instruction_scope(self): self._case("ready")
    def test_blocked_or_missing_gate_stays_blocked(self):
        for scenario in ("BLOCKED_IMPORTANT_I3", "BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE", "UNKNOWN", "missing_gate"):
            with self.subTest(scenario=scenario): self._case(scenario)
    def test_gate_only_or_coherent_scope_promotion_is_rejected(self):
        for scenario in ("gate_only", "parent", "actions", "exclusions", "environment", "targets", "wi_hash"):
            with self.subTest(scenario=scenario): self._case(scenario)
    def test_instruction_blob_and_manifest_checksums_are_verified(self):
        for scenario in ("wi_blob", "derived_hash", "raw_checksum"):
            with self.subTest(scenario=scenario): self._case(scenario)

    def test_public_runtime_rejects_control_ref_changed_by_binding_validation(self):
        helper = WslCandidateManifestGuardTests()
        temp, repo, candidate, control_ref, checksum = helper._repo()
        with temp:
            # Isolate ref-race behavior; only the binding collaborator is instrumented.
            command = (f"source '{helper._posix(GUARD)}'; "
                f"validate_wsl_candidate_binding() {{ git -C '{helper._posix(repo)}' update-ref {control_ref} {candidate}; }}; "
                f"validate_wsl_candidate_manifest '{helper._posix(repo)}' {control_ref} {candidate}")
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": helper._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum})
            self.assertEqual(20, result.returncode, result.stderr)
            self.assertIn("control revision changed", result.stderr)

    def test_public_runtime_rechecks_original_raw_checksum_after_binding(self):
        helper = WslCandidateManifestGuardTests()
        temp, repo, candidate, control_ref, _ = helper._repo()
        with temp:
            # Instrument only binding to reach the public runtime checksum boundary.
            command = (f"source '{helper._posix(GUARD)}'; validate_wsl_candidate_binding() {{ return 0; }}; "
                f"validate_wsl_candidate_manifest '{helper._posix(repo)}' {control_ref} {candidate}")
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": helper._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": "0" * 64})
            self.assertEqual(22, result.returncode, result.stderr)
            self.assertIn("manifest checksum mismatch", result.stderr)

    def test_public_runtime_rejects_aba_control_capture_during_binding(self):
        helper = WslCandidateManifestGuardTests()
        temp, repo, candidate, control_ref, checksum = helper._repo()
        with temp:
            original = helper._git(repo, "rev-parse", control_ref)
            sibling = helper._git(repo, "commit-tree", helper._git(repo, "rev-parse", "HEAD^{tree}"), "-p", candidate, "-m", "same-tree sibling for ABA fixture")
            counter = helper._posix(repo / ".git" / "control-lookups")
            command = f'''source '{helper._posix(GUARD)}'
git() {{
  if [[ "$*" == *'rev-parse --verify {control_ref}^{{commit}}' ]]; then
    count=0; [[ ! -f '{counter}' ]] || read -r count < '{counter}'
    count=$((count+1)); printf '%s\\n' "$count" > '{counter}'
    if [[ "$count" == 2 ]]; then
      command git -C '{helper._posix(repo)}' update-ref {control_ref} {sibling}
      command git "$@"
      command git -C '{helper._posix(repo)}' update-ref {control_ref} {original}
      return 0
    fi
  fi
  command git "$@"
}}
validate_wsl_candidate_manifest '{helper._posix(repo)}' {control_ref} {candidate}
'''
            result = subprocess.run(["bash", "-c", command], text=True, capture_output=True,
                env=os.environ | {"ANVIL_PYTHON": helper._posix(Path(sys.executable)), "ANVIL_CANDIDATE_MANIFEST_SHA256": checksum})
            self.assertEqual(original, helper._git(repo, "rev-parse", control_ref))
            self.assertEqual(20, result.returncode, result.stderr)
            self.assertIn("pinned control revision mismatch", result.stderr)

if __name__ == "__main__":
    unittest.main()
