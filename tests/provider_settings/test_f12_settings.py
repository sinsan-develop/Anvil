"""F-12 host-owner projection contracts. No live provider or Secret material."""
from datetime import timedelta
import json

import pytest

from packages.provider_catalog.service import ProviderCatalog
from packages.provider_catalog.models import Snapshot, canonical, digest
from packages.provider_settings import projection
from packages.knowledge import model_registry as d11
from packages.knowledge.memory import _hash
from packages.model_registry.service import DiscoveryRouter
from tests.knowledge import test_model_registry_d11 as fixture
from tests.provider_catalog.test_provider_catalog_f01 import profile as profile_data, observation

from packages.provider_settings.service import ProviderSettingsService


NOW = fixture.NOW
HASH = "sha256:" + "a" * 64
ORDER = ["cerebras", "groq", "mistral", "openrouter", "upstage", "gemini", "anthropic", "openai", "ollama"]


def owners():
    registry, context, *_ = fixture.setup(d11)
    catalog = ProviderCatalog(project_id="project-1", environment_id="env-1", broker_policy_hash=HASH)
    router = DiscoveryRouter(registry, context)
    return catalog, registry, context, router


def service(*, secret_ids=None, profile=None):
    catalog, registry, context, router = owners()
    return ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", secret_ref_ids=secret_ids or {},
        profile=profile, clock=lambda: NOW), catalog, registry, context, router


def test_nine_unconfigured_providers_and_role_gap_are_visible():
    settings, *_ = service()
    result = settings.providers("project-1", "env-1")
    assert [row["provider_id"] for row in result] == ORDER
    assert all(row["status"] == "NOT_CONFIGURED" and row["reason"] == "CREDENTIAL_NOT_REGISTERED" for row in result)
    routing = settings.routing("project-1", "env-1")
    assert routing["roles"]["main"] == {"enabled": False, "reason": "ROLE_NOT_SUPPORTED_BY_D11"}
    assert routing["roles"]["tester"] == {"enabled": False, "reason": "ROLE_NOT_SUPPORTED_BY_D11"}
    assert "planner" in routing["roles"]


def test_secret_reference_is_masked_and_revocation_blocks():
    settings, catalog, *_ = service(secret_ids={"openai": "secret-openai"})
    secret = catalog.register_secret("secret-openai", provider_id="openai", purpose="llm", now=0, expires_at=2**53)
    available = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert available["credential"] == {"reference_id": "secret-openai", "version": 1, "status": "ACTIVE", "masked": True}
    assert available["status"] != "AVAILABLE"
    catalog.revoke_secret(secret, now=1)
    revoked = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert revoked["status"] == "DISABLED" and revoked["reason"] == "SECRET_REVOKED"
    assert "broker_policy_hash" not in json.dumps(revoked)


def test_host_probe_is_not_live_connection_and_stale_probe_blocks():
    settings, _, registry, context, router = service()
    router.discover(fixture.model_data(), now=NOW)
    fresh = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert fresh["status"] != "AVAILABLE"
    assert fresh["model_count"] == 1
    stale = settings.providers("project-1", "env-1", now=NOW + timedelta(hours=2))
    openai = next(row for row in stale if row["provider_id"] == "openai")
    assert openai["reason"] == "BLOCKED_CAPABILITY_DRIFT"
    assert "endpoint-ref1" not in json.dumps(stale)


def test_scope_and_browser_supplied_activation_proof_are_rejected():
    settings, *_ = service()
    with pytest.raises(ValueError, match="AUTHORIZATION_SCOPE_MISMATCH"):
        settings.providers("another-project", "env-1")
    with pytest.raises(ValueError, match="HOST_ACTIVATION_EVIDENCE_REQUIRED"):
        settings.activate("project-1", "env-1", target={"id": "route", "version": 1, "content_hash": HASH},
            capture_id="browser-capture", expected_version=0, target_hash=HASH, reason="enable", actor_id="operator")


