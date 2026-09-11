"""Canonical C-02 independent acceptance evidence contract.

The independent execution numbers are supplied by the independent Tester.  This
file verifies that the final projection preserves those received facts without
promoting unexecuted external or full-repository validation.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "docs/evidence/raw/C-02_DELEGATION_AUTHORITY_EVIDENCE.json"


def test_received_independent_tester_totals_and_required_av_results_are_exact() -> None:
    evidence = json.loads(EVIDENCE.read_bytes())
    tester = evidence["independent_tester"]
    assert tester["validation_results"] == {"AV-AGT-001": "PASS", "AV-SAFE-022": "PASS"}
    assert tester["hostile_case_count"] == 1468
    assert tester["runner_zero_case_count"] == 1458
    assert tester["regression_pass_count"] == 193
    assert tester["critical_findings"] == 0
    assert tester["important_findings"] == 0


def test_projection_keeps_unexecuted_and_not_completed_boundaries() -> None:
    evidence = json.loads(EVIDENCE.read_bytes())
    assert evidence["full_repository_suite"] == {
        "status": "NOT_COMPLETED",
        "collection_error_count": 7,
    }
    assert set(evidence["external_validation"]) == {
        "provider", "telegram", "network", "database", "browser", "wsl", "deployment", "actual_runner"
    }
    assert set(evidence["external_validation"].values()) == {"NOT_EXECUTED"}
