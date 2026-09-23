"""F-12 ASGI and same-origin BFF boundary, using real F01/D11/F02 owners."""
import json

from fastapi.testclient import TestClient

from packages.api.common import SessionPrincipal
from packages.api.fastapi_app import ApiPorts, AuthorizationScope, create_app
from packages.api.provider_settings import ProviderSettingsPort
from packages.bff.client import BffResponse, ServerBffClient
from packages.bff.provider_settings import ProviderSettingsBff
from packages.api.runtime import create_runtime_app
from tests.api.test_runtime_app import _env, _FakeSession
from tests.provider_settings.test_f12_settings import service, owners, HASH, ORDER, NOW
from tests.knowledge import test_model_registry_d11 as d11_fixture
from packages.knowledge import model_registry as d11
from packages.knowledge.memory import _hash
from packages.provider_catalog.service import ProviderCatalog
from tests.provider_catalog.test_provider_catalog_f01 import profile as profile_data
from packages.model_registry.service import DiscoveryRouter
from packages.provider_settings.service import ProviderSettingsService
from datetime import timedelta


def client(*, permissions=None, scope=("project-1", "env-1"), settings=None):
    settings = settings or service()[0]
    port = ProviderSettingsPort(settings)
    principal = SessionPrincipal("operator", "operator", "csrf", frozenset(permissions or {
        "provider:read", "provider_routing:read", "providers:configure", "providers:test",
        "providers:refresh-models", "provider_routing:activate:activate", "provider_routing:validate:validate",
        "projects:read", "projects:revise"}),
        frozenset({"project-1"}), frozenset({"env-1"}))
    app = create_app(ports=ApiPorts(queries=port.query_ports(), commands=port.command_ports()),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope(*scope, frozenset({"operator"})))
    result = TestClient(app, base_url="https://anvil.local")
    result.cookies.set("anvil_session", "session")
    return result


def mutation_headers(permission, *, origin="https://anvil.local", csrf="csrf"):
    return {"origin": origin, "x-csrf-token": csrf, "idempotency-key": "f12-command-1",
            "if-match": '"0"', "x-target-hash": HASH, "x-permission-scope": permission, "x-reason": "operator request"}


def test_api_reads_nine_and_denies_foreign_scope():
    response = client().get("/api/providers")
    assert response.status_code == 200
    assert [row["provider_id"] for row in response.json()["data"]] == ORDER
    assert client(scope=("other", "env-1")).get("/api/providers").status_code == 403
    assert client(permissions={"provider_routing:read"}).get("/api/providers").status_code == 403
    assert client().get("/api/provider-routing").json()["data"]["roles"]["tester"]["enabled"] is False


def test_browser_cannot_supply_credential_endpoint_or_approval_proof():
    c = client()
    for body in ({"api_key": "sentinel-secret"}, {"endpoint": "https://internal.example"},
                 {"evidence_ref": "human-approval-1"}):
        response = c.post("/api/providers/openai:configure", json=body,
            headers=mutation_headers("providers:configure"))
        assert response.status_code in (400, 501)
        assert "sentinel-secret" not in response.text
        assert "internal.example" not in response.text
    activation = c.post("/api/provider-routing:activate", json={"target": {"id": "route", "version": 1, "content_hash": HASH},
        "capture_id": "browser-capture", "mode": "HUMAN", "evidence_ref": "browser-claim"},
        headers=mutation_headers("provider_routing:activate:activate"))
    assert activation.status_code in (400, 501)
    assert "browser-claim" not in activation.text


def test_mutation_still_requires_origin_csrf_and_exact_permission():
    c = client()
    path = "/api/providers/openai:test"
    assert c.post(path, json={}, headers=mutation_headers("providers:test", origin="https://evil.example")).status_code == 403
    assert c.post(path, json={}, headers=mutation_headers("providers:test", csrf="wrong")).status_code == 403
    assert c.post(path, json={}, headers=mutation_headers("provider:read")).status_code == 403
    assert c.post(path, json={}, headers=mutation_headers("providers:test")).status_code == 501


