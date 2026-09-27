"""F-20 historical acceptance must bind to the report and manifest bytes."""

from __future__ import annotations

import hashlib

from scripts.f20_evidence_binding import validate_f20_acceptance_binding


def _event(report_hash: str, manifest_hash: str) -> list[dict]:
    return [{
        "sequence": 1714,
        "event_type": "MAIN_PACKAGE_ACCEPTED",
        "work_package_id": "F-20",
        "details": {
            "test_report_ref": "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md",
            "test_report_sha256": report_hash,
            "manifest_ref": "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json",
            "manifest_sha256": manifest_hash,
        },
    }]


def test_f20_acceptance_requires_both_file_hashes(tmp_path):
    report = tmp_path / "docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md"
    manifest = tmp_path / "docs/evidence/manifests/F-20_WSL_FINAL_VALIDATION_MANIFEST.json"
    report.parent.mkdir(parents=True)
    manifest.parent.mkdir(parents=True)
    report.write_bytes(b"original report")
    manifest.write_bytes(b"original manifest")
    report_hash = hashlib.sha256(report.read_bytes()).hexdigest().upper()
    manifest_hash = hashlib.sha256(manifest.read_bytes()).hexdigest().upper()
    event = _event(report_hash, manifest_hash)

    assert validate_f20_acceptance_binding(tmp_path, event) == []
    event[0]["details"]["test_report_sha256"] = "0" * 64
    assert validate_f20_acceptance_binding(tmp_path, event) == ["F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"]
    event[0]["details"]["test_report_sha256"] = report_hash
    event[0]["details"]["manifest_sha256"] = "0" * 64
    assert validate_f20_acceptance_binding(tmp_path, event) == ["F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"]


def test_f20_acceptance_rejects_missing_or_escaping_file(tmp_path):
    event = _event("0" * 64, "0" * 64)
    assert validate_f20_acceptance_binding(tmp_path, event) == ["F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"]
    event[0]["details"]["test_report_ref"] = "../outside.md"
    assert validate_f20_acceptance_binding(tmp_path, event) == ["F20_ACCEPTANCE_EVIDENCE_HASH_MISMATCH"]
