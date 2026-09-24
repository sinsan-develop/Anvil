"""F-18 signed deployment code must install with locked and image dependencies."""

from pathlib import Path
import re
import tomllib


ROOT = Path(__file__).resolve().parents[2]


def _project():
    return tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))


def _lock():
    return tomllib.loads((ROOT / "uv.lock").read_text(encoding="utf-8"))


def _runtime_pin():
    rows = (ROOT / "deploy/wsl/requirements-runtime.txt").read_text(encoding="utf-8").splitlines()
    matches = [row for row in rows if row.lower().startswith("cryptography")]
    assert len(matches) == 1
    match = re.fullmatch(r"cryptography==([0-9]+(?:\.[0-9]+){2})", matches[0])
    assert match is not None
    return match.group(1)


def test_ed25519_is_direct_runtime_dependency():
    dependencies = _project()["project"]["dependencies"]
    assert any(re.match(r"^cryptography(?:[<=>!~]|$)", row, re.IGNORECASE) for row in dependencies)


def test_locked_project_installs_crypto_distribution():
    packages = _lock()["package"]
    root = next(row for row in packages if row["name"] == "anvil")
    assert {row["name"] for row in root["dependencies"]} >= {"cryptography"}
    assert any(row["name"] == "cryptography" for row in packages)
    assert any(row["name"] == "cryptography" for row in root["metadata"]["requires-dist"])


def test_wsl_web_image_runtime_crypto_matches_locked_version():
    package = next(row for row in _lock()["package"] if row["name"] == "cryptography")
    assert _runtime_pin() == package["version"]