def test_bff_uses_same_origin_and_filters_untrusted_internal_fields():
    captured = []
    payload = {"data": [{"provider_id": "openai", "status": "DISABLED", "reason": "SECRET_REVOKED",
        "next_action": "ROTATE_CREDENTIAL_WITH_HOST_APPROVAL", "credential": {"reference_id": "ref-1", "version": 1,
        "status": "REVOKED", "masked": True, "value": "sentinel-secret"},
        "endpoint": "http://127.0.0.1:11434", "raw_error": "sensitive"}], "request_id": "rid"}
    def transport(method, url, headers, body):
        captured.append((method, url, headers, body))
        return BffResponse(200, {"content-type": "application/json"}, json.dumps(payload).encode())
    bff = ProviderSettingsBff(ServerBffClient("http://api-internal:8200", transport))
    response = bff.request("GET", "/api/providers")
    assert captured[0][1] == "http://api-internal:8200/api/providers"
    assert bff.browser_url("/api/providers") == "/api/providers"
    assert b"sentinel-secret" not in response.body and b"127.0.0.1" not in response.body and b"sensitive" not in response.body


def test_runtime_binds_only_explicit_trusted_owner_and_keeps_legacy_default():
    settings, *_ = service()
    principal = SessionPrincipal("operator", "operator", "csrf", frozenset({"provider:read"}),
        frozenset({"project-1"}), frozenset({"env-1"}))
    args = dict(environment=_env(), session_factory=lambda: _FakeSession(),
        authenticate=lambda token: principal if token == "session" else None,
        authorization_resolver=lambda _endpoint, _params: AuthorizationScope("project-1", "env-1", frozenset({"operator"})))
    legacy = create_runtime_app(**args)
    bound = create_runtime_app(**args, provider_settings_owner=settings)
    for app, expected in ((legacy, False), (bound, True)):
        c = TestClient(app, base_url="https://anvil.sinsan.kr")
        c.cookies.set("anvil_session", "session")
        result = c.get("/api/providers")
        assert result.status_code == 200
        assert ("next_action" in result.json()["data"][0]) is expected
    assert "sentinel" not in str(bound.state)


def test_host_configure_api_calls_f01_and_rejects_browser_proof_fields():
    catalog, registry, context, router = owners()
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_operations={"configure": lambda **_: {"secret_ref_id": "host-ref", "purpose": "generate",
            "expires_at": int((NOW + timedelta(hours=1)).timestamp())}})
    c = client(settings=settings)
    headers = mutation_headers("providers:configure")
    headers["x-target-hash"] = catalog.catalog().content_hash
    headers["if-match"] = '"1"'
    forged = c.post("/api/providers/openai:configure", json={"human_approval_id": "browser"}, headers=headers)
    assert forged.status_code in (400, 501)
    assert "openai" not in settings._secret_ids
    result = c.post("/api/providers/openai:configure", json={}, headers=headers)
    assert result.status_code == 200
    assert result.json()["data"]["credential"]["reference_id"] == "host-ref"
    assert catalog.secret_reference("host-ref").to_dict()["provider_id"] == "openai"


def test_bff_command_responses_keep_only_public_fields():
    def transport(_method, _url, _headers, _body):
        return BffResponse(200, {}, json.dumps({"request_id": "rid", "data": {
            "provider_id": "openai", "credential": {"reference_id": "ref", "version": 2,
                "status": "ACTIVE", "masked": True, "value": "secret"},
            "model_id": "model-a", "status": "AVAILABLE", "route_eligible": True,
            "endpoint": "http://127.0.0.1:11434"}}).encode())
    bff = ProviderSettingsBff(ServerBffClient("http://internal:8200", transport))
    for path in ("/api/providers/openai:configure", "/api/providers/openai:test",
                 "/api/providers/openai:refresh-models", "/api/secrets/ref:revoke"):
        result = bff.request("POST", path)
        assert result.status_code == 200
        assert b"secret" not in result.body and b"127.0.0.1" not in result.body


def test_bff_rejects_sensitive_text_even_inside_public_field():
    response = {"request_id": "rid", "data": [{"provider_id": "openai", "status": "UNAVAILABLE",
        "reason": "http://127.0.0.1:11434", "next_action": "REVIEW_HOST_EVIDENCE"}]}
    bff = ProviderSettingsBff(ServerBffClient("http://internal:8200",
        lambda *_: BffResponse(200, {}, json.dumps(response).encode())))
    result = bff.request("GET", "/api/providers")
    assert result.status_code == 502 and b"127.0.0.1" not in result.body


