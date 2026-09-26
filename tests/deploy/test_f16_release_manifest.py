"""F-16 detached Ed25519 ReleaseManifest verification against independent observations."""

import base64
import hashlib
import importlib.util
import json
from dataclasses import asdict
from pathlib import Path

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from packages.deployment.release_manifest import (
    ManifestVerificationError, ReleaseExpectations, canonical_subject_bytes,
    verify_release_manifest,
)

_STAGING_PATH = Path(__file__).resolve().parents[2] / "deploy/wsl/f16_staging.py"
_SPEC = importlib.util.spec_from_file_location("f16_staging_manifest", _STAGING_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_STAGING = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_STAGING)


COMMIT = "a" * 40
REMOTE = "git@github-sinsan-develop:sinsan-develop/Anvil.git"
IMAGES = {"web": "sha256:" + "1" * 64, "api": "sha256:" + "2" * 64, "worker": "sha256:" + "3" * 64}
PROVIDERS = {
    provider: "adapter-v1" for provider in (
        "cerebras", "groq", "mistral", "openrouter", "upstage",
        "gemini", "anthropic", "openai", "ollama",
    )
}


def subject():
    return {
        "source_git_remote": REMOTE,
        "source_commit": COMMIT,
        "release_tag": "f16-test-1",
        "image_digests": IMAGES.copy(),
        "lockfile_hash": "sha256:" + "4" * 64,
        "sbom_ref": "sha256:" + "5" * 64,
        "db_migration_head": "0016_operations_recovery",
        "config_schema_revision": "sha256:" + "6" * 64,
        "provider_adapter_versions": PROVIDERS.copy(),
        "evidence_manifest_hash": "sha256:" + "7" * 64,
        "verification_report_hash": "sha256:" + "8" * 64,
    }


def expectations():
    return ReleaseExpectations(
        source_git_remote=REMOTE,
        source_commit=COMMIT,
        release_tag="f16-test-1",
        image_digests=IMAGES.copy(),
        lockfile_hash="sha256:" + "4" * 64,
        sbom_ref="sha256:" + "5" * 64,
        db_migration_head="0016_operations_recovery",
        config_schema_revision="sha256:" + "6" * 64,
        provider_adapter_versions=PROVIDERS.copy(),
        evidence_manifest_hash="sha256:" + "7" * 64,
        verification_report_hash="sha256:" + "8" * 64,
    )


def signed_manifest(value):
    # One-time synthetic in-memory key; no private material is serialized or logged.
    signer = Ed25519PrivateKey.generate()
    public = signer.public_key()
    public_der = public.public_bytes(Encoding.DER, PublicFormat.SubjectPublicKeyInfo)
    fingerprint = "sha256:" + hashlib.sha256(public_der).hexdigest()
    payload = canonical_subject_bytes(value)
    envelope = {
        "schema_version": 1,
        "subject": value,
        "subject_hash": "sha256:" + hashlib.sha256(payload).hexdigest(),
        "public_key_fingerprint": fingerprint,
        "signature": base64.b64encode(signer.sign(payload)).decode("ascii"),
    }
    public_pem = public.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    return envelope, public_pem, fingerprint


def verify(envelope, public_pem, fingerprint, observed=None):
    return verify_release_manifest(
        json.dumps(envelope, ensure_ascii=False).encode("utf-8"),
        trusted_public_key_pem=public_pem,
        trusted_fingerprint=fingerprint,
        expected=observed or expectations(),
    )


def test_valid_detached_signature_binds_all_release_subject_fields():
    envelope, public_pem, fingerprint = signed_manifest(subject())
    verified = verify(envelope, public_pem, fingerprint)
    assert verified.source_commit == COMMIT
    assert verified.release_tag == "f16-test-1"
    assert verified.subject_hash == envelope["subject_hash"]
    assert verified.image_digests == tuple(sorted(IMAGES.items()))


def test_current_oidc_migration_head_can_be_signed_and_verified():
    value = subject()
    value["db_migration_head"] = "0019_oidc_sessions"
    envelope, public_pem, fingerprint = signed_manifest(value)
    verified = verify(envelope, public_pem, fingerprint, ReleaseExpectations(**value))
    assert verified.subject_hash == envelope["subject_hash"]


@pytest.mark.parametrize("head", ["0017_unknown", "0018_unknown", "0020_unknown", "other_head", None])
def test_unapproved_migration_head_cannot_enter_signed_subject(head):
    value = subject()
    value["db_migration_head"] = head
    with pytest.raises(ManifestVerificationError, match="MANIFEST_MIGRATION_INVALID"):
        canonical_subject_bytes(value)


