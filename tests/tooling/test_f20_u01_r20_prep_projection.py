"""R20 planning descendants retain the closed R19 canonical projection."""

from pathlib import Path
import json
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("checkpoint,sequence", [
    ("2302980694acaf214b213d8e6728b294ca172a9a", 1914),
    ("ebd102f217ee1b5d63d72f2ef63cd0d3c45daf54", 1918),
])
def test_r20_planning_descendant_passes_canonical_g05(tmp_path, checkpoint, sequence):
    """Validate each immutable R20 checkpoint, not the current successor."""
    root = tmp_path / "repository"
    subprocess.run(["git", "-c", "core.autocrlf=false", "clone", "--quiet", "--local",
                    "--no-hardlinks", str(ROOT), str(root)], check=True)
    subprocess.run(["git", "checkout", "--quiet", "-B", "codex/f18-wsl-ops", checkpoint],
                   cwd=root, check=True)
    subprocess.run(["git", "remote", "add", "development", str(ROOT)], cwd=root, check=True)
    subprocess.run(["git", "update-ref", "refs/remotes/development/codex/f18-wsl-ops", checkpoint],
                   cwd=root, check=True)
    subprocess.run(["git", "branch", "--set-upstream-to=development/codex/f18-wsl-ops"],
                   cwd=root, check=True, capture_output=True)
    # The historical CLI runs historical source. Only its active R20 clock is
    # substituted; closed R19 has no live lease and needs no substitution.
    code = "from scripts import check_project_progress as c; raise SystemExit(c.main())"
    if sequence == 1918:
        code = "\n".join([
            "from datetime import datetime, timezone",
            "from unittest.mock import patch",
            "from scripts import check_project_progress as c, f20_u01_r20_start_overlay as o",
            "real = o.validate_control",
            "at = datetime(2026, 9, 30, 16, 34, 6, tzinfo=timezone.utc)",
            "with patch.object(o, 'validate_control', side_effect=lambda r, b, now: real(r, b, at)):",
            "    result = c.main()",
            "assert o.validate_control is real",
            "raise SystemExit(result)",
        ])
    result = subprocess.run([sys.executable, "-B", "-c", code], cwd=root,
                            capture_output=True, text=True, timeout=30, check=False)
    assert result.returncode == 0, result.stdout + result.stderr
    assert f"PASS sequence={sequence} reporting=AUTO_CONTINUE" in result.stdout


def test_current_successor_g05_matches_current_progress_and_event_sequence():
    progress = json.loads((ROOT / "docs/progress/build-progress.json").read_bytes())
    events = json.loads((ROOT / "docs/progress/progress-events.json").read_bytes())
    sequence = progress["event_sequence"]
    assert sequence == events["last_sequence"] == events["events"][-1]["sequence"]
    assert progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert progress["scope_revision_binding"]["release_decision"] == "DEFER"
    result = subprocess.run(
        [sys.executable, "-B", "-m", "scripts.check_project_progress"],
        cwd=ROOT, capture_output=True, text=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert f"PASS sequence={sequence} reporting=AUTO_CONTINUE" in result.stdout