def test_api_routing_validate_and_activate_consume_d11_host_capture():
    registry, context, _, _, _, prompt, model, bench, candidate = d11_fixture.ready(d11)
    catalog = ProviderCatalog(project_id="project-1", environment_id="env-1", broker_policy_hash=HASH)
    def authorize(**request):
        return registry.capture_activation(context, request["target"], mode="HUMAN",
            evidence_ref="host-human-event", expected_version=request["expected_version"],
            now=request["now"], expires_at=request["now"] + timedelta(minutes=20))
    settings = ProviderSettingsService(catalog, registry, context, DiscoveryRouter(registry, context),
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_activation_authorizer=authorize)
    c = client(settings=settings)
    validate_headers = mutation_headers("provider_routing:validate:validate")
    validate_headers["x-target-hash"] = "sha256:" + _hash(registry.query(context, now=NOW))
    validated = c.post("/api/provider-routing:validate", json={"routing": d11_fixture.route_data(prompt, model, bench)},
        headers=validate_headers)
    assert validated.status_code == 200, validated.json()
    assert validated.json()["data"]["content_hash"] == candidate["content_hash"]
    activate_headers = mutation_headers("provider_routing:activate:activate")
    activate_headers["x-target-hash"] = "sha256:" + candidate["content_hash"]
    def asgi_transport(method, url, headers, body):
        result = c.request(method, url, headers=headers, content=body)
        return BffResponse(result.status_code, dict(result.headers), result.content)
    bff = ProviderSettingsBff(ServerBffClient("https://anvil.local", asgi_transport))
    activated = bff.request("POST", "/api/provider-routing:activate", headers=activate_headers,
        body=json.dumps({"target": d11_fixture.reference(candidate)}).encode())
    assert activated.status_code == 200
    assert set(json.loads(activated.body)["data"]) == {"version", "activation_hash", "applies_from", "approval_mode"}
    assert json.loads(activated.body)["data"]["activation_hash"]


def test_bff_activation_preserves_public_activation_hash():
    payload = {"request_id": "rid", "data": {"version": 1, "activation_hash": "abc123",
        "applies_from": "NEXT_RUN_ONLY", "approval_mode": "HUMAN",
        "routing": {"endpoint_ref": "http://127.0.0.1"}}}
    bff = ProviderSettingsBff(ServerBffClient("http://internal:8200",
        lambda *_: BffResponse(200, {}, json.dumps(payload).encode())))
    result = bff.request("POST", "/api/provider-routing:activate")
    assert result.status_code == 200
    assert result.body == b'{"data":{"activation_hash":"abc123","applies_from":"NEXT_RUN_ONLY","approval_mode":"HUMAN","version":1},"request_id":"rid"}'


def test_egress_api_bff_returns_owner_selection_cas_and_rejects_browser_approval():
    catalog, registry, context, router = owners()
    approved = catalog.register_profile("profile-1", profile_data(), human_approval_id="host-event-1")
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_operations={"revise_egress": lambda **_: {"profile": approved,
            "approved_profile_hash": approved.content_hash, "human_approval_id": "host-event-1"}})
    c = client(settings=settings)
    path = "/api/projects/project-1/data-egress-profile"
    initial = c.get(path)
    assert initial.status_code == 200
    assert initial.json()["data"]["version"] == 0
    headers = mutation_headers("projects:revise")
    headers["x-target-hash"] = initial.json()["data"]["selection_hash"]
    forged = c.post(path + ":revise", json={"human_approval_id": "browser-event",
        "profile": profile_data()}, headers=headers)
    assert forged.status_code in (400, 501)
    assert catalog.profile_selection().to_dict()["version"] == 0
    def asgi_transport(method, url, headers, body):
        response = c.request(method, url, headers=headers, content=body)
        return BffResponse(response.status_code, dict(response.headers), response.content)
    bff = ProviderSettingsBff(ServerBffClient("https://anvil.local", asgi_transport))
    changed = bff.request("POST", path + ":revise", headers=headers, body=b"{}")
    assert changed.status_code == 200, changed.body
    data = json.loads(changed.body)["data"]
    assert data["version"] == 1 and data["selection_hash"] == catalog.profile_selection().content_hash
    assert data["profile_hash"] == approved.content_hash
    stale = c.post(path + ":revise", json={}, headers=headers)
    assert stale.status_code == 409
