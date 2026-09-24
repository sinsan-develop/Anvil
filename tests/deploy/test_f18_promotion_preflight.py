from dataclasses import replace

import pytest

from packages.deployment.deploy_approval import DeployApprovalSubject, subject_hash
from packages.deployment.promotion_preflight import validate_promotion
from packages.deployment.release_manifest import VerifiedRelease


COMMIT = "a" * 40
RUNTIME = "sha256:" + "1" * 64
WEB = "sha256:" + "2" * 64
MANIFEST = "sha256:" + "3" * 64
MIGRATION = "sha256:" + "4" * 64
ROLLBACK = "sha256:" + "5" * 64


def inputs():
    release = VerifiedRelease(COMMIT, "f17-rc", MANIFEST, (("api", RUNTIME), ("web", WEB), ("worker", RUNTIME)))
    evidence = {"git_commit": COMMIT, "runtime_image_digest": RUNTIME}
    approval = DeployApprovalSubject("production", MANIFEST, MIGRATION, ROLLBACK)
    return release, evidence, approval


def check(release=None, evidence=None, approval=None, **changes):
    expected_release, expected_evidence, expected_approval = inputs()
    return validate_promotion(
        release if release is not None else expected_release,
        evidence if evidence is not None else expected_evidence,
        approval if approval is not None else expected_approval,
        changes.get("environment_id", "production"),
        changes.get("migration_plan_hash", MIGRATION),
        changes.get("rollback_plan_hash", ROLLBACK),
    )


def test_actual_f17_evidence_shape_cannot_verify_web_artifact():
    decision = check()
    assert (decision.ready, decision.reason_code, decision.subject_hash) == (
        False, "WEB_IMAGE_NOT_VERIFIED", subject_hash(inputs()[2])
    )


def test_missing_web_digest_in_partial_image_map_stays_unverified():
    evidence = inputs()[1] | {"image_digests": {"api": RUNTIME, "worker": RUNTIME}}
    assert check(evidence=evidence).reason_code == "WEB_IMAGE_NOT_VERIFIED"


def test_all_three_explicit_image_digests_allow_private_rehearsal_only():
    evidence = inputs()[1] | {"image_digests": {"web": WEB, "api": RUNTIME, "worker": RUNTIME}}
    decision = check(evidence=evidence)
    assert (decision.ready, decision.reason_code, decision.subject_hash) == (
        True, "READY_FOR_PRIVATE_REHEARSAL", subject_hash(inputs()[2])
    )


@pytest.mark.parametrize("change", [
    {"git_commit": "b" * 40},
    {"runtime_image_digest": "sha256:" + "9" * 64},
    {"image_digests": {"web": "sha256:" + "9" * 64, "api": RUNTIME, "worker": RUNTIME}},
])
def test_mismatched_commit_or_image_blocks_without_side_effects(change):
    evidence = inputs()[1] | {"image_digests": {"web": WEB, "api": RUNTIME, "worker": RUNTIME}} | change
    decision = check(evidence=evidence)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_ARTIFACT_MISMATCH")


@pytest.mark.parametrize("change", [
    {"environment_id": "other"},
    {"migration_plan_hash": "sha256:" + "9" * 64},
    {"rollback_plan_hash": "sha256:" + "9" * 64},
    {"environment_id": ""},
])
def test_environment_or_plan_change_rejects_approval(change):
    decision = check(**change)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_APPROVAL_SUBJECT_MISMATCH")


def test_manifest_hash_change_rejects_approval():
    release = replace(inputs()[0], subject_hash="sha256:" + "9" * 64)
    decision = check(release=release)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_APPROVAL_SUBJECT_MISMATCH")


@pytest.mark.parametrize("change", [
    {"git_commit": None}, {"runtime_image_digest": None}, {"runtime_image_digest": "bad"},
])
def test_missing_or_malformed_f17_evidence_is_rejected(change):
    evidence = inputs()[1] | change
    decision = check(evidence=evidence)
    assert (decision.ready, decision.reason_code) == (False, "EVIDENCE_TARGET_MISMATCH")
