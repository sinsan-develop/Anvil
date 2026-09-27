"""Signed WSL observations only gate a private rehearsal, never Production."""

import base64
import hashlib
import json
from datetime import datetime, timezone

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from packages.deployment.deploy_approval import DeployApprovalSubject
from packages.deployment.deploy_approval import subject_hash
from packages.deployment.promotion_preflight import PreflightDecision, VerifiedApprovalRelease, validate_promotion
from packages.deployment.release_manifest import VerifiedRelease
import packages.deployment.wsl_operational as operational


COMMIT = "a" * 40
DIGEST = lambda digit: "sha256:" + digit * 64
IMAGES = {"web": DIGEST("1"), "api": DIGEST("2"), "worker": DIGEST("2")}
MANIFEST = DIGEST("3")
MIGRATION = DIGEST("4")
ROLLBACK = DIGEST("5")
ENVIRONMENT = "f18-wsl-ops"
COLLECTOR = "wsl-server-f18-collector"
TARGET_INSTANCE = "f18-wsl-instance-r1"
REHEARSAL_RUN = "rehearsal-run-001"
NOW = datetime(2026, 9, 25, 3, 0, tzinfo=timezone.utc)
CAPABILITIES = ("oidc", "object_storage", "network", "pg18")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def signed_bundle(payload):
    signer = Ed25519PrivateKey.generate()
    public = signer.public_key()
    der = public.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    fingerprint = "sha256:" + hashlib.sha256(der).hexdigest()
    body = canonical(payload)
    envelope = {
        "schema_version": 1,
        "payload": payload,
        "payload_hash": "sha256:" + hashlib.sha256(body).hexdigest(),
        "public_key_fingerprint": fingerprint,
        "signature": base64.b64encode(signer.sign(body)).decode("ascii"),
    }
    return canonical(envelope), public.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo), fingerprint


def payload():
    return {
        "collector_id": COLLECTOR,
        "environment_id": ENVIRONMENT,
        "source_commit": COMMIT,
        "release_manifest_hash": MANIFEST,
        "approval_subject_hash": subject_hash(DeployApprovalSubject(ENVIRONMENT, MANIFEST, MIGRATION, ROLLBACK)),
        "migration_plan_hash": MIGRATION,
        "rollback_plan_hash": ROLLBACK,
        "target_instance_id": TARGET_INSTANCE,
        "rehearsal_run_id": REHEARSAL_RUN,
        "issued_at": "2026-09-25T02:59:00Z",
        "expires_at": "2026-09-25T03:04:00Z",
        "image_digests": IMAGES.copy(),
        "capabilities": {
            key: {"status": "PASS", "acquisition": "real-wsl-observation", "evidence_hash": DIGEST(str(i + 6))}
            for i, key in enumerate(CAPABILITIES)
        },
    }


def subjects():
    release = VerifiedApprovalRelease(
        VerifiedRelease(COMMIT, "f18-test-tag", DIGEST("f"), tuple(sorted(IMAGES.items()))),
        MANIFEST, "git@github-sinsan-develop:sinsan-develop/Anvil.git",
    )
    approval = DeployApprovalSubject(ENVIRONMENT, MANIFEST, MIGRATION, ROLLBACK)
    wsl = {"git_commit": COMMIT, "runtime_image_digest": IMAGES["api"], "image_digests": IMAGES.copy()}
    return release, approval, wsl


def check(monkeypatch, payload_value=None, *, base_ready=True, signer_override=None,
          migration_plan_hash=MIGRATION, rollback_plan_hash=ROLLBACK,
          target_instance_id=TARGET_INSTANCE, rehearsal_run_id=REHEARSAL_RUN,
          now_utc=NOW, base_subject_hash=None):
    calls = []
    release, approval, wsl = subjects()

    def base(*args, **kwargs):
        calls.append("git-artifact")
        return PreflightDecision(base_ready, "READY_FOR_PRIVATE_REHEARSAL" if base_ready else "WEB_IMAGE_NOT_VERIFIED",
                                 base_subject_hash or subject_hash(approval))

    monkeypatch.setattr(operational, "validate_existing_checkout", base)
    raw, public, fingerprint = signed_bundle(payload_value if payload_value is not None else payload())
    if signer_override is not None:
        raw, public, fingerprint = signer_override(raw, public, fingerprint)
    decision = operational.validate_wsl_operational(
        release, wsl, approval, ENVIRONMENT, migration_plan_hash, rollback_plan_hash, "unused-checkout",
        raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
        expected_collector_id=COLLECTOR, expected_target_instance_id=target_instance_id,
        expected_rehearsal_run_id=rehearsal_run_id, now_utc=now_utc,
    )
    return decision, calls


