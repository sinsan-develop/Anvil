from __future__ import annotations

from dataclasses import FrozenInstanceError, replace
from datetime import datetime, timezone
import unittest

from packages.artifacts.evidence import (
    AcquisitionMode,
    EvidenceBindingError,
    EvidenceManifest,
    RawArtifactChecksum,
)


NOW = datetime(2026, 8, 15, tzinfo=timezone.utc)
HASH_A = f"sha256:{'a' * 64}"
HASH_B = f"sha256:{'b' * 64}"


def raw(path: str = "evidence/result.txt", *, target: str = HASH_A, environment: str = "env-wsl-b07") -> RawArtifactChecksum:
    return RawArtifactChecksum(path, 12, HASH_B, target, environment)


def manifest(**changes: object) -> EvidenceManifest:
    values: dict[str, object] = {
        "manifest_id": "manifest-1",
        "manifest_path": "evidence/manifest-1.json",
        "design_baseline_hash": HASH_A,
        "work_plan_hash": HASH_A,
        "work_instruction_hash": HASH_A,
        "git_head": "a" * 40,
        "git_status_before_ref": "artifact-status-before",
        "git_status_after_ref": "artifact-status-after",
        "target_hash": HASH_A,
        "delivered_artifact_hash": HASH_A,
        "container_image_digest": HASH_A,
        "db_migration_head": "0006_checkpoint_artifacts",
        "config_revision_hash": HASH_A,
        "policy_hash": HASH_A,
        "provider_routing_snapshot_hash": HASH_A,
        "environment_id": "env-wsl-b07",
        "toolchain_versions": {"python": "3.13.5"},
        "commands": ("python -m unittest",),
        "started_at": NOW,
        "finished_at": NOW,
        "actor_id": "tester-1",
        "actor_role": "independent_tester",
        "acquisition_mode": AcquisitionMode.REAL,
        "raw_artifact_checksums": (raw(),),
        "skipped_or_blocked": (),
        "unverified_scope": ("browser",),
    }
    values.update(changes)
    return EvidenceManifest(**values)  # type: ignore[arg-type]


class EvidenceManifestTests(unittest.TestCase):
    def test_complete_target_and_environment_bound_manifest_is_immutable(self):
        evidence = manifest()
        self.assertEqual(HASH_A, evidence.target_hash)
        self.assertEqual("env-wsl-b07", evidence.raw_artifact_checksums[0].environment_id)
        with self.assertRaises((FrozenInstanceError, AttributeError)):
            evidence.environment_id = "other"  # type: ignore[misc]
        with self.assertRaises(TypeError):
            evidence.toolchain_versions["python"] = "changed"  # type: ignore[index]

    def test_caller_owned_manifest_collections_are_copied_immutably(self):
        commands = ["test"]
        checksums = [raw()]
        skipped = ["provider"]
        unverified = ["browser"]
        evidence = manifest(
            commands=commands,
            raw_artifact_checksums=checksums,
            skipped_or_blocked=skipped,
            unverified_scope=unverified,
        )
        commands.append("mutated")
        checksums.clear()
        skipped.clear()
        unverified.clear()
        self.assertEqual(("test",), evidence.commands)
        self.assertEqual(1, len(evidence.raw_artifact_checksums))
        self.assertEqual(("provider",), evidence.skipped_or_blocked)
        self.assertEqual(("browser",), evidence.unverified_scope)

    def test_target_delivered_and_raw_target_or_environment_mismatch_fail_closed(self):
        hostile = (
            {"delivered_artifact_hash": HASH_B},
            {"raw_artifact_checksums": (raw(target=HASH_B),)},
            {"raw_artifact_checksums": (raw(environment="env-other"),)},
        )
        for changes in hostile:
            with self.subTest(changes=changes), self.assertRaises(EvidenceBindingError):
                manifest(**changes)

    def test_raw_checksum_missing_duplicate_self_reference_and_bad_hash_are_rejected(self):
        hostile = (
            {"raw_artifact_checksums": ()},
            {"raw_artifact_checksums": (raw(), raw())},
            {"raw_artifact_checksums": (raw("evidence/manifest-1.json"),)},
        )
        for changes in hostile:
            with self.subTest(changes=changes), self.assertRaises((EvidenceBindingError, ValueError)):
                manifest(**changes)
        with self.assertRaises(ValueError):
            replace(raw(), sha256="not-a-hash")

    def test_empty_actor_environment_commands_and_invalid_time_are_rejected(self):
        hostile = (
            {"actor_id": " "},
            {"environment_id": ""},
            {"commands": ()},
            {"finished_at": datetime(2026, 8, 14, tzinfo=timezone.utc)},
        )
        for changes in hostile:
            with self.subTest(changes=changes), self.assertRaises((EvidenceBindingError, ValueError)):
                manifest(**changes)


if __name__ == "__main__":
    unittest.main()
