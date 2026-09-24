"""F-16 Git-only staging checkout preflight; no legacy deploy scripts are called."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

from packages.deployment.release_manifest import (
    ManifestVerificationError, ReleaseExpectations, VerifiedRelease, verify_release_manifest,
)


APPROVED_DEVELOPMENT_REMOTE = "git@github-sinsan-develop:sinsan-develop/Anvil.git"
_SHA = re.compile(r"[0-9a-f]{40}\Z")
_TAG = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,126}\Z")


class GitPreflightError(ValueError):
    """A checkout is not the clean detached revision on the approved remote."""


def _git(*arguments: str, cwd: Path | None = None, allowed_codes: tuple[int, ...] = (0,)) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            ["git", *arguments], cwd=cwd, text=True, capture_output=True,
            timeout=45, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise GitPreflightError("GIT_COMMAND_UNAVAILABLE") from error
    if result.returncode not in allowed_codes:
        raise GitPreflightError("GIT_PREFLIGHT_FAILED")
    return result


def _validated_inputs(source_commit: str, release_tag: str) -> None:
    if not isinstance(source_commit, str) or _SHA.fullmatch(source_commit) is None:
        raise GitPreflightError("SOURCE_COMMIT_INVALID")
    if (
        not isinstance(release_tag, str)
        or _TAG.fullmatch(release_tag) is None
        or release_tag.endswith((".", ".lock"))
        or ".." in release_tag
    ):
        raise GitPreflightError("RELEASE_TAG_INVALID")


def _published_commit(approved_remote: str, release_tag: str) -> str:
    result = _git("ls-remote", "--exit-code", approved_remote, f"refs/tags/{release_tag}^{{}}")
    lines = result.stdout.strip().splitlines()
    if len(lines) != 1:
        raise GitPreflightError("RELEASE_TAG_NOT_PUBLISHED")
    sha, separator, ref = lines[0].partition("\t")
    if not separator or ref != f"refs/tags/{release_tag}^{{}}" or _SHA.fullmatch(sha) is None:
        raise GitPreflightError("RELEASE_TAG_NOT_PUBLISHED")
    return sha


def _published_tag_object(approved_remote: str, release_tag: str) -> str:
    result = _git("ls-remote", "--exit-code", "--refs", approved_remote, f"refs/tags/{release_tag}")
    lines = result.stdout.strip().splitlines()
    if len(lines) != 1:
        raise GitPreflightError("RELEASE_TAG_NOT_PUBLISHED")
    sha, separator, ref = lines[0].partition("\t")
    if not separator or ref != f"refs/tags/{release_tag}" or _SHA.fullmatch(sha) is None:
        raise GitPreflightError("RELEASE_TAG_NOT_PUBLISHED")
    return sha


def verify_exact_checkout(
    checkout: Path, *, approved_remote: str, source_commit: str, release_tag: str
) -> None:
    """Reject dirty, attached, copied, unapproved or nonpublished server source."""
    _validated_inputs(source_commit, release_tag)
    target = Path(checkout).resolve()
    if not target.is_dir() or not (target / ".git").exists():
        raise GitPreflightError("GIT_CHECKOUT_REQUIRED")
    if Path(_git("rev-parse", "--show-toplevel", cwd=target).stdout.strip()).resolve() != target:
        raise GitPreflightError("GIT_CHECKOUT_ROOT_MISMATCH")
    if _git("remote", "get-url", "origin", cwd=target).stdout.strip() != approved_remote:
        raise GitPreflightError("GIT_REMOTE_MISMATCH")
    if _git("rev-parse", "HEAD", cwd=target).stdout.strip() != source_commit:
        raise GitPreflightError("GIT_COMMIT_MISMATCH")
    if _git("symbolic-ref", "-q", "HEAD", cwd=target, allowed_codes=(0, 1)).returncode != 1:
        raise GitPreflightError("GIT_DETACHED_REQUIRED")
    if _git("status", "--porcelain", "--untracked-files=all", cwd=target).stdout.strip():
        raise GitPreflightError("GIT_DIRTY_CHECKOUT")
    if _git("rev-parse", f"refs/tags/{release_tag}^{{commit}}", cwd=target).stdout.strip() != source_commit:
        raise GitPreflightError("GIT_LOCAL_TAG_MISMATCH")
    if _git("rev-parse", f"refs/tags/{release_tag}", cwd=target).stdout.strip() != _published_tag_object(approved_remote, release_tag):
        raise GitPreflightError("GIT_LOCAL_TAG_OBJECT_MISMATCH")
    if _published_commit(approved_remote, release_tag) != source_commit:
        raise GitPreflightError("GIT_REMOTE_TAG_MISMATCH")


def fetch_exact_checkout(
    checkout: Path, *, approved_remote: str, source_commit: str, release_tag: str
) -> None:
    """Fetch an annotated release tag from the trusted remote into a new checkout."""
    _validated_inputs(source_commit, release_tag)
    if _published_commit(approved_remote, release_tag) != source_commit:
        raise GitPreflightError("GIT_REMOTE_TAG_MISMATCH")
    target = Path(checkout).resolve()
    if target.exists():
        raise GitPreflightError("GIT_NEW_TARGET_REQUIRED")
    if not target.parent.is_dir():
        raise GitPreflightError("GIT_TARGET_PARENT_MISSING")
    target.mkdir()
    _git("init", str(target))
    _git("remote", "add", "origin", approved_remote, cwd=target)
    _git(
        "fetch", "--no-tags", "origin",
        f"refs/tags/{release_tag}:refs/tags/{release_tag}", cwd=target,
    )
    if _git("rev-parse", "FETCH_HEAD^{commit}", cwd=target).stdout.strip() != source_commit:
        raise GitPreflightError("GIT_FETCHED_COMMIT_MISMATCH")
    _git("checkout", "--detach", source_commit, cwd=target)
    verify_exact_checkout(target, approved_remote=approved_remote, source_commit=source_commit, release_tag=release_tag)


def _docker_image_id(reference: str) -> str:
    if not isinstance(reference, str) or re.fullmatch(r"sha256:[0-9a-f]{64}", reference) is None:
        raise GitPreflightError("IMAGE_REFERENCE_INVALID")
    try:
        result = subprocess.run(
            ["docker", "image", "inspect", "--format", "{{.Id}}", reference],
            text=True, capture_output=True, timeout=20, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise GitPreflightError("IMAGE_INSPECTION_UNAVAILABLE") from error
    if result.returncode != 0 or result.stdout.strip() != reference:
        raise GitPreflightError("IMAGE_DIGEST_MISMATCH")
    return reference


def preflight_release(
    checkout: Path, *, raw_manifest: bytes, trusted_public_key_pem: bytes,
    trusted_fingerprint: str, expected: ReleaseExpectations,
    approved_remote: str = APPROVED_DEVELOPMENT_REMOTE,
) -> VerifiedRelease:
    """Read-only gate; Compose launch remains separate and forbidden on failure."""
    if expected.source_git_remote != approved_remote:
        raise GitPreflightError("GIT_REMOTE_MISMATCH")
    verified = verify_release_manifest(
        raw_manifest, trusted_public_key_pem=trusted_public_key_pem,
        trusted_fingerprint=trusted_fingerprint, expected=expected,
    )
    verify_exact_checkout(
        checkout, approved_remote=approved_remote,
        source_commit=verified.source_commit, release_tag=verified.release_tag,
    )
    lockfile = Path(checkout) / "package-lock.json"
    if not lockfile.is_file():
        raise GitPreflightError("LOCKFILE_MISSING")
    if "sha256:" + hashlib.sha256(lockfile.read_bytes()).hexdigest() != expected.lockfile_hash:
        raise GitPreflightError("LOCKFILE_HASH_MISMATCH")
    for _, digest in verified.image_digests:
        _docker_image_id(digest)
    return verified


def main(argv: list[str] | None = None) -> int:
    """Host-only preflight CLI; never accepts a remote override or launches Compose."""
    parser = argparse.ArgumentParser(description="F16 read-only release preflight")
    parser.add_argument("--checkout", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--trusted-public-key", required=True, type=Path)
    parser.add_argument("--trusted-fingerprint", required=True)
    parser.add_argument("--observations", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        observed = json.loads(args.observations.read_text(encoding="utf-8"))
        if not isinstance(observed, dict):
            raise ValueError("observations")
        expected = ReleaseExpectations(**observed)
        verified = preflight_release(
            args.checkout, raw_manifest=args.manifest.read_bytes(),
            trusted_public_key_pem=args.trusted_public_key.read_bytes(),
            trusted_fingerprint=args.trusted_fingerprint, expected=expected,
            approved_remote=APPROVED_DEVELOPMENT_REMOTE,
        )
    except (GitPreflightError, ManifestVerificationError, OSError, ValueError, TypeError) as error:
        code = str(error) if isinstance(error, (GitPreflightError, ManifestVerificationError)) else "PREFLIGHT_INPUT_INVALID"
        parser.exit(2, f"F16_PREFLIGHT_FAILED:{code}\n")
    print(f"F16_PREFLIGHT_PASS:{verified.subject_hash}")
    for service, digest in verified.image_digests:
        print(f"{service.upper()}_IMAGE_ID={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