def test_host_verified_connection_egress_secret_and_active_route_enable_only_exact_model():
    registry, context, _, _, _, _, model, _, candidate = fixture.ready(d11)
    fixture.activate(registry, context, candidate)
    catalog = ProviderCatalog(project_id="project-1", environment_id="env-1", broker_policy_hash=HASH)
    catalog.register_endpoint("api.example.com", "https", 443, ["8.8.8.8"], human_approval_id="host-approved-endpoint")
    profile = catalog.register_profile("profile-1", profile_data(), human_approval_id="host-approved-egress")
    initial_selection = catalog.profile_selection()
    catalog.select_profile(profile, expected_version=0, expected_selection_hash=initial_selection.content_hash,
        approved_profile_hash=profile.content_hash, human_approval_id="host-approved-egress")
    catalog.register_secret("secret-openai", provider_id="openai", purpose="generate",
        now=int(NOW.timestamp()) - 1, expires_at=int((NOW + timedelta(hours=4)).timestamp()))
    router = DiscoveryRouter(registry, context)
    good_observation = observation()
    egress_decision = catalog.evaluate_egress(request_id="host-egress-good", snapshot=profile,
        provider_id="openai", purpose="generate", paths=["src/a.py"], content_kind="code",
        observation=good_observation)
    broker_decision = catalog.broker_decision(request_id="host-secret-good",
        reference=catalog.secret_reference("secret-openai"), provider_id="openai", purpose="generate",
        now=int(NOW.timestamp()), operation="injection")
    host_observation = lambda provider, now: {"model_snapshot_hash": model["content_hash"],
        "connection_checked_at": NOW, "purpose": "generate", "paths": ["src/a.py"],
        "content_kind": "code", "observation": good_observation,
        "egress_decision": egress_decision, "broker_decision": broker_decision} if provider == "openai" else None
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", secret_ref_ids={"openai": "secret-openai"},
        profile=profile, clock=lambda: NOW, host_route_observer=host_observation)
    audit_before_read = catalog.audit().to_dict()
    row = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert row["status"] == "AVAILABLE" and row["enabled"] is True
    assert catalog.audit().to_dict() == audit_before_read
    assert "api.example.com" not in json.dumps(row)
    assert settings.routing("project-1", "env-1")["roles"]["developer"]["enabled"] is True
    settings._host_route_observer = lambda provider, now: {**host_observation(provider, now),
        "egress_decision": Snapshot("DECISION", egress_decision.record_id,
            egress_decision.content_hash, "{}") } if provider == "openai" else None
    forged = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert forged["reason"] == "OWNER_EVIDENCE_INVALID" and forged["enabled"] is False
    assert catalog.audit().to_dict() == audit_before_read
    drifted = {**observation(), "training": True}
    drift_decision = catalog.evaluate_egress(request_id="host-egress-drift", snapshot=profile,
        provider_id="openai", purpose="generate", paths=["src/a.py"], content_kind="code",
        observation=drifted)
    settings._host_route_observer = lambda provider, now: {"model_snapshot_hash": model["content_hash"],
        "connection_checked_at": NOW, "purpose": "generate", "paths": ["src/a.py"],
        "content_kind": "code", "observation": drifted,
        "egress_decision": drift_decision, "broker_decision": broker_decision} if provider == "openai" else None
    audit_before_drift_read = catalog.audit().to_dict()
    drift = next(row for row in settings.providers("project-1", "env-1", now=NOW) if row["provider_id"] == "openai")
    assert drift["status"] == "UNAVAILABLE" and drift["reason"] == "EGRESS_DRIFT"
    assert catalog.audit().to_dict() == audit_before_drift_read
    forged_data = {**drift_decision.to_dict(), "decision": "ALLOW"}
    forged_allow = Snapshot("DECISION", drift_decision.record_id, digest(forged_data), canonical(forged_data))
    settings._host_route_observer = lambda provider, now: {"model_snapshot_hash": model["content_hash"],
        "connection_checked_at": NOW, "purpose": "generate", "paths": ["src/a.py"],
        "content_kind": "code", "observation": drifted,
        "egress_decision": forged_allow, "broker_decision": broker_decision} if provider == "openai" else None
    forged_drift = next(row for row in settings.providers("project-1", "env-1", now=NOW) if row["provider_id"] == "openai")
    assert forged_drift["enabled"] is False and forged_drift["reason"] == "OWNER_EVIDENCE_INVALID"
    assert catalog.audit().to_dict() == audit_before_drift_read
    catalog.revoke_secret(catalog.secret_reference("secret-openai"), now=int(NOW.timestamp()))
    blocked = next(row for row in settings.providers("project-1", "env-1") if row["provider_id"] == "openai")
    assert blocked["reason"] == "SECRET_REVOKED" and blocked["enabled"] is False
    assert settings.routing("project-1", "env-1")["roles"]["developer"] == {"enabled": False, "reason": "SECRET_REVOKED"}


