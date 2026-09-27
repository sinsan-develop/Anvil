"""Static R43A OIDC host contract; Compose/runtime evidence belongs to R43B."""

from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "deploy/wsl/compose.f18.yml"
OVERLAY = ROOT / "deploy/wsl/compose.f18.oidc.yml"
NGINX = ROOT / "deploy/wsl/nginx-f18-oidc.conf"


class OverrideList(list):
    """Distinguish Compose replacement from an ordinary YAML sequence."""


class ComposeLoader(yaml.SafeLoader):
    pass


ComposeLoader.add_constructor(
    "!override", lambda loader, node: OverrideList(loader.construct_sequence(node))
)


def _base():
    return yaml.safe_load(BASE.read_text(encoding="utf-8"))


def _overlay():
    return yaml.load(OVERLAY.read_text(encoding="utf-8"), Loader=ComposeLoader)


def _networks(service):
    networks = service.get("networks", [])
    return set(networks) if isinstance(networks, (list, dict)) else set()


def _mounts(service):
    return {mount.get("target"): mount for mount in service.get("volumes", [])}


def host_errors(base, overlay):
    """Check the intentional overlay boundary, without claiming Docker config PASS."""
    errors = []
    services = overlay.get("services", {})
    web = services.get("web", {})
    api = services.get("api", {})
    issuer = services.get("oidc-issuer", {})
    if set(services) != {"web", "api", "worker", "oidc-issuer"}:
        errors.append("service-set")
    if base.get("services", {}).get("web", {}).get("ports") != [
        "127.0.0.1:${ANVIL_F18_HTTP_PORT:?reserved loopback port required}:8080"
    ]:
        errors.append("base-http-contract")
    if not isinstance(web.get("ports"), OverrideList) or web.get("ports") != [
        "127.0.0.1:8444:8444"
    ]:
        errors.append("https-exclusive-loopback")
    if any(key in web for key in ("network_mode", "extra_hosts", "build", "privileged", "container_name")):
        errors.append("web-host-exposure")
    if not isinstance(web.get("depends_on"), OverrideList) or set(web.get("depends_on", [])) != {
        "api", "oidc-issuer"
    }:
        errors.append("web-issuer-dependency")
    web_networks = web.get("networks")
    if (not isinstance(web_networks, dict)
            or _networks(web) != {"internal", "ingress"}
            or web_networks.get("internal", {}).get("aliases") != ["anvil-f18-qa.local"]):
        errors.append("web-internal-alias")
    if _networks(issuer) != {"internal"} or any(
        key in issuer for key in ("ports", "publish", "extra_hosts", "network_mode", "build")
    ):
        errors.append("issuer-isolation")
    if issuer.get("image") != "${ANVIL_F18_OIDC_ISSUER_IMAGE_REF:?verified QA issuer image ID required}":
        errors.append("issuer-image")
    base_web = base.get("services", {}).get("web", {})
    if (web.get("read_only") is not True
            or base_web.get("cap_drop") != ["ALL"]
            or base_web.get("security_opt") != ["no-new-privileges:true"]
            or any(key in web for key in ("cap_drop", "security_opt"))
            or web.get("labels", {}).get("com.anvil.cleanup-scope") != "F18_ISOLATED_WSL_OPS"):
        errors.append("web-security")
    if (issuer.get("read_only") is not True or issuer.get("cap_drop") != ["ALL"]
            or issuer.get("security_opt") != ["no-new-privileges:true"]
            or issuer.get("labels", {}).get("com.anvil.cleanup-scope") != "F18_ISOLATED_WSL_OPS"):
        errors.append("issuer-security")
    if any(key in api for key in ("ports", "publish", "extra_hosts", "network_mode", "build")):
        errors.append("api-host-exposure")
    env = api.get("environment", {})
    if env.get("FORWARDED_ALLOW_IPS") != "${ANVIL_F18_WEB_PROXY_IP:?exact QA Web internal IP required}":
        errors.append("proxy-trust")
    worker = services.get("worker", {})
    if (worker.get("environment") != {"ANVIL_AUTH_MODE": "OIDC"}
            or any(key in worker for key in ("ports", "publish", "extra_hosts", "network_mode", "build"))):
        errors.append("worker-oidc-mode")
    expected = {
        "ANVIL_AUTH_MODE": "OIDC",
        "ANVIL_CONSOLE_BASE_URL": "https://anvil-f18-qa.local:8444",
        "ANVIL_PUBLIC_HOST": "anvil-f18-qa.local",
        "ANVIL_OIDC_ISSUER": "https://anvil-f18-qa.local:8444/realms/anvil",
        "ANVIL_OIDC_CLIENT_ID": "anvil-web",
        "ANVIL_OIDC_STEP_UP_ACR": "urn:anvil:step-up",
        "ANVIL_F18_OIDC_TRUST_FILE": "/run/anvil-f18-oidc/trust.json",
    }
    if any(env.get(key) != value for key, value in expected.items()):
        errors.append("oidc-environment")
    if any("SECRET" in key.upper() for key in env if key.startswith(("ANVIL_OIDC_", "ANVIL_F18_OIDC_"))):
        errors.append("oidc-secret-environment")
    mounts = _mounts(api)
    for filename in ("trust.json", "ca.crt", "client-secret"):
        target = "/run/anvil-f18-oidc/" + filename
        mount = mounts.get(target, {})
        if (mount.get("type") != "bind" or mount.get("source") !=
                "${ANVIL_F18_OIDC_MATERIAL_DIR:?dedicated synthetic material directory required}/" + filename
                or mount.get("read_only") is not True):
            errors.append("api-mount-" + filename)
    mounts = _mounts(web)
    expected_web = {
        "/etc/nginx/nginx.conf": "./nginx-f18-oidc.conf",
        "/run/anvil-f18-oidc/tls.crt": "${ANVIL_F18_OIDC_MATERIAL_DIR:?dedicated synthetic material directory required}/tls.crt",
        "/run/anvil-f18-oidc/tls.key": "${ANVIL_F18_OIDC_MATERIAL_DIR:?dedicated synthetic material directory required}/tls.key",
    }
    for target, source in expected_web.items():
        mount = mounts.get(target, {})
        if mount.get("type") != "bind" or mount.get("source") != source or mount.get("read_only") is not True:
            errors.append("web-mount-" + target)
    return errors


