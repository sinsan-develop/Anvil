"""Fail-closed static contract for the isolated F-18 WSL network."""

from copy import deepcopy
from pathlib import Path

import pytest
import yaml


COMPOSE = Path(__file__).resolve().parents[2] / "deploy/wsl/compose.f18.yml"
SERVICE_NAMES = {"web", "api", "worker", "postgres", "minio"}
PRIVATE_SERVICES = SERVICE_NAMES - {"web"}


def _networks(service):
    networks = service.get("networks", [])
    return set(networks) if isinstance(networks, (list, dict)) else set()


def topology_errors(compose):
    """Return every violation; missing fields fail closed."""
    errors = []
    services = compose.get("services", {})
    networks = compose.get("networks", {})
    if set(services) != SERVICE_NAMES:
        errors.append("service-set")
    if set(networks) != {"internal", "ingress"}:
        errors.append("network-set")
    if networks.get("internal", {}).get("internal") is not True:
        errors.append("internal-network")
    if networks.get("ingress", {}).get("internal") is not False:
        errors.append("ingress-network")

    for name in SERVICE_NAMES & set(services):
        service = services[name]
        expected_networks = {"internal", "ingress"} if name == "web" else {"internal"}
        if _networks(service) != expected_networks:
            errors.append(f"{name}-networks")
        if name == "web":
            if service.get("ports") != ["127.0.0.1:${ANVIL_F18_HTTP_PORT:?reserved loopback port required}:8080"]:
                errors.append("web-loopback-port")
        elif "ports" in service or "publish" in service:
            errors.append(f"{name}-host-port")
        for forbidden in ("build", "network_mode", "extra_hosts", "privileged", "container_name"):
            if forbidden in service:
                errors.append(f"{name}-{forbidden}")
        if service.get("security_opt") != ["no-new-privileges:true"]:
            errors.append(f"{name}-no-new-privileges")
        if service.get("labels", {}).get("com.anvil.cleanup-scope") != "F18_ISOLATED_WSL_OPS":
            errors.append(f"{name}-cleanup-scope")
        if name in {"web", "api", "worker"}:
            if service.get("read_only") is not True:
                errors.append(f"{name}-read-only")
            if service.get("cap_drop") != ["ALL"]:
                errors.append(f"{name}-cap-drop")
        if name in {"api", "worker"} and "command" in service:
            errors.append(f"{name}-entrypoint-override")
    return errors


def _compose():
    return yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))


def test_f18_compose_has_fail_closed_topology():
    assert topology_errors(_compose()) == []


@pytest.mark.parametrize("service", sorted(PRIVATE_SERVICES))
def test_private_service_host_port_is_rejected(service):
    compose = _compose()
    compose["services"][service]["ports"] = ["127.0.0.1:9999:9999"]
    assert f"{service}-host-port" in topology_errors(compose)


@pytest.mark.parametrize("service", sorted(PRIVATE_SERVICES))
def test_private_service_ingress_is_rejected(service):
    compose = _compose()
    compose["services"][service]["networks"] = ["internal", "ingress"]
    assert f"{service}-networks" in topology_errors(compose)


@pytest.mark.parametrize("service", ["api", "worker"])
@pytest.mark.parametrize("key,value,violation", [
    ("read_only", False, "read-only"),
    ("cap_drop", [], "cap-drop"),
    ("security_opt", [], "no-new-privileges"),
])
def test_application_security_regression_is_rejected(service, key, value, violation):
    compose = deepcopy(_compose())
    compose["services"][service][key] = value
    assert f"{service}-{violation}" in topology_errors(compose)


def test_immutable_role_images_ephemeral_data_and_no_shared_f17_resources():
    compose = _compose()
    services = compose["services"]
    for name in ("web", "api", "worker", "minio"):
        assert services[name]["image"] == (
            "${ANVIL_F18_" + name.upper() + "_IMAGE_REF:?verified image ID required}"
        )
        assert "volumes" not in services[name]
    assert services["postgres"]["image"] == "${ANVIL_F18_PG18_IMAGE_REF:?verified PG18 image ID required}"
    assert "volumes" not in services["postgres"]
    assert "volumes" not in compose
    assert services["postgres"]["tmpfs"] == ["/var/lib/postgresql:rw,noexec,nosuid,size=512m"]
    assert services["minio"]["tmpfs"] == ["/data:rw,noexec,nosuid,size=512m"]
    assert services["postgres"]["environment"]["POSTGRES_PASSWORD"] == (
        "${ANVIL_F18_PG_ADMIN_PASSWORD:?synthetic credential required}"
    )
    assert services["minio"]["environment"]["MINIO_ROOT_PASSWORD"] == (
        "${ANVIL_F18_MINIO_ROOT_PASSWORD:?synthetic credential required}"
    )
    content = COMPOSE.read_text(encoding="utf-8")
    assert "local-postgres" not in content
    assert "anvil-f17-pg18-rc" not in content
    assert "envil.sinsan.kr" not in content


def test_web_uses_private_api_alias_without_application_command_override():
    compose = _compose()
    services = compose["services"]
    assert services["api"]["networks"]["internal"]["aliases"] == ["anvil-api"]
    assert "command" not in services["api"]
    assert "command" not in services["worker"]
    assert services["web"]["read_only"] is True
