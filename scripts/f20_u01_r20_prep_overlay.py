"""R20 plan-only descendant of the closed R19 canonical projection."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import hashlib
import re
import subprocess

try:
    from scripts import f20_u01_r19_close_overlay as prior
except ModuleNotFoundError:
    import f20_u01_r19_close_overlay as prior


BASE = "49f049a6eb980282f02f943a7bf78956e5fb7888"
PLAN_COMMIT = "c8ab8335cf8aaa51f711bf1b291e2f1d7f7aa8f7"
PLAN = "docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_PLAN.md"
PLAN_SHA256 = "02f24289d7a6dd3afd772d58037b87f98788c1fa8a26f412281da13c1651fe95"
SCOPE = {PLAN, "docs/WORK_STATUS.md", "scripts/f20_u01_r20_prep_overlay.py",
         "tests/tooling/test_f20_u01_r20_prep_projection.py",
         "scripts/check_project_progress.py",
         "docs/work_orders/F-20_U01_R20_NEXT_ACTIONS_BROWSER_WORK_INSTRUCTION.md",
         "docs/work_orders/F-20_U01_R20_NEXT_ACTIONS_BROWSER_INVOCATION.md"}


def _git(root: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.excludesFile=", *args], cwd=root)


def _ancestor(root: Path, earlier: str, later: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", earlier, later],
                          cwd=root, capture_output=True, check=False).returncode == 0


def validate_control(root: Path, bundle: dict, now: datetime) -> list[str]:
    errors = prior.validate_control(root, bundle, now)
    try:
        plan = (Path(root) / PLAN).read_bytes().replace(b"\r\n", b"\n")
        progress = bundle["progress"]
        if (hashlib.sha256(plan).hexdigest() != PLAN_SHA256
                or progress["event_sequence"] != 1914
                or progress["worker_lease"] is not None
                or progress["write_lease"] is not None
                or progress["f20_c30_event_integrity_incident"]["status"] != "OPEN_BLOCKING"
                or progress["scope_revision_binding"]["release_decision"] != "DEFER"):
            errors.append("F20_U01_R20_PREP_CONTROL_INVALID")
    except (OSError, KeyError, TypeError):
        errors.append("F20_U01_R20_PREP_CONTROL_INVALID")
    return sorted(set(errors))


def collect_git(root: Path, progress: dict) -> list[str]:
    try:
        root = Path(root)
        head = _git(root, "rev-parse", "HEAD").decode().strip()
        remote = _git(root, "rev-parse", "development/codex/f18-wsl-ops").decode().strip()
        changed = set(filter(None, _git(root, "diff", "--no-renames", "--name-only",
                                        f"{BASE}..HEAD").decode().splitlines()))
        good = (
            _git(root, "branch", "--show-current").decode().strip() == "codex/f18-wsl-ops"
            and _git(root, "rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
            == "development/codex/f18-wsl-ops"
            and all(re.fullmatch(r"[0-9a-f]{40}", value) for value in (head, remote))
            and all(_ancestor(root, BASE, value) for value in (head, remote))
            and _ancestor(root, PLAN_COMMIT, head)
            and _ancestor(root, remote, head)
            and changed <= SCOPE
            and prior.prior.prior.prior.prior.prior._dirty(root) <= SCOPE
            and progress["repository"]["projection_mode"] == prior.MODE
            and (root / PLAN).is_file()
        )
        return [] if good else ["F20_U01_R20_PREP_GIT_INVALID"]
    except (OSError, KeyError, subprocess.CalledProcessError, UnicodeDecodeError):
        return ["F20_U01_R20_PREP_GIT_INVALID"]
