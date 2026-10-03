"""R32 starts one bounded Next Actions writer without accepting F-20."""

from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys

from scripts import f20_u01_r32_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r32_projection_issues_one_epoch46_dual_lease():
    raw, stream, progress = overlay._historical(ROOT)
    assert stream["last_sequence"] == 1986
    assert progress["worker_lease"] is progress["write_lease"] is None
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi_sha, invocation_sha,
                              at, "r32elapsed1003")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:1986] == stream["events"]
    assert [row["sequence"] for row in rows] == [1987, 1988, 1989, 1990]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert rows[0]["details"]["parent_work_instruction"] == "docs/work_orders/F-20_U01_R31_DASHBOARD_RECONNECT_STATE_WORK_INSTRUCTION.md"
    assert final["worker_lease"]["lease_epoch"] == 46
    assert final["write_lease"]["write_epoch"] == 46
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert len(overlay.SCOPE) == 5
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE


def test_r32_start_detects_only_its_bounded_control_dirt():
    assert overlay._dirty(ROOT) <= overlay.CONTROL_SCOPE


def test_r32_control_imports_from_direct_checker_script_path():
    result = subprocess.run([sys.executable, "-I", "-c",
        f"import sys; sys.path.insert(0, {str(ROOT / 'scripts')!r}); import f20_u01_r32_start_overlay"],
        cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
