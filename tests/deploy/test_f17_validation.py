from __future__ import annotations

import pytest
from pathlib import Path
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy" / "wsl"))
from f17_validation import (
    EvidenceError,
    ObservedCriterion,
    build_validation_records,
    validate_target,
)

H = "sha256:" + "a" * 64
GIT = "b" * 40


def test_exact_published_target_and_environment_bound_evidence():
    target = validate_target(
        git_sha=GIT, published_sha=GIT, clean=True,
        image_digest="sha256:" + "c" * 64, migration_head="0016_operations_recovery",
        environment_id="f17-pg15", target_hash=H,
    )
    observed = [ObservedCriterion("AV-OPS-015", H, "f17-pg15", "PASS", "http+database", "sha256:" + "d" * 64, "GET task 200 and DB row matched")]
    rows = build_validation_records(target, observed)
    assert len(rows) == 1
    assert rows[0].criterion_id == "AV-OPS-015"
    assert rows[0].target_hash == H
    assert rows[0].acquisition_mode == "real"
    assert rows[0].verdict == "NEEDS_IMPROVEMENT"  # HTTP+DB is not the full AV-OPS criterion.


@pytest.mark.parametrize("change", [
    {"published_sha": "e" * 40}, {"clean": False},
    {"image_digest": "unverified"}, {"migration_head": "0015"},
])
def test_target_preflight_fails_closed(change):
    args = dict(git_sha=GIT, published_sha=GIT, clean=True, image_digest="sha256:" + "c" * 64,
                migration_head="0016_operations_recovery", environment_id="f17-pg15", target_hash=H)
    args.update(change)
    with pytest.raises(EvidenceError):
        validate_target(**args)


@pytest.mark.parametrize("observed", [
    ObservedCriterion("AV-OPS-015", "sha256:" + "e" * 64, "f17-pg15", "PASS", "http+database", "sha256:" + "d" * 64, "matched"),
    ObservedCriterion("AV-OPS-015", H, "f17-pg18", "PASS", "http+database", "sha256:" + "d" * 64, "matched"),
    ObservedCriterion("AV-OPS-015", H, "f17-pg15", "PASS", "fixture", "sha256:" + "d" * 64, "matched"),
    ObservedCriterion("AV-OPS-015", H, "f17-pg15", "NOT_EXECUTED", "http+database", "sha256:" + "d" * 64, "matched"),
    ObservedCriterion("AV-OPS-025", H, "f17-pg15", "PASS", "http+database", "sha256:" + "d" * 64, "matched"),
])
def test_unbound_or_unexecuted_observation_cannot_be_suitable(observed):
    target = validate_target(git_sha=GIT, published_sha=GIT, clean=True,
        image_digest="sha256:" + "c" * 64, migration_head="0016_operations_recovery",
        environment_id="f17-pg15", target_hash=H)
    with pytest.raises(EvidenceError):
        build_validation_records(target, [observed])


def test_missing_criterion_must_be_explicit_not_executed():
    target = validate_target(git_sha=GIT, published_sha=GIT, clean=True,
        image_digest="sha256:" + "c" * 64, migration_head="0016_operations_recovery",
        environment_id="f17-pg15", target_hash=H)
    assert build_validation_records(target, []) == ()


def test_pg18_compose_isolated_non_superuser_and_no_public_db():
    path = Path(__file__).resolve().parents[2] / "deploy/wsl/compose.f17.yml"
    compose = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert compose["name"] == "anvil-f17-pg18-rc"
    services = compose["services"]
    assert set(services) == {"postgres", "web", "api", "worker"}
    pg = services["postgres"]
    assert "pg18" in pg["image"]
    assert pg["environment"]["POSTGRES_USER"] == "anvil_admin"
    assert "ANVIL_F17_PG_ADMIN_PASSWORD" in pg["environment"]["POSTGRES_PASSWORD"]
    assert all(p.startswith("127.0.0.1:") for p in pg["ports"])
    assert len(pg["ports"]) == 1
    assert "ingress" in pg["networks"]  # Docker internal-only networks suppress host port publishing.
    assert "/var/lib/postgresql" in pg["tmpfs"][0]
    assert not pg.get("volumes")
    assert compose["networks"]["internal"]["internal"] is True
    for name in ("api", "worker"):
        service = services[name]
        serialized = str(service)
        assert "ANVIL_F17_APP_PASSWORD" in serialized
        assert "ANVIL_F17_PG_ADMIN_PASSWORD" not in serialized
        assert "anvil_app" in serialized
        assert "anvil_admin" not in serialized
        assert service["networks"] == ["internal"] if name == "worker" else "internal" in service["networks"]
    assert services["api"]["networks"]["internal"]["aliases"] == ["anvil-api"]
    assert services["api"]["environment"]["ANVIL_CONSOLE_BASE_URL"] == "https://127.0.0.1:8443"
    assert services["api"]["environment"]["ANVIL_AUTH_MODE"] == "WSL_ACCEPTANCE"
    assert services["api"]["environment"]["ANVIL_RUNTIME_ENVIRONMENT"] == "WSL_SERVER_TEST_STAGING"
    assert services["web"]["ports"][0].startswith("127.0.0.1:")
    assert all(service["labels"]["com.anvil.cleanup-scope"] == "F17_ISOLATED_PG18_RC" for service in services.values())
