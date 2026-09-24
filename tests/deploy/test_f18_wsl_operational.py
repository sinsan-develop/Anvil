"""Signed WSL observations only gate a private rehearsal, never Production."""

import base64
import hashlib
import json

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from packages.deployment.deploy_approval import DeployApprovalSubject
from packages.deployment.promotion_preflight import PreflightDecision, VerifiedApprovalRelease
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


def check(monkeypatch, payload_value=None, *, base_ready=True, signer_override=None):
    calls = []

    def base(*args, **kwargs):
        calls.append("git-artifact")
        return PreflightDecision(base_ready, "READY_FOR_PRIVATE_REHEARSAL" if base_ready else "WEB_IMAGE_NOT_VERIFIED", DIGEST("a"))

    monkeypatch.setattr(operational, "validate_existing_checkout", base)
    release, approval, wsl = subjects()
    raw, public, fingerprint = signed_bundle(payload_value if payload_value is not None else payload())
    if signer_override is not None:
        raw, public, fingerprint = signer_override(raw, public, fingerprint)
    decision = operational.validate_wsl_operational(
        release, wsl, approval, ENVIRONMENT, MIGRATION, ROLLBACK, "unused-checkout",
        raw, trusted_public_key_pem=public, trusted_fingerprint=fingerprint,
        expected_collector_id=COLLECTOR,
    )
    return decision, calls


def test_signed_bound_capabilities_only_allow_wsl_rehearsal(monkeypatch):
    decision, calls = check(monkeypatch)
    assert calls == ["git-artifact"]
    assert (decision.ready, decision.reason_code) == (True, "READY_FOR_WSL_REHEARSAL")


def test_existing_git_artifact_failure_is_preserved_before_capabilities(monkeypatch):
    decision, calls = check(monkeypatch, base_ready=False)
    assert calls == ["git-artifact"]
    assert (decision.ready, decision.reason_code) == (False, "WEB_IMAGE_NOT_VERIFIED")


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
        expected_collector_id=COLLECTOR,
    )
    assert (decision.ready, decision.reason_code) == (False, "CAPABILITY_NOT_VERIFIED")