def test_oidc_overlay_is_fail_closed():
    assert host_errors(_base(), _overlay()) == []


def test_oidc_overlay_requires_exact_web_ip_proxy_trust_and_worker_mode():
    overlay = _overlay()
    assert overlay["services"]["api"]["environment"]["FORWARDED_ALLOW_IPS"] == (
        "${ANVIL_F18_WEB_PROXY_IP:?exact QA Web internal IP required}"
    )
    assert overlay["services"]["worker"]["environment"] == {"ANVIL_AUTH_MODE": "OIDC"}
    assert "ports" not in overlay["services"]["worker"]


@pytest.mark.parametrize("bad_proxy", ["", "*", "0.0.0.0/0", "172.28.0.0/16", "127.0.0.1"])
def test_oidc_overlay_rejects_hardcoded_or_broad_proxy_trust(bad_proxy):
    overlay = _overlay()
    overlay["services"]["api"]["environment"]["FORWARDED_ALLOW_IPS"] = bad_proxy
    assert "proxy-trust" in host_errors(_base(), overlay)


def test_oidc_overlay_rejects_worker_mode_drift():
    overlay = _overlay()
    overlay["services"]["worker"]["environment"]["ANVIL_AUTH_MODE"] = "COOKIE"
    assert "worker-oidc-mode" in host_errors(_base(), overlay)


@pytest.mark.parametrize("bad_ports", [["0.0.0.0:8444:8444"], ["127.0.0.1:8080:8080"], ["127.0.0.1:8444:8444", "127.0.0.1:8080:8080"]])
def test_http_or_nonloopback_web_publish_is_rejected(bad_ports):
    overlay = _overlay()
    overlay["services"]["web"]["ports"] = OverrideList(bad_ports)
    assert "https-exclusive-loopback" in host_errors(_base(), overlay)


def test_plain_list_does_not_replace_base_http_publish():
    overlay = _overlay()
    overlay["services"]["web"]["ports"] = ["127.0.0.1:8444:8444"]
    assert "https-exclusive-loopback" in host_errors(_base(), overlay)


@pytest.mark.parametrize("key", ["security_opt", "cap_drop"])
def test_web_inherited_security_sequence_does_not_duplicate_on_compose_merge(key):
    base_values = _base()["services"]["web"][key]
    overlay_values = _overlay()["services"]["web"].get(key, [])
    merged = base_values + overlay_values
    assert len(merged) == len(set(merged))


