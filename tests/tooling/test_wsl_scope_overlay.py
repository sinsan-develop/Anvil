"""The WSL-only scope revision cannot be mistaken for Production acceptance."""

from copy import deepcopy
import subprocess

from scripts import wsl_scope_overlay as overlay


def test_git_path_output_preserves_korean_authority_filename(tmp_path):
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    (tmp_path / "한글_계획서.md").write_text("scope", encoding="utf-8")
    subprocess.run(["git", "-C", str(tmp_path), "add", "--", "한글_계획서.md"], check=True)
    assert overlay._run(tmp_path, "diff", "--cached", "--name-only") == "한글_계획서.md"


def _state():
    hashes = {"Anvil_설계서_v2.md": "A" * 64,
              "Anvil_작업계획서_v1.md": "B" * 64,
              "Anvil_통합검증매트릭스_v1.md": "C" * 64,
              "Anvil_테스트계획서_v1.md": "D" * 64}
    progress = {
        "repository": {"projection_mode": overlay.MODE,
                       "branch": overlay.BRANCH,
                       "validated_base_commit": overlay.BASE,
                       "exact_allowed_paths": overlay.control_paths(),
                       "product_write_scope": []},
        "event_sequence": 1512, "status": "PAUSED", "current_work_package": "F-18",
        "f18_overall_status": "PARTIAL_LOCAL_WSL_VERIFIED",
        "next_work_package": {"package_id": "F-19",
                              "status": "BLOCKED_PENDING_F18_ACCEPTANCE"},
        "active_agent": None, "worker_lease": None, "write_lease": None,
        "plan_version": "1.7", "work_plan_hash": hashes["Anvil_작업계획서_v1.md"],
        "design_baseline_hash": hashes["Anvil_설계서_v2.md"],
        "root_human_approval_binding": {"approval_id": overlay.APPROVAL_ID,
                                        "path": overlay.APPROVAL,
                                        "sha256": "E" * 64},
        "scope_revision_binding": {"artifact_sha256": hashes,
                                   "production": "NOT_EXECUTED",
                                   "release_decision": "DEFER"},
    }
    return progress, hashes


def test_scope_state_rejects_old_plan_hash_and_production_pass():
    progress, hashes = _state()
    assert overlay.validate_state(progress, hashes, "E" * 64) == []
    stale = deepcopy(progress)
    stale["work_plan_hash"] = "F" * 64
    assert overlay.validate_state(stale, hashes, "E" * 64)
    promoted = deepcopy(progress)
    promoted["scope_revision_binding"]["production"] = "PASS"
    assert overlay.validate_state(promoted, hashes, "E" * 64)
    accepted = deepcopy(progress)
    accepted["f18_overall_status"] = "ACCEPTED"
    assert overlay.validate_state(accepted, hashes, "E" * 64)


def test_scope_git_rejects_drift_and_post_qa_authority_change():
    facts = dict(branch=overlay.BRANCH, upstream=f"development/{overlay.BRANCH}",
                 head="feature", remote_head="feature", staged=set(), dirty=set(),
                 changed=set(overlay.control_paths()), base_is_ancestor=True,
                 qa_head_bound=True,
                 post_qa_changed={"docs/WORK_STATUS.md"})
    assert overlay.validate_git_facts(**facts) == []
    assert overlay.validate_git_facts(**{**facts, "changed": facts["changed"] | {"unrelated"}})
    assert overlay.validate_git_facts(**{**facts, "qa_head_bound": False})
    assert overlay.validate_git_facts(**{**facts, "post_qa_changed": {"Anvil_작업계획서_v1.md"}})
    assert overlay.validate_git_facts(**{**facts, "dirty": {"docs/WORK_STATUS.md"}})