@pytest.mark.parametrize("signed_head, observed_head", [
    ("0016_operations_recovery", "0019_oidc_sessions"),
    ("0019_oidc_sessions", "0016_operations_recovery"),
])
def test_valid_signed_migration_head_must_match_observation(signed_head, observed_head):
    value = subject()
    value["db_migration_head"] = signed_head
    envelope, public_pem, fingerprint = signed_manifest(value)
    observed = ReleaseExpectations(**{**value, "db_migration_head": observed_head})
    with pytest.raises(ManifestVerificationError, match="MANIFEST_OBSERVATION_MISMATCH"):
        verify(envelope, public_pem, fingerprint, observed)


@pytest.mark.parametrize("attack", ["signature", "other-public-key", "other-trust-fingerprint", "body", "hash"])
def test_signature_trust_or_subject_tamper_is_rejected(attack):
    envelope, public_pem, fingerprint = signed_manifest(subject())
    if attack == "signature":
        envelope["signature"] = base64.b64encode(b"0" * 64).decode("ascii")
    elif attack == "other-public-key":
        other = Ed25519PrivateKey.generate().public_key()
        public_pem = other.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    elif attack == "other-trust-fingerprint":
        fingerprint = "sha256:" + "0" * 64
    elif attack == "body":
        envelope["subject"]["source_commit"] = "b" * 40
    else:
        envelope["subject_hash"] = "sha256:" + "0" * 64
    with pytest.raises(ManifestVerificationError):
        verify(envelope, public_pem, fingerprint)


@pytest.mark.parametrize("field", [
    "source_git_remote", "source_commit", "release_tag", "image_digests", "lockfile_hash",
    "sbom_ref", "db_migration_head", "config_schema_revision", "provider_adapter_versions",
    "evidence_manifest_hash", "verification_report_hash",
])
def test_required_subject_field_cannot_be_omitted_even_with_valid_signature(field):
    value = subject()
    del value[field]
    with pytest.raises(ManifestVerificationError):
        canonical_subject_bytes(value)


@pytest.mark.parametrize("field", [
    "source_commit", "image_digests", "lockfile_hash", "db_migration_head",
    "config_schema_revision", "provider_adapter_versions", "evidence_manifest_hash",
    "verification_report_hash",
])
def test_signed_but_mismatched_observation_cannot_be_promoted(field):
    value = subject()
    envelope, public_pem, fingerprint = signed_manifest(value)
    observed = expectations()
    mismatch = {**asdict(observed), field: "not-observed"}
    with pytest.raises(ManifestVerificationError):
        verify(envelope, public_pem, fingerprint, ReleaseExpectations(**mismatch))


def test_duplicate_json_keys_and_extra_subject_field_are_rejected():
    envelope, public_pem, fingerprint = signed_manifest(subject())
    raw = json.dumps(envelope)
    duplicated = raw.replace('"schema_version": 1,', '"schema_version": 1, "schema_version": 1,', 1)
    with pytest.raises(ManifestVerificationError):
        verify_release_manifest(
            duplicated.encode(), trusted_public_key_pem=public_pem,
            trusted_fingerprint=fingerprint, expected=expectations(),
        )
    value = subject()
    value["secret_value"] = "synthetic-must-not-be-recorded"
    with pytest.raises(ManifestVerificationError):
        canonical_subject_bytes(value)


@pytest.mark.parametrize("version", ["sk-synthetic-not-a-secret", "https://example.invalid/internal"])
def test_provider_version_must_not_store_credential_or_endpoint_shape(version):
    value = subject()
    value["provider_adapter_versions"]["openai"] = version
    with pytest.raises(ManifestVerificationError):
        canonical_subject_bytes(value)


def test_host_preflight_checks_manifest_then_git_lockfile_and_image_ids(tmp_path, monkeypatch):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    lockfile = checkout / "package-lock.json"
    lockfile.write_bytes(b"synthetic lockfile")
    value = subject()
    value["lockfile_hash"] = "sha256:" + hashlib.sha256(lockfile.read_bytes()).hexdigest()
    envelope, public_pem, fingerprint = signed_manifest(value)
    observed = ReleaseExpectations(**value)
    calls = []
    monkeypatch.setattr(_STAGING, "verify_exact_checkout", lambda *args, **kwargs: calls.append("git"))
    monkeypatch.setattr(_STAGING, "_docker_image_id", lambda digest: calls.append(digest))

    with pytest.raises(ManifestVerificationError):
        _STAGING.preflight_release(
            checkout, raw_manifest=json.dumps({**envelope, "subject_hash": "sha256:" + "0" * 64}).encode(),
            trusted_public_key_pem=public_pem, trusted_fingerprint=fingerprint,
            expected=observed, approved_remote=REMOTE,
        )
    assert calls == []

    verified = _STAGING.preflight_release(
        checkout, raw_manifest=json.dumps(envelope).encode(),
        trusted_public_key_pem=public_pem, trusted_fingerprint=fingerprint,
        expected=observed, approved_remote=REMOTE,
    )
    assert verified.subject_hash == envelope["subject_hash"]
    assert calls == ["git", *[digest for _, digest in sorted(IMAGES.items())]]


