"""F-16 staging Compose isolation policy, without starting Docker resources."""

from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "deploy" / "wsl" / "compose.f16.yml"


def stack():
    return yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))


def test_only_web_exposes_loopback_and_no_build_or_host_gateway():
    services = stack()["services"]
    assert set(services) == {"web", "api", "worker", "postgres"}
    for name, service in services.items():
        assert "build" not in service
        assert "extra_hosts" not in service
        assert "network_mode" not in service
        assert "privileged" not in service
        assert "container_name" not in service
        if name == "web":
            assert service["ports"] == ["127.0.0.1:${ANVIL_F16_HTTP_PORT:?required}:8080"]
        else:
            assert "ports" not in service


def test_postgres_and_application_are_on_private_network_only():
    config = stack()
    services = config["services"]
    assert config["networks"]["internal"]["internal"] is True
    assert config["networks"]["ingress"]["internal"] is False
    for name in ("worker", "postgres"):
        assert services[name]["networks"] == ["internal"]
    assert set(services["api"]["networks"]) == {"internal"}
    assert services["api"]["networks"]["internal"]["aliases"] == ["anvil-api"]
    assert set(services["web"]["networks"]) == {"internal", "ingress"}
    assert "volumes" not in config
    assert services["postgres"]["tmpfs"] == ["/var/lib/postgresql/data:rw,noexec,nosuid,size=256m"]


def test_exact_preverified_images_and_no_embedded_credentials():
    content = COMPOSE.read_text(encoding="utf-8")
    services = stack()["services"]
    for name in ("web", "api", "worker"):
        assert services[name]["image"] == "${ANVIL_F16_" + name.upper() + "_IMAGE_REF:?verified digest required}"
    assert services["postgres"]["image"] == "${ANVIL_F16_PG15_IMAGE_REF:?verified PG15 image required}"
    assert "${ANVIL_F16_PG_PASSWORD:?required}" in content
    assert "host.docker.internal" not in content
    assert "local-postgres" not in content
    assert "envil.sinsan.kr" not in content
    assert "0.0.0.0:" not in content


def test_all_services_have_cleanup_scope_and_security_baseline():
    services = stack()["services"]
    for service in services.values():
        assert service["labels"]["com.anvil.cleanup-scope"] == "F16_ISOLATED_STAGING"
        assert service["security_opt"] == ["no-new-privileges:true"]
    for name in ("web", "api", "worker"):
        assert services[name]["read_only"] is True
        assert services[name]["cap_drop"] == ["ALL"]