def test_route_validation_and_activation_use_d11_candidate_and_host_capture():
    registry, context, _, _, _, prompt, model, bench, candidate = fixture.ready(d11)
    catalog = ProviderCatalog(project_id="project-1", environment_id="env-1", broker_policy_hash=HASH)
    authorizations = []
    def authorize(**request):
        authorizations.append(request)
        return registry.capture_activation(context, request["target"], mode="HUMAN",
            evidence_ref="host-human-event", expected_version=request["expected_version"],
            now=request["now"], expires_at=request["now"] + timedelta(minutes=20))
    settings = ProviderSettingsService(catalog, registry, context, DiscoveryRouter(registry, context),
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_activation_authorizer=authorize)
    routing_data = fixture.route_data(prompt, model, bench)
    validated = settings.validate_routing("project-1", "env-1", routing_data=routing_data,
        expected_version=0, target_hash=_hash(registry.query(context, now=NOW)), actor_id="operator", reason="validate")
    assert validated["content_hash"] == candidate["content_hash"]
    activated = settings.activate("project-1", "env-1", target=fixture.reference(candidate),
        expected_version=0, target_hash=candidate["content_hash"], reason="enable", actor_id="operator")
    assert activated["version"] == 1 and activated["applies_from"] == "NEXT_RUN_ONLY"
    assert set(activated) == {"version", "activation_hash", "applies_from", "approval_mode"}
    assert authorizations[0]["actor_id"] == "operator"
    with pytest.raises(d11.ModelRegistryError, match="ROUTING_VERSION_CONFLICT"):
        settings.activate("project-1", "env-1", target=fixture.reference(candidate),
            expected_version=0, target_hash=candidate["content_hash"], reason="stale", actor_id="operator")


def test_host_configure_refresh_rotate_and_revoke_stay_f01_d11_owned():
    catalog, registry, context, router = owners()
    operations = {
        "configure": lambda **_: {"secret_ref_id": "secret-openai", "purpose": "generate",
            "expires_at": int((NOW + timedelta(hours=2)).timestamp())},
        "refresh_models": lambda **_: fixture.model_data(),
        "rotate_secret": lambda **_: {"expires_at": int((NOW + timedelta(hours=3)).timestamp())},
        "revoke_secret": lambda **_: {"authorized": True},
    }
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW, host_operations=operations)
    configured = settings.configure("project-1", "env-1", "openai", expected_version=1,
        target_hash=catalog.catalog().content_hash, actor_id="operator", reason="configure")
    assert configured["credential"]["reference_id"] == "secret-openai"
    with pytest.raises(ValueError, match="SECRET_ALREADY_CONFIGURED"):
        settings.configure("project-1", "env-1", "openai", expected_version=1,
            target_hash=catalog.catalog().content_hash, actor_id="operator", reason="replace")
    refreshed = settings.refresh_models("project-1", "env-1", "openai", expected_version=0,
        target_hash=_hash(registry.query(context, now=NOW)), actor_id="operator", reason="refresh")
    assert refreshed["model_id"] == "model-a"
    current = catalog.secret_reference("secret-openai")
    rotated = settings.rotate_secret("project-1", "env-1", "secret-openai", expected_version=1,
        target_hash=current.content_hash, actor_id="operator", reason="rotate")
    assert rotated["version"] == 2
    latest = catalog.secret_reference("secret-openai")
    revoked = settings.revoke_secret("project-1", "env-1", "secret-openai", expected_version=2,
        target_hash=latest.content_hash, actor_id="operator", reason="revoke")
    assert revoked == {"reference_id": "secret-openai", "version": 2, "status": "REVOKED", "masked": True}
    assert "broker_policy_hash" not in json.dumps(revoked)


def test_egress_revision_uses_owner_cas_for_initial_and_replacement_and_reads_new_selection():
    catalog, registry, context, router = owners()
    initial = catalog.profile_selection()
    first_profile = catalog.register_profile("profile-1", profile_data(), human_approval_id="host-human-event")
    evidence = {"profile": first_profile, "approved_profile_hash": first_profile.content_hash,
        "human_approval_id": "host-human-event"}
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_operations={"revise_egress": lambda **_: dict(evidence)})
    result = settings.revise_egress("project-1", "env-1", expected_version=0,
        target_hash=initial.content_hash, actor_id="operator", reason="approve profile")
    assert result["mode"] == "approved_paths" and result["applies_from"] == "NEXT_RUN_ONLY"
    assert result["approved_path_count"] == 1
    assert result["version"] == 1 and result["selection_hash"] == catalog.profile_selection().content_hash
    old_profile = catalog.current_profile()[1]
    pin = catalog.pin_run("existing-run", old_profile)
    next_profile = catalog.register_profile("profile-2", profile_data(approved_paths=["src/**", "docs/**"]),
        human_approval_id="host-approval-2")
    evidence.update(profile=next_profile, approved_profile_hash=next_profile.content_hash,
        human_approval_id="host-approval-2")
    second = settings.revise_egress("project-1", "env-1", expected_version=1,
        target_hash=result["selection_hash"], actor_id="operator", reason="expand approved paths")
    assert second["version"] == 2 and second["approved_path_count"] == 2
    another = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW)
    assert another.egress("project-1", "env-1")["profile_hash"] == second["profile_hash"]
    assert settings.egress("project-1", "env-1")["profile_hash"] == second["profile_hash"]
    assert catalog.pin_run("existing-run", old_profile) == pin
    with pytest.raises(ValueError, match="EGRESS_VERSION_CONFLICT"):
        settings.revise_egress("project-1", "env-1", expected_version=0,
            target_hash=initial.content_hash, actor_id="operator", reason="stale")


