"""R20 planning descendants retain the closed R19 canonical projection."""

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def test_r20_planning_descendant_passes_canonical_g05():
    """Plan and issued-lease descendants must not be rejected as R19 writes."""
    result = subprocess.run(
        [sys.executable, "-B", str(ROOT / "scripts/check_project_progress.py")],
        cwd=ROOT, capture_output=True, text=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert ("PASS sequence=1914" in result.stdout
            or "PASS sequence=1918" in result.stdout)