def test_preflight_rejects_unapproved_remote_before_git_or_image(tmp_path, monkeypatch):
    envelope, public_pem, fingerprint = signed_manifest(subject())
    monkeypatch.setattr(_STAGING, "verify_exact_checkout", lambda *args, **kwargs: pytest.fail("git must not run"))
    with pytest.raises(_STAGING.GitPreflightError):
        _STAGING.preflight_release(
            tmp_path, raw_manifest=json.dumps(envelope).encode(),
            trusted_public_key_pem=public_pem, trusted_fingerprint=fingerprint,
            expected=expectations(), approved_remote="other-remote",
        )


def test_cli_fixes_approved_remote_and_does_not_launch_compose(tmp_path, monkeypatch, capsys):
    manifest = tmp_path / "manifest.json"
    manifest.write_text("{}", encoding="utf-8")
    key = tmp_path / "public.pem"
    key.write_text("synthetic public input", encoding="utf-8")
    observations = tmp_path / "observations.json"
    observations.write_text(json.dumps(asdict(expectations())), encoding="utf-8")
    calls = []

    def fake_preflight(*args, **kwargs):
        calls.append(kwargs)
        return _STAGING.VerifiedRelease(COMMIT, "f16-test-1", "sha256:" + "a" * 64, tuple(sorted(IMAGES.items())))

    monkeypatch.setattr(_STAGING, "preflight_release", fake_preflight)
    assert _STAGING.main([
        "--checkout", str(tmp_path), "--manifest", str(manifest),
        "--trusted-public-key", str(key), "--trusted-fingerprint", "sha256:" + "b" * 64,
        "--observations", str(observations),
    ]) == 0
    assert calls[0]["approved_remote"] == _STAGING.APPROVED_DEVELOPMENT_REMOTE
    assert "F16_PREFLIGHT_PASS" in capsys.readouterr().out


def test_preflight_rejects_lockfile_mismatch_before_image_inspection(tmp_path, monkeypatch):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    (checkout / "package-lock.json").write_bytes(b"changed lockfile")
    envelope, public_pem, fingerprint = signed_manifest(subject())
    monkeypatch.setattr(_STAGING, "verify_exact_checkout", lambda *args, **kwargs: None)
    monkeypatch.setattr(_STAGING, "_docker_image_id", lambda digest: pytest.fail("image must not be inspected"))
    with pytest.raises(_STAGING.GitPreflightError, match="LOCKFILE_HASH_MISMATCH"):
        _STAGING.preflight_release(
            checkout, raw_manifest=json.dumps(envelope).encode(),
            trusted_public_key_pem=public_pem, trusted_fingerprint=fingerprint,
            expected=expectations(), approved_remote=REMOTE,
        )


def test_docker_image_id_must_match_signed_digest(monkeypatch):
    digest = IMAGES["web"]
    class InspectResult:
        returncode = 0
        stdout = IMAGES["api"] + "\n"
    monkeypatch.setattr(_STAGING.subprocess, "run", lambda *args, **kwargs: InspectResult())
    with pytest.raises(_STAGING.GitPreflightError, match="IMAGE_DIGEST_MISMATCH"):
        _STAGING._docker_image_id(digest)


def test_cli_rejects_missing_observation_before_preflight(tmp_path, monkeypatch):
    manifest = tmp_path / "manifest.json"
    manifest.write_text("{}", encoding="utf-8")
    key = tmp_path / "public.pem"
    key.write_text("synthetic public input", encoding="utf-8")
    observations = tmp_path / "observations.json"
    incomplete = asdict(expectations())
    del incomplete["db_migration_head"]
    observations.write_text(json.dumps(incomplete), encoding="utf-8")
    monkeypatch.setattr(_STAGING, "preflight_release", lambda *args, **kwargs: pytest.fail("must not preflight"))
    with pytest.raises(SystemExit) as exit_result:
        _STAGING.main([
            "--checkout", str(tmp_path), "--manifest", str(manifest),
            "--trusted-public-key", str(key), "--trusted-fingerprint", "sha256:" + "b" * 64,
            "--observations", str(observations),
        ])
    assert exit_result.value.code == 2
