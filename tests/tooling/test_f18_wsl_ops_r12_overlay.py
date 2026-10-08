"""R12 auth-ingress writer starts only from the verified R11 closeout."""

import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
PREVIOUS_STATE = "79a857c332a029e31bb0ce0c4ea220be072a56ce"
PUBLISHED_ACTIVE = "cae47aa8c2dd14d561d03b8eaf25948c860f136e"
HISTORICAL_ACTIVE = "c7610e20ba80f5e3aec356e0fc3b282ae9fb050b"
EXACT3 = sorted(("deploy/local/nginx.conf", "tests/integration/test_f15_local_stack.py",
                 "docs/04_test_reports/F-18_WSL_OPS_REPORT.md"))


def _historical_git_root(tmp_path, start):
    """Pin both remote-tracking refs to the exact R12 issuance-era Git objects."""
    clone = tmp_path / "r12-repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", "--no-checkout", str(ROOT), str(clone)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", start.BRANCH, HISTORICAL_ACTIVE],
                   cwd=clone, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=clone, check=True)
    for name, revision in (("main", start.BASE), (start.BRANCH, HISTORICAL_ACTIVE)):
        subprocess.run(["git", "update-ref", f"refs/remotes/development/{name}", revision],
                       cwd=clone, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to", f"development/{start.BRANCH}"],
                   cwd=clone, check=True, capture_output=True)
    return clone


def _published_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PREVIOUS_STATE}:docs/progress/build-progress.json"], cwd=ROOT))


def _active_progress():
    return json.loads(subprocess.check_output(
        ["git", "show", f"{PUBLISHED_ACTIVE}:docs/progress/build-progress.json"], cwd=ROOT))


def test_r12_binds_published_r11_close_and_exact_auth_ingress_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    assert start.PREVIOUS_STATE == PREVIOUS_STATE
    assert start.write_paths() == EXACT3
    assert start.validate_predecessor(ROOT, _published_progress()) == []
    changed = _published_progress()
    changed["worker_lease"] = {"lease_id": "stale"}
    assert start.validate_predecessor(ROOT, changed) == ["F18_WSL_OPS_R12_PREDECESSOR_INVALID"]


def test_r12_control_scope_cannot_claim_product_as_evidence():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    assert set(start.write_paths()).isdisjoint(start.evidence_paths())
    assert start.MANIFEST in start.control_paths()
    assert start.previous.MANIFEST in start.evidence_paths()
    assert start.previous.r11.MANIFEST in start.evidence_paths()


def test_r12_write_lease_carries_new_epoch_and_exact_scope():
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    lease = start._lease("write", "2026-09-25T10:00:00+09:00",
                         "2026-09-25T22:00:00+09:00", "control-qa")
    assert lease["lease_epoch"] == 10 and lease["write_epoch"] == 10
    assert lease["path_scope"] == EXACT3
    assert lease["worker_lease_id"] == start.WORKER


def test_r12_post_qa_accepts_only_issued_product_scope(tmp_path):
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    clone = _historical_git_root(tmp_path, start)
    assert start.control_qa_commit(clone) == "30637da8301acdeccd32510656e914677c123e23"
    assert start.collect_git(clone) == []


def test_r12_post_qa_rejects_unrelated_path(tmp_path, monkeypatch):
    start = importlib.import_module("scripts.f18_wsl_ops_r12_overlay")
    clone = _historical_git_root(tmp_path, start)
    real_run = start._run
    qa = start.control_qa_commit(clone)
    head = HISTORICAL_ACTIVE

    def with_unrelated(root, *args):
        if args == ("rev-parse", "HEAD"):
            return head
        result = real_run(root, *args)
        if args == ("diff", "--name-only", f"{qa}..{head}"):
            return result + "\ndeploy/ysna/unrelated-change.sh"
        return result

    monkeypatch.setattr(start, "_run", with_unrelated)
    assert "F18_WSL_OPS_R12_POST_QA_SCOPE_INVALID" in start.collect_git(clone)