def test_web_without_internal_dns_alias_is_rejected():
    overlay = _overlay()
    overlay["services"]["web"]["networks"] = ["internal", "ingress"]
    assert "web-internal-alias" in host_errors(_base(), overlay)


def test_web_network_mode_override_is_rejected():
    overlay = _overlay()
    overlay["services"]["web"]["network_mode"] = "host"
    assert "web-host-exposure" in host_errors(_base(), overlay)


@pytest.mark.parametrize("mutation", [
    lambda service: service.update(ports=["127.0.0.1:8302:8302"]),
    lambda service: service.update(networks=["internal", "ingress"]),
    lambda service: service.update(build="."),
])
def test_issuer_host_exposure_is_rejected(mutation):
    overlay = _overlay()
    mutation(overlay["services"]["oidc-issuer"])
    assert "issuer-isolation" in host_errors(_base(), overlay)


@pytest.mark.parametrize("key,bad", [
    ("ANVIL_AUTH_MODE", "COOKIE"),
    ("ANVIL_CONSOLE_BASE_URL", "http://anvil-f18-qa.local:8444"),
    ("ANVIL_OIDC_ISSUER", "https://other.local:8444/realms/anvil"),
    ("ANVIL_PUBLIC_HOST", "localhost"),
])
def test_non_oidc_or_wrong_origin_is_rejected(key, bad):
    overlay = _overlay()
    overlay["services"]["api"]["environment"][key] = bad
    assert "oidc-environment" in host_errors(_base(), overlay)


def test_oidc_secret_environment_is_rejected():
    overlay = _overlay()
    overlay["services"]["api"]["environment"]["ANVIL_OIDC_CLIENT_SECRET"] = "plaintext"
    assert "oidc-secret-environment" in host_errors(_base(), overlay)


@pytest.mark.parametrize("service,filename", [("api", "trust.json"), ("api", "ca.crt"), ("api", "client-secret"), ("web", "tls.crt"), ("web", "tls.key")])
def test_missing_or_writable_trust_mount_is_rejected(service, filename):
    overlay = _overlay()
    target = "/run/anvil-f18-oidc/" + filename
    overlay["services"][service]["volumes"] = [
        mount for mount in overlay["services"][service]["volumes"] if mount["target"] != target
    ]
    assert any(error.endswith(filename) for error in host_errors(_base(), overlay))


@pytest.mark.parametrize("service,filename", [("api", "trust.json"), ("api", "ca.crt"), ("api", "client-secret"), ("web", "tls.crt"), ("web", "tls.key")])
def test_writable_trust_mount_is_rejected(service, filename):
    overlay = _overlay()
    target = "/run/anvil-f18-oidc/" + filename
    _mounts(overlay["services"][service])[target]["read_only"] = False
    assert any(error.endswith(filename) for error in host_errors(_base(), overlay))


def test_wrong_ca_source_is_rejected():
    overlay = _overlay()
    _mounts(overlay["services"]["api"])["/run/anvil-f18-oidc/ca.crt"]["source"] = "./untrusted-ca.crt"
    assert "api-mount-ca.crt" in host_errors(_base(), overlay)


def test_nginx_tls_same_origin_routes_and_no_http_listener():
    nginx = NGINX.read_text(encoding="utf-8")
    assert "listen 8444 ssl;" in nginx
    assert "server_name anvil-f18-qa.local;" in nginx
    assert "ssl_certificate /run/anvil-f18-oidc/tls.crt;" in nginx
    assert "ssl_certificate_key /run/anvil-f18-oidc/tls.key;" in nginx
    assert "listen 8080" not in nginx
    assert "location /realms/anvil/" in nginx
    assert "proxy_pass http://oidc-issuer:8302;" in nginx
    for route in ("/api/", "/auth/"):
        assert "location " + route in nginx
    assert nginx.count("proxy_pass http://anvil-api:8301;") == 2
    assert "proxy_set_header Host $http_host;" in nginx
    assert "try_files $uri $uri/ /index.html;" in nginx


def test_original_http_compose_and_image_contract_remain_separate():
    assert _base()["services"]["web"]["ports"] == [
        "127.0.0.1:${ANVIL_F18_HTTP_PORT:?reserved loopback port required}:8080"
    ]
    assert "oidc-issuer" not in _base()["services"]
