from dataclasses import replace
from datetime import datetime, timezone

import pytest

from packages.recovery.disaster import RecoveryManifest, RecoveryMismatch, RestoreObservation, verify_restore, verify_backup, encode_manifest, read_manifest


HASH = "sha256:" + "a" * 64
NOW = datetime(2026, 9, 24, tzinfo=timezone.utc)
SOURCE = {key: HASH for key in ("project", "run", "approval", "progress", "terminal_learning", "audit")}


def manifest():
    return RecoveryManifest("project-1", "wsl-pg15", "a" * 40, "0016_operations_recovery",
                            15, HASH, "vector:0.8", HASH, 12, {"artifact-1": HASH}, NOW,
                            "operator-1", HASH, SOURCE)


def observation(lineage):
    return RestoreObservation("isolated-restore-db", HASH, "a" * 40,
                              "0016_operations_recovery", 15, HASH, "vector:0.8", HASH, 12,
                              {"artifact-1": HASH}, lineage, True, "project-1", "wsl-pg15")


def test_replayed_restore_requires_full_lineage_and_target_binding():
    expected = manifest()
    source = {"project": HASH, "run": HASH, "approval": HASH,
              "progress": HASH, "terminal_learning": HASH, "audit": HASH}
    assert verify_restore(expected, source, observation(dict(source))).status == "RESTORE_VERIFIED"
    assert verify_restore(expected, source, observation(dict(source))).evidence_hash.startswith("sha256:")
    for key in source:
        changed = dict(source)
        changed.pop(key)
        with pytest.raises(RecoveryMismatch):
            verify_restore(expected, source, observation(changed))
    with pytest.raises(RecoveryMismatch):
        verify_restore(expected, source, replace(observation(source), git_sha="b" * 40))
    with pytest.raises(RecoveryMismatch):
        verify_restore(expected, source, replace(observation(source), project_id="other"))
    with pytest.raises(RecoveryMismatch):
        verify_restore(expected, source, replace(observation(source), environment_id="ysna-prod"))


def test_dump_list_is_not_restore_evidence():
    with pytest.raises(RecoveryMismatch):
        verify_restore(manifest(), {"project": HASH}, observation({"project": HASH}))
    with pytest.raises(RecoveryMismatch):
        verify_restore(manifest(), {key: HASH for key in ("project", "run", "approval", "progress", "terminal_learning", "audit")},
                       replace(observation({key: HASH for key in ("project", "run", "approval", "progress", "terminal_learning", "audit")}), replayed=False))


def test_restore_receipt_must_match_manifest_backup_digest():
    source = {key: HASH for key in ("project", "run", "approval", "progress", "terminal_learning", "audit")}
    with pytest.raises(RecoveryMismatch):
        verify_restore(manifest(), source, replace(observation(source), restored_from_digest="sha256:" + "b" * 64))


def test_colluding_source_and_target_lineage_cannot_override_sidecar_origin():
    source = {key: HASH for key in ("project", "run", "approval", "progress", "terminal_learning", "audit")}
    forged = dict(source)
    forged["approval"] = "sha256:" + "b" * 64
    with pytest.raises(RecoveryMismatch, match="RESTORE_LINEAGE_MISMATCH"):
        verify_restore(manifest(), forged, observation(forged))


def test_restore_target_observation_cannot_change_during_comparison():
    target = observation(dict(SOURCE))
    with pytest.raises(TypeError):
        target.lineage_hashes["approval"] = "sha256:" + "b" * 64
    with pytest.raises(TypeError):
        target.artifact_checksums["artifact-1"] = "sha256:" + "b" * 64


def test_backup_requires_bytes_checksum_and_restore_listing():
    from hashlib import sha256
    content = b"synthetic-pg-custom-dump"
    expected = replace(manifest(), backup_digest="sha256:" + sha256(content).hexdigest())
    assert verify_backup(expected, content, ("TABLE public.tasks",)).digest == expected.backup_digest
    with pytest.raises(RecoveryMismatch):
        verify_backup(expected, b"tampered", ("TABLE public.tasks",))
    with pytest.raises(RecoveryMismatch):
        verify_backup(expected, content, ())


def test_manifest_sidecar_roundtrip_requires_raw_checksum_and_canonical_bytes():
    from hashlib import sha256
    raw = encode_manifest(manifest())
    digest = "sha256:" + sha256(raw).hexdigest()
    assert read_manifest(raw, digest) == manifest()
    with pytest.raises(RecoveryMismatch):
        read_manifest(raw + b" ", digest)
    with pytest.raises(RecoveryMismatch):
        read_manifest(raw, "sha256:" + "b" * 64)


def test_manifest_artifact_snapshot_cannot_mutate_after_checksum_verification():
    from hashlib import sha256
    raw = encode_manifest(manifest())
    restored = read_manifest(raw, "sha256:" + sha256(raw).hexdigest())
    with pytest.raises(TypeError):
        restored.artifact_checksums["artifact-1"] = "sha256:" + "b" * 64
    assert encode_manifest(restored) == raw


def test_recovery_package_exposes_disaster_contract_without_auto_execution():
    from packages.recovery import RecoveryManifest as exported
    assert exported is RecoveryManifest


def test_malformed_sidecar_is_value_safe_failure():
    import json
    from hashlib import sha256
    data = json.loads(encode_manifest(manifest()))
    data["artifact_checksums"] = ["not-a-map"]
    raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    with pytest.raises(RecoveryMismatch, match="RECOVERY_MANIFEST_INVALID"):
        read_manifest(raw, "sha256:" + sha256(raw).hexdigest())