def test_egress_revision_rejects_unbound_host_evidence_without_selection_change():
    catalog, registry, context, router = owners()
    initial = catalog.profile_selection()
    profile = catalog.register_profile("profile-1", profile_data(), human_approval_id="host-human-event")
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", clock=lambda: NOW,
        host_operations={"revise_egress": lambda **_: {"profile": profile, "human_approval_id": "host-human-event",
            "approved_profile_hash": HASH}})
    with pytest.raises(ValueError, match="PROFILE_APPROVAL_MISMATCH"):
        settings.revise_egress("project-1", "env-1", expected_version=0,
            target_hash=initial.content_hash, actor_id="operator", reason="approve profile")
    assert catalog.current_profile() == (initial, None)


def test_routing_requires_exact_verified_model_hash_for_each_role():
    view = {"version": 1, "active": {"content_hash": "activation", "routing": {"routes": [
        {"role": "developer", "model": {"content_hash": "model-b"}},
        {"role": "reviewer", "model": {"content_hash": "model-a"}}]}},
        "models": {"model-a": {"data": {"provider": "openai"}},
                   "model-b": {"data": {"provider": "openai"}}}, "quarantine": []}
    rows = [{"provider_id": "openai", "enabled": True, "reason": "HOST_VERIFIED_READY",
             "eligible_model_snapshot_hash": "model-a"}]
    roles = projection.routing(view, rows)["roles"]
    assert roles["reviewer"] == {"enabled": True, "reason": "NEXT_RUN_ONLY"}
    assert roles["developer"] == {"enabled": False, "reason": "MODEL_ROUTE_EVIDENCE_MISMATCH"}


def test_foreign_or_forged_profile_is_rejected_without_owner_audit_write():
    catalog, registry, context, router = owners()
    foreign = ProviderCatalog(project_id="project-1", environment_id="env-1", broker_policy_hash=HASH)
    profile = foreign.register_profile("profile-1", profile_data(), human_approval_id="host-human-event")
    with pytest.raises(ValueError, match="PROFILE_OWNER_MISMATCH"):
        ProviderSettingsService(catalog, registry, context, router,
            project_id="project-1", environment_id="env-1", profile=profile, clock=lambda: NOW)
    owned = catalog.register_profile("profile-1", profile_data(), human_approval_id="host-human-event")
    initial = catalog.profile_selection()
    catalog.select_profile(owned, expected_version=0, expected_selection_hash=initial.content_hash,
        approved_profile_hash=owned.content_hash, human_approval_id="host-human-event")
    settings = ProviderSettingsService(catalog, registry, context, router,
        project_id="project-1", environment_id="env-1", profile=owned, clock=lambda: NOW)
    before = catalog.audit().to_dict()
    assert settings.egress("project-1", "env-1")["profile_hash"] == owned.content_hash
    assert catalog.audit().to_dict() == before
    with pytest.raises(ValueError, match="PROFILE_OWNER_MISMATCH"):
        ProviderSettingsService(catalog, registry, context, router,
            project_id="project-1", environment_id="env-1",
            profile=Snapshot("PROFILE", "profile-1", owned.content_hash, "{}"), clock=lambda: NOW)
    assert catalog.audit().to_dict() == before


def test_foreign_catalog_scope_is_rejected_even_before_any_profile_is_selected():
    _, registry, context, router = owners()
    foreign = ProviderCatalog(project_id="another-project", environment_id="env-1", broker_policy_hash=HASH)
    with pytest.raises(ValueError, match="OWNER_SCOPE_MISMATCH"):
        ProviderSettingsService(foreign, registry, context, router,
            project_id="project-1", environment_id="env-1", clock=lambda: NOW)