def test_signed_bound_capabilities_only_allow_wsl_rehearsal(monkeypatch):
    decision, calls = check(monkeypatch)
    assert calls == ["git-artifact"]
    assert (decision.ready, decision.reason_code) == (True, "READY_FOR_WSL_REHEARSAL")


def test_distinct_worker_digest_passes_artifact_and_signed_capability_gates(monkeypatch):
    distinct = IMAGES | {"worker": DIGEST("c")}
    release, approval, wsl = subjects()
    release = VerifiedApprovalRelease(
        VerifiedRelease(COMMIT, "f18-test-tag", DIGEST("f"), tuple(sorted(distinct.items()))),
        MANIFEST, release.source_git_remote,
    )
    wsl["image_digests"] = distinct.copy()
    observed = payload()
    observed["image_digests"] = distinct.copy()

    def artifact_gate(*args, **kwargs):
        return validate_promotion(*args[:6])

    monkeypatch.setattr(operational, "validate_existing_checkout", artifact_gate)
    raw, public, fingerprint = signed_bundle(observed)
    decision = operational.validate_wsl_operational(
        release, wsl, approval, ENVIRONMENT, MIGRATION, ROLLBACK, "unused-checkout",
        raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
        expected_collector_id=COLLECTOR, expected_target_instance_id=TARGET_INSTANCE,
        expected_rehearsal_run_id=REHEARSAL_RUN, now_utc=NOW,
    )
    assert (decision.ready, decision.reason_code) == (True, "READY_FOR_WSL_REHEARSAL")


def test_existing_git_artifact_failure_is_preserved_before_capabilities(monkeypatch):
    decision, calls = check(monkeypatch, base_ready=False)
    assert calls == ["git-artifact"]
    assert (decision.ready, decision.reason_code) == (False, "WEB_IMAGE_NOT_VERIFIED")


@pytest.mark.parametrize("changed", ["migration", "rollback"])
def test_old_capability_signature_cannot_authorize_changed_plan(monkeypatch, changed):
    kwargs = {"migration_plan_hash": DIGEST("a")} if changed == "migration" else {"rollback_plan_hash": DIGEST("b")}
    decision, _ = check(monkeypatch, **kwargs)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


@pytest.mark.parametrize("changed", ["migration_plan_hash", "rollback_plan_hash"])
def test_signed_plan_must_match_approval_subject(monkeypatch, changed):
    observed = payload()
    observed[changed] = DIGEST("a")
    decision, _ = check(monkeypatch, observed)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


def test_capability_evidence_cannot_reuse_another_approval_subject_hash(monkeypatch):
    decision, _ = check(monkeypatch, base_subject_hash=DIGEST("a"))
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


def test_signed_approval_subject_hash_must_match_current_subject(monkeypatch):
    observed = payload()
    observed["approval_subject_hash"] = DIGEST("a")
    decision, _ = check(monkeypatch, observed)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


@pytest.mark.parametrize("changed", ["target_instance", "rehearsal_run"])
def test_signed_observation_cannot_be_replayed_for_another_target_or_run(monkeypatch, changed):
    kwargs = ({"target_instance_id": "f18-wsl-instance-r2"} if changed == "target_instance"
              else {"rehearsal_run_id": "rehearsal-run-002"})
    decision, _ = check(monkeypatch, **kwargs)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


@pytest.mark.parametrize("issued,expires,now", [
    ("2026-09-25T02:49:00Z", "2026-09-25T02:54:00Z", NOW),
    ("2026-09-25T03:00:31Z", "2026-09-25T03:04:00Z", NOW),
    ("2026-09-25T02:59:00Z", "2026-09-25T03:04:00Z", datetime(2026, 9, 25, 3, 4, tzinfo=timezone.utc)),
    ("2026-09-25T02:59:00Z", "2026-09-25T03:04:01Z", NOW),
    ("2026-09-25T03:04:00Z", "2026-09-25T02:59:00Z", NOW),
    ("2026-09-25 02:59:00", "2026-09-25T03:04:00Z", NOW),
    ("2026-09-25T02:59:00Z", "2026-09-25T03:04:00Z", datetime(2026, 9, 25, 3, 0)),
])
def test_stale_future_oversized_or_untrusted_time_fails_closed(monkeypatch, issued, expires, now):
    observed = payload()
    observed["issued_at"] = issued
    observed["expires_at"] = expires
    decision, _ = check(monkeypatch, observed, now_utc=now)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


