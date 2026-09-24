"""F-18 CLI only reads independently supplied evidence and an existing checkout."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

import packages.deployment.promotion_preflight as preflight
from tests.deploy.test_f16_release_manifest import signed_manifest, subject

from packages.deployment.production_preflight_cli import main


RUNTIME = "sha256:" + "1" * 64
WEB = "sha256:" + "2" * 64
MIGRATION = "sha256:" + "4" * 64
ROLLBACK = "sha256:" + "5" * 64


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=True).stdout.strip()


@pytest.fixture
def case(tmp_path: Path, monkeypatch):
    remote = tmp_path / "approved.git"
    source = tmp_path / "source"
    alias = preflight.APPROVED_DEVELOPMENT_REMOTE
    git("init", "--bare", str(remote))
    git("init", str(source))
    git("config", "user.email", "f18-cli@example.invalid", cwd=source)
    git("config", "user.name", "F18 CLI", cwd=source)
    (source / "tracked.txt").write_text("approved\n", encoding="utf-8")
    git("add", "tracked.txt", cwd=source)
    git("commit", "-m", "approved", cwd=source)
    commit = git("rev-parse", "HEAD", cwd=source)
    git("tag", "-a", "f18-cli-1", "-m", "release", cwd=source)
    git("remote", "add", "origin", str(remote), cwd=source)
    git("push", "origin", "HEAD", "refs/tags/f18-cli-1", cwd=source)
    checkout = tmp_path / "checkout"
    git("clone", str(remote), str(checkout))
    git("checkout", "--detach", commit, cwd=checkout)
    git("remote", "set-url", "origin", alias, cwd=checkout)
    actual_git = preflight._F16._git

    def local_git(*args, **kwargs):
        if args and args[0] == "ls-remote" and alias in args:
            args = tuple(str(remote) if value == alias else value for value in args)
        return actual_git(*args, **kwargs)

    monkeypatch.setattr(preflight._F16, "_git", local_git)
    release_subject = subject()
    release_subject.update(source_git_remote=alias, source_commit=commit, release_tag="f18-cli-1",
                           image_digests={"web": WEB, "api": RUNTIME, "worker": RUNTIME})
    envelope, public, fingerprint = signed_manifest(release_subject)
    raw_manifest = json.dumps(envelope).encode("utf-8")
    evidence = {"git_commit": commit, "runtime_image_digest": RUNTIME,
                "image_digests": {"web": WEB, "api": RUNTIME, "worker": RUNTIME}}
    approval = {"environment_id": "production",
                "release_manifest_hash": "sha256:" + hashlib.sha256(raw_manifest).hexdigest(),
                "migration_plan_hash": MIGRATION, "rollback_plan_hash": ROLLBACK}
    files = {
        "manifest": tmp_path / "manifest.json", "key": tmp_path / "public.pem",
        "expected": tmp_path / "expected.json", "evidence": tmp_path / "evidence.json",
        "approval": tmp_path / "approval.json",
    }
    files["manifest"].write_bytes(raw_manifest)
    files["key"].write_bytes(public)
    files["expected"].write_text(json.dumps(release_subject), encoding="utf-8")
    files["evidence"].write_text(json.dumps(evidence), encoding="utf-8")
    files["approval"].write_text(json.dumps(approval), encoding="utf-8")
    argv = [
        "--checkout", str(checkout), "--manifest", str(files["manifest"]),
        "--trusted-public-key", str(files["key"]), "--trusted-fingerprint", fingerprint,
        "--expected-observations", str(files["expected"]), "--wsl-evidence", str(files["evidence"]),
        "--approval-subject", str(files["approval"]), "--observed-environment-id", "production",
        "--migration-plan-hash", MIGRATION, "--rollback-plan-hash", ROLLBACK,
    ]
    return files, argv, checkout, source, alias


def test_signed_local_checkout_only_yields_non_production_marker(case, capsys):
    _, argv, checkout, _, _ = case
    before = git("status", "--porcelain", "--untracked-files=all", cwd=checkout)
    assert main(argv) == 0
    out = capsys.readouterr()
    assert out.out.startswith("F18_LOCAL_PREFLIGHT_PASS:sha256:")
    assert out.out.rstrip().endswith(":PRODUCTION_CAPABILITY_NOT_VERIFIED")
    assert out.err == ""
    assert git("status", "--porcelain", "--untracked-files=all", cwd=checkout) == before == ""


@pytest.mark.parametrize("change", [
    "signature", "approval", "web", "commit", "image", "dirty", "attached", "remote",
    "source-remote", "duplicate", "nested-duplicate", "extra", "extra-evidence",
    "bad-format", "large", "missing", "missing-key",
])
def test_failure_is_redacted_and_fail_closed(case, capsys, change):
    files, argv, checkout, source, _ = case
    if change == "signature":
        data = json.loads(files["manifest"].read_text(encoding="utf-8"))
        data["signature"] = "invalid-secret-should-not-print"
        files["manifest"].write_text(json.dumps(data), encoding="utf-8")
    elif change == "approval":
        data = json.loads(files["approval"].read_text(encoding="utf-8"))
        data["migration_plan_hash"] = "sha256:" + "9" * 64
        files["approval"].write_text(json.dumps(data), encoding="utf-8")
    elif change in {"web", "commit", "image"}:
        data = json.loads(files["evidence"].read_text(encoding="utf-8"))
        if change == "web":
            del data["image_digests"]
        elif change == "commit":
            data["git_commit"] = "b" * 40
        else:
            data["runtime_image_digest"] = "sha256:" + "9" * 64
        files["evidence"].write_text(json.dumps(data), encoding="utf-8")
    elif change == "dirty":
        (checkout / "tracked.txt").write_text("patched\n", encoding="utf-8")
    elif change == "attached":
        git("switch", "-c", "local", cwd=checkout)
    elif change == "remote":
        git("remote", "set-url", "origin", str(source), cwd=checkout)
    elif change == "source-remote":
        data = json.loads(files["expected"].read_text(encoding="utf-8"))
        data["source_git_remote"] = "git@other:unapproved.git"
        files["expected"].write_text(json.dumps(data), encoding="utf-8")
    elif change == "duplicate":
        files["approval"].write_text('{"environment_id":"x","environment_id":"y"}', encoding="utf-8")
    elif change == "nested-duplicate":
        files["evidence"].write_text(
            '{"git_commit":"' + "a" * 40 + '","runtime_image_digest":"' + RUNTIME +
            '","image_digests":{"web":"' + WEB + '","web":"' + WEB + '"}}', encoding="utf-8"
        )
    elif change == "extra":
        data = json.loads(files["expected"].read_text(encoding="utf-8"))
        data["secret-should-not-print"] = "sensitive"
        files["expected"].write_text(json.dumps(data), encoding="utf-8")
    elif change == "extra-evidence":
        data = json.loads(files["evidence"].read_text(encoding="utf-8"))
        data["extra"] = "secret-should-not-print"
        files["evidence"].write_text(json.dumps(data), encoding="utf-8")
    elif change == "bad-format":
        files["approval"].write_text('{"bad":NaN}', encoding="utf-8")
    elif change == "large":
        files["evidence"].write_text("x" * 20000, encoding="utf-8")
    elif change == "missing-key":
        argv[argv.index("--trusted-public-key") + 1] = str(checkout / "missing-secret-key")
    else:
        argv[argv.index("--manifest") + 1] = str(checkout / "missing-secret-file")
    assert main(argv) != 0
    out = capsys.readouterr()
    assert out.out == ""
    assert out.err.startswith("F18_LOCAL_PREFLIGHT_FAILED:")
    assert "secret-should-not-print" not in out.err
    assert "sensitive" not in out.err
    assert "invalid-secret-should-not-print" not in out.err
    assert str(checkout) not in out.err


def test_module_entrypoint_rejects_missing_input_without_echoing_path(tmp_path):
    result = subprocess.run(
        [sys.executable, "-B", "-m", "packages.deployment.production_preflight_cli",
         "--checkout", str(tmp_path / "private-checkout")],
        text=True, capture_output=True, check=False,
    )
    assert result.returncode != 0
    assert result.stdout == ""
    assert result.stderr.startswith("F18_LOCAL_PREFLIGHT_FAILED:")
    assert str(tmp_path) not in result.stderr
