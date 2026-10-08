"""R28 replaces the incomplete R27 leases before widening the test writer path."""

from datetime import datetime, timezone
import json
from pathlib import Path
import re

from scripts import f20_u01_r28_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]


def test_r28_scope_is_only_python_evidence_contract_and_report():
    assert overlay.SCOPE == [
        "tests/integration/test_f20_u01_oidc_browser_pg15.py",
        "docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md",
    ]
    assert re.fullmatch(r"[0-9a-f]{40}", overlay.BASE)
    assert not set(overlay.SCOPE) & set(overlay.prior.SCOPE)


def test_r28_projection_revokes_r27_then_issues_new_epoch_without_acceptance():
    raw, stream, progress = overlay._historical(ROOT)
    assert stream["last_sequence"] == overlay.START
    at = datetime.now(timezone.utc).replace(microsecond=0)
    wi_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation_sha = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], progress, wi_sha, invocation_sha,
                              at, "r28contract1002")
    outputs = overlay._projection(ROOT, progress, raw, stream, rows,
                                  wi_sha, invocation_sha)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:overlay.START] == stream["events"]
    assert [row["sequence"] for row in rows] == list(range(1961, 1967))
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert final["completed_f20_u01_r27_worker_lease"]["status"] == "REVOKED"
    assert final["completed_f20_u01_r27_write_lease"]["status"] == "REVOKED"
    assert final["worker_lease"]["lease_epoch"] == 42
    assert final["write_lease"]["write_epoch"] == 42
    assert final["worker_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["path_scope"] == overlay.SCOPE
    assert final["write_lease"]["worker_lease_id"] == final["worker_lease"]["lease_id"]
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in final["completed_packages"]
    assert final["repository"]["product_write_scope"] == overlay.SCOPE
