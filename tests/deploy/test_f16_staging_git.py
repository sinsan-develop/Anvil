"""F-16 Git-only staging checkout rejects local or untrusted source state."""

from pathlib import Path
import importlib.util
import subprocess

import pytest

_SCRIPT = Path(__file__).resolve().parents[2] / "deploy/wsl/f16_staging.py"
_SPEC = importlib.util.spec_from_file_location("f16_staging", _SCRIPT)
assert _SPEC is not None and _SPEC.loader is not None
_STAGING = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_STAGING)
GitPreflightError = _STAGING.GitPreflightError
fetch_exact_checkout = _STAGING.fetch_exact_checkout
verify_exact_checkout = _STAGING.verify_exact_checkout


def git(*arguments: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        ["git", *arguments], cwd=cwd, text=True, capture_output=True, check=True,
    )
    return result.stdout.strip()


@pytest.fixture
def published_tag(tmp_path: Path):
    remote = tmp_path / "approved.git"
    source = tmp_path / "source"
    remote.mkdir()
    source.mkdir()
    git("init", "--bare", str(remote))
    git("init", str(source))
    git("config", "user.email", "f16-test@example.invalid", cwd=source)
    git("config", "user.name", "F16 fixture", cwd=source)
    (source / "tracked.txt").write_text("approved source\n", encoding="utf-8")
    git("add", "tracked.txt", cwd=source)
    git("commit", "-m", "source", cwd=source)
    commit = git("rev-parse", "HEAD", cwd=source)
    git("tag", "-a", "f16-test-1", "-m", "release fixture", cwd=source)
    git("remote", "add", "origin", str(remote), cwd=source)
    git("push", "origin", "HEAD", "refs/tags/f16-test-1", cwd=source)
    return remote, source, commit


def test_fetch_creates_only_exact_clean_detached_remote_tag_checkout(tmp_path, published_tag):
    remote, _, commit = published_tag
    checkout = tmp_path / "staging"

    fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")

    assert git("rev-parse", "HEAD", cwd=checkout) == commit
    assert git("status", "--porcelain", "--untracked-files=all", cwd=checkout) == ""
    assert subprocess.run(["git", "symbolic-ref", "-q", "HEAD"], cwd=checkout, capture_output=True).returncode == 1
    published_tag_object = git("ls-remote", str(remote), "refs/tags/f16-test-1").split()[0]
    assert git("rev-parse", "refs/tags/f16-test-1", cwd=checkout) == published_tag_object
    assert (checkout / "tracked.txt").read_text(encoding="utf-8") == "approved source\n"
    verify_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")


@pytest.mark.parametrize("mutation", ["tracked", "untracked", "branch", "remote", "copied-source"])
def test_preflight_rejects_dirty_branch_other_remote_or_copied_source(tmp_path, published_tag, mutation):
    remote, source, commit = published_tag
    checkout = tmp_path / "staging"
    if mutation == "copied-source":
        checkout.mkdir()
        (checkout / "tracked.txt").write_text("approved source\n", encoding="utf-8")
    else:
        fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")
        if mutation == "tracked":
            (checkout / "tracked.txt").write_text("server patch\n", encoding="utf-8")
        elif mutation == "untracked":
            (checkout / "scp-copy.txt").write_text("copied\n", encoding="utf-8")
        elif mutation == "branch":
            git("switch", "-c", "local-branch", cwd=checkout)
        else:
            git("remote", "set-url", "origin", str(source), cwd=checkout)
    with pytest.raises(GitPreflightError):
        verify_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")


def test_preflight_rejects_local_tag_when_remote_has_no_matching_release(tmp_path, published_tag):
    remote, _, commit = published_tag
    checkout = tmp_path / "staging"
    fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")
    git("tag", "-a", "forged-local-tag", "-m", "local only", cwd=checkout)
    with pytest.raises(GitPreflightError):
        verify_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="forged-local-tag")


def test_preflight_rejects_replaced_local_tag_object_even_if_commit_matches(tmp_path, published_tag):
    remote, _, commit = published_tag
    checkout = tmp_path / "staging"
    fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")
    git("tag", "-f", "-a", "f16-test-1", "-m", "forged same commit", commit, cwd=checkout)
    assert git("rev-parse", "refs/tags/f16-test-1^{commit}", cwd=checkout) == commit
    with pytest.raises(GitPreflightError):
        verify_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")


def test_fetch_rejects_wrong_sha_and_existing_directory_without_mutating_it(tmp_path, published_tag):
    remote, _, commit = published_tag
    checkout = tmp_path / "staging"
    with pytest.raises(GitPreflightError):
        fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit="0" * 40, release_tag="f16-test-1")
    assert not checkout.exists()
    checkout.mkdir()
    protected = checkout / "user-data.txt"
    protected.write_text("preserve", encoding="utf-8")
    with pytest.raises(GitPreflightError):
        fetch_exact_checkout(checkout, approved_remote=str(remote), source_commit=commit, release_tag="f16-test-1")
    assert protected.read_text(encoding="utf-8") == "preserve"
