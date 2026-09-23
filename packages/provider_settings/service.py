"""F-12 read and command facade over F01, D11 and F02 owner APIs."""

from datetime import datetime, timezone, timedelta

from packages.knowledge.memory import to_primitive, _hash
from packages.knowledge.model_registry import ModelRegistry, ModelRegistryError
from packages.model_registry.service import DiscoveryRouter
from packages.provider_catalog.models import CatalogRejected, PROVIDER_IDS, Snapshot, digest
from packages.provider_catalog.service import ProviderCatalog

from . import projection


class SettingsUnavailable(ValueError):
    pass


def _matches_hash(owner_hash, request_hash):
    return request_hash in {owner_hash, "sha256:" + owner_hash}


class ProviderSettingsService:
    def __init__(self, catalog, registry, context, router, *, project_id, environment_id,
                 secret_ref_ids=None, profile=None, clock=None, host_activation_authorizer=None,
                 host_route_observer=None, host_operations=None):
        if type(catalog) is not ProviderCatalog or type(registry) is not ModelRegistry or type(router) is not DiscoveryRouter:
            raise SettingsUnavailable("TRUSTED_OWNER_REQUIRED")
        if type(project_id) is not str or not project_id or type(environment_id) is not str or not environment_id:
            raise SettingsUnavailable("OWNER_SCOPE_REQUIRED")
        if catalog.owner_scope().to_dict() != {"project_id": project_id, "environment_id": environment_id}:
            raise SettingsUnavailable("OWNER_SCOPE_MISMATCH")
        if profile is not None and type(profile) is not Snapshot:
            raise SettingsUnavailable("HOST_PROFILE_REQUIRED")
        if not callable(clock or datetime.now):
            raise SettingsUnavailable("HOST_CLOCK_REQUIRED")
        if host_activation_authorizer is not None and not callable(host_activation_authorizer):
            raise SettingsUnavailable("HOST_ACTIVATION_EVIDENCE_REQUIRED")
        if host_route_observer is not None and not callable(host_route_observer):
            raise SettingsUnavailable("HOST_ROUTE_OBSERVER_REQUIRED")
        self._catalog, self._registry, self._context, self._router = catalog, registry, context, router
        self._project, self._environment = project_id, environment_id
        self._secret_ids = dict(secret_ref_ids or {})
        if any(key not in PROVIDER_IDS or type(value) is not str for key, value in self._secret_ids.items()):
            raise SettingsUnavailable("SECRET_REFERENCE_INVALID")
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._host_activation_authorizer = host_activation_authorizer
        self._host_route_observer = host_route_observer
        self._host_operations = dict(host_operations or {})
        if any(not callable(fn) for fn in self._host_operations.values()):
            raise SettingsUnavailable("HOST_OPERATION_INVALID")
        if profile is not None:
            self._verified_profile(profile)

    def _verified_profile(self, profile):
        try:
            self._catalog.validate_profile(profile)
            selected = self._catalog.current_profile()[1]
            data = profile.to_dict()
            if (selected == profile and data["project_id"] == self._project
                    and data["environment_id"] == self._environment):
                return
        except (KeyError, ValueError, TypeError, CatalogRejected):
            pass
        raise SettingsUnavailable("PROFILE_OWNER_MISMATCH")

    def _owner_decision(self, handle, kind, expected_request):
        try:
            exact = self._catalog.validate_decision(handle, kind)
            data = exact.to_dict()
            if data.get("request_hash") != digest(expected_request):
                return None
            return data
        except (KeyError, ValueError, TypeError, CatalogRejected):
            return None

    def _host_operation(self, name, **request):
        operation = self._host_operations.get(name)
        if operation is None:
            raise SettingsUnavailable("HOST_EVIDENCE_REQUIRED")
        return operation(**request)

    def _command(self, project_id, environment_id, *, actor_id, reason):
        self._scope(project_id, environment_id)
        if type(actor_id) is not str or not actor_id or type(reason) is not str or not reason:
            raise SettingsUnavailable("COMMAND_CONTEXT_INVALID")

    def configure(self, project_id, environment_id, provider_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        if provider_id not in PROVIDER_IDS or expected_version != 1 or target_hash != self._catalog.catalog().content_hash:
            raise SettingsUnavailable("CATALOG_VERSION_CONFLICT")
        if provider_id in self._secret_ids:
            raise SettingsUnavailable("SECRET_ALREADY_CONFIGURED")
        evidence = self._host_operation("configure", project_id=project_id, environment_id=environment_id,
            provider_id=provider_id, actor_id=actor_id, reason=reason)
        if type(evidence) is not dict or set(evidence) != {"secret_ref_id", "purpose", "expires_at"}:
            raise SettingsUnavailable("HOST_EVIDENCE_INVALID")
        result = self._catalog.register_secret(evidence["secret_ref_id"], provider_id=provider_id,
            purpose=evidence["purpose"], expires_at=evidence["expires_at"], now=int(self._now(None).timestamp()))
        self._secret_ids[provider_id] = evidence["secret_ref_id"]
        return {"provider_id": provider_id, "credential": projection.public_secret(result.to_dict()),
                "status": "REFERENCE_REGISTERED_CONNECTION_NOT_VERIFIED"}

    def refresh_models(self, project_id, environment_id, provider_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        if provider_id not in PROVIDER_IDS:
            raise SettingsUnavailable("PROVIDER_ID_INVALID")
        instant = self._now(None)
        view = to_primitive(self._registry.query(self._context, now=instant))
        if expected_version != view["version"] or not _matches_hash(_hash(view), target_hash):
            raise SettingsUnavailable("ROUTING_VERSION_CONFLICT")
        evidence = self._host_operation("refresh_models", project_id=project_id, environment_id=environment_id,
            provider_id=provider_id, actor_id=actor_id, reason=reason, now=instant)
        if type(evidence) is not dict or evidence.get("provider") != provider_id:
            raise SettingsUnavailable("HOST_EVIDENCE_INVALID")
        discovered = self._router.discover(evidence, now=instant).to_dict()
        return projection.public_model({**discovered, "availability_reason": "HOST_OBSERVATION_ONLY"})

    def test_connection(self, project_id, environment_id, provider_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        if self._host_route_observer is None or provider_id not in PROVIDER_IDS:
            raise SettingsUnavailable("HOST_EVIDENCE_REQUIRED")
        view = to_primitive(self._registry.query(self._context, now=self._now(None)))
        if expected_version != view["version"] or not _matches_hash(_hash(view), target_hash):
            raise SettingsUnavailable("ROUTING_VERSION_CONFLICT")
        row = next(row for row in self.providers(project_id, environment_id) if row["provider_id"] == provider_id)
        return {"provider_id": provider_id, "status": row["status"], "reason": row["reason"],
                "route_eligible": row["enabled"]}

    def validate_routing(self, project_id, environment_id, *, routing_data, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        instant = self._now(None)
        view = to_primitive(self._registry.query(self._context, now=instant))
        if expected_version != view["version"] or not _matches_hash(_hash(view), target_hash):
            raise SettingsUnavailable("ROUTING_VERSION_CONFLICT")
        if type(routing_data) is not dict:
            raise SettingsUnavailable("ROUTING_COMMAND_INVALID")
        candidate = to_primitive(self._registry.create_routing(self._context, routing_data, now=instant))
        return {key: candidate[key] for key in ("id", "version", "content_hash", "baseline_version")}

    def rotate_secret(self, project_id, environment_id, reference_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        if reference_id not in self._secret_ids.values():
            raise SettingsUnavailable("SECRET_SCOPE_MISMATCH")
        current = self._catalog.secret_reference(reference_id)
        if current.to_dict()["version"] != expected_version or current.content_hash != target_hash:
            raise SettingsUnavailable("SECRET_VERSION_CONFLICT")
        evidence = self._host_operation("rotate_secret", project_id=project_id, environment_id=environment_id,
            reference_id=reference_id, actor_id=actor_id, reason=reason)
        if type(evidence) is not dict or set(evidence) != {"expires_at"}:
            raise SettingsUnavailable("HOST_EVIDENCE_INVALID")
        result = self._catalog.rotate_secret(current, expires_at=evidence["expires_at"], now=int(self._now(None).timestamp()))
        return projection.public_secret(result.to_dict())

    def revoke_secret(self, project_id, environment_id, reference_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        if reference_id not in self._secret_ids.values():
            raise SettingsUnavailable("SECRET_SCOPE_MISMATCH")
        current = self._catalog.secret_reference(reference_id)
        if current.to_dict()["version"] != expected_version or current.content_hash != target_hash:
            raise SettingsUnavailable("SECRET_VERSION_CONFLICT")
        evidence = self._host_operation("revoke_secret", project_id=project_id, environment_id=environment_id,
            reference_id=reference_id, actor_id=actor_id, reason=reason)
        if evidence != {"authorized": True}:
            raise SettingsUnavailable("HOST_EVIDENCE_INVALID")
        revoked = self._catalog.revoke_secret(current, now=int(self._now(None).timestamp())).to_dict()
        return projection.public_secret({**current.to_dict(), "status": revoked["status"]})

    def _scope(self, project_id, environment_id):
        if (project_id, environment_id) != (self._project, self._environment):
            raise SettingsUnavailable("AUTHORIZATION_SCOPE_MISMATCH")

    def _now(self, now):
        instant = self._clock() if now is None else now
        if type(instant) is not datetime or instant.tzinfo is None:
            raise SettingsUnavailable("HOST_CLOCK_REQUIRED")
        return instant

    def providers(self, project_id, environment_id, *, now=None):
        self._scope(project_id, environment_id)
        instant = self._now(now)
        _, profile = self._catalog.current_profile()
        base = self._catalog.catalog().to_dict()
        if [row["provider_id"] for row in base["providers"]] != list(PROVIDER_IDS):
            raise SettingsUnavailable("CATALOG_ORDER_MISMATCH")
        discovered = self._router.catalog(now=instant).to_dict()
        secrets = {}
        for provider, reference_id in self._secret_ids.items():
            record = self._catalog.secret_reference(reference_id).to_dict()
            if (record["project_id"], record["environment_id"], record["provider_id"]) != (self._project, self._environment, provider):
                raise SettingsUnavailable("SECRET_SCOPE_MISMATCH")
            if record["status"] == "ACTIVE" and instant.timestamp() >= record["expires_at"]:
                record = {**record, "status": "EXPIRED"}
            secrets[provider] = record
        evidence = {}
        if self._host_route_observer is not None and profile is not None:
            view = to_primitive(self._registry.query(self._context, now=instant))
            active = view.get("active")
            quarantined = active and any(item.get("activation_hash") == active["content_hash"] for item in view.get("quarantine", []))
            approved_models = {route["model"]["content_hash"] for route in active["routing"]["routes"]} if active and not quarantined else set()
            for provider, record in secrets.items():
                if record["status"] != "ACTIVE":
                    continue
                observed = self._host_route_observer(provider, instant)
                if observed is None:
                    continue
                if type(observed) is not dict or set(observed) != {"model_snapshot_hash", "connection_checked_at", "purpose", "paths", "content_kind", "observation", "egress_decision", "broker_decision"}:
                    evidence[provider] = ("UNAVAILABLE", "HOST_OBSERVATION_INVALID")
                    continue
                checked = observed["connection_checked_at"]
                if type(checked) is not datetime or checked.tzinfo is None or not checked <= instant < checked + timedelta(seconds=60):
                    evidence[provider] = ("UNAVAILABLE", "HOST_OBSERVATION_STALE")
                    continue
                if observed["model_snapshot_hash"] not in approved_models:
                    evidence[provider] = ("UNAVAILABLE", "BLOCKED_CAPABILITY_DRIFT")
                    continue
                models = discovered["models"]
                if not any(model["content_hash"] == observed["model_snapshot_hash"] and
                           model["data"]["provider"] == provider and
                           model["availability_reason"] == "HOST_OBSERVATION_ONLY" for model in models):
                    evidence[provider] = ("UNAVAILABLE", "BLOCKED_CAPABILITY_DRIFT")
                    continue
                secret_ref = self._catalog.secret_reference(self._secret_ids[provider])
                egress_request = dict(profile_hash=profile.content_hash, provider_id=provider,
                    purpose=observed["purpose"], mask=None, payload_hash=None,
                    paths=observed["paths"], content_kind=observed["content_kind"], observation=observed["observation"])
                broker_request = dict(reference_hash=secret_ref.content_hash, provider_id=provider,
                    purpose=observed["purpose"], now=int(checked.timestamp()), operation="injection")
                decision = self._owner_decision(observed["egress_decision"], "EGRESS_DECISION", egress_request)
                broker = self._owner_decision(observed["broker_decision"], "BROKER_DECISION", broker_request)
                if decision is None or broker is None:
                    evidence[provider] = ("UNAVAILABLE", "OWNER_EVIDENCE_INVALID")
                elif decision["decision"] == "ALLOW" and broker["decision"] == "ALLOW":
                    evidence[provider] = ("AVAILABLE", "HOST_VERIFIED_READY", observed["model_snapshot_hash"])
                else:
                    evidence[provider] = ("UNAVAILABLE", decision["reason"] if decision["decision"] != "ALLOW" else broker["reason"])
        return projection.providers(base, discovered, secrets, evidence)

    def routing(self, project_id, environment_id, *, now=None):
        self._scope(project_id, environment_id)
        instant = self._now(now)
        view = to_primitive(self._registry.query(self._context, now=instant))
        return projection.routing(view, self.providers(project_id, environment_id, now=instant))

    def egress(self, project_id, environment_id):
        self._scope(project_id, environment_id)
        selection, profile = self._catalog.current_profile()
        return projection.egress(profile, selection)

    def revise_egress(self, project_id, environment_id, *, expected_version, target_hash, actor_id, reason):
        self._command(project_id, environment_id, actor_id=actor_id, reason=reason)
        selection = self._catalog.profile_selection()
        if expected_version != selection.to_dict()["version"] or target_hash != selection.content_hash:
            raise SettingsUnavailable("EGRESS_VERSION_CONFLICT")
        evidence = self._host_operation("revise_egress", project_id=project_id, environment_id=environment_id,
            actor_id=actor_id, reason=reason)
        if type(evidence) is not dict or set(evidence) != {"profile", "approved_profile_hash", "human_approval_id"}:
            raise SettingsUnavailable("HOST_EVIDENCE_INVALID")
        profile = evidence["profile"]
        updated = self._catalog.select_profile(profile, expected_version=expected_version,
            expected_selection_hash=target_hash, approved_profile_hash=evidence["approved_profile_hash"],
            human_approval_id=evidence["human_approval_id"])
        return projection.egress(profile, updated)

    def activate(self, project_id, environment_id, *, target, capture_id=None,
                 expected_version, target_hash, reason, actor_id, now=None):
        self._scope(project_id, environment_id)
        # The browser never selects a host capture or claims HUMAN/MAIN_POLICY proof.
        if capture_id is not None or self._host_activation_authorizer is None:
            raise SettingsUnavailable("HOST_ACTIVATION_EVIDENCE_REQUIRED")
        if type(target) is not dict or set(target) != {"id", "version", "content_hash"} or not _matches_hash(target["content_hash"], target_hash):
            raise SettingsUnavailable("ROUTING_TARGET_MISMATCH")
        if type(expected_version) is not int or expected_version < 0 or not reason or not actor_id:
            raise SettingsUnavailable("ROUTING_COMMAND_INVALID")
        instant = self._now(now)
        capture = self._host_activation_authorizer(project_id=project_id, environment_id=environment_id,
            actor_id=actor_id, target=dict(target), expected_version=expected_version, reason=reason, now=instant)
        if type(capture) is not str or not capture:
            raise SettingsUnavailable("HOST_ACTIVATION_EVIDENCE_REQUIRED")
        activated = to_primitive(self._registry.activate(self._context, target, capture,
            expected_version=expected_version, now=instant))
        return {"version": activated["version"], "activation_hash": activated["content_hash"],
                "applies_from": activated["applies_from"], "approval_mode": activated["approval_mode"]}
