from dataclasses import replace
import hashlib
import json
from functools import lru_cache
from pathlib import Path
import subprocess

import pytest

from packages.deployment.deploy_approval import DeployApprovalSubject, subject_hash
import packages.deployment.promotion_preflight as preflight
from packages.deployment.promotion_preflight import (
    validate_existing_checkout, validate_promotion, verify_approval_release,
)
from packages.deployment.release_manifest import ManifestVerificationError
from tests.deploy.test_f16_release_manifest import expectations, signed_manifest, subject


COMMIT = "a" * 40
RUNTIME = "sha256:" + "1" * 64
WEB = "sha256:" + "2" * 64
WORKER = "sha256:" + "3" * 64
MIGRATION = "sha256:" + "4" * 64
ROLLBACK = "sha256:" + "5" * 64


def verified_envelope(*, source_commit=COMMIT, source_git_remote=None, release_tag="f16-test-1",
                      worker_digest=RUNTIME):
    release_subject = subject()
    release_subject["image_digests"] = {"web": WEB, "api": RUNTIME, "worker": worker_digest}
    release_subject["source_commit"] = source_commit
    if source_git_remote is not None:
        release_subject["source_git_remote"] = source_git_remote
    release_subject["release_tag"] = release_tag
    envelope, public, fingerprint = signed_manifest(release_subject)
    raw = json.dumps(envelope, ensure_ascii=False).encode("utf-8")
    verified = verify_approval_release(
        raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
        expected=replace(
            expectations(), image_digests=release_subject["image_digests"],
            source_commit=source_commit, source_git_remote=release_subject["source_git_remote"],
            release_tag=release_tag,
        ),
    )
    return verified, raw


@lru_cache(maxsize=1)
def inputs():
    release, raw = verified_envelope()
    evidence = {"git_commit": release.release.source_commit, "runtime_image_digest": RUNTIME}
    approval = DeployApprovalSubject("production", "sha256:" + hashlib.sha256(raw).hexdigest(), MIGRATION, ROLLBACK)
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


def test_distinct_signed_worker_digest_matching_observation_is_ready():
    release, raw = verified_envelope(worker_digest=WORKER)
    approval = DeployApprovalSubject("production", "sha256:" + hashlib.sha256(raw).hexdigest(), MIGRATION, ROLLBACK)
    evidence = {"git_commit": COMMIT, "runtime_image_digest": RUNTIME,
                "image_digests": {"web": WEB, "api": RUNTIME, "worker": WORKER}}
    decision = check(release=release, evidence=evidence, approval=approval)
    assert (decision.ready, decision.reason_code, decision.subject_hash) == (
        True, "READY_FOR_PRIVATE_REHEARSAL", subject_hash(approval)
    )


@pytest.mark.parametrize("change", [
    {"runtime_image_digest": WORKER},
    {"image_digests": {"web": WEB, "api": RUNTIME, "worker": RUNTIME}},
    {"image_digests": {"web": WEB, "api": WORKER, "worker": WORKER}},
])
def test_distinct_digest_requires_legacy_api_and_each_observed_role_to_match(change):
    release, raw = verified_envelope(worker_digest=WORKER)
    approval = DeployApprovalSubject("production", "sha256:" + hashlib.sha256(raw).hexdigest(), MIGRATION, ROLLBACK)
    evidence = {"git_commit": COMMIT, "runtime_image_digest": RUNTIME,
                "image_digests": {"web": WEB, "api": RUNTIME, "worker": WORKER}} | change
    decision = check(release=release, evidence=evidence, approval=approval)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_ARTIFACT_MISMATCH")


def test_distinct_observed_worker_rejects_different_signed_worker():
    release, raw = verified_envelope(worker_digest="sha256:" + "6" * 64)
    approval = DeployApprovalSubject("production", "sha256:" + hashlib.sha256(raw).hexdigest(), MIGRATION, ROLLBACK)
    evidence = {"git_commit": COMMIT, "runtime_image_digest": RUNTIME,
                "image_digests": {"web": WEB, "api": RUNTIME, "worker": WORKER}}
    decision = check(release=release, evidence=evidence, approval=approval)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_ARTIFACT_MISMATCH")


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


def test_new_valid_signature_for_same_subject_invalidates_prior_approval():
    release, _ = verified_envelope()
    assert release.release.subject_hash == inputs()[0].release.subject_hash
    assert release.envelope_hash != inputs()[0].envelope_hash
    decision = check(release=release)
    assert (decision.ready, decision.reason_code) == (False, "DEPLOY_APPROVAL_SUBJECT_MISMATCH")


def test_bare_f16_subject_verification_cannot_bypass_envelope_binding():
    decision = check(release=inputs()[0].release)
    assert (decision.ready, decision.reason_code) == (False, "EVIDENCE_TARGET_MISMATCH")


def test_tampered_envelope_never_yields_approval_release():
    envelope, public, fingerprint = signed_manifest(subject())
    envelope["signature"] = "not a signature"
    with pytest.raises(ManifestVerificationError):
        verify_approval_release(
            json.dumps(envelope).encode("utf-8"),
            trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
            expected=expectations(),
        )


@pytest.mark.parametrize("change", [
    {"git_commit": None}, {"runtime_image_digest": None}, {"runtime_image_digest": "bad"},
])
def test_missing_or_malformed_f17_evidence_is_rejected(change):
    evidence = inputs()[1] | change
    decision = check(evidence=evidence)
    assert (decision.ready, decision.reason_code) == (False, "EVIDENCE_TARGET_MISMATCH")


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=True).stdout.strip()


