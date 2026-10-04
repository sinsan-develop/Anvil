"""R38B close must revoke both leases without converting QA into acceptance."""

from datetime import datetime, timezone
import json
from pathlib import Path

import pytest

from scripts import f20_u01_r38b_close_overlay as close


ROOT = Path(__file__).resolve().parents[2]


def _source():
    raw = (ROOT / close.EVENTS).read_bytes()
    return raw, json.loads(raw), json.loads((ROOT / close.PROGRESS).read_bytes())


def test_close_projects_exact_append_and_revokes_only_r38b_leases():
    raw, stream, progress = _source()
    assert stream["last_sequence"] == close.START
    at = datetime.now(timezone.utc).replace(microsecond=0)
    rows = close._make_rows(stream["events"], progress, at)
    outputs = close._projection(ROOT, progress, raw, stream["events"], rows)
    new_events = json.loads(outputs[close.EVENTS])
    new_progress = json.loads(outputs[close.PROGRESS])
    assert new_events["events"][:close.START] == stream["events"]
    assert new_events["events"][close.START:] == rows
    assert new_events["last_sequence"] == close.END
    assert close._append_raw(raw, stream, rows) == outputs[close.EVENTS]
    assert [r["event_type"] for r in rows] == list(close.KINDS)
    assert new_progress["worker_lease"] is new_progress["write_lease"] is None
    assert new_progress["completed_f20_u01_r38b_worker_lease"]["status"] == "REVOKED"
    assert new_progress["completed_f20_u01_r38b_write_lease"]["status"] == "REVOKED"
    assert new_progress["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new_progress["scope_revision_binding"]["release_decision"] == "DEFER"
    assert new_progress["f20_overall_status"] == "REWORK_IN_PROGRESS"
    assert "F-20" not in new_progress["completed_packages"]
    assert new_progress["repository"]["product_write_scope"] == []
    assert new_progress["repository"]["local_wsl_qa_head"] == close.QA_HEAD
    assert json.loads(outputs[close.MANIFEST])["accepted"] is False


def test_close_refuses_wrong_raw_event_sequence():
    raw, stream, progress = _source()
    rows = close._make_rows(stream["events"], progress, datetime.now(timezone.utc))
    with pytest.raises(ValueError, match="EVENT_BYTES_INVALID"):
        close._append_raw(raw.replace(b'"last_sequence": 2038',
                                      b'"last_sequence": 2037'), stream, rows)