@pytest.mark.parametrize("change", [
    "missing_oidc", "missing_object_storage", "missing_network", "missing_pg18",
    "status_oidc", "status_object_storage", "status_network", "status_pg18",
    "verified_only", "wrong_acquisition", "wrong_environment", "wrong_commit",
    "wrong_manifest", "wrong_web_image", "wrong_api_image", "wrong_worker_image",
    "bad_evidence_hash", "wrong_collector",
])
def test_capability_evidence_fails_closed(monkeypatch, change):
    observed = payload()
    if change.startswith("missing_"):
        del observed["capabilities"][change.removeprefix("missing_")]
    elif change.startswith("status_"):
        observed["capabilities"][change.removeprefix("status_")]["status"] = "NOT_VERIFIED"
    elif change == "verified_only":
        observed["capabilities"]["oidc"] = {"verified": True}
    elif change == "wrong_acquisition":
        observed["capabilities"]["oidc"]["acquisition"] = "fixture"
    elif change == "wrong_environment":
        observed["environment_id"] = "other"
    elif change == "wrong_commit":
        observed["source_commit"] = "b" * 40
    elif change == "wrong_manifest":
        observed["release_manifest_hash"] = DIGEST("9")
    elif change.endswith("_image"):
        observed["image_digests"][change.split("_")[1]] = DIGEST("9")
    elif change == "bad_evidence_hash":
        observed["capabilities"]["network"]["evidence_hash"] = "unverified"
    else:
        observed["collector_id"] = "other-collector"
    decision, calls = check(monkeypatch, observed)
    assert calls == ["git-artifact"]
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


def test_changed_signature_or_trust_cannot_assert_provenance(monkeypatch):
    def tamper(raw, public, fingerprint):
        envelope = json.loads(raw)
        envelope["signature"] = base64.b64encode(b"0" * 64).decode("ascii")
        return canonical(envelope), public, fingerprint

    decision, _ = check(monkeypatch, signer_override=tamper)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")

    def wrong_trust(raw, public, fingerprint):
        return raw, public, DIGEST("0")

    decision, _ = check(monkeypatch, signer_override=wrong_trust)
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


def test_missing_envelope_is_not_verified_true_shortcut(monkeypatch):
    monkeypatch.setattr(operational, "validate_existing_checkout", lambda *a, **kw: PreflightDecision(True, "READY_FOR_PRIVATE_REHEARSAL", DIGEST("a")))
    release, approval, wsl = subjects()
    decision = operational.validate_wsl_operational(
        release, wsl, approval, ENVIRONMENT, MIGRATION, ROLLBACK, "unused-checkout",
        {"verified": True}, trusted_public_key_pem=b"", trusted_fingerprint=DIGEST("0"),
        expected_collector_id=COLLECTOR, expected_target_instance_id=TARGET_INSTANCE,
        expected_rehearsal_run_id=REHEARSAL_RUN, now_utc=NOW,
    )
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")


def test_caller_cannot_override_approved_remote(monkeypatch):
    remotes = []
    release, approval, wsl = subjects()
    def base(*args, **kwargs):
        remotes.append(args[-1])
        return PreflightDecision(True, "READY_FOR_PRIVATE_REHEARSAL", subject_hash(approval))
    monkeypatch.setattr(operational, "validate_existing_checkout", base)
    raw, public, fingerprint = signed_bundle(payload())
    decision = operational.validate_wsl_operational(
        release, wsl, approval, ENVIRONMENT, MIGRATION, ROLLBACK, "unused-checkout",
        raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
        expected_collector_id=COLLECTOR, expected_target_instance_id=TARGET_INSTANCE,
        expected_rehearsal_run_id=REHEARSAL_RUN, now_utc=NOW,
    )
    assert decision.ready is True
    assert remotes == [operational.APPROVED_DEVELOPMENT_REMOTE]
    with pytest.raises(TypeError, match="approved_remote"):
        operational.validate_wsl_operational(
            release, wsl, approval, ENVIRONMENT, MIGRATION, ROLLBACK, "unused-checkout",
            raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
            expected_collector_id=COLLECTOR, expected_target_instance_id=TARGET_INSTANCE,
            expected_rehearsal_run_id=REHEARSAL_RUN, now_utc=NOW,
            approved_remote="file:///unauthorized-local-remote",
        )
