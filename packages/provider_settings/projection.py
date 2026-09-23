"""F-12 public projections. Only named fields cross the browser boundary."""

from packages.knowledge.model_registry import ROLES
from packages.provider_catalog.models import PROVIDER_IDS


_NEXT = {
    "CREDENTIAL_NOT_REGISTERED": "REGISTER_CREDENTIAL_REFERENCE",
    "SECRET_REVOKED": "ROTATE_CREDENTIAL_WITH_HOST_APPROVAL",
    "SECRET_EXPIRED": "ROTATE_CREDENTIAL_WITH_HOST_APPROVAL",
    "MODEL_NOT_DISCOVERED": "RUN_HOST_MODEL_PROBE_AND_BENCHMARK",
    "BLOCKED_CAPABILITY_DRIFT": "REPROBE_BENCHMARK_AND_REAPPROVE",
    "LIVE_CONNECTION_NOT_VERIFIED": "RUN_HOST_CONNECTION_TEST",
}


def public_secret(record):
    return {"reference_id": record["secret_ref_id"], "version": record["version"],
            "status": record["status"], "masked": True}


def public_model(record):
    data = record["data"]
    return {"model_id": data["model_id"], "model_revision": data["model_revision"],
            "snapshot_hash": record["content_hash"], "capabilities": list(data["capabilities"]),
            "context_tokens": data["context_tokens"], "privacy_class": data["privacy_class"],
            "probe_revision": data["probe"]["revision"],
            "benchmark_revision": data["benchmark_revision"],
            "availability_reason": record["availability_reason"]}


def providers(catalog, discovery, secrets, route_evidence=None):
    route_evidence = route_evidence or {}
    by_provider = {provider: [] for provider in PROVIDER_IDS}
    for model in discovery["models"]:
        provider = model["data"]["provider"]
        if provider in by_provider:
            by_provider[provider].append(public_model(model))
    rows = []
    for index, provider in enumerate(PROVIDER_IDS, 1):
        credential = public_secret(secrets[provider]) if provider in secrets else None
        models = by_provider[provider]
        if credential is not None and credential["status"] in {"REVOKED", "EXPIRED"}:
            status, reason = "DISABLED", "SECRET_" + credential["status"]
        elif any(model["availability_reason"] != "HOST_OBSERVATION_ONLY" for model in models):
            status, reason = "UNAVAILABLE", "BLOCKED_CAPABILITY_DRIFT"
        elif credential is None:
            status, reason = "NOT_CONFIGURED", "CREDENTIAL_NOT_REGISTERED"
        elif not models:
            status, reason = "UNAVAILABLE", "MODEL_NOT_DISCOVERED"
        else:
            # F02's host fixture has no live transport, egress or benchmark assertion.
            status, reason = "DEGRADED", "LIVE_CONNECTION_NOT_VERIFIED"
        eligible_hash = None
        if status not in {"NOT_CONFIGURED", "DISABLED", "UNAVAILABLE"} and provider in route_evidence:
            observed_status, observed_reason, *observed_hash = route_evidence[provider]
            status, reason = observed_status, observed_reason
            if status == "AVAILABLE" and observed_hash:
                eligible_hash = observed_hash[0]
        rows.append({"provider_id": provider, "display_name": provider.upper(),
                     "sort_order": index, "provider_type": "local" if provider == "ollama" else "cloud",
                     "status": status, "enabled": status == "AVAILABLE", "reason": reason,
                     "next_action": _NEXT.get(reason, "REVIEW_HOST_EVIDENCE"), "credential": credential,
                     "model_count": len(models), "models": models,
                     "eligible_model_snapshot_hash": eligible_hash})
    return rows


def routing(view, provider_rows):
    active = view.get("active")
    roles = {role: {"enabled": False, "reason": "ROUTING_NOT_ACTIVE"} for role in ROLES}
    roles["main"] = {"enabled": False, "reason": "ROLE_NOT_SUPPORTED_BY_D11"}
    roles["tester"] = {"enabled": False, "reason": "ROLE_NOT_SUPPORTED_BY_D11"}
    if active:
        blocked = any(item.get("activation_hash") == active["content_hash"] for item in view.get("quarantine", []))
        by_provider = {row["provider_id"]: row for row in provider_rows}
        for route in active["routing"]["routes"]:
            role = route["role"]
            if role in ROLES:
                model = view["models"].get(route["model"]["content_hash"])
                provider = model["data"]["provider"] if model else None
                status = by_provider.get(provider)
                exact = bool(status and status.get("eligible_model_snapshot_hash") == route["model"]["content_hash"])
                enabled = bool(status and status["enabled"] and exact and not blocked)
                reason = "BLOCKED_CAPABILITY_DRIFT" if blocked else "NEXT_RUN_ONLY" if enabled else "MODEL_ROUTE_EVIDENCE_MISMATCH" if status and status["enabled"] and not exact else status["reason"] if status else "OWNER_EVIDENCE_INVALID"
                roles[role] = {"enabled": enabled, "reason": reason}
    return {"version": view["version"], "activation_hash": active["content_hash"] if active else None,
            "applies_from": "NEXT_RUN_ONLY" if active else None,
            "provider_ids": [row["provider_id"] for row in provider_rows], "roles": roles}


def egress(profile, selection):
    state = {"version": selection.to_dict()["version"], "selection_hash": selection.content_hash}
    if profile is None:
        return {**state, "status": "NOT_CONFIGURED", "reason": "HOST_APPROVED_PROFILE_REQUIRED"}
    data = profile.to_dict()
    policy = data["profile"]
    return {**state, "status": "HOST_APPROVED_REFERENCE_ONLY", "mode": policy["mode"],
            "provider_allowlist": list(policy["provider_allowlist"]),
            "approved_path_count": len(policy["approved_paths"]),
            "excluded_path_count": len(policy["excluded_paths"]),
            "profile_hash": profile.content_hash, "applies_from": "NEXT_RUN_ONLY"}
