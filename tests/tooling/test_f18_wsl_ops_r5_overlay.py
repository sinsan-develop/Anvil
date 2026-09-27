"""R5 keeps the R4 Git QA boundary while fixing its historical test fixture."""

from copy import deepcopy
import importlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]
R4_HEAD = "b39952770e115c2ccafdf0e980eb31b6c23cc716"


def _published_r4():
    raw = subprocess.check_output(
        ["git", "show", f"{R4_HEAD}:docs/progress/build-progress.json"], cwd=ROOT)
    return json.loads(raw)


def test_r5_checkpoint_disallows_writer_and_rebound_qa():
    r5 = importlib.import_module("scripts.f18_wsl_ops_r5_overlay")
    state = deepcopy(_published_r4())
    state["event_sequence"] = 1528
    state["repository"]["projection_mode"] = r5.MODE
    state["repository"]["exact_allowed_paths"] = r5.control_paths()
    state["repository"]["control_qa_head"] = "a" * 40
    assert r5.validate_state(state, "a" * 40) == []
    state["write_lease"] = {"lease_id": "unauthorized"}
    assert r5.validate_state(state, "a" * 40)
    state["write_lease"] = None
    state["repository"]["control_qa_head"] = "b" * 40
    assert r5.validate_state(state, "a" * 40)


def test_r5_prior_checkpoint_is_frozen_to_published_git_commit():
    r5 = importlib.import_module("scripts.f18_wsl_ops_r5_overlay")
    progress = _published_r4()
    assert r5.validate_r4_checkpoint(ROOT, progress) == []
    altered = deepcopy(progress)
    altered["repository"]["control_qa_head"] = "d27c5264a56c80ccf4f96571fcca15ec50ca93e7"
    assert r5.validate_r4_checkpoint(ROOT, altered)
