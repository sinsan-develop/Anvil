from dataclasses import replace

import pytest

from packages.deployment.deploy_approval import (
    DeployApprovalSubject,
    approval_matches,
    subject_hash,
)


def subject() -> DeployApprovalSubject:
    return DeployApprovalSubject(
        environment_id="production",
        release_manifest_hash="sha256:" + "1" * 64,
        migration_plan_hash="sha256:" + "2" * 64,
        rollback_plan_hash="sha256:" + "3" * 64,
    )


def test_canonical_subject_hash_is_fixed_and_approval_is_exact():
    approved = subject()
    assert subject_hash(approved) == "sha256:425c949eabee6a1dba8c83ae27136df364ab1f69a9a514092e1888687bac0301"
    assert approval_matches(approved, subject()) is True
    for field, value in (
        ("environment_id", "other-production"),
        ("release_manifest_hash", "sha256:" + "4" * 64),
        ("migration_plan_hash", "sha256:" + "4" * 64),
        ("rollback_plan_hash", "sha256:" + "4" * 64),
    ):
        changed = replace(approved, **{field: value})
        assert subject_hash(changed) != subject_hash(approved)
        assert approval_matches(approved, changed) is False


@pytest.mark.parametrize("value", ["", "sha256:" + "A" * 64, "sha256:" + "a" * 63, "a" * 64])
def test_malformed_digest_is_rejected(value):
    with pytest.raises(ValueError):
        replace(subject(), release_manifest_hash=value)


@pytest.mark.parametrize("environment", ["", " ", "\n"])
def test_empty_environment_is_rejected(environment):
    with pytest.raises(ValueError):
        replace(subject(), environment_id=environment)
