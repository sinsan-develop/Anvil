"""R37 closure must revoke the writer without accepting F-20/U-01."""

from datetime import datetime, timezone
from importlib import import_module
import json
from pathlib import Path
from unittest import mock

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_r37_close_preserves_history_and_block():
    overlay = import_module("scripts.f20_u01_r37_close_overlay")
    raw, stream, progress = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    outputs = overlay._projection(ROOT, progress, raw, stream["events"], rows)
    events = json.loads(outputs[overlay.EVENTS])
    final = json.loads(outputs[overlay.PROGRESS])
    assert events["events"][:2026] == stream["events"]
    assert [row["sequence"] for row in rows] == [2027, 2028]
    assert [row["event_type"] for row in rows] == [
        "WRITE_LEASE_REVOKED", "WORKER_LEASE_REVOKED",
    ]
    assert final["worker_lease"] is final["write_lease"] is None
    assert final["completed_f20_u01_r37_worker_lease"]["lease_id"] == (
        stream["events"][2023]["details"]["lease_id"]
    )
    assert final["completed_f20_u01_r37_write_lease"]["lease_id"] == (
        stream["events"][2024]["details"]["lease_id"]
    )
    assert final["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert final["scope_revision_binding"]["release_decision"] == "DEFER"
    assert final["f20_overall_status"] == "REWORK_IN_PROGRESS"
    assert "F-20" not in final["completed_packages"]
    assert final["repository"]["product_write_scope"] == []
    assert final["repository"]["validated_base_commit"] == overlay.BASE
    assert final["repository"]["local_wsl_qa_head"] == overlay.QA_HEAD
    assert overlay.QA_HEAD.encode() in outputs[overlay.HANDOFF]


def test_r37_close_rejects_changed_event_prefix():
    overlay = import_module("scripts.f20_u01_r37_close_overlay")
    raw, stream, _ = overlay._historical(ROOT)
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = overlay._make_rows(stream["events"], at)
    with pytest.raises(ValueError, match="F20_U01_R37_CLOSE_EVENT_BYTES_INVALID"):
        overlay._append_raw(raw.replace(b'"last_sequence": 2026',
                                        b'"last_sequence": 2025'),
                            {"last_event_id": stream["last_event_id"]}, rows)


def test_r37_close_rejects_changed_prior_authority_blob(tmp_path):
    overlay = import_module("scripts.f20_u01_r37_close_overlay")
    assert set(overlay.AUTHORITY_FILES).isdisjoint(overlay.CONTROL_SCOPE)
    blobs = {path: overlay._git(ROOT, "show", f"{overlay.BASE}:{path}")
             for path in overlay.AUTHORITY_FILES}
    for path, content in blobs.items():
        target = tmp_path / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    def historical_blob(_root, *args):
        assert args[0] == "show"
        return blobs[args[1].split(":", 1)[1]]

    with mock.patch.object(overlay, "_git", side_effect=historical_blob):
        assert overlay._authority_bytes_match(tmp_path)
        for path, content in blobs.items():
            target = tmp_path / path
            target.write_bytes(content + b"\nforged")
            assert not overlay._authority_bytes_match(tmp_path), path
            target.write_bytes(content)
        assert overlay._authority_bytes_match(tmp_path)


def test_r37_base_contains_its_close_control_script():
    overlay = import_module("scripts.f20_u01_r37_close_overlay")
    assert overlay._git(
        ROOT, "cat-file", "-e", f"{overlay.BASE}:scripts/f20_u01_r37_close_overlay.py",
    ) == b""


def test_r37_close_keeps_product_paths_outside_control_scope():
    overlay = import_module("scripts.f20_u01_r37_close_overlay")
    assert "apps/api/anvil_api/oidc_process.py" not in overlay.CONTROL_SCOPE
    assert "tests/integration/test_f20_u01_r37_provider_host_pg15.py" not in overlay.CONTROL_SCOPE
    assert set(overlay.AUTHORITY_FILES).isdisjoint(overlay.CONTROL_SCOPE)