@pytest.fixture
def checkout_fixture(tmp_path: Path, monkeypatch):
    remote = tmp_path / "approved.git"
    source = tmp_path / "source"
    remote_alias = "git@fixture:approved.git"
    git("init", "--bare", str(remote))
    git("init", str(source))
    git("config", "user.email", "f18-test@example.invalid", cwd=source)
    git("config", "user.name", "F18 fixture", cwd=source)
    (source / "tracked.txt").write_text("approved\n", encoding="utf-8")
    git("add", "tracked.txt", cwd=source)
    git("commit", "-m", "approved", cwd=source)
    commit = git("rev-parse", "HEAD", cwd=source)
    git("tag", "-a", "f16-test-1", "-m", "signed fixture", cwd=source)
    git("remote", "add", "origin", str(remote), cwd=source)
    git("push", "origin", "HEAD", "refs/tags/f16-test-1", cwd=source)
    checkout = tmp_path / "checkout"
    git("clone", str(remote), str(checkout))
    git("checkout", "--detach", commit, cwd=checkout)
    git("remote", "set-url", "origin", remote_alias, cwd=checkout)
    actual_git = preflight._F16._git

    def local_fixture_git(*args, **kwargs):
        if args and args[0] == "ls-remote" and remote_alias in args:
            args = tuple(str(remote) if value == remote_alias else value for value in args)
        return actual_git(*args, **kwargs)

    monkeypatch.setattr(preflight._F16, "_git", local_fixture_git)
    release, raw = verified_envelope(source_commit=commit, source_git_remote=remote_alias)
    evidence = {"git_commit": commit, "runtime_image_digest": RUNTIME,
                "image_digests": {"web": WEB, "api": RUNTIME, "worker": RUNTIME}}
    approval = DeployApprovalSubject("production", "sha256:" + hashlib.sha256(raw).hexdigest(), MIGRATION, ROLLBACK)
    return remote_alias, source, checkout, release, evidence, approval


def existing(checkout_fixture, **changes):
    remote, _, checkout, release, evidence, approval = checkout_fixture
    return validate_existing_checkout(
        changes.get("release", release), changes.get("evidence", evidence),
        changes.get("approval", approval), "production", MIGRATION, ROLLBACK,
        changes.get("checkout", checkout), approved_remote=changes.get("approved_remote", remote),
    )


def test_existing_clean_detached_published_checkout_is_private_rehearsal_ready(checkout_fixture):
    _, _, checkout, release, _, approval = checkout_fixture
    before = git("status", "--porcelain", "--untracked-files=all", cwd=checkout)
    decision = existing(checkout_fixture)
    assert (decision.ready, decision.reason_code, decision.subject_hash) == (
        True, "READY_FOR_PRIVATE_REHEARSAL", subject_hash(approval)
    )
    assert release.source_git_remote == checkout_fixture[0]
    assert git("status", "--porcelain", "--untracked-files=all", cwd=checkout) == before == ""


@pytest.mark.parametrize("mutation", ["remote", "tag", "commit", "attached", "tracked", "untracked", "copied"])
def test_existing_checkout_rejects_wrong_git_state(checkout_fixture, mutation):
    remote, source, checkout, release, evidence, approval = checkout_fixture
    if mutation == "remote":
        git("remote", "set-url", "origin", str(source), cwd=checkout)
    elif mutation == "tag":
        release, raw = verified_envelope(
            source_commit=evidence["git_commit"], source_git_remote=remote, release_tag="other-tag"
        )
        approval = replace(approval, release_manifest_hash="sha256:" + hashlib.sha256(raw).hexdigest())
    elif mutation == "commit":
        git("config", "user.email", "f18-test@example.invalid", cwd=checkout)
        git("config", "user.name", "F18 fixture", cwd=checkout)
        (checkout / "tracked.txt").write_text("local commit\n", encoding="utf-8")
        git("add", "tracked.txt", cwd=checkout)
        git("commit", "-m", "local-only", cwd=checkout)
    elif mutation == "attached":
        git("switch", "-c", "local-branch", cwd=checkout)
    elif mutation == "tracked":
        (checkout / "tracked.txt").write_text("server patch\n", encoding="utf-8")
    elif mutation == "untracked":
        (checkout / "copied.txt").write_text("source copy\n", encoding="utf-8")
    else:
        copied = checkout.parent / "copied"
        copied.mkdir()
        (copied / "tracked.txt").write_text("approved\n", encoding="utf-8")
        checkout = copied
    decision = existing(checkout_fixture, release=release, evidence=evidence, approval=approval, checkout=checkout)
    assert (decision.ready, decision.reason_code) == (False, "GIT_CHECKOUT_NOT_VERIFIED")


def test_signed_remote_must_match_approved_remote_before_git_guard(checkout_fixture, monkeypatch):
    monkeypatch.setattr(preflight, "verify_exact_checkout", lambda *a, **kw: pytest.fail("git guard called"))
    decision = existing(checkout_fixture, approved_remote="other-remote")
    assert (decision.ready, decision.reason_code) == (False, "GIT_CHECKOUT_NOT_VERIFIED")


@pytest.mark.parametrize("reason", ["web", "approval"])
def test_promotion_rejection_does_not_call_git_guard(checkout_fixture, monkeypatch, reason):
    monkeypatch.setattr(preflight, "verify_exact_checkout", lambda *a, **kw: pytest.fail("git guard called"))
    _, _, _, _, evidence, approval = checkout_fixture
    if reason == "web":
        decision = existing(checkout_fixture, evidence={k: v for k, v in evidence.items() if k != "image_digests"})
        assert decision.reason_code == "WEB_IMAGE_NOT_VERIFIED"
    else:
        decision = existing(checkout_fixture, approval=replace(approval, migration_plan_hash="sha256:" + "9" * 64))
        assert decision.reason_code == "DEPLOY_APPROVAL_SUBJECT_MISMATCH"
    assert decision.ready is False
