"""R9 host Queue source lease transition stays bounded and append-only."""

from datetime import datetime, timezone
from pathlib import Path
import json

from scripts import f20_u01_r9_start_overlay as overlay


ROOT = Path(__file__).resolve().parents[2]
AT = datetime(2026, 9, 29, 15, 0, tzinfo=timezone.utc)


def _inputs():
    raw, stream, progress = overlay._historical(ROOT)
    wi = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.WI).read_bytes()))
    invocation = overlay.r1._sha(overlay.r1._lf((ROOT / overlay.INVOCATION).read_bytes()))
    rows = overlay._make_rows(stream["events"], wi, invocation, AT, "r9test01")
    return raw, stream, progress, rows, wi, invocation


def test_r9_lease_events_are_exact_and_new():
    _, stream, _, rows, wi, invocation = _inputs()
    assert [row["sequence"] for row in rows] == [1843, 1844, 1845, 1846]
    assert [row["event_type"] for row in rows] == list(overlay.KINDS)
    assert rows[0]["details"]["sha256"] == wi
    assert rows[0]["details"]["invocation_sha256"] == invocation
    worker, write = rows[1]["details"], rows[2]["details"]
    assert worker["lease_epoch"] == write["write_epoch"] == 22
    assert worker["path_scope"] == write["path_scope"] == overlay.SCOPE
    assert write["worker_lease_id"] == worker["lease_id"]
    assert worker["execution_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])
    assert write["write_fencing_token"] not in overlay.r1._historical_fencing_tokens(stream["events"])


def test_r9_projection_preserves_event_prefix_and_blocking_state():
    raw, stream, progress, rows, wi, invocation = _inputs()
    outputs = overlay._projection(ROOT, progress, raw, rows, wi, invocation)
    prior_events = raw.split(b'"events": [\n', 1)[1].split(b'\n  ],\n  "last_event_id"', 1)[0]
    new_events = outputs[overlay.EVENTS].split(b'"events": [\n', 1)[1]
    assert new_events.startswith(prior_events)
    assert json.loads(outputs[overlay.EVENTS])["last_sequence"] == 1846
    new = json.loads(outputs[overlay.PROGRESS])
    assert new["worker_lease"]["lease_epoch"] == 22
    assert new["write_lease"]["write_epoch"] == 22
    assert new["repository"]["product_write_scope"] == overlay.SCOPE
    assert new["f20_c30_event_integrity_incident"]["status"] == "OPEN_BLOCKING"
    assert new["scope_revision_binding"]["release_decision"] == "DEFER"
    assert "F-20" not in new["completed_packages"]
    assert stream["last_sequence"] == 1842


def test_r9_scope_does_not_include_public_api_or_schema():
    assert overlay.SCOPE == [
        "packages/observability/service.py",
        "apps/api/anvil_api/oidc_process.py",
        "tests/observability/test_f20_u01_r9_queue_host.py",
        "tests/api/test_f20_u01_r9_oidc_queue_host.py",
        "docs/04_test_reports/F-20_U01_R9_QUEUE_HOST_RESULT.md",
    ]
    assert overlay.WI not in overlay.SCOPE
    assert overlay.EVENTS not in overlay.SCOPE
